import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import logger from '../utils/logger';
import { desiredExtFrom, TextureEncoder, normalizeEncoder } from '../utils/gltf-constants';

const execAsync = promisify(exec);

export interface GltfTransformExecOptions {
  inputPath: string;
  outputPath?: string;
  // Decide output ext by either explicit outputFormat or presence of binary flag
  outputFormat?: 'glb' | 'gltf';
  binary?: boolean;

  // Common transforms
  optimize?: boolean; // default: true
  simplify?: boolean;
  simplifyOptions?: {
    ratio?: number;
  };
  draco?: boolean;
  dracoOptions?: Record<string, string | number | boolean>;
  textureCompress?: boolean;
  textureFormat?: TextureEncoder | 'jpg';
}

/**
 * Generic executor that builds and runs gltf-transform CLI commands.
 * - Logs full command at info level
 * - Returns the exact command string executed
 */
export class GltfTransformExecutor {
  public async execute(options: GltfTransformExecOptions): Promise<string> {
    const command = this.buildCommand(options);
    logger.info(`Executing command: ${command}`);

    const { stderr } = await execAsync(command);

    // gltf-transform may output non-fatal logs to stderr; only throw on clear errors.
    if (stderr && /error|failed|exception/i.test(stderr)) {
      throw new Error(`gltf-transform error: ${stderr}`);
    }
    return command;
  }

  private buildCommand(options: GltfTransformExecOptions): string {
    if (!options.inputPath) {
      throw new Error('Input path is required.');
    }
    // Compute output path if not provided
    const inputExt = path.extname(options.inputPath);
    const baseName = path.basename(options.inputPath, inputExt);
    const dirName = path.dirname(options.inputPath);
    const desiredExt = desiredExtFrom({ outputFormat: options.outputFormat, binary: options.binary });
    const outputPath = options.outputPath || path.join(dirName, `${baseName}_transformed${desiredExt}`);

    // Base command: gltf-transform <command> "input" "output" [flags]
    const parts: string[] = ['gltf-transform'];
    let primaryCommand: string | null = null;

    // Select primary CLI command.
    if (options.textureCompress) {
      const fmt = String(options.textureFormat || '').toLowerCase();
      primaryCommand = (fmt === 'jpeg' || fmt === 'jpg') ? 'jpeg'
                      : (fmt === 'png') ? 'png'
                      : (fmt === 'avif') ? 'avif'
                      : (fmt === 'etc1s') ? 'etc1s'
                      : (fmt === 'uastc') ? 'uastc'
                      : 'webp';
    } else if (options.optimize !== false) {
      primaryCommand = 'optimize';
    } else if (options.simplify) {
      primaryCommand = 'simplify';
    } else if (options.draco) {
      primaryCommand = 'draco';
    } else {
      primaryCommand = 'copy';
    }

    const flags: string[] = [];
    if (primaryCommand === 'simplify' && options.simplifyOptions?.ratio != null) {
      flags.push('--ratio', String(options.simplifyOptions.ratio));
    }
    if (primaryCommand === 'draco' && options.dracoOptions) {
      for (const [k, v] of Object.entries(options.dracoOptions)) {
        if (v === undefined || v === null) continue;
        flags.push(`--${k}`, String(v));
      }
    }

    parts.push(primaryCommand || 'copy');
    parts.push(`"${options.inputPath}"`, `"${outputPath}"`);
    if (flags.length) parts.push(...flags);

    return parts.join(' ');
  }
}

// Global instance if needed elsewhere
export const globalGltfTransformExecutor = new GltfTransformExecutor();