/* @ts-nocheck */
import { GltfTransformProcessor } from '../../core/gltf-transform-processor';
import { NodeIO, Document } from '@gltf-transform/core';

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

// Mock fs
jest.mock('fs', () => ({
  statSync: jest.fn().mockReturnValue({
    size: 1024
  }),
  existsSync: jest.fn().mockReturnValue(true)
}));

// Mock path
jest.mock('path', () => ({
  extname: jest.fn().mockImplementation((p) => {
    if (p.includes('.glb')) return '.glb';
    if (p.includes('.gltf')) return '.gltf';
    return '';
  }),
  basename: jest.fn().mockImplementation((p, ext) => {
    if (ext) return p.replace(ext, '');
    return p.split('/').pop();
  }),
  dirname: jest.fn().mockReturnValue('/mock/dir'),
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Mock @gltf-transform/core
jest.mock('@gltf-transform/core', () => {
  class MockAccessor {
    getCount() { return 100; }
    getArray() { return [0, 1, 2, 3, 4]; }
  }

  class MockPrimitive {
    getAttribute(name: string) {
      return name === 'POSITION' ? new MockAccessor() : null;
    }
    getIndices() {
      return new MockAccessor();
    }
  }

  class MockMesh {
    listPrimitives() {
      return [new MockPrimitive(), new MockPrimitive()];
    }
  }

  class MockTexture {
    getImage() { return Buffer.from('mock-image-data'); }
  }

  class MockRoot {
    listMeshes() { return [new MockMesh(), new MockMesh()]; }
    listTextures() { return [new MockTexture(), new MockTexture()]; }
  }

  class MockDocument {
    getRoot() { return new MockRoot(); }
    transform = jest.fn().mockResolvedValue(undefined);
  }

  class MockNodeIO {
    read = jest.fn().mockResolvedValue(new MockDocument());
    write = jest.fn().mockResolvedValue(undefined);
  }

  return {
    NodeIO: MockNodeIO,
    Document: MockDocument
  };
});

// Mock @gltf-transform/functions
jest.mock('@gltf-transform/functions', () => ({
  dedup: jest.fn().mockReturnValue('dedup-transform'),
  draco: jest.fn().mockReturnValue('draco-transform'),
  flatten: jest.fn().mockReturnValue('flatten-transform'),
  join: jest.fn().mockReturnValue('join-transform'),
  prune: jest.fn().mockReturnValue('prune-transform'),
  resample: jest.fn().mockReturnValue('resample-transform'),
  simplify: jest.fn().mockReturnValue('simplify-transform'),
  textureCompress: jest.fn().mockReturnValue('texture-compress-transform'),
  weld: jest.fn().mockReturnValue('weld-transform')
}));

describe('GltfTransformProcessor', () => {
  let processor: GltfTransformProcessor;
  const mockInputPath = '/path/to/model.glb';
  const mockOutputPath = '/path/to/output.glb';

  beforeEach(() => {
    processor = new GltfTransformProcessor();
    jest.clearAllMocks();
  });

  test('should process a glTF file successfully', async () => {
    const options: GltfTransformOptions = {
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
    const options: GltfTransformOptions = {
      inputPath: mockInputPath,
      optimize: true
    };

    const result = await processor.process(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.outputPath).toBeDefined();
    expect(result.data?.outputPath).toContain('_transformed');
  });

  test('should apply correct transformations based on options', async () => {
    const options: GltfTransformOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      dedup: true,
      prune: true,
      simplify: true,
      simplifyOptions: {
        ratio: 0.5
      },
      weld: true,
      weldOptions: {
        tolerance: 0.0001
      },
      flatten: true,
      join: true,
      resample: true,
      resampleOptions: {
        tolerance: 0.00001
      },
      compressTextures: true,
      textureOptions: {
        format: 'webp',
        quality: 80
      },
      draco: true,
      dracoOptions: {
        quantizePosition: 14,
        quantizeNormal: 10
      }
    };

    // Spy on the private method
    const applyTransformationsSpy = jest.spyOn(processor as any, 'applyTransformations');

    await processor.process(options);

    expect(applyTransformationsSpy).toHaveBeenCalled();

    // Check that the correct transforms were created
    const { dedup, prune, simplify, weld, flatten, join, resample, textureCompress, draco } = require('@gltf-transform/functions');

    expect(dedup).toHaveBeenCalled();
    expect(prune).toHaveBeenCalled();
    expect(simplify).toHaveBeenCalledWith(expect.objectContaining({
      ratio: 0.5
    }));
    expect(weld).toHaveBeenCalledWith(expect.objectContaining({
      tolerance: 0.0001
    }));
    expect(flatten).toHaveBeenCalled();
    expect(join).toHaveBeenCalled();
    expect(resample).toHaveBeenCalledWith(expect.objectContaining({
      tolerance: 0.00001
    }));
    expect(textureCompress).toHaveBeenCalledWith(expect.objectContaining({
      encoder: 'webp',
      quality: 80
    }));
    expect(draco).toHaveBeenCalledWith(expect.objectContaining({
      quantizePosition: 14,
      quantizeNormal: 10
    }));
  });

  test('should handle read errors', async () => {
    // Mock read to throw an error
    (processor['io'].read as jest.Mock).mockRejectedValueOnce(new Error('Read error'));

    const options: GltfTransformOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath
    };

    const result = await processor.process(options);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Read error');
  });

  test('should handle write errors', async () => {
    // Mock write to throw an error
    (processor['io'].write as jest.Mock).mockRejectedValueOnce(new Error('Write error'));

    const options: GltfTransformOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath
    };

    const result = await processor.process(options);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Write error');
  });

  test('should use optimize method correctly', async () => {
    const processSpy = jest.spyOn(processor, 'process');

    await processor.optimize(mockInputPath, mockOutputPath);

    expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      optimize: true,
      dedup: true,
      prune: true,
      mergeMeshes: true,
      mergeMaterials: true,
      compressTextures: true,
      draco: true
    }));
  });

  test('should use simplify method correctly', async () => {
    const processSpy = jest.spyOn(processor, 'process');
    const ratio = 0.5;

    await processor.simplify(mockInputPath, ratio, mockOutputPath);

    expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      simplify: true,
      simplifyOptions: {
        ratio
      }
    }));
  });

  test('should use compressTextures method correctly', async () => {
    const processSpy = jest.spyOn(processor, 'process');
    const textureOptions = {
      format: 'webp' as const,
      quality: 75
    };

    await processor.compressTextures(mockInputPath, textureOptions, mockOutputPath);

    expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      compressTextures: true,
      textureOptions
    }));
  });

  test('should use applyDraco method correctly', async () => {
    const processSpy = jest.spyOn(processor, 'process');
    const dracoOptions = {
      quantizePosition: 12,
      quantizeNormal: 8
    };

    await processor.applyDraco(mockInputPath, dracoOptions, mockOutputPath);

    expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({
      inputPath: mockInputPath,
      outputPath: mockOutputPath,
      draco: true,
      dracoOptions
    }));
  });

  test('should collect stats correctly', async () => {
    const options: GltfTransformOptions = {
      inputPath: mockInputPath,
      outputPath: mockOutputPath
    };

    const result = await processor.process(options);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.stats).toBeDefined();
    expect(result.data?.stats.vertexCount).toBeDefined();
    expect(result.data?.stats.vertexCount.before).toBeGreaterThan(0);
    expect(result.data?.stats.vertexCount.after).toBeGreaterThan(0);
    expect(result.data?.stats.drawCallCount).toBeDefined();
    expect(result.data?.stats.textureCount).toBeDefined();
    expect(result.data?.stats.textureSize).toBeDefined();
  });
});