import { GltfProcessor, GltfProcessOptions } from '../../core/gltf-processor';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execAsync: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
  statSync: jest.fn().mockReturnValue({
    size: 1024
  }),
  readdirSync: jest.fn().mockReturnValue(['texture1.png', 'texture2.jpg', 'other.file']),
  existsSync: jest.fn().mockReturnValue(true)
}));

// Mock path
jest.mock('path', () => ({
  extname: jest.fn().mockImplementation((p) => {
    if (p.includes('.glb')) return '.glb';
    if (p.includes('.gltf')) return '.gltf';
    if (p.includes('.png')) return '.png';
    if (p.includes('.jpg')) return '.jpg';
    return '';
  }),
  basename: jest.fn().mockImplementation((p, ext) => {
    if (ext) return p.replace(ext, '');
    return p.split('/').pop();
  }),
  dirname: jest.fn().mockReturnValue('/mock/dir'),
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Mock util
jest.mock('util', () => ({
  promisify: jest.fn().mockImplementation((fn) => {
    return jest.fn().mockResolvedValue({ stdout: 'Success', stderr: '' });
  })
}));

describe('GltfProcessor', () => {
  let processor: GltfProcessor;
  const mockInputPath = '/path/to/model.glb';
  const mockOutputPath = '/path/to/output.glb';

  beforeEach(() => {
    processor = new GltfProcessor();
    jest.clearAllMocks();

    // Default mock implementations
    (exec as jest.Mock).mockImplementation((cmd, cb) => {
      cb(null, { stdout: 'Success', stderr: '' });
    });

    (fs.statSync as jest.Mock).mockReturnValue({
      size: 1024
    });
  });

  test('should process a glTF file successfully', async () => {
    const options: GltfProcessOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      optimize: true,
      draco: true
    };

    const result = await processor.process(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.inputPath).toBe(mockInputPath);
    expect(result.data?.outputPath).toBe(mockOutputPath);
    expect(result.metrics).toBeDefined();
    expect(result.metrics.processingTime).toBeGreaterThanOrEqual(0);
  });

  test('should generate output path if not provided', async () => {
    const options: GltfProcessOptions = {
      inputPath: mockInputPath,
      optimize: true
    };

    const result = await processor.process(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.outputPath).toBeDefined();
    expect(result.data?.outputPath).toContain('_processed');
  });

  test('should handle separate textures', async () => {
    const options: GltfProcessOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      separateTextures: true
    };

    // Mock texture files
    (fs.readdirSync as jest.Mock).mockReturnValue([
      'output.png',
      'output_baseColor.jpg',
      'output_normal.png',
      'other.file'
    ]);

    const result = await processor.process(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.stats.textureCount).toBe(3); // 3 texture files
    expect(result.data?.stats.totalTextureSize).toBeGreaterThan(0);
  });

  test('should handle command execution errors', async () => {
    // Mock exec to simulate an error
    const mockError = new Error('Command failed');
    (exec as jest.Mock).mockImplementation((cmd, cb) => {
      cb(mockError, { stdout: '', stderr: 'Error: Command failed' });
    });

    const options: GltfProcessOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath
    };

    const result = await processor.process(options);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Command failed');
  });

  test('should handle gltf-pipeline errors in stderr', async () => {
    // Mock exec to simulate a gltf-pipeline error
    (exec as jest.Mock).mockImplementation((cmd, cb) => {
      cb(null, { stdout: '', stderr: 'Error: Invalid glTF file' });
    });

    const options: GltfProcessOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath
    };

    const result = await processor.process(options);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('gltf-pipeline error');
  });

  test('should build command with correct options', () => {
    const options: GltfProcessOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      outputFormat: 'glb',
      separateTextures: true,
      textureCompress: true,
      optimize: true,
      draco: true,
      dracoOptions: {
        compressionLevel: 7,
        quantizePosition: 14
      },
      removeNormals: true,
      stripEmptyNodes: true
    };

    const command = processor['buildCommand'](options);

    expect(command).toContain(`-i "${mockInputPath}"`);
    expect(command).toContain(`-o "${mockOutputPath}"`);
    expect(command).toContain('--binary');
    expect(command).toContain('-t');
    expect(command).toContain('--compress-textures');
    expect(command).toContain('--optimize');
    expect(command).toContain('--draco');
    expect(command).toContain('--draco.compressionLevel 7');
    expect(command).toContain('--draco.quantizePosition 14');
    expect(command).toContain('--removeNormals');
    expect(command).toContain('--stripEmptyNodes');
  });

  test('should use convert method correctly', async () => {
    const processSpy = jest.spyOn(processor, 'process');

    await processor.convert(mockInputPath, 'gltf', mockOutputPath);

    expect(processSpy).toHaveBeenCalledWith({
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      outputFormat: 'gltf'
    });
  });

  test('should use extractTextures method correctly', async () => {
    const processSpy = jest.spyOn(processor, 'process');

    await processor.extractTextures(mockInputPath, mockOutputPath);

    expect(processSpy).toHaveBeenCalledWith({
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      separateTextures: true
    });
  });

  test('should use optimize method correctly', async () => {
    const processSpy = jest.spyOn(processor, 'process');
    const options = {
      draco: true,
      dracoOptions: {
        compressionLevel: 9
      }
    };

    await processor.optimize(mockInputPath, options, mockOutputPath);

    expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      optimize: true,
      draco: true,
      dracoOptions: {
        compressionLevel: 9
      }
    }));
  });
});