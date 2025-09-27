import { exec } from 'child_process';
import * as path from 'path';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, cb) => {
    // Follow Node's exec callback signature: (error, stdout: string, stderr: string)
    cb(null, 'CLI executed successfully', '');
    return { stdout: '', stderr: '' };
  })
}));

// Mock the processors
jest.mock('../../core/gltf-processor', () => {
  return {
    GltfProcessor: jest.fn().mockImplementation(() => ({
      convert: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/output.gltf',
          stats: { inputSize: 1000, outputSize: 900 }
        },
        metrics: { processingTime: 100 }
      }),
      extractTextures: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/textures',
          stats: { textureCount: 5 }
        },
        metrics: { processingTime: 80 }
      }),
      optimize: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/optimized.glb',
          stats: { inputSize: 1000, outputSize: 600, compressionRatio: 0.6 }
        },
        metrics: { processingTime: 120 }
      })
    }))
  };
});

jest.mock('../../core/optimizer-simple', () => {
  return {
    ModelOptimizer: jest.fn().mockImplementation(() => ({
      optimize: jest.fn().mockResolvedValue({
        success: true,
        data: {
          inputPath: '/path/to/model.glb',
          outputPath: '/path/to/optimized.glb',
          preset: 'web',
          stats: {
            sizeReduction: 0.4,
            vertexReduction: 0.3,
            drawCallReduction: 0.5,
            textureReduction: 0.6
          }
        },
        metrics: { processingTime: 150 }
      })
    }))
  };
});

jest.mock('../../core/validator-simple', () => {
  return {
    SimpleValidator: jest.fn().mockImplementation(() => ({
      validate: jest.fn().mockResolvedValue({
        success: true,
        data: {
          valid: true,
          errors: [],
          warnings: [],
          info: []
        },
        metrics: { processingTime: 50 }
      })
    }))
  };
});

jest.mock('../../core/analyzer', () => {
  return {
    ModelAnalyzer: jest.fn().mockImplementation(() => ({
      analyze: jest.fn().mockResolvedValue({
        success: true,
        data: {
          geometry: {
            vertexCount: 1000,
            triangleCount: 500,
            meshCount: 2,
            primitiveCount: 4
          },
          materials: {
            count: 2,
            types: ['PBR'],
            textureCount: 3,
            totalTextureSize: 2048
          },
          animations: {
            count: 1,
            totalKeyframes: 100,
            duration: 5.0
          },
          scene: {
            nodeCount: 10,
            maxDepth: 3
          },
          fileInfo: {
            size: 1024,
            format: 'GLB',
            version: '2.0'
          }
        },
        metrics: { processingTime: 70 }
      })
    }))
  };
});

describe('GLTF Process CLI', () => {
  const cliPath = path.resolve(__dirname, '../../../src/cli/gltf-process-cli.ts');
  const mockInputPath = '/path/to/model.glb';
  const mockOutputPath = '/path/to/output.glb';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should execute convert command', async () => {
    const command = `tsx ${cliPath} convert -i ${mockInputPath} -o ${mockOutputPath} -f gltf`;

    await new Promise<void>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        expect(error).toBeNull();
        expect(stdout).toContain('CLI executed successfully');
        resolve();
      });
    });

    // Check that the command was executed with the correct arguments
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('convert'),
      expect.any(Function)
    );
  });

  test('should execute extract-textures command', async () => {
    const command = `tsx ${cliPath} extract-textures -i ${mockInputPath} -o ${mockOutputPath}`;

    await new Promise<void>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        expect(error).toBeNull();
        expect(stdout).toContain('CLI executed successfully');
        resolve();
      });
    });

    // Check that the command was executed with the correct arguments
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('extract-textures'),
      expect.any(Function)
    );
  });

  test('should execute optimize command', async () => {
    const command = `tsx ${cliPath} optimize -i ${mockInputPath} -o ${mockOutputPath} --draco`;

    await new Promise<void>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        expect(error).toBeNull();
        expect(stdout).toContain('CLI executed successfully');
        resolve();
      });
    });

    // Check that the command was executed with the correct arguments
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('optimize'),
      expect.any(Function)
    );
  });

  test('should execute optimize-preset command', async () => {
    const command = `tsx ${cliPath} optimize-preset -i ${mockInputPath} -o ${mockOutputPath} -p web`;

    await new Promise<void>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        expect(error).toBeNull();
        expect(stdout).toContain('CLI executed successfully');
        resolve();
      });
    });

    // Check that the command was executed with the correct arguments
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('optimize-preset'),
      expect.any(Function)
    );
  });

  test('should execute validate command', async () => {
    const command = `tsx ${cliPath} validate -i ${mockInputPath}`;

    await new Promise<void>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        expect(error).toBeNull();
        expect(stdout).toContain('CLI executed successfully');
        resolve();
      });
    });

    // Check that the command was executed with the correct arguments
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('validate'),
      expect.any(Function)
    );
  });

  test('should execute analyze command', async () => {
    const command = `tsx ${cliPath} analyze -i ${mockInputPath}`;

    await new Promise<void>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        expect(error).toBeNull();
        expect(stdout).toContain('CLI executed successfully');
        resolve();
      });
    });

    // Check that the command was executed with the correct arguments
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('analyze'),
      expect.any(Function)
    );
  });

  test('should handle command errors', async () => {
    // Mock exec to simulate an error
    (exec as unknown as jest.Mock).mockImplementationOnce((cmd, cb) => {
      // Follow Node's exec signature: (error, stdout: string, stderr: string)
      cb(new Error('Command failed'), '', 'Error: Command failed');
      return { stdout: '', stderr: '' };
    });

    const command = `tsx ${cliPath} convert -i ${mockInputPath} -o ${mockOutputPath}`;

    await new Promise<void>((resolve) => {
      exec(command, (error, stdout, stderr) => {
        expect(error).toBeDefined();
        expect(stderr).toContain('Command failed');
        resolve();
      });
    });
  });
});