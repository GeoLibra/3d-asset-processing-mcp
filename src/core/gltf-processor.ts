import { ProcessResult } from '../types';
import { globalCache } from '../utils/cache';
import logger from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import { GltfPipelineExecutor } from './gltf-pipeline-executor';

/**
 * Options for processing glTF files, mapping to gltf-pipeline flags.
 */
export interface GltfProcessOptions {
  inputPath: string;
  outputPath?: string;

  // General flags
  binary?: boolean; // -b
  json?: boolean; // -j
  separate?: boolean; // -s
  separateTextures?: boolean; // -t
  stats?: boolean;
  keepUnusedElements?: boolean;
  keepLegacyExtensions?: boolean;
  allowAbsolute?: boolean; // -a

  // Draco compression flags
  draco?: boolean; // -d
  dracoOptions?: {
    compressionLevel?: number;
    quantizePositionBits?: number;
    quantizeNormalBits?: number;
    quantizeTexcoordBits?: number;
    quantizeColorBits?: number;
    quantizeGenericBits?: number;
    unifiedQuantization?: boolean;
    uncompressedFallback?: boolean;
  };

  // Texture compression (to be handled by gltf-transform, not pipeline)
  textureCompress?: boolean;
  textureFormat?: 'webp' | 'jpg' | 'png';

  // Deprecated/Legacy options that will be mapped
  outputFormat?: 'glb' | 'gltf';
}

/**
 * Result of a glTF processing operation
 */
export interface GltfProcessResult {
  inputPath: string;
  outputPath: string;
  format: 'glb' | 'gltf';
  stats: {
    inputSize: number;
    outputSize: number;
    compressionRatio: number;
    textureCount?: number;
    totalTextureSize?: number;
  };
}


/**
 * GltfProcessor class for handling various glTF processing operations
 * using gltf-pipeline.
 */
export class GltfProcessor {
  private executor: GltfPipelineExecutor;

  constructor() {
    this.executor = new GltfPipelineExecutor();
  }

  /**
   * Process a glTF file with the specified options.
   * This is a universal method that maps MCP parameters to gltf-pipeline CLI flags.
   */
  async process(
    options: GltfProcessOptions
  ): Promise<ProcessResult<GltfProcessResult>> {
    const startTime = Date.now();

    try {
      // Map legacy outputFormat to binary/json flags
      if (options.outputFormat === 'glb') {
        options.binary = true;
      } else if (options.outputFormat === 'gltf') {
        options.json = true;
      }

      // Generate output path if not provided
      if (!options.outputPath) {
        const inputExt = path.extname(options.inputPath);
        const outputExt = options.binary ? '.glb' : '.gltf';
        const baseName = path.basename(options.inputPath, inputExt);
        const dirName = path.dirname(options.inputPath);
        options.outputPath = path.join(
          dirName,
          `${baseName}_processed${outputExt}`
        );
      }

      // Check cache
      const cacheKey = globalCache.generateKey('gltf-process', options);
      const cached = globalCache.get<GltfProcessResult>(cacheKey);
      if (cached) {
        logger.info(`Processing cache hit for: ${options.inputPath}`);
        return {
          success: true,
          data: cached,
          metrics: {
            processingTime: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed,
          },
        };
      }

      logger.info(`Starting glTF processing for: ${options.inputPath}`);

      // Execute the command
      await this.executor.execute(options);

      // Get file stats for the result
      const inputStats = fs.statSync(options.inputPath);
      const outputStats = fs.statSync(options.outputPath);

      const result: GltfProcessResult = {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        format: options.binary ? 'glb' : 'gltf',
        stats: {
          inputSize: inputStats.size,
          outputSize: outputStats.size,
          compressionRatio:
            inputStats.size > 0
              ? (1 - outputStats.size / inputStats.size) * 100
              : 0,
        },
      };

      // If separate textures were generated, count them and get total size
      if (options.separateTextures && options.outputPath) {
        const outputPath = options.outputPath;
        const outputDir = path.dirname(outputPath);
        const textureFiles = fs.readdirSync(outputDir).filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return (
            ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.ktx2', '.basis'].includes(ext) &&
            file.startsWith(path.basename(outputPath, path.extname(outputPath)))
          );
        });

        let totalTextureSize = 0;
        for (const file of textureFiles) {
          const stats = fs.statSync(path.join(outputDir, file));
          totalTextureSize += stats.size;
        }

        result.stats.textureCount = textureFiles.length;
        result.stats.totalTextureSize = totalTextureSize;
      }

      // Cache result
      globalCache.set(cacheKey, result, 3600); // 1 hour cache

      const processingTime = Date.now() - startTime;
      logger.info(
        `Processing completed in ${processingTime}ms for: ${options.inputPath}`
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
      logger.error(`Processing failed for ${options.inputPath}:`, error);
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
   * Convert a glTF file between glb and gltf formats.
   * @param inputPath - Path to the input file.
   * @param outputFormat - Target format ('glb' or 'gltf').
   * @param outputPath - Optional output path.
   */
  async convert(
    inputPath: string,
    outputFormat: 'glb' | 'gltf',
    outputPath?: string
  ): Promise<ProcessResult<GltfProcessResult>> {
    const options: GltfProcessOptions = {
      inputPath,
      outputFormat,
      outputPath,
    };
    return this.process(options);
  }
}

// Global processor instance
export const globalGltfProcessor = new GltfProcessor();