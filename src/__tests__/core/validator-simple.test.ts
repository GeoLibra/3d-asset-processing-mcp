import { SimpleValidator } from '../../core/validator-simple';
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

// Mock gltf-validator
jest.mock('gltf-validator', () => ({
  validateBytes: jest.fn().mockResolvedValue({
    valid: true,
    issues: []
  })
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  statSync: jest.fn().mockReturnValue({
    size: 1024,
    birthtime: new Date(),
    mtime: new Date()
  }),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('mock-file-content'))
}));

describe('SimpleValidator', () => {
  let validator: SimpleValidator;
  const mockFilePath = '/path/to/model.glb';

  beforeEach(() => {
    validator = new SimpleValidator();
    jest.clearAllMocks();
  });

  test('should validate a valid file', async () => {
    // Ensure GLB header is valid to avoid early FILE_CHECK errors.
    (fs.readFileSync as jest.Mock).mockReturnValueOnce(Buffer.from('glTFxxxxvalid'));
    const result = await validator.validate(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.valid).toBe(true);
    expect(result.metrics?.processingTime ?? 0).toBeGreaterThanOrEqual(0);
  });

  test('should handle non-existent files', async () => {
    // Mock file not existing
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

    const result = await validator.validate('/path/to/non-existent.glb');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors.length).toBeGreaterThan(0);
    expect(result.data?.errors[0].code).toBe('FILE_NOT_FOUND');
  });

  test('should handle empty files', async () => {
    // Mock empty file
    (fs.statSync as jest.Mock).mockReturnValueOnce({
      size: 0,
      birthtime: new Date(),
      mtime: new Date()
    });

    const result = await validator.validate(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors.length).toBeGreaterThan(0);
    expect(result.data?.errors[0].code).toBe('EMPTY_FILE');
  });

  test('should handle invalid GLB headers', async () => {
    // Mock invalid GLB header
    (fs.readFileSync as jest.Mock).mockReturnValueOnce(Buffer.from('invalid-header'));

    const result = await validator.validate('/path/to/invalid.glb');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors.some((e: { code: string }) => e.code === 'INVALID_GLB_HEADER')).toBe(true);
  });

  test('should handle validator errors', async () => {
    // Ensure GLB header is valid to avoid early FILE_CHECK errors.
    (fs.readFileSync as jest.Mock).mockReturnValueOnce(Buffer.from('glTFxxxxvalid'));
    // Mock validator throwing an error
    const gltfValidator = require('gltf-validator');
    (gltfValidator.validateBytes as jest.Mock).mockRejectedValueOnce(new Error('Validation error'));

    const result = await validator.validate(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors.some((e: { code: string }) => e.code === 'VALIDATOR_ERROR')).toBe(true);
  });

  test('should handle validator issues', async () => {
    // Ensure GLB header is valid to avoid early FILE_CHECK errors.
    (fs.readFileSync as jest.Mock).mockReturnValueOnce(Buffer.from('glTFxxxxvalid'));
    // Mock validator returning issues
    const gltfValidator = require('gltf-validator');
    (gltfValidator.validateBytes as jest.Mock).mockResolvedValueOnce({
      valid: false,
      issues: [
        { code: 'ERROR_CODE', message: 'Error message', severity: 0, pointer: '/path' },
        { code: 'WARNING_CODE', message: 'Warning message', severity: 1, pointer: '/path' },
        { code: 'INFO_CODE', message: 'Info message', severity: 2, pointer: '/path' }
      ]
    });

    const result = await validator.validate(mockFilePath);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors.length).toBe(1);
    expect(result.data?.warnings.length).toBe(1);
    expect(result.data?.info.length).toBe(1);
  });

  test('should apply rule-specific checks', async () => {
    // Ensure GLB header is valid to avoid early FILE_CHECK errors.
    (fs.readFileSync as jest.Mock).mockReturnValueOnce(Buffer.from('glTFxxxxvalid'));
    const result = await validator.validate(mockFilePath, 'web-compatible');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.info.some((i: { code: string }) => i.code === 'WEB_COMPATIBILITY_CHECK')).toBe(true);
  });

  test('should return validator info', async () => {
    const info = await validator.getValidatorInfo();

    expect(info.available).toBe(true);
    expect(info.type).toBe('JavaScript API');
  });
});