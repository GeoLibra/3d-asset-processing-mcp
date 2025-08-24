import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ModelInput } from '../types';
import logger from './logger';

export class FileHandler {
  private tempDir: string;

  constructor(tempDir = './temp') {
    this.tempDir = path.resolve(tempDir);
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.ensureDir(this.tempDir);
      logger.debug(`Temp directory ensured: ${this.tempDir}`);
    } catch (error) {
      logger.error('Failed to create temp directory:', error);
      throw error;
    }
  }

  /**
   * Process input files, converting them to local file paths
   */
  async processInput(input: ModelInput): Promise<string> {
    switch (input.type) {
      case 'file':
        return this.processFile(input.source);
      case 'url':
        return this.downloadFile(input.source);
      case 'base64':
        return this.saveBase64(input.source);
      default:
        throw new Error(`Unsupported input type: ${input.type}`);
    }
  }

  /**
   * Process local file
   */
  private async processFile(filePath: string): Promise<string> {
    const resolvedPath = path.resolve(filePath);

    if (!await fs.pathExists(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    logger.debug(`Processing local file: ${resolvedPath}`);
    return resolvedPath;
  }

  /**
   * Download remote file
   */
  private async downloadFile(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const fileName = this.getFileNameFromUrl(url) || `download_${uuidv4()}`;
      const filePath = path.join(this.tempDir, fileName);

      await fs.writeFile(filePath, Buffer.from(buffer));
      logger.debug(`Downloaded file: ${url} -> ${filePath}`);

      return filePath;
    } catch (error) {
      logger.error(`Failed to download file from ${url}:`, error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save Base64 data
   */
  private async saveBase64(base64Data: string): Promise<string> {
    try {
      // Parse data URL format
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid base64 data format');
      }

      const [, mimeType, data] = matches;
      const buffer = Buffer.from(data, 'base64');

      const extension = this.getExtensionFromMimeType(mimeType) || '.bin';
      const fileName = `base64_${uuidv4()}${extension}`;
      const filePath = path.join(this.tempDir, fileName);

      await fs.writeFile(filePath, buffer);
      logger.debug(`Saved base64 data: ${filePath}`);

      return filePath;
    } catch (error) {
      logger.error('Failed to save base64 data:', error);
      throw new Error(`Failed to save base64 data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract filename from URL
   */
  private getFileNameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = path.basename(pathname);
      return fileName && fileName !== '/' ? fileName : null;
    } catch {
      return null;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string | null {
    const mimeMap: Record<string, string> = {
      'model/gltf+json': '.gltf',
      'model/gltf-binary': '.glb',
      'application/octet-stream': '.glb',
      'application/json': '.gltf'
    };
    return mimeMap[mimeType] || null;
  }

  /**
   * Calculate file hash
   */
  async calculateFileHash(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string) {
    const stats = await fs.stat(filePath);
    const hash = await this.calculateFileHash(filePath);

    return {
      path: filePath,
      size: stats.size,
      hash,
      created: stats.birthtime,
      modified: stats.mtime,
      extension: path.extname(filePath).toLowerCase()
    };
  }

  /**
   * Create temporary file path
   */
  createTempPath(extension = '.tmp'): string {
    const fileName = `${uuidv4()}${extension}`;
    return path.join(this.tempDir, fileName);
  }

  /**
   * Clean up temporary file
   */
  async cleanup(filePath: string): Promise<void> {
    try {
      if (filePath.startsWith(this.tempDir)) {
        await fs.remove(filePath);
        logger.debug(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }

  /**
   * Clean up all temporary files
   */
  async cleanupAll(): Promise<void> {
    try {
      await fs.emptyDir(this.tempDir);
      logger.info('Cleaned up all temp files');
    } catch (error) {
      logger.error('Failed to cleanup temp directory:', error);
    }
  }

  /**
   * Copy file
   */
  async copyFile(src: string, dest: string): Promise<void> {
    await fs.copy(src, dest);
    logger.debug(`Copied file: ${src} -> ${dest}`);
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }
}

// Global file handler instance
export const globalFileHandler = new FileHandler();