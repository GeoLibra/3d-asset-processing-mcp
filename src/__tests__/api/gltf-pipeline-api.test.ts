import express from 'express';
import request from 'supertest';
import { gltfPipelineRouter } from '../../api/gltf-pipeline-api';
import { GltfProcessor } from '../../core/gltf-processor';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../core/gltf-processor', () => {
  return {
    GltfProcessor: jest.fn().mockImplementation(() => ({
      process: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/output.glb',
          stats: {
            inputSize: 1000,
            outputSize: 800,
            compressionRatio: 0.8
          }
        },
        metrics: {
          processingTime: 100
        }
      }),
      convert: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/output.gltf',
          stats: {
            inputSize: 1000,
            outputSize: 900
          }
        },
        metrics: {
          processingTime: 80
        }
      }),
      extractTextures: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/textures',
          stats: {
            textureCount: 5
          }
        },
        metrics: {
          processingTime: 60
        }
      }),
      optimize: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/optimized.glb',
          stats: {
            inputSize: 1000,
            outputSize: 600,
            compressionRatio: 0.6
          }
        },
        metrics: {
          processingTime: 120
        }
      })
    }))
  };
});

// Mock file upload middleware
jest.mock('multer', () => {
  const multer = () => ({
    single: () => (req: any, res: any, next: any) => {
      req.file = {
        path: '/path/to/uploaded/model.glb',
        originalname: 'model.glb',
        mimetype: 'model/gltf-binary'
      };
      next();
    }
  });
  multer.diskStorage = () => ({});
  return multer;
});

describe('GLTF Pipeline API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/gltf-pipeline', gltfPipelineRouter);
    jest.clearAllMocks();
  });

  test('should process a model with POST /process', async () => {
    const response = await request(app)
      .post('/api/gltf-pipeline/process')
      .field('outputFormat', 'glb')
      .field('optimize', 'true')
      .field('draco', 'true')
      .attach('file', Buffer.from('mock-file-content'), 'model.glb');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.outputPath).toBeDefined();
    expect(response.body.metrics).toBeDefined();

    // Check that the processor was called with correct options
    const mockProcessor = (GltfProcessor as jest.Mock).mock.instances[0];
    expect(mockProcessor.process).toHaveBeenCalledWith(expect.objectContaining({
      outputFormat: 'glb',
      optimize: true,
      draco: true
    }));
  });

  test('should convert a model with POST /convert', async () => {
    const response = await request(app)
      .post('/api/gltf-pipeline/convert')
      .field('outputFormat', 'gltf')
      .attach('file', Buffer.from('mock-file-content'), 'model.glb');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.outputPath).toBeDefined();

    // Check that the processor was called with correct options
    const mockProcessor = (GltfProcessor as jest.Mock).mock.instances[0];
    expect(mockProcessor.convert).toHaveBeenCalledWith(
      expect.any(String),
      'gltf',
      expect.any(String)
    );
  });

  test('should extract textures with POST /extract-textures', async () => {
    const response = await request(app)
      .post('/api/gltf-pipeline/extract-textures')
      .attach('file', Buffer.from('mock-file-content'), 'model.glb');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.outputPath).toBeDefined();
    expect(response.body.data.stats.textureCount).toBeDefined();

    // Check that the processor was called
    const mockProcessor = (GltfProcessor as jest.Mock).mock.instances[0];
    expect(mockProcessor.extractTextures).toHaveBeenCalled();
  });

  test('should optimize a model with POST /optimize', async () => {
    const response = await request(app)
      .post('/api/gltf-pipeline/optimize')
      .field('draco', 'true')
      .field('dracoCompressionLevel', '7')
      .attach('file', Buffer.from('mock-file-content'), 'model.glb');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.outputPath).toBeDefined();
    expect(response.body.data.stats.compressionRatio).toBeDefined();

    // Check that the processor was called with correct options
    const mockProcessor = (GltfProcessor as jest.Mock).mock.instances[0];
    expect(mockProcessor.optimize).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        draco: true,
        dracoOptions: expect.objectContaining({
          compressionLevel: 7
        })
      }),
      expect.any(String)
    );
  });

  test('should handle errors gracefully', async () => {
    // Mock processor to throw an error
    const mockProcessor = (GltfProcessor as jest.Mock).mock.instances[0];
    mockProcessor.process.mockRejectedValueOnce(new Error('Processing error'));

    const response = await request(app)
      .post('/api/gltf-pipeline/process')
      .field('outputFormat', 'glb')
      .attach('file', Buffer.from('mock-file-content'), 'model.glb');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error).toContain('Processing error');
  });

  test('should handle missing file in request', async () => {
    // Override the multer mock for this test
    const originalMulter = require('multer');
    jest.mock('multer', () => {
      const multer = () => ({
        single: () => (req: any, res: any, next: any) => {
          // Don't add a file to the request
          next();
        }
      });
      multer.diskStorage = originalMulter.diskStorage;
      return multer;
    });

    // Re-import the router to use the new mock
    jest.resetModules();
    const { gltfPipelineRouter: updatedRouter } = require('../../api/gltf-pipeline-api');
    const newApp = express();
    newApp.use(express.json());
    newApp.use('/api/gltf-pipeline', updatedRouter);

    const response = await request(newApp)
      .post('/api/gltf-pipeline/process')
      .field('outputFormat', 'glb');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error).toContain('No file uploaded');
  });
});