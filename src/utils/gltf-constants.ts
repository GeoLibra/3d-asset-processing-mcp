export const GLB_EXT = '.glb';
export const GLTF_EXT = '.gltf';

export type OutputFormat = 'glb' | 'gltf';

export function desiredExtFrom(opts: { outputFormat?: OutputFormat; binary?: boolean }): string {
  if (opts.outputFormat === 'glb' || opts.binary) return GLB_EXT;
  return GLTF_EXT;
}

// Texture encoders
export const TEXTURE_ENCODERS = ['webp', 'jpeg', 'png'] as const;
export type TextureEncoder = typeof TEXTURE_ENCODERS[number];

// Legacy/alias mapping
export const LEGACY_ENCODER_ALIASES: Record<string, TextureEncoder> = {
  jpg: 'jpeg',
};

// Normalize user-provided encoder (returns undefined if not provided)
export function normalizeEncoder(input?: string): TextureEncoder | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase();
  const alias = LEGACY_ENCODER_ALIASES[lower];
  const candidate = (alias ?? lower) as string;
  if ((TEXTURE_ENCODERS as readonly string[]).includes(candidate)) {
    return candidate as TextureEncoder;
  }
  throw new Error(`Unsupported texture encoder: ${input}. Supported: ${TEXTURE_ENCODERS.join(', ')} (aliases: jpg->jpeg).`);
}