import { Router } from 'express';
import { globalGltfProcessor, GltfProcessOptions } from '../core/gltf-processor';
import logger from '../utils/logger';
import * as fs from 'fs';

const router = Router();

/**
 * A universal endpoint to process glTF files using various gltf-pipeline options.
 * This single endpoint replaces the separate /convert, /extract-textures, and /optimize routes.
 *
 * POST /api/gltf/process
 *
 * Body: GltfProcessOptions
 * Example:
 * {
 *   "inputPath": "/path/to/model.gltf",
 *   "outputPath": "/path/to/model.glb",
 *   "binary": true,
 *   "draco": true,
 *   "dracoOptions": {
 *     "compressionLevel": 10
 *   }
 * }
 */
router.post('/process', async (req, res) => {
  try {
    const options: GltfProcessOptions = req.body;

    if (!options.inputPath) {
      return res.status(400).json({ error: 'Input path (inputPath) is required' });
    }

    if (!fs.existsSync(options.inputPath)) {
      return res.status(404).json({ error: `Input file not found: ${options.inputPath}` });
    }

    // The processor now handles all logic, including mapping old params.
    const result = await globalGltfProcessor.process(options);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('API processing error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;