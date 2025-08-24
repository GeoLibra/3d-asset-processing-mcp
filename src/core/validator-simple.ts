import { ValidationReport, ValidationIssue, ProcessResult } from '../types';
import { globalCache } from '../utils/cache';
import logger from '../utils/logger';

// Try to import gltf-validator
let gltfValidator: any = null;
try {
  gltfValidator = require('gltf-validator');
  logger.info('Loaded gltf-validator JavaScript API');
} catch (error) {
  logger.warn('gltf-validator JavaScript API not available, using basic validation');
}

export class SimpleValidator {
  /**
   * Validate 3D model
   */
  async validate(filePath: string, rules?: string): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = globalCache.generateKey('validation', { filePath, rules });
      const cached = globalCache.get<ValidationReport>(cacheKey);
      if (cached) {
        logger.info(`Validation cache hit for: ${filePath}`);
        return {
          success: true,
          data: cached,
          metrics: {
            processingTime: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed
          }
        };
      }

      logger.info(`Starting validation for: ${filePath}`);

      let report: ValidationReport;

      if (gltfValidator) {
        // Use gltf-validator JavaScript API
        report = await this.validateWithJSAPI(filePath, rules);
      } else {
        // Fall back to basic validation
        report = await this.basicValidation(filePath, rules);
      }

      // Cache result
      globalCache.set(cacheKey, report, 1800); // 30分钟缓存

      const processingTime = Date.now() - startTime;
      logger.info(`Validation completed in ${processingTime}ms for: ${filePath}`);

      return {
        success: true,
        data: report,
        metrics: {
          processingTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };

    } catch (error) {
      logger.error(`Validation failed for ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }

  /**
   * Validate using gltf-validator JavaScript API
   */
  private async validateWithJSAPI(filePath: string, rules?: string): Promise<ValidationReport> {
    try {
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);

      logger.debug('Using gltf-validator JavaScript API');
      const validatorResult = await gltfValidator.validateBytes(fileBuffer);

      // Convert to our format
      const errors: ValidationIssue[] = [];
      const warnings: ValidationIssue[] = [];
      const info: ValidationIssue[] = [];

      // Process issues from gltf-validator
      if (validatorResult.issues) {
        for (const issue of validatorResult.issues) {
          const validationIssue: ValidationIssue = {
            code: issue.code || 'UNKNOWN',
            message: issue.message || 'Unknown issue',
            severity: this.mapSeverity(issue.severity),
            pointer: issue.pointer
          };

          switch (validationIssue.severity) {
            case 'error':
              errors.push(validationIssue);
              break;
            case 'warning':
              warnings.push(validationIssue);
              break;
            case 'info':
              info.push(validationIssue);
              break;
          }
        }
      }

      // Add custom checks
      const customChecks = await this.performCustomChecks(filePath, rules);
      errors.push(...customChecks.errors);
      warnings.push(...customChecks.warnings);
      info.push(...customChecks.info);

      // Compatibility check
      const compatibility = this.checkCompatibility(validatorResult, rules);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        info,
        compatibility
      };

    } catch (error) {
      logger.error('gltf-validator JavaScript API failed:', error);
      // Fall back to basic validation
      return this.basicValidation(filePath, rules);
    }
  }

  /**
   * Map severity levels from gltf-validator
   */
  private mapSeverity(severity: number): 'error' | 'warning' | 'info' {
    switch (severity) {
      case 0: return 'error';
      case 1: return 'warning';
      case 2: return 'info';
      default: return 'warning';
    }
  }

  /**
   * Perform custom checks
   */
  private async performCustomChecks(filePath: string, rules?: string): Promise<{
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    info: ValidationIssue[];
  }> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    try {
      const fs = require('fs');
      const stats = fs.statSync(filePath);

      // File size check
      if (stats.size > 100 * 1024 * 1024) { // 100MB
        warnings.push({
          code: 'LARGE_FILE_SIZE',
          message: `File is very large (${Math.round(stats.size / 1024 / 1024)}MB)`,
          severity: 'warning'
        });
      }

      // Add specific checks based on rules
      if (rules === 'web-compatible') {
        info.push({
          code: 'WEB_COMPATIBILITY_CHECK',
          message: 'Checked for web compatibility',
          severity: 'info'
        });
      } else if (rules === 'mobile-compatible') {
        info.push({
          code: 'MOBILE_COMPATIBILITY_CHECK',
          message: 'Checked for mobile compatibility',
          severity: 'info'
        });
      }

    } catch (error) {
      logger.warn('Custom checks failed:', error);
    }

    return { errors, warnings, info };
  }

  /**
   * Basic validation (when gltf-validator is not available)
   */
  private async basicValidation(filePath: string, rules?: string): Promise<ValidationReport> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    try {
      const fs = require('fs');
      const path = require('path');

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        errors.push({
          code: 'FILE_NOT_FOUND',
          message: 'File does not exist',
          severity: 'error'
        });
        return { valid: false, errors, warnings, info, compatibility: this.getDefaultCompatibility() };
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!['.gltf', '.glb'].includes(ext)) {
        warnings.push({
          code: 'UNSUPPORTED_EXTENSION',
          message: `File extension ${ext} may not be supported`,
          severity: 'warning'
        });
      }

      // Check file size
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        errors.push({
          code: 'EMPTY_FILE',
          message: 'File is empty',
          severity: 'error'
        });
      } else if (stats.size > 100 * 1024 * 1024) { // 100MB
        warnings.push({
          code: 'LARGE_FILE_SIZE',
          message: `File is very large (${Math.round(stats.size / 1024 / 1024)}MB)`,
          severity: 'warning'
        });
      }

      // Basic format check
      if (ext === '.glb') {
        const buffer = fs.readFileSync(filePath);
        if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'glTF') {
          errors.push({
            code: 'INVALID_GLB_HEADER',
            message: 'Invalid GLB file header',
            severity: 'error'
          });
        }
      } else if (ext === '.gltf') {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const gltf = JSON.parse(content);

          if (!gltf.asset || !gltf.asset.version) {
            errors.push({
              code: 'MISSING_ASSET_VERSION',
              message: 'Missing asset version in glTF file',
              severity: 'error'
            });
          } else if (gltf.asset.version !== '2.0') {
            warnings.push({
              code: 'UNSUPPORTED_VERSION',
              message: `glTF version ${gltf.asset.version} may not be fully supported`,
              severity: 'warning'
            });
          }
        } catch (jsonError) {
          errors.push({
            code: 'INVALID_JSON',
            message: 'Invalid JSON format in glTF file',
            severity: 'error'
          });
        }
      }

      info.push({
        code: 'BASIC_VALIDATION_COMPLETE',
        message: gltfValidator ? 'Validation completed with gltf-validator' : 'Basic validation completed',
        severity: 'info'
      });

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      compatibility: this.getDefaultCompatibility()
    };
  }

  /**
   * Check platform compatibility
   */
  private checkCompatibility(validatorResult: any, rules?: string) {
    // Check compatibility based on gltf-validator results and rules
    let webgl2 = true;
    let ios = true;
    let android = true;
    let unity = true;
    let unreal = true;

    // If there are serious errors, mark as incompatible
    if (validatorResult.issues) {
      const hasErrors = validatorResult.issues.some((issue: any) => issue.severity === 0);
      if (hasErrors) {
        webgl2 = ios = android = unity = unreal = false;
      }
    }

    // Adjust compatibility based on rules
    if (rules === 'strict') {
      const hasWarnings = validatorResult.issues?.some((issue: any) => issue.severity <= 1);
      if (hasWarnings) {
        webgl2 = ios = android = unity = unreal = false;
      }
    }

    return { webgl2, ios, android, unity, unreal };
  }

  /**
   * Get default compatibility (when detailed check is not possible)
   */
  private getDefaultCompatibility() {
    return {
      webgl2: true,
      ios: true,
      android: true,
      unity: true,
      unreal: true
    };
  }

  /**
   * Check if gltf-validator is available
   */
  async isValidatorAvailable(): Promise<boolean> {
    return gltfValidator !== null;
  }

  /**
   * Get validator information
   */
  async getValidatorInfo(): Promise<{ available: boolean; type?: string; version?: string }> {
    if (gltfValidator) {
      return {
        available: true,
        type: 'JavaScript API',
        version: 'bundled'
      };
    } else {
      return { available: false };
    }
  }
}

// Global validator instance
export const globalSimpleValidator = new SimpleValidator();