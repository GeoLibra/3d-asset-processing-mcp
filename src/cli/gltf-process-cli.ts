#!/usr/bin/env node

import { Command } from 'commander';
import { globalGltfProcessor } from '../core/gltf-processor';
import logger from '../utils/logger';
import * as path from 'path';

const program = new Command();

program
  .name('gltf-process')
  .description('Process glTF/GLB files using gltf-pipeline')
  .version('1.0.0');

// Convert command
program
  .command('convert')
  .description('Convert between glTF and GLB formats')
  .argument('<input>', 'Input file path')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format (glb or gltf)', /^(glb|gltf)$/i)
  .action(async (input, options) => {
    try {
      const format = options.format?.toLowerCase() ||
                    (path.extname(input).toLowerCase() === '.glb' ? 'gltf' : 'glb');

      const result = await globalGltfProcessor.convert(input, format as 'glb' | 'gltf', options.output);

      if (result.success && result.data) {
        logger.info(`Conversion successful!`);
        logger.info(`Input: ${result.data.inputPath} (${formatSize(result.data.stats.inputSize)})`);
        logger.info(`Output: ${result.data.outputPath} (${formatSize(result.data.stats.outputSize)})`);
        logger.info(`Compression ratio: ${result.data.stats.compressionRatio.toFixed(2)}%`);
      } else {
        logger.error(`Conversion failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Error:', error);
      process.exit(1);
    }
  });

// Extract textures command
program
  .command('extract-textures')
  .description('Extract textures from a glTF/GLB file')
  .argument('<input>', 'Input file path')
  .option('-o, --output <path>', 'Output file path')
  .action(async (input, options) => {
    try {
      const result = await globalGltfProcessor.extractTextures(input, options.output);

      if (result.success && result.data) {
        logger.info(`Texture extraction successful!`);
        logger.info(`Input: ${result.data.inputPath} (${formatSize(result.data.stats.inputSize)})`);
        logger.info(`Output: ${result.data.outputPath} (${formatSize(result.data.stats.outputSize)})`);
        logger.info(`Textures extracted: ${result.data.stats.textureCount}`);
        logger.info(`Total texture size: ${formatSize(result.data.stats.totalTextureSize || 0)}`);
      } else {
        logger.error(`Texture extraction failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Error:', error);
      process.exit(1);
    }
  });

// Optimize command
program
  .command('optimize')
  .description('Optimize a glTF/GLB file')
  .argument('<input>', 'Input file path')
  .option('-o, --output <path>', 'Output file path')
  .option('--draco', 'Apply Draco compression')
  .option('--draco-level <level>', 'Draco compression level (1-10)', parseInt)
  .option('--no-geometry', 'Skip geometry compression')
  .option('--no-textures', 'Skip texture compression')
  .option('--remove-normals', 'Remove normal data')
  .option('--strip-empty', 'Strip empty nodes')
  .action(async (input, options) => {
    try {
      const dracoOptions = options.dracoLevel ? { compressionLevel: options.dracoLevel } : undefined;

      const result = await globalGltfProcessor.optimize(input, {
        draco: options.draco,
        dracoOptions,
        compressGeometry: options.geometry,
        compressTextures: options.textures,
        removeNormals: options.removeNormals,
        stripEmptyNodes: options.stripEmpty
      }, options.output);

      if (result.success && result.data) {
        logger.info(`Optimization successful!`);
        logger.info(`Input: ${result.data.inputPath} (${formatSize(result.data.stats.inputSize)})`);
        logger.info(`Output: ${result.data.outputPath} (${formatSize(result.data.stats.outputSize)})`);
        logger.info(`Compression ratio: ${result.data.stats.compressionRatio.toFixed(2)}%`);
      } else {
        logger.error(`Optimization failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Error:', error);
      process.exit(1);
    }
  });

// Custom process command
program
  .command('process')
  .description('Process a glTF/GLB file with custom options')
  .argument('<input>', 'Input file path')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format (glb or gltf)', /^(glb|gltf)$/i)
  .option('-t, --separate-textures', 'Extract textures to separate files')
  .option('--compress-textures', 'Compress textures')
  .option('--optimize', 'Apply general optimizations')
  .option('--draco', 'Apply Draco compression')
  .option('--draco-level <level>', 'Draco compression level (1-10)', parseInt)
  .option('--remove-normals', 'Remove normal data')
  .option('--strip-empty', 'Strip empty nodes')
  .action(async (input, options) => {
    try {
      const dracoOptions = options.dracoLevel ? { compressionLevel: options.dracoLevel } : undefined;

      const result = await globalGltfProcessor.process({
        inputPath: input,
        outputPath: options.output,
        outputFormat: options.format,
        separateTextures: options.separateTextures,
        textureCompress: options.compressTextures,
        optimize: options.optimize,
        draco: options.draco,
        dracoOptions,
        removeNormals: options.removeNormals,
        stripEmptyNodes: options.stripEmpty
      });

      if (result.success && result.data) {
        logger.info(`Processing successful!`);
        logger.info(`Input: ${result.data.inputPath} (${formatSize(result.data.stats.inputSize)})`);
        logger.info(`Output: ${result.data.outputPath} (${formatSize(result.data.stats.outputSize)})`);
        logger.info(`Compression ratio: ${result.data.stats.compressionRatio.toFixed(2)}%`);

        if (result.data.stats.textureCount) {
          logger.info(`Textures extracted: ${result.data.stats.textureCount}`);
          logger.info(`Total texture size: ${formatSize(result.data.stats.totalTextureSize || 0)}`);
        }
      } else {
        logger.error(`Processing failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Error:', error);
      process.exit(1);
    }
  });

// Helper function to format file sizes
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

program.parse();