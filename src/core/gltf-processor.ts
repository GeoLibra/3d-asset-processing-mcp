import { ProcessResult } from '../types';
import { globalCache } from '../utils/cache';
import logger from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const gltfPipeline = require('gltf-pipeline');

/**
 * Options for processing glTF files
 */
export interface GltfProcessOptions {
  // Common options
  inputPath: string;
  outputPath?: string;

  // Format conversion
  outputFormat?: 'glb' | 'gltf';

  // Texture options
  separateTextures?: boolean;
  textureCompress?: boolean;
  textureFormat?: 'webp' | 'jpg' | 'png';

  // Optimization options
  optimize?: boolean;
  compressGeometry?: boolean;
  compressTextures?: boolean;

  // Draco compression options
  draco?: boolean;
  dracoOptions?: {
    compressionLevel?: number; // 1-10
    quantizePosition?: number; // bits
    quantizeNormal?: number; // bits
    quantizeTexcoord?: number; // bits
    quantizeColor?: number; // bits
    quantizeGeneric?: number; // bits
  };

  // Other options
  removeNormals?: boolean;
  stripEmptyNodes?: boolean;
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
 * using gltf-pipeline
 */
export class GltfProcessor {
  /**
   * Process a glTF file with the specified options
   */
  async process(
    options: GltfProcessOptions
  ): Promise<ProcessResult<GltfProcessResult>> {
    const startTime = Date.now();

    try {
      // Generate output path if not provided
      if (!options.outputPath) {
        const inputExt = path.extname(options.inputPath);
        const outputExt = options.outputFormat === 'glb' ? '.glb' : '.gltf';
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

      // Try to use Node.js API first, fallback to command line if needed
      try {
        await this.processWithNodeAPI(options);
      } catch (apiError) {
        logger.warn(
          `Node.js API failed, falling back to command line: ${apiError}`
        );

        // Build and execute the command
        const command = this.buildCommand(options);
        logger.debug(`Executing command: ${command}`);

        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stderr.includes('Saved')) {
          throw new Error(`gltf-pipeline error: ${stderr}`);
        }
      }

      // Get file stats for the result
      const inputStats = fs.statSync(options.inputPath);
      const outputStats = fs.statSync(options.outputPath);

      const result: GltfProcessResult = {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        format:
          options.outputFormat ||
          (path.extname(options.outputPath) === '.glb' ? 'glb' : 'gltf'),
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
      if (options.separateTextures) {
        const outputDir = path.dirname(options.outputPath);
        const textureFiles = fs.readdirSync(outputDir).filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return (
            ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) &&
            file.includes(
              path.basename(
                options.outputPath || '',
                path.extname(options.outputPath || '')
              )
            )
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
   * Convert between glTF and GLB formats
   */
  async convert(
    inputPath: string,
    outputFormat: 'glb' | 'gltf',
    outputPath?: string
  ): Promise<ProcessResult<GltfProcessResult>> {
    return this.process({
      inputPath,
      outputPath,
      outputFormat,
    });
  }

  /**
   * Extract textures from a glTF/GLB file
   */
  async extractTextures(
    inputPath: string,
    outputPath?: string
  ): Promise<ProcessResult<GltfProcessResult>> {
    return this.process({
      inputPath,
      outputPath,
      separateTextures: true,
    });
  }

  /**
   * Optimize a glTF/GLB file
   */
  async optimize(
    inputPath: string,
    options: Partial<GltfProcessOptions> = {},
    outputPath?: string
  ): Promise<ProcessResult<GltfProcessResult>> {
    return this.process({
      inputPath,
      outputPath,
      optimize: true,
      compressGeometry: options.compressGeometry ?? true,
      compressTextures: options.compressTextures ?? true,
      draco: options.draco ?? true,
      dracoOptions: options.dracoOptions,
      ...options,
    });
  }

  /**
   * Process using gltf-pipeline Node.js API
   */
  private async processWithNodeAPI(options: GltfProcessOptions): Promise<void> {
    // Read input file
    const inputBuffer = fs.readFileSync(options.inputPath);

    // Build gltf-pipeline options
    const pipelineOptions: any = {};

    if (options.outputFormat === 'glb') {
      pipelineOptions.binary = true;
    } else if (options.outputFormat === 'gltf') {
      pipelineOptions.json = true;
    }

    if (options.separateTextures) {
      pipelineOptions.separateTextures = true;
    }

    if (options.draco) {
      pipelineOptions.draco = {
        compressionLevel: options.dracoOptions?.compressionLevel || 7,
        quantizePosition: options.dracoOptions?.quantizePosition || 14,
        quantizeNormal: options.dracoOptions?.quantizeNormal || 10,
        quantizeTexcoord: options.dracoOptions?.quantizeTexcoord || 12,
        quantizeColor: options.dracoOptions?.quantizeColor || 8,
        quantizeGeneric: options.dracoOptions?.quantizeGeneric || 12,
      };
    }

    // Process the glTF
    const result = await gltfPipeline.processGltf(inputBuffer, pipelineOptions);

    // Write output file
    if (options.outputPath) {
      fs.writeFileSync(options.outputPath, result.gltf);

      // Write separate textures if requested
      if (options.separateTextures && result.separateResources) {
        const outputDir = path.dirname(options.outputPath);
        for (const [filename, data] of Object.entries(
          result.separateResources
        )) {
          const resourcePath = path.join(outputDir, filename);
          fs.writeFileSync(resourcePath, data as Buffer);
        }
      }
    }
  }

  /**
   * Build the gltf-pipeline command based on options
   */
  private buildCommand(options: GltfProcessOptions): string {
    const commands: string[] = ['gltf-pipeline'];

    // Input and output
    commands.push(`-i "${options.inputPath}"`);
    commands.push(`-o "${options.outputPath}"`);

    // Format conversion
    if (options.outputFormat === 'glb') {
      commands.push('--binary');
    } else if (options.outputFormat === 'gltf') {
      commands.push('--json');
    }

    // Texture options
    if (options.separateTextures) {
      commands.push('-t');
    }

    if (options.textureCompress) {
      commands.push('--compress-textures');
    }

    // Optimization options
    if (options.optimize) {
      commands.push('--optimize');
    }

    // Draco compression
    if (options.draco) {
      commands.push('--draco');

      if (options.dracoOptions) {
        const { dracoOptions } = options;

        if (dracoOptions.compressionLevel !== undefined) {
          commands.push(
            `--draco.compressionLevel ${dracoOptions.compressionLevel}`
          );
        }

        if (dracoOptions.quantizePosition !== undefined) {
          commands.push(
            `--draco.quantizePosition ${dracoOptions.quantizePosition}`
          );
        }

        if (dracoOptions.quantizeNormal !== undefined) {
          commands.push(
            `--draco.quantizeNormal ${dracoOptions.quantizeNormal}`
          );
        }

        if (dracoOptions.quantizeTexcoord !== undefined) {
          commands.push(
            `--draco.quantizeTexcoord ${dracoOptions.quantizeTexcoord}`
          );
        }

        if (dracoOptions.quantizeColor !== undefined) {
          commands.push(`--draco.quantizeColor ${dracoOptions.quantizeColor}`);
        }

        if (dracoOptions.quantizeGeneric !== undefined) {
          commands.push(
            `--draco.quantizeGeneric ${dracoOptions.quantizeGeneric}`
          );
        }
      }
    }

    // Other options
    if (options.removeNormals) {
      commands.push('--removeNormals');
    }

    if (options.stripEmptyNodes) {
      commands.push('--stripEmptyNodes');
    }

    return commands.join(' ');
  }
}

// Global processor instance
export const globalGltfProcessor = new GltfProcessor();
