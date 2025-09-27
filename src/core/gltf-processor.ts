import { ProcessResult } from '../types';
import { globalCache } from '../utils/cache';
import logger from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import { GltfPipelineExecutor } from './gltf-pipeline-executor';
import { desiredExtFrom, TextureEncoder } from '../utils/gltf-constants';

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

  // feature flags expected by tests
  optimize?: boolean;
  removeNormals?: boolean;
  stripEmptyNodes?: boolean;

  // Draco compression flags
  draco?: boolean; // -d
  dracoOptions?: {
    compressionLevel?: number;
    // 支持 tests 使用的不带 Bits 的字段名
    quantizePosition?: number;
    quantizeNormal?: number;
    quantizeTexcoord?: number;
    quantizeColor?: number;
    quantizeGeneric?: number;
    // 同时兼容 *Bits 命名
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
  textureFormat?: TextureEncoder | 'jpg';

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
  command: string;
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

  // 内部命令拼装，供测试使用
  private buildCommand(options: GltfProcessOptions): string {
    const parts: string[] = ['gltf-pipeline'];

    parts.push(`-i "${options.inputPath}"`);
    if (options.outputPath) parts.push(`-o "${options.outputPath}"`);

    if (options.binary) parts.push('--binary');
    if (options.outputFormat === 'glb') parts.push('--binary');
    if (options.json) parts.push('-j');
    if (options.separate) parts.push('-s');
    if (options.separateTextures) parts.push('-t');
    if (options.stats) parts.push('--stats');
    if (options.keepUnusedElements) parts.push('--keep-unused-elements');
    if (options.keepLegacyExtensions) parts.push('--keep-legacy-extensions');
    if (options.allowAbsolute) parts.push('-a');

    if (options.optimize) parts.push('--optimize');
    if (options.removeNormals) parts.push('--removeNormals');
    if (options.stripEmptyNodes) parts.push('--stripEmptyNodes');

    if (options.draco) {
      parts.push('--draco');
      const d = options.dracoOptions || {};
      const num = (v?: number) => (typeof v === 'number' ? v : undefined);
      if (num(d.compressionLevel) !== undefined) parts.push(`--draco.compressionLevel ${d.compressionLevel}`);
      const qp = num(d.quantizePosition ?? d.quantizePositionBits);
      if (qp !== undefined) parts.push(`--draco.quantizePosition ${qp}`);
      const qn = num(d.quantizeNormal ?? d.quantizeNormalBits);
      if (qn !== undefined) parts.push(`--draco.quantizeNormal ${qn}`);
      const qt = num(d.quantizeTexcoord ?? d.quantizeTexcoordBits);
      if (qt !== undefined) parts.push(`--draco.quantizeTexcoord ${qt}`);
      const qc = num(d.quantizeColor ?? d.quantizeColorBits);
      if (qc !== undefined) parts.push(`--draco.quantizeColor ${qc}`);
      const qg = num(d.quantizeGeneric ?? d.quantizeGenericBits);
      if (qg !== undefined) parts.push(`--draco.quantizeGeneric ${qg}`);
      if (d.unifiedQuantization) parts.push(`--draco.unifiedQuantization`);
      if (d.uncompressedFallback) parts.push(`--draco.uncompressedFallback`);
    }

    if (options.textureCompress) {
      parts.push('--compress-textures');
      if (options.textureFormat) {
        // 映射 jpg -> jpeg
        const enc = options.textureFormat === 'jpg' ? 'jpeg' : options.textureFormat;
        parts.push(`--texture-format ${enc}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Process a glTF file with the specified options.
   * This is a universal method that maps MCP parameters to gltf-pipeline CLI flags.
   */
  async process(
    options: GltfProcessOptions
  ): Promise<ProcessResult<GltfProcessResult>> {
    const startTime = Date.now();
    // clone to avoid mutating caller's object (tests spy on the argument)
    options = { ...options };

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
        const outputExt = desiredExtFrom({ outputFormat: options.outputFormat, binary: options.binary });
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
      const command = await this.executor.execute(options);

      // Get file stats for the result
      const inputStats = fs.statSync(options.inputPath);
      const outputStats = fs.statSync(options.outputPath);

      const result: GltfProcessResult = {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        format: options.binary ? 'glb' : 'gltf',
        command,
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
        const baseWithExt = path.basename(outputPath);
        const baseWithoutExt = baseWithExt.replace(/\.(glb|gltf)$/i, '');
        const textureFiles = fs.readdirSync(outputDir).filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return (
            ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.ktx2', '.basis'].includes(ext) &&
            file.startsWith(baseWithoutExt)
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

  // 提取纹理
  async extractTextures(
    inputPath: string,
    outputPath?: string
  ): Promise<ProcessResult<GltfProcessResult>> {
    const options: GltfProcessOptions = {
      inputPath,
      outputPath,
      separateTextures: true
    };
    return this.process(options);
  }

  // 优化（含 Draco 可选）
  async optimize(
    inputPath: string,
    opts?: { draco?: boolean; dracoOptions?: GltfProcessOptions['dracoOptions'] },
    outputPath?: string
  ): Promise<ProcessResult<GltfProcessResult>> {
    const options: GltfProcessOptions = {
      inputPath,
      outputPath,
      optimize: true,
      draco: !!opts?.draco,
      dracoOptions: opts?.dracoOptions
    };
    return this.process(options);
  }
}

// Global processor instance
export const globalGltfProcessor = new GltfProcessor();