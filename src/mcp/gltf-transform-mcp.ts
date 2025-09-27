import logger from '../utils/logger';
import * as fs from 'fs';
import { GltfTransformExecutor, GltfTransformExecOptions } from '../core/gltf-transform-executor';

/**
 * MCP server for gltf-transform integration
 */
export const gltfTransformMcp = {
  name: 'gltf-transform',
  description: 'Process glTF/GLB files using gltf-transform library',

  tools: {
    /**
     * Process a glTF file with custom options
     */
    process: {
      description: 'Process a glTF file with custom options',
      inputSchema: {
        type: 'object',
        properties: {
          inputPath: {
            type: 'string',
            description: 'Path to the input file'
          },
          outputPath: {
            type: 'string',
            description: 'Path to the output file (optional)'
          },
          optimize: {
            type: 'boolean',
            description: 'Apply all optimizations'
          },
          simplify: {
            type: 'boolean',
            description: 'Simplify geometry'
          },
          simplifyOptions: {
            type: 'object',
            description: 'Options for simplification'
          },
          weld: {
            type: 'boolean',
            description: 'Weld vertices'
          },
          compressTextures: {
            type: 'boolean',
            description: 'Compress textures'
          },
          textureOptions: {
            type: 'object',
            description: 'Options for texture compression'
          },
          draco: {
            type: 'boolean',
            description: 'Apply Draco compression'
          },
          dracoOptions: {
            type: 'object',
            description: 'Options for Draco compression'
          }
        },
        required: ['inputPath']
      },
      execute: async (args: GltfTransformExecOptions) => {
        try {
          if (!fs.existsSync(args.inputPath)) {
            return {
              success: false,
              error: `Input file not found: ${args.inputPath}`
            };
          }

          const executor = new GltfTransformExecutor();
          const command = await executor.execute(args);
          return { success: true, data: { inputPath: args.inputPath, outputPath: args.outputPath, command } };
        } catch (error) {
          logger.error('MCP process error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    },

    /**
     * Optimize a glTF file
     */
    optimize: {
      description: 'Optimize a glTF file with default settings',
      inputSchema: {
        type: 'object',
        properties: {
          inputPath: {
            type: 'string',
            description: 'Path to the input file'
          },
          outputPath: {
            type: 'string',
            description: 'Path to the output file (optional)'
          }
        },
        required: ['inputPath']
      },
      execute: async (args: { inputPath: string; outputPath?: string }) => {
        try {
          if (!fs.existsSync(args.inputPath)) {
            return {
              success: false,
              error: `Input file not found: ${args.inputPath}`
            };
          }

          const executor = new GltfTransformExecutor();
          const command = await executor.execute({ inputPath: args.inputPath, outputPath: args.outputPath });
          return { success: true, data: { inputPath: args.inputPath, outputPath: args.outputPath, command } };
        } catch (error) {
          logger.error('MCP optimize error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    },

    /**
     * Simplify a glTF file's geometry
     */
    simplify: {
      description: 'Simplify a glTF file\'s geometry',
      inputSchema: {
        type: 'object',
        properties: {
          inputPath: {
            type: 'string',
            description: 'Path to the input file'
          },
          outputPath: {
            type: 'string',
            description: 'Path to the output file (optional)'
          },
          ratio: {
            type: 'number',
            description: 'Target ratio (0-1) of vertices to keep (default: 0.5)'
          }
        },
        required: ['inputPath']
      },
      execute: async (args: { inputPath: string; outputPath?: string; ratio?: number }) => {
        try {
          if (!fs.existsSync(args.inputPath)) {
            return {
              success: false,
              error: `Input file not found: ${args.inputPath}`
            };
          }

          const executor = new GltfTransformExecutor();
          const command = await executor.execute({ inputPath: args.inputPath, outputPath: args.outputPath, simplify: true, simplifyOptions: { ratio: args.ratio ?? 0.5 } });
          return { success: true, data: { inputPath: args.inputPath, outputPath: args.outputPath, command } };
        } catch (error) {
          logger.error('MCP simplify error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    }
  },

  resources: {
    /**
     * Get information about gltf-transform
     */
    info: {
      description: 'Get information about gltf-transform',
      uri: 'info',
      resolve: async () => {
        return {
          name: 'gltf-transform',
          version: '@gltf-transform/core version from package.json',
          description: 'A library for transforming glTF 3D models',
          capabilities: [
            'Mesh optimization',
            'Texture compression',
            'Draco compression',
            'Animation optimization',
            'Scene structure optimization'
          ]
        };
      }
    }
  }
};