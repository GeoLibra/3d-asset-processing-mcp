import { NodeIO, Document } from '@gltf-transform/core';
import { ModelAnalysis, ProcessResult } from '../types';
import { globalCache } from '../utils/cache';
import logger from '../utils/logger';

export class ModelAnalyzer {
  private io: NodeIO;

  constructor() {
    this.io = new NodeIO();
  }

  /**
   * Analyze 3D model
   */
  async analyze(filePath: string): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = globalCache.generateKey('analysis', filePath);
      const cached = globalCache.get<ModelAnalysis>(cacheKey);
      if (cached) {
        logger.info(`Analysis cache hit for: ${filePath}`);
        return {
          success: true,
          data: cached,
          metrics: {
            processingTime: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed
          }
        };
      }

      logger.info(`Starting analysis for: ${filePath}`);

      // Read document
      const document = await this.io.read(filePath);

      // Perform analysis
      const analysis = await this.performAnalysis(document, filePath);

      // Cache result
      globalCache.set(cacheKey, analysis, 3600); // 1小时缓存

      const processingTime = Date.now() - startTime;
      logger.info(`Analysis completed in ${processingTime}ms for: ${filePath}`);

      return {
        success: true,
        data: analysis,
        metrics: {
          processingTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };

    } catch (error) {
      logger.error(`Analysis failed for ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          processingTime: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }

  /**
   * Perform detailed analysis
   */
  private async performAnalysis(document: Document, filePath: string): Promise<ModelAnalysis> {
    const root = document.getRoot();

    // Basic metadata
    const metadata = this.analyzeMetadata(document, filePath);

    // Geometry analysis
    const geometry = this.analyzeGeometry(root);

    // Materials analysis
    const materials = this.analyzeMaterials(root);

    // Texture analysis
    const textures = this.analyzeTextures(root);

    // Animation analysis
    const animations = this.analyzeAnimations(root);

    // Extensions analysis
    const extensions = this.analyzeExtensions(root);

    // Performance analysis
    const performance = this.analyzePerformance(root, geometry, textures);

    return {
      metadata,
      geometry,
      materials,
      textures,
      animations,
      extensions,
      performance
    };
  }

  /**
   * Analyze metadata
   */
  private analyzeMetadata(document: Document, filePath: string) {
    const root = document.getRoot();
    const asset = root.getAsset();

    // Get file size
    const fs = require('fs');
    const stats = fs.statSync(filePath);

    return {
      fileSize: stats.size,
      format: filePath.endsWith('.glb') ? 'GLB' as const : 'glTF' as const,
      version: asset.version || '2.0',
      generator: asset.generator || 'Unknown'
    };
  }

  /**
   * Analyze geometry data
   */
  private analyzeGeometry(root: any) {
    const meshes = root.listMeshes();
    let primitiveCount = 0;
    let vertexCount = 0;
    let triangleCount = 0;
    let hasNormals = false;
    let hasTangents = false;
    let hasTexCoords = false;
    let hasColors = false;

    for (const mesh of meshes) {
      const primitives = mesh.listPrimitives();
      primitiveCount += primitives.length;

      for (const primitive of primitives) {
        const position = primitive.getAttribute('POSITION');
        if (position) {
          vertexCount += position.getCount();
        }

        const indices = primitive.getIndices();
        if (indices) {
          triangleCount += indices.getCount() / 3;
        } else if (position) {
          triangleCount += position.getCount() / 3;
        }

        // Check attributes
        if (primitive.getAttribute('NORMAL')) hasNormals = true;
        if (primitive.getAttribute('TANGENT')) hasTangents = true;
        if (primitive.getAttribute('TEXCOORD_0')) hasTexCoords = true;
        if (primitive.getAttribute('COLOR_0')) hasColors = true;
      }
    }

    return {
      meshCount: meshes.length,
      primitiveCount,
      vertexCount,
      triangleCount: Math.floor(triangleCount),
      hasNormals,
      hasTangents,
      hasTexCoords,
      hasColors
    };
  }

  /**
   * Analyze materials
   */
  private analyzeMaterials(root: any) {
    const materials = root.listMaterials();
    let pbrMaterials = 0;
    let unlitMaterials = 0;
    const extensions = new Set<string>();

    for (const material of materials) {
      if (material.getBaseColorTexture() || material.getMetallicRoughnessTexture()) {
        pbrMaterials++;
      }

      // Check unlit extension
      if (material.getExtension('KHR_materials_unlit')) {
        unlitMaterials++;
        extensions.add('KHR_materials_unlit');
      }

      // Check other material extensions
      const materialExtensions = [
        'KHR_materials_clearcoat',
        'KHR_materials_transmission',
        'KHR_materials_volume',
        'KHR_materials_ior',
        'KHR_materials_specular',
        'KHR_materials_sheen'
      ];

      for (const ext of materialExtensions) {
        if (material.getExtension(ext)) {
          extensions.add(ext);
        }
      }
    }

    return {
      materialCount: materials.length,
      pbrMaterials,
      unlitMaterials,
      extensions: Array.from(extensions)
    };
  }

  /**
   * Analyze textures
   */
  private analyzeTextures(root: any) {
    const textures = root.listTextures();
    let totalTextureSize = 0;
    const formats: Record<string, number> = {};
    const colorSpaces: Record<string, number> = {};
    let maxResolution: [number, number] = [0, 0];

    for (const texture of textures) {
      const image = texture.getImage();
      if (image) {
        const size = image.byteLength;
        totalTextureSize += size;

        // Try to get image information (simplified handling)
        const mimeType = texture.getMimeType();
        if (mimeType) {
          formats[mimeType] = (formats[mimeType] || 0) + 1;
        }

        // Color space analysis (simplified)
        const colorSpace = 'sRGB'; // Default, actually requires more complex detection
        colorSpaces[colorSpace] = (colorSpaces[colorSpace] || 0) + 1;
      }
    }

    return {
      textureCount: textures.length,
      totalTextureSize,
      formats,
      maxResolution,
      colorSpaces
    };
  }

  /**
   * Analyze animations
   */
  private analyzeAnimations(root: any) {
    const animations = root.listAnimations();
    let totalDuration = 0;
    let channels = 0;
    let samplers = 0;

    for (const animation of animations) {
      const animChannels = animation.listChannels();
      const animSamplers = animation.listSamplers();

      channels += animChannels.length;
      samplers += animSamplers.length;

      // Calculate animation duration
      for (const sampler of animSamplers) {
        const input = sampler.getInput();
        if (input) {
          const times = input.getArray();
          if (times && times.length > 0) {
            const timeArray = Array.from(times) as number[];
            const duration = Math.max(...timeArray);
            totalDuration = Math.max(totalDuration, duration);
          }
        }
      }
    }

    return {
      animationCount: animations.length,
      totalDuration,
      channels,
      samplers
    };
  }

  /**
   * Analyze extensions
   */
  private analyzeExtensions(root: any) {
    const used = root.listExtensionsUsed();
    const required = root.listExtensionsRequired();

    return {
      used: used || [],
      required: required || []
    };
  }

  /**
   * Performance analysis
   */
  private analyzePerformance(root: any, geometry: any, textures: any) {
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    // Estimate Draw Calls
    const estimatedDrawCalls = geometry.primitiveCount;

    // Estimate memory usage
    const estimatedMemoryUsage = textures.totalTextureSize + (geometry.vertexCount * 32); // Simplified estimation

    // Performance bottleneck detection
    if (geometry.triangleCount > 100000) {
      bottlenecks.push('High triangle count');
      recommendations.push('Consider using geometry simplification');
    }

    if (textures.totalTextureSize > 50 * 1024 * 1024) { // 50MB
      bottlenecks.push('Large texture memory usage');
      recommendations.push('Consider texture compression or resizing');
    }

    if (estimatedDrawCalls > 100) {
      bottlenecks.push('High draw call count');
      recommendations.push('Consider mesh merging or instancing');
    }

    if (!geometry.hasNormals) {
      recommendations.push('Consider adding normals for better lighting');
    }

    return {
      estimatedDrawCalls,
      estimatedMemoryUsage,
      bottlenecks,
      recommendations
    };
  }
}

// Global analyzer instance
export const globalAnalyzer = new ModelAnalyzer();