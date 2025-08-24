import { Request, Response } from 'express';

/**
 * Result of a processing operation
 */
export interface ProcessResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metrics: {
    processingTime: number;
    memoryUsage: number;
  };
}

/**
 * Validation report structure
 */
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

/**
 * Validation issue structure
 */
export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  pointer?: string;
}

/**
 * Model analysis result
 */
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
  fileInfo: {
    size: number;
    format: string;
    version: string;
  };
}

/**
 * Optimization preset options
 */
export interface OptimizationPreset {
  name: string;
  description: string;
  geometry: any[];
  textures: any[];
}

export type OptimizationPresetName = 'web-high' | 'web-lite' | 'mobile' | 'editor-safe';

/**
 * Optimization result
 */
export interface OptimizationResult {
  artifacts?: {
    optimized?: string;
    report?: string;
    [key: string]: string | undefined;
  };
  metrics: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    geometryReduction: number;
    textureReduction: number;
    processingTime: number;
  };
  quality?: {
    visualScore: number;
    performanceScore: number;
    compatibilityScore: number;
  };
  warnings?: string[];
  errors?: string[];
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

/**
 * Model input structure
 */
export interface ModelInput {
  source: string;
  type: 'file' | 'url' | 'base64';
  format?: string;
  options?: Record<string, any>;
}

/**
 * MCP Tool interface
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  execute: (input: any) => Promise<ProcessResult>;
}

/**
 * Express request with typed body
 */
export interface TypedRequest<T = any> extends Request {
  body: T;
}

/**
 * Express response with typed body
 */
export interface TypedResponse<T = any> extends Response {
  json(body: T): this;
}