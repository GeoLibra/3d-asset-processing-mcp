// Basic type definitions
export interface ModelInput {
  source: string; // File path, URL or base64
  type: 'file' | 'url' | 'base64';
  format?: 'gltf' | 'glb' | 'auto';
}

export interface ModelAnalysis {
  metadata: {
    fileSize: number;
    format: 'glTF' | 'GLB';
    version: string;
    generator: string;
  };
  geometry: {
    meshCount: number;
    primitiveCount: number;
    vertexCount: number;
    triangleCount: number;
    hasNormals: boolean;
    hasTangents: boolean;
    hasTexCoords: boolean;
    hasColors: boolean;
  };
  materials: {
    materialCount: number;
    pbrMaterials: number;
    unlitMaterials: number;
    extensions: string[];
  };
  textures: {
    textureCount: number;
    totalTextureSize: number;
    formats: Record<string, number>;
    maxResolution: [number, number];
    colorSpaces: Record<string, number>;
  };
  animations: {
    animationCount: number;
    totalDuration: number;
    channels: number;
    samplers: number;
  };
  extensions: {
    used: string[];
    required: string[];
  };
  performance: {
    estimatedDrawCalls: number;
    estimatedMemoryUsage: number;
    bottlenecks: string[];
    recommendations: string[];
  };
}

export interface OptimizationPreset {
  name: string;
  description: string;
  geometry: any[];
  textures: any[];
  cleanup?: any[];
  performance?: {
    maxDrawCalls?: number;
    maxTriangles?: number;
    maxTextureSize?: number;
  };
}

export interface OptimizationResult {
  artifacts: {
    optimized: string;
    variants?: Record<string, string>;
    thumbnails?: string[];
    report: string;
  };
  metrics: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    geometryReduction: number;
    textureReduction: number;
    processingTime: number;
  };
  quality: {
    visualScore: number;
    performanceScore: number;
    compatibilityScore: number;
  };
  warnings: string[];
  errors: string[];
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  compatibility: {
    webgl2: boolean;
    ios: boolean;
    android: boolean;
    unity: boolean;
    unreal: boolean;
  };
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  pointer?: string;
}

export interface ProcessResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
  metrics?: {
    processingTime: number;
    memoryUsage: number;
  };
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  size: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  execute: (params: any) => Promise<any>;
}