import { NodeIO, Document } from '@gltf-transform/core';
import {
  dedup,
  prune,
  weld,
  reorder,
  quantize,
} from '@gltf-transform/functions';
import {
  OptimizationPreset,
  OptimizationResult,
  ProcessResult,
} from '../types';
import { globalCache } from '../utils/cache';
import { globalFileHandler } from '../utils/file-handler';
import logger from '../utils/logger';

export class ModelOptimizer {
  private io: NodeIO;

  constructor() {
    this.io = new NodeIO();
  }

  /**
   * Optimize model
   */
  async optimize(
    filePath: string,
    preset: string | OptimizationPreset
  ): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      // Get preset configuration
      const optimizationPreset =
        typeof preset === 'string' ? this.getPreset(preset) : preset;

      if (!optimizationPreset) {
        throw new Error(`Unknown preset: ${preset}`);
      }

      // Check cache
      const cacheKey = globalCache.generateKey('optimization', {
        filePath,
        preset: optimizationPreset.name,
      });
      const cached = globalCache.get<OptimizationResult>(cacheKey);
      if (cached) {
        logger.info(`Optimization cache hit for: ${filePath}`);
        return {
          success: true,
          data: cached,
          metrics: {
            processingTime: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed,
          },
        };
      }

      logger.info(
        `Starting optimization with preset '${optimizationPreset.name}' for: ${filePath}`
      );

      // Read original document
      const document = await this.io.read(filePath);
      const originalStats = this.getDocumentStats(document);

      // Perform optimization
      const optimizedDocument = await this.applyOptimizations(
        document,
        optimizationPreset
      );

      // Generate output file
      const outputPath = globalFileHandler.createTempPath('.glb');
      await this.io.write(outputPath, optimizedDocument);

      // Calculate optimization results
      const optimizedStats = this.getDocumentStats(optimizedDocument);
      const result = await this.generateOptimizationResult(
        filePath,
        outputPath,
        originalStats,
        optimizedStats,
        optimizationPreset,
        startTime
      );

      // Cache result
      globalCache.set(cacheKey, result, 1800); // 30分钟缓存

      const processingTime = Date.now() - startTime;
      logger.info(
        `Optimization completed in ${processingTime}ms for: ${filePath}`
      );

      return {
        success: true,
        data: result,
        metrics: {
          processingTime,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    } catch (error) {
      logger.error(`Optimization failed for ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    }
  }

  /**
   * Apply optimization operations
   */
  private async applyOptimizations(
    document: Document,
    preset: OptimizationPreset
  ): Promise<Document> {
    const operations = [];

    // Geometry optimization
    if (preset.geometry) {
      operations.push(...preset.geometry);
    }

    // Apply all operations
    if (operations.length > 0) {
      await document.transform(...operations);
    }

    return document;
  }

  /**
   * Get preset configuration
   */
  private getPreset(presetName: string): OptimizationPreset | null {
    const presets: Record<string, OptimizationPreset> = {
      'web-high': {
        name: 'web-high',
        description: 'High quality web optimization',
        geometry: [
          dedup(),
          prune({ keepAttributes: true }),
          weld({ tolerance: 0.0001 }),
          reorder({ encoder: 'meshopt' }),
          quantize({
            quantizePosition: 14,
            quantizeTexcoord: 12,
            quantizeNormal: 10,
            quantizeColor: 8,
          }),
        ],
        textures: [],
      },

      'web-lite': {
        name: 'web-lite',
        description: 'Lightweight web optimization',
        geometry: [
          dedup(),
          prune({ keepAttributes: false }),
          weld({ tolerance: 0.001 }),
          quantize({
            quantizePosition: 12,
            quantizeTexcoord: 10,
            quantizeNormal: 8,
          }),
        ],
        textures: [],
      },

      mobile: {
        name: 'mobile',
        description: 'Mobile-optimized preset',
        geometry: [
          dedup(),
          prune({ keepAttributes: true }),
          quantize({
            quantizePosition: 12,
            quantizeTexcoord: 10,
            quantizeNormal: 8,
          }),
        ],
        textures: [],
      },

      'editor-safe': {
        name: 'editor-safe',
        description: 'Editor-safe optimization preserving all data',
        geometry: [
          dedup(),
          quantize({
            quantizePosition: 16,
            quantizeTexcoord: 16,
            quantizeNormal: 16,
          }),
        ],
        textures: [],
      },
    };

    return presets[presetName] || null;
  }

  /**
   * Get document statistics
   */
  private getDocumentStats(document: Document) {
    const root = document.getRoot();
    const meshes = root.listMeshes();
    const materials = root.listMaterials();
    const textures = root.listTextures();

    let vertexCount = 0;
    let triangleCount = 0;
    let textureSize = 0;

    // Calculate geometry statistics
    for (const mesh of meshes) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (position) {
          vertexCount += position.getCount();
        }

        const indices = primitive.getIndices();
        if (indices) {
          triangleCount += indices.getCount() / 3;
        } else if (position) {
          triangleCount += position.getCount() / 3;
        }
      }
    }

    // Calculate texture size
    for (const texture of textures) {
      const image = texture.getImage();
      if (image) {
        textureSize += image.byteLength;
      }
    }

    return {
      meshCount: meshes.length,
      materialCount: materials.length,
      textureCount: textures.length,
      vertexCount,
      triangleCount: Math.floor(triangleCount),
      textureSize,
    };
  }

  /**
   * Generate optimization result report
   */
  private async generateOptimizationResult(
    originalPath: string,
    optimizedPath: string,
    originalStats: any,
    optimizedStats: any,
    preset: OptimizationPreset,
    startTime: number
  ): Promise<OptimizationResult> {
    // Get file size
    const originalInfo = await globalFileHandler.getFileInfo(originalPath);
    const optimizedInfo = await globalFileHandler.getFileInfo(optimizedPath);

    const compressionRatio = originalInfo.size / optimizedInfo.size;
    const geometryReduction =
      originalStats.triangleCount > 0
        ? 1 - optimizedStats.triangleCount / originalStats.triangleCount
        : 0;
    const textureReduction =
      originalStats.textureSize > 0
        ? 1 - optimizedStats.textureSize / originalStats.textureSize
        : 0;

    // Generate report
    const report = this.generateReport(originalStats, optimizedStats, preset);
    const reportPath = globalFileHandler.createTempPath('.json');
    const fs = require('fs-extra');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Calculate quality score (simplified version)
    const visualScore = Math.max(0, 1 - Math.abs(geometryReduction - 0.3)); // Expect 30% geometry reduction
    const performanceScore = Math.min(1, compressionRatio / 2); // Expect 2x compression
    const compatibilityScore = 0.95; // Simplified to a fixed value

    const warnings: string[] = [];
    const errors: string[] = [];

    // Check potential issues
    if (compressionRatio < 1.1) {
      warnings.push('Low compression ratio achieved');
    }
    if (geometryReduction > 0.8) {
      warnings.push('High geometry reduction may affect visual quality');
    }

    return {
      artifacts: {
        optimized: optimizedPath,
        report: reportPath,
      },
      metrics: {
        originalSize: originalInfo.size,
        optimizedSize: optimizedInfo.size,
        compressionRatio,
        geometryReduction,
        textureReduction,
        processingTime: Date.now() - startTime,
      },
      quality: {
        visualScore,
        performanceScore,
        compatibilityScore,
      },
      warnings,
      errors,
    };
  }

  /**
   * Generate detailed report
   */
  private generateReport(
    originalStats: any,
    optimizedStats: any,
    preset: OptimizationPreset
  ) {
    return {
      preset: preset.name,
      timestamp: new Date().toISOString(),
      original: originalStats,
      optimized: optimizedStats,
      changes: {
        meshCount: optimizedStats.meshCount - originalStats.meshCount,
        materialCount:
          optimizedStats.materialCount - originalStats.materialCount,
        textureCount: optimizedStats.textureCount - originalStats.textureCount,
        vertexCount: optimizedStats.vertexCount - originalStats.vertexCount,
        triangleCount:
          optimizedStats.triangleCount - originalStats.triangleCount,
        textureSize: optimizedStats.textureSize - originalStats.textureSize,
      },
      reductions: {
        vertices:
          originalStats.vertexCount > 0
            ? 1 - optimizedStats.vertexCount / originalStats.vertexCount
            : 0,
        triangles:
          originalStats.triangleCount > 0
            ? 1 - optimizedStats.triangleCount / originalStats.triangleCount
            : 0,
        textures:
          originalStats.textureSize > 0
            ? 1 - optimizedStats.textureSize / originalStats.textureSize
            : 0,
      },
    };
  }

  /**
   * Get list of available presets
   */
  getAvailablePresets(): string[] {
    return ['web-high', 'web-lite', 'mobile', 'editor-safe'];
  }
}

// Global optimizer instance
export const globalOptimizer = new ModelOptimizer();
