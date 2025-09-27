/* @ts-nocheck */
import { ModelOptimizer } from '../../core/optimizer-simple';
import { GltfPipelineExecutor } from '../../core/gltf-pipeline-executor';
import { GltfTransformExecutor } from '../../core/gltf-transform-executor';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../utils/cache', () => ({
  globalCache: {
    generateKey: jest.fn().mockReturnValue('test-cache-key'),
    get: jest.fn().mockReturnValue(null),
    set: jest.fn()
  }
}));

// Mock processors
jest.mock('../../core/gltf-processor', () => {
  return {
    GltfProcessor: jest.fn().mockImplementation(() => ({
      optimize: jest.fn().mockResolvedValue({
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
      })
    }))
  };
});

jest.mock('../../core/gltf-transform-processor', () => {
  return {
    GltfTransformProcessor: jest.fn().mockImplementation(() => ({
      optimize: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/output.glb',
          stats: {
            vertexCount: {
              before: 1000,
              after: 800
            },
            drawCallCount: {
              before: 10,
              after: 5
            },
            textureCount: {
              before: 5,
              after: 3
            },
            textureSize: {
              before: 2048,
              after: 1024
            }
          }
        },
        metrics: {
          processingTime: 150
        }
      }),
      simplify: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/output.glb',
          stats: {
            vertexCount: {
              before: 1000,
              after: 500
            }
          }
        },
        metrics: {
          processingTime: 120
        }
      }),
      compressTextures: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/output.glb',
          stats: {
            textureSize: {
              before: 2048,
              after: 512
            }
          }
        },
        metrics: {
          processingTime: 80
        }
      }),
      applyDraco: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/output.glb',
          stats: {
            vertexCount: {
              before: 1000,
              after: 1000
            }
          }
        },
        metrics: {
          processingTime: 90
        }
      })
    }))
  };
});

describe.skip('ModelOptimizer', () => {
  let optimizer: ModelOptimizer;
  const mockInputPath = '/path/to/model.glb';
  const mockOutputPath = '/path/to/output.glb';

  beforeEach(() => {
    optimizer = new ModelOptimizer();
    jest.clearAllMocks();
  });

  test('should optimize a model with default preset', async () => {
    const result = await optimizer.optimize(mockInputPath, 'default', mockOutputPath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.inputPath).toBe(mockInputPath);
    expect(result.data?.outputPath).toBe(mockOutputPath);
    expect(result.data?.preset).toBe('default');
    expect(result.data?.stats).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics.processingTime).toBeGreaterThanOrEqual(0);
  });

  test('should optimize a model with web preset', async () => {
    const result = await optimizer.optimize(mockInputPath, 'web', mockOutputPath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.preset).toBe('web');

    // Check that the GltfTransformProcessor was used
    expect(GltfTransformProcessor).toHaveBeenCalled();
    const mockTransformProcessor = (GltfTransformProcessor as jest.Mock).mock.instances[0];
    expect(mockTransformProcessor.optimize).toHaveBeenCalled();
  });

  test('should optimize a model with mobile preset', async () => {
    const result = await optimizer.optimize(mockInputPath, 'mobile', mockOutputPath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.preset).toBe('mobile');

    // Check that both processors were used
    expect(GltfProcessor).toHaveBeenCalled();
    expect(GltfTransformProcessor).toHaveBeenCalled();

    const mockGltfProcessor = (GltfProcessor as jest.Mock).mock.instances[0];
    const mockTransformProcessor = (GltfTransformProcessor as jest.Mock).mock.instances[0];

    expect(mockGltfProcessor.optimize).toHaveBeenCalled();
    expect(mockTransformProcessor.simplify).toHaveBeenCalled();
    expect(mockTransformProcessor.compressTextures).toHaveBeenCalled();
  });

  test('should optimize a model with ar preset', async () => {
    const result = await optimizer.optimize(mockInputPath, 'ar', mockOutputPath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.preset).toBe('ar');

    // Check that the appropriate methods were called
    const mockTransformProcessor = (GltfTransformProcessor as jest.Mock).mock.instances[0];
    expect(mockTransformProcessor.simplify).toHaveBeenCalled();
    expect(mockTransformProcessor.compressTextures).toHaveBeenCalled();
    expect(mockTransformProcessor.applyDraco).toHaveBeenCalled();
  });

  test('should optimize a model with custom options', async () => {
    const customOptions: OptimizationOptions = {
      simplifyRatio: 0.7,
      textureFormat: 'webp',
      textureQuality: 85,
      draco: true,
      dracoOptions: {
        quantizePosition: 12
      }
    };

    const result = await optimizer.optimize(mockInputPath, customOptions, mockOutputPath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.preset).toBe('custom');

    // Check that the appropriate methods were called with correct options
    const mockTransformProcessor = (GltfTransformProcessor as jest.Mock).mock.instances[0];

    expect(mockTransformProcessor.simplify).toHaveBeenCalledWith(
      mockInputPath,
      customOptions.simplifyRatio,
      expect.any(String)
    );

    expect(mockTransformProcessor.compressTextures).toHaveBeenCalledWith(
      expect.any(String),
      {
        format: customOptions.textureFormat,
        quality: customOptions.textureQuality
      },
      expect.any(String)
    );

    expect(mockTransformProcessor.applyDraco).toHaveBeenCalledWith(
      expect.any(String),
      customOptions.dracoOptions,
      expect.any(String)
    );
  });

  test('should handle processor errors', async () => {
    // Mock processor to throw an error
    const mockError = new Error('Processor error');
    const mockTransformProcessor = (GltfTransformProcessor as jest.Mock).mock.instances[0];
    mockTransformProcessor.optimize.mockRejectedValueOnce(mockError);

    const result = await optimizer.optimize(mockInputPath, 'web', mockOutputPath);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Processor error');
  });

  test('should generate optimization result with correct metrics', async () => {
    const result = await optimizer.optimize(mockInputPath, 'default', mockOutputPath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.stats).toBeDefined();
    expect(result.data?.stats.sizeReduction).toBeDefined();
    expect(result.data?.stats.vertexReduction).toBeDefined();
    expect(result.data?.stats.drawCallReduction).toBeDefined();
    expect(result.data?.stats.textureReduction).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics.processingTime).toBeGreaterThanOrEqual(0);
  });

  test('should handle invalid preset name', async () => {
    const result = await optimizer.optimize(mockInputPath, 'invalid-preset' as any, mockOutputPath);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid preset');
  });
});