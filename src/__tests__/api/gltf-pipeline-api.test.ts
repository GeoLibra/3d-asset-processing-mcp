import express from 'express';
import request from 'supertest';
import gltfPipelineRouter from '../../api/gltf-pipeline-api';
import { GLB_EXT, desiredExtFrom } from '../../utils/gltf-constants';

// Mock logger to keep test output clean
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock the executor to avoid running real CLI
const mockExecute = jest.fn();
jest.mock('../../core/gltf-pipeline-executor', () => {
  return {
    GltfPipelineExecutor: jest.fn().mockImplementation(() => ({
      execute: mockExecute
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

describe('GLTF Pipeline API (executor-based)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/gltf-pipeline', gltfPipelineRouter);
    jest.clearAllMocks();
  });

  test('POST /process should return success with command and outputPath', async () => {
    const expectedCmd = 'gltf-pipeline -i "/path/to/uploaded/model.glb" -o "/path/to/uploaded/model_processed.glb" -b -d';
    mockExecute.mockResolvedValueOnce(expectedCmd);

    const response = await request(app)
      .post('/api/gltf-pipeline/process')
      .field('outputFormat', 'glb')
      .field('draco', 'true')
      .attach('file', Buffer.from('mock-file-content'), 'model.glb');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    // data.command
    expect(typeof response.body.data.command).toBe('string');
    expect(response.body.data.command.length).toBeGreaterThan(0);

    // outputPath should end with desired extension
    const desiredExt = desiredExtFrom({ outputFormat: 'glb' });
    expect(response.body.data.outputPath).toBeDefined();
    expect(response.body.data.outputPath.endsWith(desiredExt)).toBe(true);

    // executor called with normalized options
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: expect.any(String),
        outputPath: expect.stringMatching(/_processed\.glb$/),
        outputFormat: 'glb',
        draco: true,
        binary: true // alias for outputFormat=glb
      })
    );
  });

  test('POST /process should handle executor errors', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Processing error'));

    const response = await request(app)
      .post('/api/gltf-pipeline/process')
      .field('outputFormat', 'glb')
      .attach('file', Buffer.from('mock-file-content'), 'model.glb');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(String(response.body.error)).toContain('Processing error');
  });

  test('POST /process should handle missing file', async () => {
    // Override the multer mock for this test to not attach a file
    const originalMulter = require('multer');
    jest.doMock('multer', () => {
      const multer = () => ({
        single: () => (req: any, res: any, next: any) => {
          next();
        }
      });
      multer.diskStorage = originalMulter.diskStorage;
      return multer;
    });

    // Re-import router with new mock in effect
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
    expect(String(response.body.error)).toContain('No file uploaded');
  });
});