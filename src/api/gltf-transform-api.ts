import { Router } from 'express';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { GltfTransformExecutor, GltfTransformExecOptions } from '../core/gltf-transform-executor';
import { desiredExtFrom } from '../utils/gltf-constants';

const router = Router();

/**
 * Process a glTF file with custom options
 * POST /api/transform/process
 */
router.post('/process', async (req, res) => {
  try {
    const options: GltfTransformExecOptions = req.body;

    if (!options?.inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }
    if (!fs.existsSync(options.inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    // Ensure outputPath
    if (!options.outputPath) {
      const inputExt = path.extname(options.inputPath);
      const baseName = path.basename(options.inputPath, inputExt);
      const dirName = path.dirname(options.inputPath);
      const desiredExt = desiredExtFrom({ outputFormat: options.outputFormat, binary: options.binary });
      options.outputPath = path.join(dirName, `${baseName}_transformed${desiredExt}`);
    }

    const executor = new GltfTransformExecutor();
    const command = await executor.execute(options);

    res.json({
      success: true,
      data: {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        command
      }
    });
  } catch (error) {
    logger.error('API error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Optimize a glTF file
 * POST /api/transform/optimize
 */
router.post('/optimize', async (req, res) => {
  try {
    const { inputPath } = req.body as { inputPath?: string; outputPath?: string };

    if (!inputPath) return res.status(400).json({ error: 'Input path is required' });
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Input file not found' });

    const execOptions: GltfTransformExecOptions = {
      inputPath,
      outputPath: req.body.outputPath,
      outputFormat: req.body.outputFormat,
      binary: req.body.binary,
      // optimize via gltf-transform: just include 'optimize' in command via executor default pipeline
    };

    const executor = new GltfTransformExecutor();
    const command = await executor.execute(execOptions);

    res.json({ success: true, data: { inputPath, outputPath: execOptions.outputPath, command } });
  } catch (error) {
    logger.error('API error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Simplify a glTF file's geometry
 * POST /api/transform/simplify
 */
router.post('/simplify', async (req, res) => {
  try {
    const { inputPath } = req.body as { inputPath?: string; ratio?: number; outputPath?: string };

    if (!inputPath) return res.status(400).json({ error: 'Input path is required' });
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Input file not found' });

    const execOptions: GltfTransformExecOptions = {
      inputPath,
      outputPath: req.body.outputPath,
      simplify: true,
      simplifyOptions: { ratio: req.body.ratio ?? 0.5 }
    };

    const executor = new GltfTransformExecutor();
    const command = await executor.execute(execOptions);

    res.json({ success: true, data: { inputPath, outputPath: execOptions.outputPath, command } });
  } catch (error) {
    logger.error('API error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Compress textures in a glTF file
 * POST /api/transform/compress-textures
 */
router.post('/compress-textures', async (req, res) => {
  try {
    const { inputPath } = req.body as { inputPath?: string; outputPath?: string; textureOptions?: any };

    if (!inputPath) return res.status(400).json({ error: 'Input path is required' });
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Input file not found' });

    const execOptions: GltfTransformExecOptions = {
      inputPath,
      outputPath: req.body.outputPath,
      textureCompress: true,
      textureFormat: req.body?.textureOptions?.format,
      // quality 等细节由 executor/CLI 侧处理或忽略
    };

    const executor = new GltfTransformExecutor();
    const command = await executor.execute(execOptions);

    res.json({ success: true, data: { inputPath, outputPath: execOptions.outputPath, command} });
  } catch (error) {
    logger.error('API error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Apply Draco compression to a glTF file
 * POST /api/transform/draco
 */
router.post('/draco', async (req, res) => {
  try {
    const { inputPath } = req.body as { inputPath?: string; outputPath?: string; dracoOptions?: any };

    if (!inputPath) return res.status(400).json({ error: 'Input path is required' });
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Input file not found' });

    const execOptions: GltfTransformExecOptions = {
      inputPath,
      outputPath: req.body.outputPath,
      draco: true,
      dracoOptions: req.body.dracoOptions
    };

    const executor = new GltfTransformExecutor();
    const command = await executor.execute(execOptions);

    res.json({ success: true, data: { inputPath, outputPath: execOptions.outputPath, command } });
  } catch (error) {
    logger.error('API error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;