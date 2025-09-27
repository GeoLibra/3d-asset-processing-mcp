import { MCPTool, ModelInput, ProcessResult } from '../types';
import { globalAnalyzer } from '../core/analyzer';
import { globalOptimizer } from '../core/optimizer-simple';
import { globalSimpleValidator } from '../core/validator-simple';

import { globalFileHandler } from '../utils/file-handler';
import logger from '../utils/logger';
import { GltfPipelineExecutor } from '../core/gltf-pipeline-executor';
import { GltfTransformExecutor, GltfTransformExecOptions } from '../core/gltf-transform-executor';
import { TEXTURE_ENCODERS, desiredExtFrom } from '../utils/gltf-constants';

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
          source: { type: 'string', description: 'File path, URL, or base64 data of the 3D model' },
          type: { type: 'string', enum: ['file', 'url', 'base64'], description: 'Type of input source' },
          format: { type: 'string', enum: ['gltf', 'glb', 'auto'], description: 'Expected format of the model', default: 'auto' },
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
      if (params.input.type !== 'file') await globalFileHandler.cleanup(filePath);
      return result;
    } catch (error) {
      logger.error('Analysis tool error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error), metrics: { processingTime: 0, memoryUsage: process.memoryUsage().heapUsed } };
    }
  },
};

/**
 * Model Optimization Tool
 */
/* deprecated: not exported */ const optimizeModelTool: MCPTool = {
  name: 'optimize_model',
  description: 'Optimize a 3D model using predefined presets or custom settings',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'File path, URL, or base64 data of the 3D model' },
          type: { type: 'string', enum: ['file', 'url', 'base64'], description: 'Type of input source' },
          format: { type: 'string', enum: ['gltf', 'glb', 'auto'], description: 'Expected format of the model', default: 'auto' },
        },
        required: ['source', 'type'],
      },
      preset: { type: 'string', enum: ['web-high', 'web-lite', 'mobile', 'editor-safe'], description: 'Optimization preset to use', default: 'web-high' },
      outputPath: { type: 'string', description: 'Optional output file path (if not provided, returns temporary file)', optional: true },
    },
    required: ['input'],
  },
  execute: async (params: { input: ModelInput; preset?: string; outputPath?: string; }): Promise<ProcessResult> => {
    try {
      const preset = params.preset || 'web-high';
      logger.info(`Optimizing model with preset '${preset}': ${params.input.source}`);
      const filePath = await globalFileHandler.processInput(params.input);
      const result = await globalOptimizer.optimize(filePath, preset);
      if (params.outputPath && result.success && result.data?.artifacts?.optimized) {
        await globalFileHandler.copyFile(result.data.artifacts.optimized, params.outputPath);
        result.data.artifacts.optimized = params.outputPath;
      }
      if (params.input.type !== 'file') await globalFileHandler.cleanup(filePath);
      return result;
    } catch (error) {
      logger.error('Optimization tool error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error), metrics: { processingTime: 0, memoryUsage: process.memoryUsage().heapUsed } };
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
          source: { type: 'string', description: 'File path, URL, or base64 data of the 3D model' },
          type: { type: 'string', enum: ['file', 'url', 'base64'], description: 'Type of input source' },
          format: { type: 'string', enum: ['gltf', 'glb', 'auto'], description: 'Expected format of the model', default: 'auto' },
        },
        required: ['source', 'type'],
      },
      rules: { type: 'string', enum: ['web-compatible', 'mobile-compatible', 'strict', 'basic'], description: 'Validation rule set to apply', default: 'basic' },
    },
    required: ['input'],
  },
  execute: async (params: { input: ModelInput; rules?: string; }): Promise<ProcessResult> => {
    try {
      const rules = params.rules || 'basic';
      logger.info(`Validating model with rules '${rules}': ${params.input.source}`);
      const filePath = await globalFileHandler.processInput(params.input);
      const result = await globalSimpleValidator.validate(filePath, rules);
      const validatorInfo = await globalSimpleValidator.getValidatorInfo();
      if (params.input.type !== 'file') await globalFileHandler.cleanup(filePath);

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
      return { success: false, error: error instanceof Error ? error.message : String(error), metrics: { processingTime: 0, memoryUsage: process.memoryUsage().heapUsed } };
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
  description: 'Execute gltf-pipeline CLI with pipeline-like options; returns the exact command executed',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: { type: 'string', description: 'Path to the input glTF/GLB file' },
      outputPath: { type: 'string', description: 'Optional output path (auto-generated if not provided)' },
      outputFormat: { type: 'string', enum: ['glb', 'gltf'], description: 'Output format' },
      separate: { type: 'boolean', description: 'Separate buffers' },
      separateTextures: { type: 'boolean', description: 'Extract textures to separate files' },
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
        const desiredExt = desiredExtFrom({ outputFormat: params.outputFormat });
        params.outputPath = pathMod.join(dirName, `${baseName}_processed${desiredExt}`);
      }
      const executor = new GltfPipelineExecutor();
      const command = await executor.execute(params);
      logger.info(`gltf-pipeline executed: ${command}`);
      return { success: true, data: { inputPath: params.inputPath, outputPath: params.outputPath, command }, metrics: { processingTime: Date.now() - start, memoryUsage: process.memoryUsage().heapUsed } };
    } catch (error) {
      logger.error('gltf-pipeline executor tool error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error), metrics: { processingTime: Date.now() - start, memoryUsage: process.memoryUsage().heapUsed } };
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
  description: 'Execute gltf-transform CLI with common options; returns the exact command executed',
  inputSchema: {
    type: 'object',
    properties: {
      inputPath: { type: 'string', description: 'Path to the input glTF/GLB file' },
      outputPath: { type: 'string', description: 'Optional output path (auto-generated if not provided)' },
      outputFormat: { type: 'string', enum: ['glb', 'gltf'], description: 'Output format (decides ext)' },
      draco: { type: 'boolean', description: 'Apply Draco compression' },
      textureCompress: { type: 'boolean', description: 'Compress textures' },
      // Allow standard encoders and alias 'jpg'
      textureFormat: { type: 'string', enum: ([...TEXTURE_ENCODERS, 'jpg'] as unknown as string[]), description: 'Texture encoder' },
      binary: { type: 'boolean', description: 'Alias for outputFormat=glb' },
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
        const desiredExt = desiredExtFrom({ outputFormat: params.outputFormat, binary: params.binary });
        params.outputPath = pathMod.join(dirName, `${baseName}_transformed${desiredExt}`);
      }
      const executor = new GltfTransformExecutor();
      const command = await executor.execute(params);
      logger.info(`gltf-transform executed: ${command}`);
      return { success: true, data: { inputPath: params.inputPath, outputPath: params.outputPath!, command }, metrics: { processingTime: Date.now() - start, memoryUsage: process.memoryUsage().heapUsed } };
    } catch (error) {
      logger.error('gltf-transform executor tool error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error), metrics: { processingTime: Date.now() - start, memoryUsage: process.memoryUsage().heapUsed } };
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