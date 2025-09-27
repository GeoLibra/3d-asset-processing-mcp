/* Global type for tests */
declare type OptimizationOptions = {
  simplifyRatio?: number;
  textureFormat?: 'webp' | 'jpeg' | 'png' | 'ktx2' | 'basis';
  textureQuality?: number;
  draco?: boolean;
  dracoOptions?: {
    quantizePosition?: number;
    quantizeNormal?: number;
    quantizeTexcoord?: number;
    quantizeColor?: number;
    quantizeGeneric?: number;
    compressionLevel?: number;
  };
};