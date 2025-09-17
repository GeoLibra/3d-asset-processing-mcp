import { GltfProcessOptions } from './gltf-processor';
import { promisify } from 'util';
import { exec } from 'child_process';
import logger from '../utils/logger';

const execAsync = promisify(exec);

export class GltfPipelineExecutor {
  public async execute(options: GltfProcessOptions): Promise<void> {
    const command = this.buildCommand(options);
    logger.debug(`Executing command: ${command}`);

    const { stderr } = await execAsync(command);

    if (stderr && !stderr.includes('Saved')) {
      throw new Error(`gltf-pipeline error: ${stderr}`);
    }
  }

  private buildCommand(options: GltfProcessOptions): string {
    const commands: string[] = ['gltf-pipeline'];

    if (!options.inputPath || !options.outputPath) {
      throw new Error('Input and output paths are required.');
    }

    commands.push(`-i "${options.inputPath}"`);
    commands.push(`-o "${options.outputPath}"`);

    if (options.outputFormat === 'glb') {
      commands.push('-b');
    } else if (options.outputFormat === 'gltf') {
      commands.push('-j');
    }

    if (options.separate) {
      commands.push('-s');
    }

    if (options.separateTextures) {
      commands.push('-t');
    }

    if (options.stats) {
      commands.push('--stats');
    }

    if (options.keepUnusedElements) {
      commands.push('--keepUnusedElements');
    }

    if (options.keepLegacyExtensions) {
      commands.push('--keepLegacyExtensions');
    }

    if (options.draco) {
      commands.push('-d');
      if (options.dracoOptions) {
        const { dracoOptions } = options;
        if (dracoOptions.compressionLevel !== undefined) {
          commands.push(`--draco.compressionLevel ${dracoOptions.compressionLevel}`);
        }
        if (dracoOptions.quantizePositionBits !== undefined) {
          commands.push(`--draco.quantizePositionBits ${dracoOptions.quantizePositionBits}`);
        }
        if (dracoOptions.quantizeNormalBits !== undefined) {
          commands.push(`--draco.quantizeNormalBits ${dracoOptions.quantizeNormalBits}`);
        }
        if (dracoOptions.quantizeTexcoordBits !== undefined) {
          commands.push(`--draco.quantizeTexcoordBits ${dracoOptions.quantizeTexcoordBits}`);
        }
        if (dracoOptions.quantizeColorBits !== undefined) {
          commands.push(`--draco.quantizeColorBits ${dracoOptions.quantizeColorBits}`);
        }
        if (dracoOptions.quantizeGenericBits !== undefined) {
          commands.push(`--draco.quantizeGenericBits ${dracoOptions.quantizeGenericBits}`);
        }
        if (dracoOptions.unifiedQuantization) {
          commands.push('--draco.unifiedQuantization');
        }
        if (dracoOptions.uncompressedFallback) {
          commands.push('--draco.uncompressedFallback');
        }
      }
    }

    // Since the `gltf-pipeline` tool does not directly support texture compression options,
    // we will rely on `gltf-transform` for this functionality.
    // The `textureCompress` and `textureFormat` options will be handled by the `gltf-transform` processor.

    return commands.join(' ');
  }
}