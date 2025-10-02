import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import logger from '../utils/logger';
import {
  desiredExtFrom,
  TextureEncoder,
  normalizeEncoder,
} from '../utils/gltf-constants';

const execAsync = promisify(exec);

export interface GltfTransformExecOptions {
  inputPath: string;
  outputPath?: string;
  // Decide output ext by either explicit outputFormat or presence of binary flag
  outputFormat?: 'glb' | 'gltf';
  binary?: boolean;

  // Inspection
  inspect?: boolean;
  validate?: boolean;

  // Package operations
  optimize?: boolean;
  copy?: boolean;
  merge?: string[];
  partition?: boolean;
  dedup?: boolean;
  prune?: boolean;
  gzip?: boolean;

  // Scene operations
  center?: boolean;
  instance?: boolean;
  flatten?: boolean;
  join?: boolean;

  // Geometry operations
  draco?: boolean;
  dracoOptions?: Record<string, string | number | boolean>;
  meshopt?: boolean;
  quantize?: boolean;
  dequantize?: boolean;
  weld?: boolean;
  unweld?: boolean;
  tangents?: boolean;
  unwrap?: boolean;
  reorder?: boolean;
  simplify?: boolean;
  simplifyOptions?: {
    ratio?: number;
  };

  // Material operations
  metalrough?: boolean;
  palette?: boolean;
  unlit?: boolean;

  // Texture operations
  resize?: { width?: number; height?: number };
  etc1s?: boolean; // KTX2 + Basis ETC1S compression
  uastc?: boolean; // KTX2 + Basis UASTC compression
  ktxdecompress?: boolean;
  ktxfix?: boolean;
  avif?: boolean;
  webp?: boolean;
  png?: boolean;
  jpeg?: boolean;
  textureOptions?: Record<string, any>;

  // Animation operations
  resample?: boolean;
  sequence?: boolean;
  sparse?: boolean;

  // Global options
  vertexLayout?: 'interleaved' | 'separate';

  // Legacy support
  textureCompress?: boolean | string;
  textureFormat?: TextureEncoder | 'jpg';
  compress?: string;
}

/**
 * Generic executor that builds and runs gltf-transform CLI commands.
 * - Logs full command at info level
 * - Returns the exact command string executed
 * - Supports multi-step processing for complex operations
 */
export class GltfTransformExecutor {
  public async execute(options: GltfTransformExecOptions): Promise<string> {
    // Check if this requires multi-step processing
    const steps = this.planExecutionSteps(options);

    if (steps.length === 1) {
      // Single step execution
      const command = this.buildCommand(options);
      logger.info(`Executing command: ${command}`);

      const { stderr } = await execAsync(command);

      if (stderr && /error|failed|exception/i.test(stderr)) {
        throw new Error(`gltf-transform error: ${stderr}`);
      }
      return command;
    } else {
      // Multi-step execution
      return await this.executeMultiStep(steps, options);
    }
  }

  private planExecutionSteps(options: GltfTransformExecOptions): string[] {
    const steps: string[] = [];

    // Handle inspection commands first (single step, no output)
    if (options.inspect) return ['inspect'];
    if (options.validate) return ['validate'];

    // For multi-step operations, we need to determine the order
    // Priority: geometry compression -> texture compression -> other operations

    if (options.meshopt) steps.push('meshopt');
    if (options.draco) steps.push('draco');
    if (options.quantize) steps.push('quantize');
    if (options.weld) steps.push('weld');
    if (options.simplify) steps.push('simplify');

    // Texture operations
    if (options.etc1s) steps.push('etc1s');
    if (options.uastc) steps.push('uastc');
    if (options.webp) steps.push('webp');
    if (options.avif) steps.push('avif');
    if (options.png) steps.push('png');
    if (options.jpeg) steps.push('jpeg');

    // Other operations
    if (options.optimize) steps.push('optimize');
    if (options.dedup) steps.push('dedup');
    if (options.prune) steps.push('prune');

    // If no specific operations, default to copy
    if (steps.length === 0) steps.push('copy');

    return steps;
  }

  private async executeMultiStep(steps: string[], options: GltfTransformExecOptions): Promise<string> {
    const inputExt = path.extname(options.inputPath);
    const baseName = path.basename(options.inputPath, inputExt);
    const dirName = path.dirname(options.inputPath);
    const desiredExt = desiredExtFrom({
      outputFormat: options.outputFormat,
      binary: options.binary
    });

    let currentInput = options.inputPath;
    const commands: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isLastStep = i === steps.length - 1;

      // Determine output path for this step
      let stepOutput: string;
      if (isLastStep) {
        // Final output
        stepOutput = options.outputPath || path.join(dirName, `${baseName}_processed${desiredExt}`);
      } else {
        // Intermediate file
        stepOutput = path.join(dirName, `${baseName}_step${i + 1}_${step}${inputExt}`);
      }

      // Build command for this step
      const stepOptions: GltfTransformExecOptions = {
        ...options,
        inputPath: currentInput,
        outputPath: stepOutput,
        // Clear all other operations except the current one
        meshopt: step === 'meshopt',
        draco: step === 'draco',
        etc1s: step === 'etc1s',
        uastc: step === 'uastc',
        webp: step === 'webp',
        avif: step === 'avif',
        png: step === 'png',
        jpeg: step === 'jpeg',
        optimize: step === 'optimize',
        dedup: step === 'dedup',
        prune: step === 'prune',
        quantize: step === 'quantize',
        weld: step === 'weld',
        simplify: step === 'simplify',
      };

      const command = this.buildCommand(stepOptions);
      logger.info(`Executing step ${i + 1}/${steps.length}: ${command}`);

      const { stderr } = await execAsync(command);

      if (stderr && /error|failed|exception/i.test(stderr)) {
        throw new Error(`gltf-transform error in step ${i + 1}: ${stderr}`);
      }

      commands.push(command);
      currentInput = stepOutput;

      // Clean up intermediate files (except the final output)
      if (!isLastStep && i > 0) {
        try {
          const previousFile = path.join(dirName, `${baseName}_step${i}_${steps[i-1]}${inputExt}`);
          if (previousFile !== options.inputPath) {
            await execAsync(`rm "${previousFile}"`);
          }
        } catch (error) {
          logger.warn(`Failed to clean up intermediate file: ${error}`);
        }
      }
    }

    return commands.join(' && ');
  }

  private buildCommand(options: GltfTransformExecOptions): string {
    if (!options.inputPath) {
      throw new Error('Input path is required.');
    }

    const parts: string[] = ['gltf-transform'];
    let primaryCommand: string | null = null;
    const flags: string[] = [];

    // Handle inspection commands (no output file needed)
    if (options.inspect) {
      parts.push('inspect', `"${options.inputPath}"`);
      return parts.join(' ');
    }

    if (options.validate) {
      parts.push('validate', `"${options.inputPath}"`);
      return parts.join(' ');
    }

    // Compute output path if not provided
    const inputExt = path.extname(options.inputPath);
    const baseName = path.basename(options.inputPath, inputExt);
    const dirName = path.dirname(options.inputPath);
    const desiredExt = desiredExtFrom({
      outputFormat: options.outputFormat,
      binary: options.binary,
    });
    const outputPath =
      options.outputPath ||
      path.join(dirName, `${baseName}_transformed${desiredExt}`);

    // Select primary CLI command based on priority
    if (options.optimize) {
      primaryCommand = 'optimize';
      // Add optimize-specific flags
      if (options.compress) {
        flags.push('--compress', options.compress);
      }
      if (options.textureCompress) {
        flags.push(
          '--texture-compress',
          typeof options.textureCompress === 'string'
            ? options.textureCompress
            : 'webp'
        );
      }
    } else if (options.merge && options.merge.length > 0) {
      primaryCommand = 'merge';
    } else if (options.draco) {
      primaryCommand = 'draco';
    } else if (options.meshopt) {
      primaryCommand = 'meshopt';
    } else if (options.simplify) {
      primaryCommand = 'simplify';
    } else if (options.weld) {
      primaryCommand = 'weld';
    } else if (options.unweld) {
      primaryCommand = 'unweld';
    } else if (options.quantize) {
      primaryCommand = 'quantize';
    } else if (options.dequantize) {
      primaryCommand = 'dequantize';
    } else if (options.tangents) {
      primaryCommand = 'tangents';
    } else if (options.unwrap) {
      primaryCommand = 'unwrap';
    } else if (options.reorder) {
      primaryCommand = 'reorder';
    } else if (options.center) {
      primaryCommand = 'center';
    } else if (options.instance) {
      primaryCommand = 'instance';
    } else if (options.flatten) {
      primaryCommand = 'flatten';
    } else if (options.join) {
      primaryCommand = 'join';
    } else if (options.metalrough) {
      primaryCommand = 'metalrough';
    } else if (options.palette) {
      primaryCommand = 'palette';
    } else if (options.unlit) {
      primaryCommand = 'unlit';
    } else if (options.resize) {
      primaryCommand = 'resize';
    } else if (options.etc1s) {
      primaryCommand = 'etc1s';
    } else if (options.uastc) {
      primaryCommand = 'uastc';
    } else if (options.ktxdecompress) {
      primaryCommand = 'ktxdecompress';
    } else if (options.ktxfix) {
      primaryCommand = 'ktxfix';
    } else if (options.avif) {
      primaryCommand = 'avif';
    } else if (options.webp) {
      primaryCommand = 'webp';
    } else if (options.png) {
      primaryCommand = 'png';
    } else if (options.jpeg) {
      primaryCommand = 'jpeg';
    } else if (options.resample) {
      primaryCommand = 'resample';
    } else if (options.sequence) {
      primaryCommand = 'sequence';
    } else if (options.sparse) {
      primaryCommand = 'sparse';
    } else if (options.dedup) {
      primaryCommand = 'dedup';
    } else if (options.prune) {
      primaryCommand = 'prune';
    } else if (options.partition) {
      primaryCommand = 'partition';
    } else if (options.gzip) {
      primaryCommand = 'gzip';
    } else if (options.textureCompress) {
      // Legacy support
      const fmt = String(options.textureFormat || '').toLowerCase();
      primaryCommand =
        fmt === 'jpeg' || fmt === 'jpg'
          ? 'jpeg'
          : fmt === 'png'
          ? 'png'
          : fmt === 'avif'
          ? 'avif'
          : fmt === 'etc1s'
          ? 'etc1s'
          : fmt === 'uastc'
          ? 'uastc'
          : 'webp';
    } else {
      primaryCommand = 'copy';
    }

    // Add command-specific flags
    if (
      primaryCommand === 'simplify' &&
      options.simplifyOptions?.ratio != null
    ) {
      flags.push('--ratio', String(options.simplifyOptions.ratio));
    }

    if (primaryCommand === 'draco' && options.dracoOptions) {
      for (const [k, v] of Object.entries(options.dracoOptions)) {
        if (v === undefined || v === null) continue;
        flags.push(`--${k}`, String(v));
      }
    }

    if (primaryCommand === 'resize' && options.resize) {
      if (options.resize.width)
        flags.push('--width', String(options.resize.width));
      if (options.resize.height)
        flags.push('--height', String(options.resize.height));
    }

    // Add global flags
    if (options.vertexLayout) {
      flags.push('--vertex-layout', options.vertexLayout);
    }

    // Build final command
    parts.push(primaryCommand || 'copy');

    // Handle merge command differently (multiple inputs, then output)
    if (primaryCommand === 'merge') {
      parts.push(`"${options.inputPath}"`);
      // Add additional input files
      if (options.merge) {
        for (const file of options.merge) {
          parts.push(`"${file}"`);
        }
      }
      parts.push(`"${outputPath}"`);
    } else {
      parts.push(`"${options.inputPath}"`, `"${outputPath}"`);
    }

    if (flags.length) parts.push(...flags);

    return parts.join(' ');
  }
}

// Global instance if needed elsewhere
export const globalGltfTransformExecutor = new GltfTransformExecutor();
