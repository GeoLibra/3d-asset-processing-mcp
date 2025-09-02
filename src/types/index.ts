// Basic type definitions
export interface ModelInput {
  source: string; // File path, URL or base64
  type: 'file' | 'url' | 'base64';
  format?: 'gltf' | 'glb' | 'auto';
}

export interface ModelAnalysis {
  geometry: {
    vertexCount: number;
    triangleCount: number;
    meshCount: number;
    primitiveCount: number;
  };
  materials: {
    count: number;
    types: string[];
    textureCount: number;
    totalTextureSize: number;
  };
  animations: {
    count: number;
    totalKeyframes: number;
    duration: number;
  };
  scene: {
    nodeCount: number;
    maxDepth: number;
  };
  extensions: {
    used: string[];
    required: string[];
    count: number;
  };
  fileInfo: {
    size: number;
    format: 'glTF' | 'GLB';
    version: string;
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

export interface ProcessResult<T = any> {
  success: boolean;
  data?: T;
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