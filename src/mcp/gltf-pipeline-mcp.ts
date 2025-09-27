import { GltfProcessOptions } from '../core/gltf-processor';
import { GltfPipelineExecutor } from '../core/gltf-pipeline-executor';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { desiredExtFrom } from '../utils/gltf-constants';
import { promisify } from 'util';
import { exec } from 'child_process';

/**
 * MCP server for gltf-pipeline integration.
 * Provides a unified 'process' tool that exposes all of gltf-pipeline's functionality.
 */
export const gltfPipelineMcp = {
  name: 'gltf-pipeline',
  description: 'A comprehensive tool to process, optimize, and convert glTF/GLB files.',

  tools: {
    /**
     * Universal tool to process glTF files with a wide range of options.
     */
    process: {
      description: 'Process a glTF/GLB file with any combination of gltf-pipeline options.',
      inputSchema: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: 'Path to the input .gltf or .glb file.' },
          outputPath: { type: 'string', description: 'Path for the output file (optional).' },
          binary: { type: 'boolean', description: 'Output as binary .glb. Overrides json flag.' },
          json: { type: 'boolean', description: 'Output as .gltf with embedded resources.' },
          separate: { type: 'boolean', description: 'Output as .gltf with separate resources (.bin, .glsl).' },
          separateTextures: { type: 'boolean', description: 'Extract textures into separate files.' },
          stats: { type: 'boolean', description: 'Log statistics about the processed model.' },
          keepUnusedElements: { type: 'boolean', description: 'Keep unused materials, nodes, and meshes.' },
          keepLegacyExtensions: { type: 'boolean', description: 'Prevent conversion of legacy materials.' },
          allowAbsolute: { type: 'boolean', description: 'Allow absolute paths for external resources.' },
          draco: { type: 'boolean', description: 'Enable Draco mesh compression.' },
          dracoOptions: {
            type: 'object',
            properties: {
              compressionLevel: { type: 'number', description: 'Draco compression level (0-10).' },
              quantizePositionBits: { type: 'number', description: 'Quantization bits for position.' },
              quantizeNormalBits: { type: 'number', description: 'Quantization bits for normal.' },
              quantizeTexcoordBits: { type: 'number', description: 'Quantization bits for texture coordinates.' },
              quantizeColorBits: { type: 'number', description: 'Quantization bits for color.' },
              quantizeGenericBits: { type: 'number', description: 'Quantization bits for other attributes.' },
              unifiedQuantization: { type: 'boolean', description: 'Use a single quantization grid for all primitives.' },
              uncompressedFallback: { type: 'boolean', description: 'Add uncompressed fallback meshes.' },
            },
          },
        },
        required: ['inputPath'],
      },
      execute: async (args: GltfProcessOptions) => {
        try {
          if (!fs.existsSync(args.inputPath)) {
            return {
              success: false,
              error: `Input file not found: ${args.inputPath}`,
            };
          }
          // Normalize output flags and outputPath, then execute via executor
          if (args.outputFormat === 'glb') args.binary = true;
          if (!args.outputPath) {
            const inputExt = path.extname(args.inputPath);
            const baseName = path.basename(args.inputPath, inputExt);
            const dirName = path.dirname(args.inputPath);
            const desiredExt = desiredExtFrom({ outputFormat: args.outputFormat, binary: args.binary });
            args.outputPath = path.join(dirName, `${baseName}_processed${desiredExt}`);
          }

          const executor = new GltfPipelineExecutor();
          const command = await executor.execute(args);
          return {
            success: true,
            data: {
              inputPath: args.inputPath,
              outputPath: args.outputPath,
              command
            }
          };
        } catch (error) {
          logger.error('MCP process tool error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },
  },

  resources: {
    /**
     * Get information about the installed gltf-pipeline CLI.
     */
    info: {
      description: 'Get version and details about the gltf-pipeline CLI.',
      fetch: async () => {
        try {
          const { stdout } = await promisify(exec)('gltf-pipeline --version');
          return {
            version: stdout.trim(),
            description: 'Command-line tools for optimizing glTF assets.',
            website: 'https://github.com/CesiumGS/gltf-pipeline',
            isInstalled: true,
          };
        } catch (error) {
          logger.warn('Could not retrieve gltf-pipeline version. It may not be installed globally.');
          return {
            error: 'Failed to get gltf-pipeline version. Ensure it is installed and in your PATH.',
            isInstalled: false,
          };
        }
      },
    },
  },
};