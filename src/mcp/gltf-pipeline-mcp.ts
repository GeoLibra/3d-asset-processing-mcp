import { globalGltfProcessor, GltfProcessOptions } from '../core/gltf-processor';
import logger from '../utils/logger';
import * as fs from 'fs';

/**
 * MCP server for gltf-pipeline integration
 */
export const gltfPipelineMcp = {
  name: 'gltf-pipeline',
  description: 'Process glTF/GLB files using gltf-pipeline',

  tools: {
    /**
     * Convert between glTF and GLB formats
     */
    convert: {
      description: 'Convert between glTF and GLB formats',
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
          format: {
            type: 'string',
            enum: ['glb', 'gltf'],
            description: 'Output format (glb or gltf)'
          }
        },
        required: ['inputPath']
      },
      execute: async (args: { inputPath: string; outputPath?: string; format?: 'glb' | 'gltf' }) => {
        try {
          if (!fs.existsSync(args.inputPath)) {
            return {
              success: false,
              error: `Input file not found: ${args.inputPath}`
            };
          }

          const format = args.format || (args.inputPath.toLowerCase().endsWith('.glb') ? 'gltf' : 'glb');
          const result = await globalGltfProcessor.convert(args.inputPath, format, args.outputPath);

          return result;
        } catch (error) {
          logger.error('MCP convert error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    },

    /**
     * Extract textures from a glTF/GLB file
     */
    extractTextures: {
      description: 'Extract textures from a glTF/GLB file',
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

          const result = await globalGltfProcessor.extractTextures(args.inputPath, args.outputPath);

          return result;
        } catch (error) {
          logger.error('MCP extract textures error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    },

    /**
     * Optimize a glTF/GLB file
     */
    optimize: {
      description: 'Optimize a glTF/GLB file',
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
          draco: {
            type: 'boolean',
            description: 'Apply Draco compression'
          },
          dracoOptions: {
            type: 'object',
            properties: {
              compressionLevel: {
                type: 'number',
                description: 'Draco compression level (1-10)'
              },
              quantizePosition: {
                type: 'number',
                description: 'Position quantization bits'
              },
              quantizeNormal: {
                type: 'number',
                description: 'Normal quantization bits'
              },
              quantizeTexcoord: {
                type: 'number',
                description: 'Texture coordinate quantization bits'
              },
              quantizeColor: {
                type: 'number',
                description: 'Color quantization bits'
              },
              quantizeGeneric: {
                type: 'number',
                description: 'Generic attribute quantization bits'
              }
            }
          },
          compressGeometry: {
            type: 'boolean',
            description: 'Apply geometry compression'
          },
          compressTextures: {
            type: 'boolean',
            description: 'Apply texture compression'
          },
          removeNormals: {
            type: 'boolean',
            description: 'Remove normal data'
          },
          stripEmptyNodes: {
            type: 'boolean',
            description: 'Strip empty nodes'
          }
        },
        required: ['inputPath']
      },
      execute: async (args: {
        inputPath: string;
        outputPath?: string;
        draco?: boolean;
        dracoOptions?: any;
        compressGeometry?: boolean;
        compressTextures?: boolean;
        removeNormals?: boolean;
        stripEmptyNodes?: boolean;
      }) => {
        try {
          if (!fs.existsSync(args.inputPath)) {
            return {
              success: false,
              error: `Input file not found: ${args.inputPath}`
            };
          }

          const result = await globalGltfProcessor.optimize(
            args.inputPath,
            {
              draco: args.draco,
              dracoOptions: args.dracoOptions,
              compressGeometry: args.compressGeometry,
              compressTextures: args.compressTextures,
              removeNormals: args.removeNormals,
              stripEmptyNodes: args.stripEmptyNodes
            },
            args.outputPath
          );

          return result;
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
     * Process a glTF/GLB file with custom options
     */
    process: {
      description: 'Process a glTF/GLB file with custom options',
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
          outputFormat: {
            type: 'string',
            enum: ['glb', 'gltf'],
            description: 'Output format (glb or gltf)'
          },
          separateTextures: {
            type: 'boolean',
            description: 'Extract textures to separate files'
          },
          textureCompress: {
            type: 'boolean',
            description: 'Compress textures'
          },
          textureFormat: {
            type: 'string',
            enum: ['webp', 'jpg', 'png'],
            description: 'Texture format'
          },
          optimize: {
            type: 'boolean',
            description: 'Apply general optimizations'
          },
          compressGeometry: {
            type: 'boolean',
            description: 'Apply geometry compression'
          },
          compressTextures: {
            type: 'boolean',
            description: 'Apply texture compression'
          },
          draco: {
            type: 'boolean',
            description: 'Apply Draco compression'
          },
          dracoOptions: {
            type: 'object',
            properties: {
              compressionLevel: {
                type: 'number',
                description: 'Draco compression level (1-10)'
              }
            }
          },
          removeNormals: {
            type: 'boolean',
            description: 'Remove normal data'
          },
          stripEmptyNodes: {
            type: 'boolean',
            description: 'Strip empty nodes'
          }
        },
        required: ['inputPath']
      },
      execute: async (args: GltfProcessOptions) => {
        try {
          if (!fs.existsSync(args.inputPath)) {
            return {
              success: false,
              error: `Input file not found: ${args.inputPath}`
            };
          }

          const result = await globalGltfProcessor.process(args);

          return result;
        } catch (error) {
          logger.error('MCP process error:', error);
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
     * Get information about gltf-pipeline
     */
    info: {
      description: 'Get information about gltf-pipeline',
      fetch: async () => {
        try {
          const { stdout } = await promisify(exec)('gltf-pipeline --version');
          return {
            version: stdout.trim(),
            description: 'Pipeline tools for glTF 3D models',
            website: 'https://github.com/CesiumGS/gltf-pipeline'
          };
        } catch (error) {
          return {
            error: 'Failed to get gltf-pipeline version',
            isInstalled: false
          };
        }
      }
    }
  }
};

// Import promisify for the resource
import { promisify } from 'util';
import { exec } from 'child_process';