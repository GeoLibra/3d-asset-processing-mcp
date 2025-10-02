import { MCPTool, ModelInput, ProcessResult } from '../types';
import { globalAnalyzer } from '../core/analyzer';
import { globalOptimizer } from '../core/optimizer-simple';
import { globalSimpleValidator } from '../core/validator-simple';

import { globalFileHandler } from '../utils/file-handler';
import logger from '../utils/logger';
import { GltfPipelineExecutor } from '../core/gltf-pipeline-executor';
import {
  GltfTransformExecutor,
  GltfTransformExecOptions,
} from '../core/gltf-transform-executor';
import { TEXTURE_ENCODERS, desiredExtFrom } from '../utils/gltf-constants';

/**
 * Model Analysis Tool
 */
export const analyzeModelTool: MCPTool = {
  name: 'analyze_model',
  description:
    'Analyze a 3D model and provide detailed statistics and recommendations',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'File path, URL, or base64 data of the 3D model',
          },
          type: {
            type: 'string',
            enum: ['file', 'url', 'base64'],
            description: 'Type of input source',
          },
          format: {
            type: 'string',
            enum: ['gltf', 'glb', 'auto'],
            description: 'Expected format of the model',
            default: 'auto',
          },
        },
        required: ['source', 'type'],
      },
    },
    required: ['input'],
  },
  execute: async (params: { input: ModelInput }): Promise<ProcessResult> => {
    try {
      logger.info(`Analyzing model: ${params.input.source}`);
      const filePath = await globalFileHandler.processInput(params.input);
      const result = await globalAnalyzer.analyze(filePath);
      if (params.input.type !== 'file')
        await globalFileHandler.cleanup(filePath);
      return result;
    } catch (error) {
      logger.error('Analysis tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    }
  },
};


/**
 * Model Validation Tool
 */
export const validateModelTool: MCPTool = {
  name: 'validate_model',
  description: 'Validate a 3D model for compliance and compatibility',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'File path, URL, or base64 data of the 3D model',
          },
          type: {
            type: 'string',
            enum: ['file', 'url', 'base64'],
            description: 'Type of input source',
          },
          format: {
            type: 'string',
            enum: ['gltf', 'glb', 'auto'],
            description: 'Expected format of the model',
            default: 'auto',
          },
        },
        required: ['source', 'type'],
      },
      rules: {
        type: 'string',
        enum: ['web-compatible', 'mobile-compatible', 'strict', 'basic'],
        description: 'Validation rule set to apply',
        default: 'basic',
      },
    },
    required: ['input'],
  },
  execute: async (params: {
    input: ModelInput;
    rules?: string;
  }): Promise<ProcessResult> => {
    try {
      const rules = params.rules || 'basic';
      logger.info(
        `Validating model with rules '${rules}': ${params.input.source}`
      );
      const filePath = await globalFileHandler.processInput(params.input);
      const result = await globalSimpleValidator.validate(filePath, rules);
      const validatorInfo = await globalSimpleValidator.getValidatorInfo();
      if (params.input.type !== 'file')
        await globalFileHandler.cleanup(filePath);

      if (result.success) {
        return {
          ...result,
          data: {
            ...(result.data as any),
            validator: {
              ...validatorInfo,
              recommendation: validatorInfo.available
                ? 'Official gltf-validator is available for comprehensive validation'
                : 'Install gltf-validator for more accurate validation: npm install -g gltf-validator',
            },
          },
        };
      }
      return {
        ...result,
        data: {
          validator: {
            ...validatorInfo,
            recommendation: validatorInfo.available
              ? 'Official gltf-validator is available for comprehensive validation'
              : 'Install gltf-validator for more accurate validation: npm install -g gltf-validator',
          },
        },
      };
    } catch (error) {
      logger.error('Validation tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    }
  },
};

/**
 * glTF Pipeline Executor Tool (CLI)
 * - Builds and runs gltf-pipeline CLI command via executor
 * - Returns executed command and input/output paths
 */
export const gltfPipelineExecutorTool: MCPTool = {
  name: 'gltf-pipeline-executor',
  description:
    'Execute gltf-pipeline CLI for BASIC glTF operations: glTF↔GLB conversion, embed/separate resources, glTF 1.0→2.0 upgrade, basic Draco compression, cleanup unused elements. Limited to basic file format operations and simple compression.',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file',
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)',
      },
      outputFormat: {
        type: 'string',
        enum: ['glb', 'gltf'],
        description: 'Output format',
      },
      separate: { type: 'boolean', description: 'Separate buffers' },
      separateTextures: {
        type: 'boolean',
        description: 'Extract textures to separate files',
      },
      stats: { type: 'boolean', description: 'Output stats' },
      keepUnusedElements: { type: 'boolean' },
      keepLegacyExtensions: { type: 'boolean' },
      draco: { type: 'boolean', description: 'Apply Draco compression' },
      dracoOptions: {
        type: 'object',
        properties: {
          compressionLevel: { type: 'number', minimum: 0, maximum: 10 },
          quantizePositionBits: { type: 'number', minimum: 0, maximum: 16 },
          quantizeNormalBits: { type: 'number', minimum: 0, maximum: 16 },
          quantizeTexcoordBits: { type: 'number', minimum: 0, maximum: 16 },
          quantizeColorBits: { type: 'number', minimum: 0, maximum: 16 },
          quantizeGenericBits: { type: 'number', minimum: 0, maximum: 16 },
          unifiedQuantization: { type: 'boolean' },
          uncompressedFallback: { type: 'boolean' },
        },
      },
    },
    required: ['inputPath'],
  },
  execute: async (params: any): Promise<ProcessResult> => {
    const start = Date.now();
    try {
      if (!params.outputPath) {
        const pathMod = await import('path');
        const inputExt = pathMod.extname(params.inputPath);
        const baseName = pathMod.basename(params.inputPath, inputExt);
        const dirName = pathMod.dirname(params.inputPath);
        const desiredExt = desiredExtFrom({
          outputFormat: params.outputFormat,
        });
        params.outputPath = pathMod.join(
          dirName,
          `${baseName}_processed${desiredExt}`
        );
      }
      const executor = new GltfPipelineExecutor();
      const command = await executor.execute(params);
      logger.info(`gltf-pipeline executed: ${command}`);
      return {
        success: true,
        data: {
          inputPath: params.inputPath,
          outputPath: params.outputPath,
          command,
        },
        metrics: {
          processingTime: Date.now() - start,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    } catch (error) {
      logger.error('gltf-pipeline executor tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: Date.now() - start,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    }
  },
};

/**
 * glTF Transform Executor Tool (CLI)
 * - Builds and runs gltf-transform CLI command via executor
 * - Returns executed command and input/output paths
 */
export const gltfTransformExecutorTool: MCPTool = {
  name: 'gltf-transform-executor',
  description:
    'Execute gltf-transform CLI for ADVANCED glTF processing: Meshopt compression, Draco compression, texture compression (WebP/AVIF/JPEG/PNG), KTX2+Basis compression (ETC1S/UASTC), geometry optimization (quantize/weld/simplify/tangents), scene optimization (center/flatten/join), material conversion (metalrough/unlit), animation optimization (resample). Supports multi-step processing for complex operations.',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input file',
      },
      outputPath: {
        type: 'string',
        description: 'Path to the output file (optional)',
      },
      outputFormat: {
        type: 'string',
        enum: ['glb', 'gltf'],
        description: 'Output format (decides ext)',
      },
      binary: {
        type: 'boolean',
        description: 'Alias for outputFormat=glb',
      },

      // Inspection
      inspect: {
        type: 'boolean',
        description: 'Inspect contents of the model',
      },
      validate: {
        type: 'boolean',
        description: 'Validate model against the glTF spec',
      },

      // Package operations
      optimize: {
        type: 'boolean',
        description: 'Apply all optimizations',
      },
      copy: {
        type: 'boolean',
        description: 'Copy model with minimal changes',
      },
      merge: {
        type: 'array',
        items: { type: 'string' },
        description: 'Merge additional models (array of file paths)',
      },
      partition: {
        type: 'boolean',
        description: 'Partition binary data into separate .bin files',
      },
      dedup: {
        type: 'boolean',
        description: 'Deduplicate accessors and textures',
      },
      prune: {
        type: 'boolean',
        description: 'Remove unreferenced properties from the file',
      },
      gzip: {
        type: 'boolean',
        description: 'Compress model with lossless gzip',
      },

      // Scene operations
      center: {
        type: 'boolean',
        description: 'Center the scene at the origin',
      },
      instance: {
        type: 'boolean',
        description: 'Create GPU instances from shared mesh references',
      },
      flatten: {
        type: 'boolean',
        description: 'Flatten scene graph',
      },
      join: {
        type: 'boolean',
        description: 'Join meshes and reduce draw calls',
      },

      // Geometry operations
      draco: {
        type: 'boolean',
        description:
          'Apply Draco compression to mesh geometry only (not animation). Google Draco provides excellent compression for static geometry.',
      },
      dracoOptions: {
        type: 'object',
        description: 'Options for Draco compression',
      },
      meshopt: {
        type: 'boolean',
        description:
          'Apply Meshoptimizer compression to geometry, morph targets, and keyframe animation. Superior to Draco for animated content and provides better performance.',
      },
      quantize: {
        type: 'boolean',
        description: 'Quantize geometry attributes to reduce precision and memory usage',
      },
      dequantize: {
        type: 'boolean',
        description: 'Dequantize geometry',
      },
      weld: {
        type: 'boolean',
        description: 'Weld vertices',
      },
      unweld: {
        type: 'boolean',
        description: 'De-index geometry, disconnecting any shared vertices',
      },
      tangents: {
        type: 'boolean',
        description: 'Generate MikkTSpace vertex tangents',
      },
      unwrap: {
        type: 'boolean',
        description: 'Generate texcoords',
      },
      reorder: {
        type: 'boolean',
        description: 'Optimize vertex data for locality of reference',
      },
      simplify: {
        type: 'boolean',
        description: 'Simplify mesh geometry by reducing vertex count while preserving visual quality',
      },
      simplifyOptions: {
        type: 'object',
        description: 'Options for simplification',
      },

      // Material operations
      metalrough: {
        type: 'boolean',
        description: 'Convert materials from spec/gloss to metal/rough',
      },
      palette: {
        type: 'boolean',
        description: 'Creates palette textures and merges materials',
      },
      unlit: {
        type: 'boolean',
        description: 'Convert materials from metal/rough to unlit',
      },

      // Texture operations
      resize: {
        type: 'object',
        description: 'Resize PNG or JPEG textures',
      },
      etc1s: {
        type: 'boolean',
        description:
          'KTX2 + Basis ETC1S texture compression (high compression ratio, lower quality). Best for diffuse textures where file size is critical.',
      },
      uastc: {
        type: 'boolean',
        description:
          'KTX2 + Basis UASTC texture compression (lower compression ratio, higher quality). Best for normal maps and detail textures.',
      },
      ktxdecompress: {
        type: 'boolean',
        description: 'KTX + Basis texture decompression',
      },
      ktxfix: {
        type: 'boolean',
        description: 'Fixes common issues in KTX texture metadata',
      },
      avif: {
        type: 'boolean',
        description: 'AVIF texture compression (next-generation format with superior compression)',
      },
      webp: {
        type: 'boolean',
        description: 'WebP texture compression (modern format with excellent compression and quality)',
      },
      png: {
        type: 'boolean',
        description: 'PNG texture compression (lossless compression, larger file sizes)',
      },
      jpeg: {
        type: 'boolean',
        description: 'JPEG texture compression (lossy compression, smaller file sizes)',
      },
      textureOptions: {
        type: 'object',
        description: 'Options for texture compression',
      },

      // Animation operations
      resample: {
        type: 'boolean',
        description: 'Resample animations, losslessly deduplicating keyframes',
      },
      sequence: {
        type: 'boolean',
        description: 'Animate node visibilities as a flipboard sequence',
      },
      sparse: {
        type: 'boolean',
        description: 'Reduces storage for zero-filled arrays',
      },

      // Global options
      vertexLayout: {
        type: 'string',
        enum: ['interleaved', 'separate'],
        description: 'Vertex buffer layout preset',
      },

      // Optimize-specific options
      compress: {
        type: 'string',
        enum: ['draco', 'meshopt'],
        description: 'Compression method for optimize command',
      },
      textureCompress: {
        type: 'string',
        enum: ['webp', 'avif', 'jpeg', 'png', 'etc1s', 'uastc'],
        description: 'Texture compression format for optimize command',
      },

      // Legacy support
      textureFormat: {
        type: 'string',
        enum: [...TEXTURE_ENCODERS, 'jpg'] as unknown as string[],
        description: 'Legacy texture encoder (use textureCompress instead)',
      },
    },
    required: ['inputPath'],
  },
  execute: async (params: GltfTransformExecOptions): Promise<ProcessResult> => {
    const start = Date.now();
    try {
      if (!params.outputPath) {
        const pathMod = await import('path');
        const inputExt = pathMod.extname(params.inputPath);
        const baseName = pathMod.basename(params.inputPath, inputExt);
        const dirName = pathMod.dirname(params.inputPath);
        const desiredExt = desiredExtFrom({
          outputFormat: params.outputFormat,
          binary: params.binary,
        });
        params.outputPath = pathMod.join(
          dirName,
          `${baseName}_transformed${desiredExt}`
        );
      }
      const executor = new GltfTransformExecutor();
      const command = await executor.execute(params);
      logger.info(`gltf-transform executed: ${command}`);
      return {
        success: true,
        data: {
          inputPath: params.inputPath,
          outputPath: params.outputPath!,
          command,
        },
        metrics: {
          processingTime: Date.now() - start,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    } catch (error) {
      logger.error('gltf-transform executor tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: Date.now() - start,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    }
  },
};



// Export all tools
export const allTools: MCPTool[] = [
  analyzeModelTool,
  validateModelTool,
  gltfPipelineExecutorTool,
  gltfTransformExecutorTool,
];
