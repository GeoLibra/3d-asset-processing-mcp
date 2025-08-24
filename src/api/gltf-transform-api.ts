import { Router } from 'express';
import { globalGltfTransformProcessor, GltfTransformOptions } from '../core/gltf-transform-processor';
import logger from '../utils/logger';
import * as fs from 'fs';

const router = Router();

/**
 * Process a glTF file with custom options
 * POST /api/transform/process
 */
router.post('/process', async (req, res) => {
  try {
    const options: GltfTransformOptions = req.body;

    if (!options.inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(options.inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfTransformProcessor.process(options);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
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
    const { inputPath, outputPath } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfTransformProcessor.optimize(inputPath, outputPath);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
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
    const { inputPath, outputPath, ratio } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfTransformProcessor.simplify(inputPath, ratio, outputPath);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
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
    const { inputPath, outputPath, textureOptions } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfTransformProcessor.compressTextures(inputPath, textureOptions, outputPath);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
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
    const { inputPath, outputPath, dracoOptions } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfTransformProcessor.applyDraco(inputPath, dracoOptions, outputPath);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('API error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;