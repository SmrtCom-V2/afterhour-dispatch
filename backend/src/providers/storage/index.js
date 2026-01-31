/**
 * Storage Provider Abstraction Layer
 * Supports local filesystem and S3
 * MVP: Local storage for SP report photos
 */

import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Local Storage Provider
class LocalStorageProvider {
  constructor(basePath) {
    this.basePath = basePath;
  }

  async init() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create storage directory', { error: error.message });
    }
  }

  async upload(fileBuffer, filename, mimetype) {
    const filePath = path.join(this.basePath, filename);
    const dir = path.dirname(filePath);

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, fileBuffer);

      logger.info('File uploaded', { filename });
      return {
        success: true,
        path: filePath,
        url: `/uploads/${filename}`,
      };
    } catch (error) {
      logger.error('File upload failed', { error: error.message, filename });
      return { success: false, error: error.message };
    }
  }

  async delete(filename) {
    const filePath = path.join(this.basePath, filename);

    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      logger.error('File delete failed', { error: error.message, filename });
      return { success: false, error: error.message };
    }
  }

  async getFile(filename) {
    const filePath = path.join(this.basePath, filename);

    try {
      const buffer = await fs.readFile(filePath);
      return { success: true, buffer };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getPublicUrl(filename) {
    return `/uploads/${filename}`;
  }
}

// S3 Storage Provider (for production)
class S3StorageProvider {
  constructor(accessKeyId, secretAccessKey, bucket, region) {
    this.bucket = bucket;
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.client = null;
  }

  async init() {
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  async upload(fileBuffer, filename, mimetype) {
    if (!this.client) await this.init();

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: filename,
          Body: fileBuffer,
          ContentType: mimetype,
        })
      );

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${filename}`;
      logger.info('File uploaded to S3', { filename, url });

      return { success: true, path: filename, url };
    } catch (error) {
      logger.error('S3 upload failed', { error: error.message, filename });
      return { success: false, error: error.message };
    }
  }

  async delete(filename) {
    if (!this.client) await this.init();

    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: filename,
        })
      );
      return { success: true };
    } catch (error) {
      logger.error('S3 delete failed', { error: error.message, filename });
      return { success: false, error: error.message };
    }
  }

  async getFile(filename) {
    if (!this.client) await this.init();

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: filename,
        })
      );

      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return { success: true, buffer };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getPublicUrl(filename) {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${filename}`;
  }
}

// Factory function
export function createStorageProvider() {
  const providerName = config.storage.provider;

  switch (providerName) {
    case 's3':
      return new S3StorageProvider(
        config.storage.s3.accessKeyId,
        config.storage.s3.secretAccessKey,
        config.storage.s3.bucket,
        config.storage.s3.region
      );

    case 'local':
    default:
      return new LocalStorageProvider(config.storage.localPath);
  }
}

// Singleton instance
let storageProvider = null;

export async function getStorageProvider() {
  if (!storageProvider) {
    storageProvider = createStorageProvider();
    await storageProvider.init();
  }
  return storageProvider;
}

export default getStorageProvider;
