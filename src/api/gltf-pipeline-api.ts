import { Router } from 'express';
import multer from 'multer';
import { GltfProcessOptions } from '../core/gltf-processor';
import { GltfPipelineExecutor } from '../core/gltf-pipeline-executor';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { desiredExtFrom } from '../utils/gltf-constants';

const router = Router();
const upload = multer();

/**
 * POST /api/gltf-pipeline/process
 * 接收 multipart/form-data（包含文件与字段），组装 GltfProcessOptions 并调用执行器
 */
router.post('/process', upload.single('file'), async (req, res) => {
  try {
    // 1) 校验文件
    const r: any = req;
    if (!r.file || !r.file.path) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // 2) 解析字段并规范化为 GltfProcessOptions
    const body = req.body || {};
    // 将字符串布尔转布尔
    const toBool = (v: any) => (typeof v === 'string' ? v === 'true' : !!v);
    const outputFormat = (body.outputFormat as 'glb' | 'gltf' | undefined) ?? 'glb';

    const options: GltfProcessOptions = {
      inputPath: r.file.path,
      outputPath: undefined,
      outputFormat,
      // 如果 outputFormat=glb 则等同于 binary
      binary: outputFormat === 'glb' ? true : toBool(body.binary),
      json: outputFormat === 'gltf' ? true : toBool(body.json),
      separateTextures: toBool(body.separateTextures),
      draco: body.draco !== undefined ? toBool(body.draco) : (outputFormat === 'glb'),
      stats: toBool(body.stats),
      allowAbsolute: toBool(body.allowAbsolute),
      keepLegacyExtensions: toBool(body.keepLegacyExtensions),
      keepUnusedElements: toBool(body.keepUnusedElements),
      dracoOptions: body.dracoOptions
        ? typeof body.dracoOptions === 'string'
          ? JSON.parse(body.dracoOptions)
          : body.dracoOptions
        : undefined,
      textureCompress: toBool(body.textureCompress),
      textureFormat: body.textureFormat
    };

    // 3) 生成 outputPath
    const desiredExt = desiredExtFrom({ outputFormat: options.outputFormat, binary: options.binary === true });
    const base = path.basename(r.file.originalname, path.extname(r.file.originalname));
    const dir = path.dirname(r.file.path);
    options.outputPath = path.join(dir, `${base}_processed${desiredExt}`);
    // normalize extension to ensure it matches desiredExt exactly
    if (!options.outputPath.endsWith(desiredExt)) {
      options.outputPath = options.outputPath.replace(/\.(glb|gltf)$/i, '') + desiredExt;
    }

    // 4) 执行
    const executor = new GltfPipelineExecutor();
    const command = await executor.execute(options);

    return res.status(200).json({
      success: true,
      data: {
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        command
      }
    });
  } catch (error) {
    logger.error('API processing error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 同时导出命名路由，便于测试用 require 解构
export const gltfPipelineRouter = router;
export default router;