import { Router } from 'express';
import { globalGltfProcessor } from '../core/gltf-processor';
import logger from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

/**
 * Convert between glTF and GLB formats
 * POST /api/gltf/convert
 */
router.post('/convert', async (req, res) => {
  try {
    const { inputPath, outputPath, format } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const outputFormat = format || (path.extname(inputPath).toLowerCase() === '.glb' ? 'gltf' : 'glb');

    const result = await globalGltfProcessor.convert(inputPath, outputFormat, outputPath);

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
 * Extract textures from a glTF/GLB file
 * POST /api/gltf/extract-textures
 */
router.post('/extract-textures', async (req, res) => {
  try {
    const { inputPath, outputPath } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfProcessor.extractTextures(inputPath, outputPath);

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
 * Optimize a glTF/GLB file
 * POST /api/gltf/optimize
 */
router.post('/optimize', async (req, res) => {
  try {
    const {
      inputPath,
      outputPath,
      draco,
      dracoOptions,
      compressGeometry,
      compressTextures,
      removeNormals,
      stripEmptyNodes
    } = req.body;

    if (!inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfProcessor.optimize(inputPath, {
      draco,
      dracoOptions,
      compressGeometry,
      compressTextures,
      removeNormals,
      stripEmptyNodes
    }, outputPath);

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
 * Process a glTF/GLB file with custom options
 * POST /api/gltf/process
 */
router.post('/process', async (req, res) => {
  try {
    const options = req.body;

    if (!options.inputPath) {
      return res.status(400).json({ error: 'Input path is required' });
    }

    if (!fs.existsSync(options.inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const result = await globalGltfProcessor.process(options);

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