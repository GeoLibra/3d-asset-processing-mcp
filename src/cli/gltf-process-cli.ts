#!/usr/bin/env node

import { Command } from 'commander';
import { GltfProcessOptions } from '../core/gltf-processor';
import { GltfPipelineExecutor } from '../core/gltf-pipeline-executor';
import * as path from 'path';
import * as fs from 'fs';
import logger from '../utils/logger';
import { desiredExtFrom } from '../utils/gltf-constants';

const program = new Command();

program
  .name('gltf-process')
  .description('A universal command to process glTF/GLB files using gltf-pipeline, supporting all its features through a unified interface.')
  .version('2.0.0')
  .argument('<input>', 'Input file path')
  .option('-o, --output <path>', 'Output file path')
  .option('-b, --binary', 'Output as binary glb')
  .option('-j, --json', 'Output as standard gltf with embedded resources')
  .option('-s, --separate', 'Output as standard gltf with separate resources (.bin, .glsl)')
  .option('-t, --separate-textures', 'Extract textures to separate files')
  .option('--stats', 'Print statistics about the processed model')
  .option('--keep-unused-elements', 'Keeps unused materials, nodes, and meshes')
  .option('--keep-legacy-extensions', 'Keeps legacy extensions like KHR_materials_common')
  .option('-d, --draco', 'Apply Draco compression')
  .option('--draco.compressionLevel <level>', 'Draco: compression level (0-10)', parseInt)
  .option('--draco.quantizePositionBits <bits>', 'Draco: quantization bits for position', parseInt)
  .option('--draco.quantizeNormalBits <bits>', 'Draco: quantization bits for normal', parseInt)
  .option('--draco.quantizeTexcoordBits <bits>', 'Draco: quantization bits for texcoord', parseInt)
  .option('--draco.quantizeColorBits <bits>', 'Draco: quantization bits for color', parseInt)
  .option('--draco.quantizeGenericBits <bits>', 'Draco: quantization bits for generic attributes', parseInt)
  .option('--draco.unifiedQuantization', 'Draco: use unified quantization')
  .option('--draco.uncompressedFallback', 'Draco: add uncompressed fallback mesh')
  .action(async (input, options) => {
    try {
      if (!fs.existsSync(input)) {
        logger.error(`Input file not found: ${input}`);
        process.exit(1);
      }

      const processOptions: GltfProcessOptions = {
        inputPath: input,
        outputPath: options.output,
        binary: options.binary,
        json: options.json,
        separate: options.separate,
        separateTextures: options.separateTextures,
        stats: options.stats,
        keepUnusedElements: options.keepUnusedElements,
        keepLegacyExtensions: options.keepLegacyExtensions,
        draco: options.draco,
        dracoOptions: {
          compressionLevel: options['draco.compressionLevel'],
          quantizePositionBits: options['draco.quantizePositionBits'],
          quantizeNormalBits: options['draco.quantizeNormalBits'],
          quantizeTexcoordBits: options['draco.quantizeTexcoordBits'],
          quantizeColorBits: options['draco.quantizeColorBits'],
          quantizeGenericBits: options['draco.quantizeGenericBits'],
          unifiedQuantization: options['draco.unifiedQuantization'],
          uncompressedFallback: options['draco.uncompressedFallback'],
        },
      };

      // Map outputFormat from flags and ensure outputPath
      if (processOptions.binary) processOptions.outputFormat = 'glb';
      else if (processOptions.json) processOptions.outputFormat = 'gltf';

      if (!processOptions.outputPath) {
        const inputExt = path.extname(processOptions.inputPath);
        const baseName = path.basename(processOptions.inputPath, inputExt);
        const dirName = path.dirname(processOptions.inputPath);
        const desiredExt = desiredExtFrom({ outputFormat: processOptions.outputFormat });
        processOptions.outputPath = path.join(dirName, `${baseName}_processed${desiredExt}`);
      }

      const executor = new GltfPipelineExecutor();
      const command = await executor.execute(processOptions);

      logger.info(`Processing successful!`);
      logger.info(`Command: ${command}`);
      logger.info(`Input: ${processOptions.inputPath}`);
      logger.info(`Output: ${processOptions.outputPath}`);
    } catch (error) {
      logger.error('An unexpected error occurred:', error);
      process.exit(1);
    }
  });

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

program.parse();