import { ModelAnalyzer } from '../../core/analyzer';
import { NodeIO, Document, Root } from '@gltf-transform/core';

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
    size: 1024,
    birthtime: new Date(),
    mtime: new Date()
  })
}));

// Mock @gltf-transform/core
jest.mock('@gltf-transform/core', () => {
  // Create mock classes
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

  class MockMaterial {
    getBaseColorTexture() { return null; }
    getMetallicRoughnessTexture() { return null; }
    getExtension(name: string) { return null; }
  }

  class MockTexture {
    getImage() { return Buffer.from('mock-image-data'); }
    getMimeType() { return 'image/png'; }
  }

  class MockAnimation {
    listChannels() { return [{}]; }
    listSamplers() {
      return [{
        getInput: () => ({
          getArray: () => [0, 0.5, 1.0, 1.5, 2.0]
        })
      }];
    }
  }

  class MockNode {
    listChildren() { return []; }
  }

  class MockScene {
    listNodes() { return [new MockNode()]; }
  }

  class MockRoot {
    getAsset() { return { version: '2.0', generator: 'Test' }; }
    listMeshes() { return [new MockMesh(), new MockMesh()]; }
    listMaterials() { return [new MockMaterial(), new MockMaterial()]; }
    listTextures() { return [new MockTexture(), new MockTexture()]; }
    listAnimations() { return [new MockAnimation()]; }
    listExtensionsUsed() { return ['KHR_draco_mesh_compression']; }
    listExtensionsRequired() { return []; }
    listNodes() { return [new MockNode(), new MockNode()]; }
    listScenes() { return [new MockScene()]; }
  }

  class MockDocument {
    getRoot() { return new MockRoot(); }
  }

  class MockNodeIO {
    read() { return Promise.resolve(new MockDocument()); }
  }

  return {
    NodeIO: MockNodeIO,
    Document: MockDocument,
    Root: MockRoot
  };
});

describe('ModelAnalyzer', () => {
  let analyzer: ModelAnalyzer;
  const mockFilePath = '/path/to/model.glb';

  beforeEach(() => {
    analyzer = new ModelAnalyzer();
    jest.clearAllMocks();
  });

  test('should analyze a model successfully', async () => {
    const result = await analyzer.analyze(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics.processingTime).toBeGreaterThanOrEqual(0);
  });

  test('should return geometry statistics', async () => {
    const result = await analyzer.analyze(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.geometry).toBeDefined();
    expect(result.data?.geometry.vertexCount).toBeGreaterThan(0);
    expect(result.data?.geometry.triangleCount).toBeGreaterThan(0);
    expect(result.data?.geometry.meshCount).toBe(2);
    expect(result.data?.geometry.primitiveCount).toBe(4);
  });

  test('should return material statistics', async () => {
    const result = await analyzer.analyze(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.materials).toBeDefined();
    expect(result.data?.materials.count).toBe(2);
    expect(result.data?.materials.types).toContain('PBR');
    expect(result.data?.materials.textureCount).toBe(2);
  });

  test('should return animation statistics', async () => {
    const result = await analyzer.analyze(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.animations).toBeDefined();
    expect(result.data?.animations.count).toBe(1);
    expect(result.data?.animations.duration).toBeGreaterThan(0);
  });

  test('should return scene statistics', async () => {
    const result = await analyzer.analyze(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.scene).toBeDefined();
    expect(result.data?.scene.nodeCount).toBe(2);
    expect(result.data?.scene.maxDepth).toBeGreaterThanOrEqual(1);
  });

  test('should return file information', async () => {
    const result = await analyzer.analyze(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.fileInfo).toBeDefined();
    expect(result.data?.fileInfo.size).toBe(1024);
    expect(result.data?.fileInfo.format).toBe('GLB');
    expect(result.data?.fileInfo.version).toBe('2.0');
  });

  test('should handle analysis errors', async () => {
    // Mock NodeIO to throw an error
    jest.spyOn(analyzer['io'], 'read').mockRejectedValueOnce(new Error('Analysis error'));

    const result = await analyzer.analyze(mockFilePath);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Analysis error');
    expect(result.metrics).toBeDefined();
    expect(result.metrics.processingTime).toBeGreaterThanOrEqual(0);
  });
});