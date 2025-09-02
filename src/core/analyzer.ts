import { NodeIO, Document } from '@gltf-transform/core';
import { ModelAnalysis, ProcessResult } from '../types';
import { globalCache } from '../utils/cache';
import logger from '../utils/logger';

export class ModelAnalyzer {
  private io: NodeIO;

  private initialized: Promise<void>;

  constructor() {
    // Initialize IO
    this.io = new NodeIO();
    this.initialized = this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    const isTestEnv = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';

    if (!isTestEnv) {
      try {
        // Dynamically import and register extensions
        const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
        this.io.registerExtensions(ALL_EXTENSIONS);
        logger.debug('Registered ALL_EXTENSIONS successfully');

      // Register decoders
      const dependencies: Record<string, any> = {};

      // Try to register Draco decoder
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const draco3d = require('draco3dgltf');
        if (draco3d && draco3d.createDecoderModule) {
          dependencies['draco3d.decoder'] = await draco3d.createDecoderModule();
          logger.debug('Registered Draco decoder');
        }
      } catch (e) {
        logger.warn('Draco decoder not available:', e instanceof Error ? e.message : String(e));
      }

      // Try to register Meshopt decoder
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const meshopt = require('meshoptimizer');
        if (meshopt && meshopt.MeshoptDecoder) {
          dependencies['meshopt.decoder'] = meshopt.MeshoptDecoder;
          logger.debug('Registered Meshopt decoder');
        }
      } catch (e) {
        try {
          // Fallback to meshopt_decoder package
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const meshoptDecoder = require('meshopt_decoder');
          dependencies['meshopt.decoder'] = meshoptDecoder.default || meshoptDecoder.MeshoptDecoder || meshoptDecoder;
          logger.debug('Registered Meshopt decoder (fallback)');
        } catch (e2) {
          logger.warn('Meshopt decoder not available:', e instanceof Error ? e.message : String(e));
        }
      }

        // Register all available dependencies
        if (Object.keys(dependencies).length > 0) {
          this.io.registerDependencies(dependencies);
          logger.debug(`Registered ${Object.keys(dependencies).length} decoders`);
        }

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn(`Failed to initialize extensions and decoders: ${msg}`);
      }
    } else {
      logger.debug('Skipping extensions registration in test environment');
    }
  }

  /**
   * Analyze 3D model
   */
  async analyze(filePath: string): Promise<ProcessResult> {
    const startTime = Date.now();

    try {
      // Wait for initialization to complete
      await this.initialized;

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
      geometry: {
        vertexCount: geometry.vertexCount,
        triangleCount: geometry.triangleCount,
        meshCount: geometry.meshCount,
        primitiveCount: geometry.primitiveCount
      },
      materials: {
        count: materials.materialCount,
        types: ['PBR', 'Unlit'],
        textureCount: textures.textureCount,
        totalTextureSize: textures.totalTextureSize
      },
      animations: {
        count: animations.animationCount,
        totalKeyframes: animations.samplers,
        duration: animations.totalDuration
      },
      scene: {
        nodeCount: root.listNodes().length,
        maxDepth: this.calculateSceneDepth(root)
      },
      extensions: {
        used: extensions.used,
        required: extensions.required,
        count: extensions.used.length
      },
      fileInfo: {
        size: metadata.fileSize,
        format: metadata.format,
        version: metadata.version
      }
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
    const usedExtensions = root.listExtensionsUsed();
    const requiredExtensions = root.listExtensionsRequired();

    // Extract extension names from extension objects
    const used = usedExtensions ? usedExtensions.map((ext: any) => ext.extensionName || ext) : [];
    const required = requiredExtensions ? requiredExtensions.map((ext: any) => ext.extensionName || ext) : [];

    // Log extensions for debugging
    if (used && used.length > 0) {
      logger.info(`Extensions used: ${used.join(', ')}`);
    }
    if (required && required.length > 0) {
      logger.info(`Extensions required: ${required.join(', ')}`);
    }

    return {
      used,
      required
    };
  }

  /**
   * Calculate the maximum depth of the scene graph
   */
  private calculateSceneDepth(root: any): number {
    const scenes = root.listScenes();
    let maxDepth = 0;

    for (const scene of scenes) {
      // Get root nodes of the scene (nodes without parents)
      const rootNodes = root.listNodes().filter((node: any) => !node.getParent());
      for (const node of rootNodes) {
        const depth = this.getNodeDepth(node, 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return maxDepth || 1;
  }

  /**
   * Get the depth of a node in the scene graph
   */
  private getNodeDepth(node: any, currentDepth: number): number {
    let maxChildDepth = currentDepth;
    const children = node.listChildren();

    for (const child of children) {
      const childDepth = this.getNodeDepth(child, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return maxChildDepth;
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