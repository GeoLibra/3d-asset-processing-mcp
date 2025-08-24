import { MCPTool, ModelInput, ProcessResult } from '../types';
import { globalAnalyzer } from '../core/analyzer';
import { globalOptimizer } from '../core/optimizer-simple';
import { globalSimpleValidator } from '../core/validator-simple';
import {
  globalGltfProcessor,
  GltfProcessOptions,
} from '../core/gltf-processor';
import {
  globalGltfTransformProcessor,
  GltfTransformOptions,
} from '../core/gltf-transform-processor';
import { globalFileHandler } from '../utils/file-handler';
import logger from '../utils/logger';

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

      // Process input file
      const filePath = await globalFileHandler.processInput(params.input);

      // Perform analysis
      const result = await globalAnalyzer.analyze(filePath);

      // Clean up temporary files
      if (params.input.type !== 'file') {
        await globalFileHandler.cleanup(filePath);
      }

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
 * Model Optimization Tool
 */
export const optimizeModelTool: MCPTool = {
  name: 'optimize_model',
  description:
    'Optimize a 3D model using predefined presets or custom settings',
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
      preset: {
        type: 'string',
        enum: ['web-high', 'web-lite', 'mobile', 'editor-safe'],
        description: 'Optimization preset to use',
        default: 'web-high',
      },
      outputPath: {
        type: 'string',
        description:
          'Optional output file path (if not provided, returns temporary file)',
        optional: true,
      },
    },
    required: ['input'],
  },
  execute: async (params: {
    input: ModelInput;
    preset?: string;
    outputPath?: string;
  }): Promise<ProcessResult> => {
    try {
      const preset = params.preset || 'web-high';
      logger.info(
        `Optimizing model with preset '${preset}': ${params.input.source}`
      );

      // Process input file
      const filePath = await globalFileHandler.processInput(params.input);

      // Perform optimization
      const result = await globalOptimizer.optimize(filePath, preset);

      // If output path is specified, copy the file
      if (
        params.outputPath &&
        result.success &&
        result.data?.artifacts?.optimized
      ) {
        await globalFileHandler.copyFile(
          result.data.artifacts.optimized,
          params.outputPath
        );
        result.data.artifacts.optimized = params.outputPath;
      }

      // Clean up temporary files
      if (params.input.type !== 'file') {
        await globalFileHandler.cleanup(filePath);
      }

      return result;
    } catch (error) {
      logger.error('Optimization tool error:', error);
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

      // Process input file
      const filePath = await globalFileHandler.processInput(params.input);

      // Perform validation
      const result = await globalSimpleValidator.validate(filePath, rules);

      // Clean up temporary files
      if (params.input.type !== 'file') {
        await globalFileHandler.cleanup(filePath);
      }

      return result;
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
 * Get Available Presets Tool
 */
export const getPresetsTools: MCPTool = {
  name: 'get_presets',
  description: 'Get list of available optimization presets',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  execute: async (): Promise<ProcessResult> => {
    try {
      const presets = globalOptimizer.getAvailablePresets();
      return {
        success: true,
        data: {
          presets,
          descriptions: {
            'web-high':
              'High quality web optimization - preserves visual quality while optimizing for web delivery',
            'web-lite':
              'Lightweight web optimization - prioritizes file size reduction over quality',
            mobile:
              'Mobile-optimized preset - balances quality and performance for mobile devices',
            'editor-safe':
              'Editor-safe optimization - minimal changes that preserve editability',
          },
        },
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    } catch (error) {
      logger.error('Get presets tool error:', error);
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
 * Get Validator Status Tool
 */
export const getValidatorStatusTool: MCPTool = {
  name: 'get_validator_status',
  description: 'Check the status and availability of gltf-validator',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  execute: async (): Promise<ProcessResult> => {
    try {
      const validatorInfo = await globalSimpleValidator.getValidatorInfo();
      return {
        success: true,
        data: {
          ...validatorInfo,
          recommendation: validatorInfo.available
            ? 'Official gltf-validator is available for comprehensive validation'
            : 'Install gltf-validator for more accurate validation: npm install -g gltf-validator',
        },
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    } catch (error) {
      logger.error('Get validator status tool error:', error);
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
 * glTF Pipeline Processing Tool
 */
export const gltfProcessTool: MCPTool = {
  name: 'gltf_process',
  description: 'Process glTF files using gltf-pipeline with various optimization options',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file'
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)'
      },
      outputFormat: {
        type: 'string',
        enum: ['glb', 'gltf'],
        description: 'Output format'
      },
      separateTextures: {
        type: 'boolean',
        description: 'Extract textures to separate files',
        default: false
      },
      textureCompress: {
        type: 'boolean',
        description: 'Compress textures',
        default: false
      },
      textureFormat: {
        type: 'string',
        enum: ['webp', 'jpg', 'png'],
        description: 'Texture output format'
      },
      optimize: {
        type: 'boolean',
        description: 'Apply general optimizations',
        default: false
      },
      compressGeometry: {
        type: 'boolean',
        description: 'Compress geometry data',
        default: false
      },
      compressTextures: {
        type: 'boolean',
        description: 'Compress texture data',
        default: false
      },
      draco: {
        type: 'boolean',
        description: 'Apply Draco compression',
        default: false
      },
      dracoOptions: {
        type: 'object',
        properties: {
          compressionLevel: { type: 'number', minimum: 1, maximum: 10 },
          quantizePosition: { type: 'number', minimum: 0, maximum: 16 },
          quantizeNormal: { type: 'number', minimum: 0, maximum: 16 },
          quantizeTexcoord: { type: 'number', minimum: 0, maximum: 16 },
          quantizeColor: { type: 'number', minimum: 0, maximum: 16 },
          quantizeGeneric: { type: 'number', minimum: 0, maximum: 16 }
        },
        description: 'Draco compression options'
      },
      removeNormals: {
        type: 'boolean',
        description: 'Remove normal vectors',
        default: false
      },
      stripEmptyNodes: {
        type: 'boolean',
        description: 'Remove empty nodes',
        default: false
      }
    },
    required: ['inputPath']
  },
  execute: async (params: GltfProcessOptions): Promise<ProcessResult> => {
    try {
      logger.info(`Processing glTF file: ${params.inputPath}`);
      const result = await globalGltfProcessor.process(params);
      return result;
    } catch (error) {
      logger.error('glTF process tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }
};

/**
 * glTF Format Conversion Tool
 */
export const gltfConvertTool: MCPTool = {
  name: 'gltf_convert',
  description: 'Convert between glTF and GLB formats',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file'
      },
      outputFormat: {
        type: 'string',
        enum: ['glb', 'gltf'],
        description: 'Target output format'
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)'
      }
    },
    required: ['inputPath', 'outputFormat']
  },
  execute: async (params: { inputPath: string; outputFormat: 'glb' | 'gltf'; outputPath?: string }): Promise<ProcessResult> => {
    try {
      logger.info(`Converting ${params.inputPath} to ${params.outputFormat}`);
      const result = await globalGltfProcessor.convert(params.inputPath, params.outputFormat, params.outputPath);
      return result;
    } catch (error) {
      logger.error('glTF convert tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }
};

/**
 * glTF Transform Processing Tool
 */
export const gltfTransformTool: MCPTool = {
  name: 'gltf_transform',
  description: 'Process glTF files using gltf-transform library with advanced optimization options',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file'
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)'
      },
      optimize: {
        type: 'boolean',
        description: 'Apply comprehensive optimization',
        default: false
      },
      simplify: {
        type: 'boolean',
        description: 'Simplify geometry',
        default: false
      },
      simplifyOptions: {
        type: 'object',
        properties: {
          ratio: { type: 'number', minimum: 0, maximum: 1, description: 'Target ratio of vertices to keep' },
          error: { type: 'number', minimum: 0, maximum: 1, description: 'Error tolerance' },
          lockBorder: { type: 'boolean', description: 'Lock border vertices' }
        },
        description: 'Geometry simplification options'
      },
      weld: {
        type: 'boolean',
        description: 'Weld duplicate vertices',
        default: false
      },
      weldOptions: {
        type: 'object',
        properties: {
          tolerance: { type: 'number', description: 'Distance tolerance for welding' }
        },
        description: 'Vertex welding options'
      },
      compressTextures: {
        type: 'boolean',
        description: 'Compress textures',
        default: false
      },
      textureOptions: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['webp', 'jpeg', 'png'], description: 'Output format' },
          quality: { type: 'number', minimum: 0, maximum: 100, description: 'Quality setting' },
          powerOfTwo: { type: 'boolean', description: 'Resize to power of two' },
          maxSize: { type: 'number', description: 'Maximum texture size' }
        },
        description: 'Texture compression options'
      },
      dedup: {
        type: 'boolean',
        description: 'Deduplicate resources',
        default: false
      },
      flatten: {
        type: 'boolean',
        description: 'Flatten node hierarchy',
        default: false
      },
      join: {
        type: 'boolean',
        description: 'Join meshes with same materials',
        default: false
      },
      mergeMeshes: {
        type: 'boolean',
        description: 'Merge compatible meshes',
        default: false
      },
      mergeMaterials: {
        type: 'boolean',
        description: 'Merge similar materials',
        default: false
      },
      prune: {
        type: 'boolean',
        description: 'Remove unused resources',
        default: false
      },
      resample: {
        type: 'boolean',
        description: 'Resample animations',
        default: false
      },
      resampleOptions: {
        type: 'object',
        properties: {
          fps: { type: 'number', description: 'Target frames per second' },
          tolerance: { type: 'number', description: 'Error tolerance' }
        },
        description: 'Animation resampling options'
      },
      draco: {
        type: 'boolean',
        description: 'Apply Draco compression',
        default: false
      },
      dracoOptions: {
        type: 'object',
        properties: {
          compressionLevel: { type: 'number', minimum: 0, maximum: 10 },
          quantizePosition: { type: 'number', minimum: 0, maximum: 16 },
          quantizeNormal: { type: 'number', minimum: 0, maximum: 16 },
          quantizeTexcoord: { type: 'number', minimum: 0, maximum: 16 },
          quantizeColor: { type: 'number', minimum: 0, maximum: 16 },
          quantizeGeneric: { type: 'number', minimum: 0, maximum: 16 }
        },
        description: 'Draco compression options'
      }
    },
    required: ['inputPath']
  },
  execute: async (params: GltfTransformOptions): Promise<ProcessResult> => {
    try {
      logger.info(`Transforming glTF file: ${params.inputPath}`);
      const result = await globalGltfTransformProcessor.process(params);
      return result;
    } catch (error) {
      logger.error('glTF transform tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }
};

/**
 * glTF Transform Optimize Tool (Preset-based)
 */
export const gltfTransformOptimizeTool: MCPTool = {
  name: 'gltf_transform_optimize',
  description: 'Optimize glTF files using gltf-transform with default optimization settings',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file'
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)'
      }
    },
    required: ['inputPath']
  },
  execute: async (params: { inputPath: string; outputPath?: string }): Promise<ProcessResult> => {
    try {
      logger.info(`Optimizing glTF file with transform: ${params.inputPath}`);
      const result = await globalGltfTransformProcessor.optimize(params.inputPath, params.outputPath);
      return result;
    } catch (error) {
      logger.error('glTF transform optimize tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }
};

/**
 * glTF Geometry Simplify Tool
 */
export const gltfSimplifiyTool: MCPTool = {
  name: 'gltf_simplify',
  description: 'Simplify geometry in glTF files to reduce polygon count',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file'
      },
      ratio: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Target ratio of vertices to keep (0.0 to 1.0)',
        default: 0.5
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)'
      }
    },
    required: ['inputPath']
  },
  execute: async (params: { inputPath: string; ratio?: number; outputPath?: string }): Promise<ProcessResult> => {
    try {
      const ratio = params.ratio || 0.5;
      logger.info(`Simplifying glTF geometry with ratio ${ratio}: ${params.inputPath}`);
      const result = await globalGltfTransformProcessor.simplify(params.inputPath, ratio, params.outputPath);
      return result;
    } catch (error) {
      logger.error('glTF simplify tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }
};

/**
 * glTF Texture Compression Tool
 */
export const gltfCompressTexturesTool: MCPTool = {
  name: 'gltf_compress_textures',
  description: 'Compress textures in glTF files',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file'
      },
      format: {
        type: 'string',
        enum: ['webp', 'jpeg', 'png'],
        description: 'Target texture format',
        default: 'webp'
      },
      quality: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Compression quality (0-100)',
        default: 80
      },
      powerOfTwo: {
        type: 'boolean',
        description: 'Resize textures to power of two dimensions',
        default: true
      },
      maxSize: {
        type: 'number',
        description: 'Maximum texture size in pixels',
        default: 2048
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)'
      }
    },
    required: ['inputPath']
  },
  execute: async (params: {
    inputPath: string;
    format?: 'webp' | 'jpeg' | 'png';
    quality?: number;
    powerOfTwo?: boolean;
    maxSize?: number;
    outputPath?: string;
  }): Promise<ProcessResult> => {
    try {
      logger.info(`Compressing textures in glTF file: ${params.inputPath}`);
      const options = {
        format: params.format || 'webp',
        quality: params.quality || 80,
        powerOfTwo: params.powerOfTwo !== false,
        maxSize: params.maxSize || 2048
      };
      const result = await globalGltfTransformProcessor.compressTextures(params.inputPath, options, params.outputPath);
      return result;
    } catch (error) {
      logger.error('glTF compress textures tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }
};

/**
 * glTF Draco Compression Tool
 */
export const gltfDracoTool: MCPTool = {
  name: 'gltf_draco',
  description: 'Apply Draco compression to glTF geometry',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'Path to the input glTF/GLB file'
      },
      compressionLevel: {
        type: 'number',
        minimum: 0,
        maximum: 10,
        description: 'Compression level (0-10, higher = better compression)',
        default: 7
      },
      quantizePosition: {
        type: 'number',
        minimum: 0,
        maximum: 16,
        description: 'Position quantization bits',
        default: 14
      },
      quantizeNormal: {
        type: 'number',
        minimum: 0,
        maximum: 16,
        description: 'Normal quantization bits',
        default: 10
      },
      quantizeTexcoord: {
        type: 'number',
        minimum: 0,
        maximum: 16,
        description: 'Texture coordinate quantization bits',
        default: 12
      },
      quantizeColor: {
        type: 'number',
        minimum: 0,
        maximum: 16,
        description: 'Color quantization bits',
        default: 8
      },
      quantizeGeneric: {
        type: 'number',
        minimum: 0,
        maximum: 16,
        description: 'Generic attribute quantization bits',
        default: 12
      },
      outputPath: {
        type: 'string',
        description: 'Optional output path (auto-generated if not provided)'
      }
    },
    required: ['inputPath']
  },
  execute: async (params: {
    inputPath: string;
    compressionLevel?: number;
    quantizePosition?: number;
    quantizeNormal?: number;
    quantizeTexcoord?: number;
    quantizeColor?: number;
    quantizeGeneric?: number;
    outputPath?: string;
  }): Promise<ProcessResult> => {
    try {
      logger.info(`Applying Draco compression to glTF file: ${params.inputPath}`);
      const options = {
        compressionLevel: params.compressionLevel || 7,
        quantizePosition: params.quantizePosition || 14,
        quantizeNormal: params.quantizeNormal || 10,
        quantizeTexcoord: params.quantizeTexcoord || 12,
        quantizeColor: params.quantizeColor || 8,
        quantizeGeneric: params.quantizeGeneric || 12
      };
      const result = await globalGltfTransformProcessor.applyDraco(params.inputPath, options, params.outputPath);
      return result;
    } catch (error) {
      logger.error('glTF Draco tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }
};

// Export all tools
export const allTools: MCPTool[] = [
  analyzeModelTool,
  optimizeModelTool,
  validateModelTool,
  getPresetsTools,
  getValidatorStatusTool,
  gltfProcessTool,
  gltfConvertTool,
  gltfTransformTool,
  gltfTransformOptimizeTool,
  gltfSimplifiyTool,
  gltfCompressTexturesTool,
  gltfDracoTool,
];
