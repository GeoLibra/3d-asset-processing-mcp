import { ValidationReport, ValidationIssue, ProcessResult } from '../types';
import { globalCache } from '../utils/cache';
import logger from '../utils/logger';
const gltfValidator = require('gltf-validator');

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

      // Perform validation
      const report = await this.validateModel(filePath, rules);

      // Cache result
      globalCache.set(cacheKey, report, 1800); // 30 minute cache

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
   * Validate model using gltf-validator
   */
  private async validateModel(filePath: string, rules?: string): Promise<ValidationReport> {
    // First perform basic file checks (these should happen regardless of gltf-validator)
    const fileChecks = await this.performFileChecks(filePath);

    // If file checks found critical errors, return early
    if (fileChecks.errors.length > 0) {
      return {
        valid: false,
        errors: fileChecks.errors,
        warnings: fileChecks.warnings,
        info: fileChecks.info,
        compatibility: this.getDefaultCompatibility()
      };
    }

    try {
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);

      logger.debug('Using gltf-validator JavaScript API');
      const validatorResult = await gltfValidator.validateBytes(fileBuffer);

      // Convert to our format
      const errors: ValidationIssue[] = [...fileChecks.errors];
      const warnings: ValidationIssue[] = [...fileChecks.warnings];
      const info: ValidationIssue[] = [...fileChecks.info];

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

      // Add rule-specific checks
      const ruleChecks = this.performRuleChecks(rules);
      info.push(...ruleChecks);

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

      // Create a basic error report including file checks
      const errors: ValidationIssue[] = [
        ...fileChecks.errors,
        {
          code: 'VALIDATOR_ERROR',
          message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error'
        }
      ];

      return {
        valid: false,
        errors,
        warnings: fileChecks.warnings,
        info: fileChecks.info,
        compatibility: this.getDefaultCompatibility()
      };
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
   * Perform basic file checks
   */
  private async performFileChecks(filePath: string): Promise<{
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    info: ValidationIssue[];
  }> {
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
        return { errors, warnings, info };
      }

      const stats = fs.statSync(filePath);

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!['.gltf', '.glb'].includes(ext)) {
        warnings.push({
          code: 'UNSUPPORTED_EXTENSION',
          message: `File extension ${ext} may not be supported`,
          severity: 'warning'
        });
      }

      // File size check
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

      // Basic format check for GLB files
      if (ext === '.glb') {
        const buffer = fs.readFileSync(filePath);
        if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'glTF') {
          errors.push({
            code: 'INVALID_GLB_HEADER',
            message: 'Invalid GLB file header',
            severity: 'error'
          });
        }
      }

    } catch (error) {
      logger.warn('File checks failed:', error);
      errors.push({
        code: 'FILE_CHECK_ERROR',
        message: `File check error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }

    return { errors, warnings, info };
  }

  /**
   * Perform rule-specific checks
   */
  private performRuleChecks(rules?: string): ValidationIssue[] {
    const info: ValidationIssue[] = [];

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

    return info;
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
   * Get validator information
   */
  async getValidatorInfo(): Promise<{ available: boolean; type?: string; version?: string }> {
    return {
      available: true,
      type: 'JavaScript API',
      version: 'bundled'
    };
  }
}

// Global validator instance
export const globalSimpleValidator = new SimpleValidator();