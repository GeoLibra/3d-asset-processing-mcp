import { MCPTool, ModelInput, ProcessResult } from '../types';
import { globalAnalyzer } from '../core/analyzer';
import { globalOptimizer } from '../core/optimizer-simple';
import { globalSimpleValidator } from '../core/validator-simple';
import { globalFileHandler } from '../utils/file-handler';
import logger from '../utils/logger';

/**
 * Model Analysis Tool
 */
export const analyzeModelTool: MCPTool = {
  name: 'analyze_model',
  description: 'Analyze a 3D model and provide detailed statistics and recommendations',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'File path, URL, or base64 data of the 3D model'
          },
          type: {
            type: 'string',
            enum: ['file', 'url', 'base64'],
            description: 'Type of input source'
          },
          format: {
            type: 'string',
            enum: ['gltf', 'glb', 'auto'],
            description: 'Expected format of the model',
            default: 'auto'
          }
        },
        required: ['source', 'type']
      }
    },
    required: ['input']
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
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

/**
 * Model Optimization Tool
 */
export const optimizeModelTool: MCPTool = {
  name: 'optimize_model',
  description: 'Optimize a 3D model using predefined presets or custom settings',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'File path, URL, or base64 data of the 3D model'
          },
          type: {
            type: 'string',
            enum: ['file', 'url', 'base64'],
            description: 'Type of input source'
          },
          format: {
            type: 'string',
            enum: ['gltf', 'glb', 'auto'],
            description: 'Expected format of the model',
            default: 'auto'
          }
        },
        required: ['source', 'type']
      },
      preset: {
        type: 'string',
        enum: ['web-high', 'web-lite', 'mobile', 'editor-safe'],
        description: 'Optimization preset to use',
        default: 'web-high'
      },
      outputPath: {
        type: 'string',
        description: 'Optional output file path (if not provided, returns temporary file)',
        optional: true
      }
    },
    required: ['input']
  },
  execute: async (params: { input: ModelInput; preset?: string; outputPath?: string }): Promise<ProcessResult> => {
    try {
      const preset = params.preset || 'web-high';
      logger.info(`Optimizing model with preset '${preset}': ${params.input.source}`);

      // Process input file
      const filePath = await globalFileHandler.processInput(params.input);

      // Perform optimization
      const result = await globalOptimizer.optimize(filePath, preset);

      // If output path is specified, copy the file
      if (params.outputPath && result.success && result.data?.artifacts?.optimized) {
        await globalFileHandler.copyFile(result.data.artifacts.optimized, params.outputPath);
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
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
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
            description: 'File path, URL, or base64 data of the 3D model'
          },
          type: {
            type: 'string',
            enum: ['file', 'url', 'base64'],
            description: 'Type of input source'
          },
          format: {
            type: 'string',
            enum: ['gltf', 'glb', 'auto'],
            description: 'Expected format of the model',
            default: 'auto'
          }
        },
        required: ['source', 'type']
      },
      rules: {
        type: 'string',
        enum: ['web-compatible', 'mobile-compatible', 'strict', 'basic'],
        description: 'Validation rule set to apply',
        default: 'basic'
      }
    },
    required: ['input']
  },
  execute: async (params: { input: ModelInput; rules?: string }): Promise<ProcessResult> => {
    try {
      const rules = params.rules || 'basic';
      logger.info(`Validating model with rules '${rules}': ${params.input.source}`);

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
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

/**
 * Get Available Presets Tool
 */
export const getPresetsTools: MCPTool = {
  name: 'get_presets',
  description: 'Get list of available optimization presets',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async (): Promise<ProcessResult> => {
    try {
      const presets = globalOptimizer.getAvailablePresets();
      return {
        success: true,
        data: {
          presets,
          descriptions: {
            'web-high': 'High quality web optimization - preserves visual quality while optimizing for web delivery',
            'web-lite': 'Lightweight web optimization - prioritizes file size reduction over quality',
            'mobile': 'Mobile-optimized preset - balances quality and performance for mobile devices',
            'editor-safe': 'Editor-safe optimization - minimal changes that preserve editability'
          }
        }
      };
    } catch (error) {
      logger.error('Get presets tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

/**
 * Get Validator Status Tool
 */
export const getValidatorStatusTool: MCPTool = {
  name: 'get_validator_status',
  description: 'Check the status and availability of gltf-validator',
  inputSchema: {
    type: 'object',
    properties: {}
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
            : 'Install gltf-validator for more accurate validation: npm install -g gltf-validator'
        }
      };
    } catch (error) {
      logger.error('Get validator status tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
  getValidatorStatusTool
];