import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { env } from '../config/env.js';
import type { StorageProvider } from './storage-provider.js';

function extensionFromFilename(filename?: string) {
  if (!filename) return '';
  const ext = path.extname(filename);
  return ext ? ext.toLowerCase() : '';
}

function normalizeExtension(fileExtension: string) {
  return fileExtension.startsWith('.') ? fileExtension.toLowerCase() : `.${fileExtension.toLowerCase()}`;
}

function buildS3Client() {
  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: env.AWS_REGION ?? 'auto',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
  };

  if (env.AWS_S3_ENDPOINT) {
    config.endpoint = env.AWS_S3_ENDPOINT;
    // Required for path-style URLs (Cloudflare R2, MinIO, etc.)
    config.forcePathStyle = false;
  }

  return new S3Client(config);
}

export const s3StorageProvider: StorageProvider = {
  async storeFile(input) {
    const s3 = buildS3Client();
    const extension = extensionFromFilename(input.originalFilename);
    const storageKey = `${input.category}/${crypto.randomUUID()}${extension}`;
    const fileData = await fs.readFile(input.tempFilePath);

    await s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET!,
        Key: storageKey,
        Body: fileData,
        ContentType: input.mimeType ?? 'application/octet-stream',
      })
    );

    // Clean up the temp file
    await fs.rm(input.tempFilePath, { force: true });

    return {
      storageProvider: 's3',
      storageKey,
      publicUrl: `${env.AWS_S3_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${storageKey}`,
    };
  },

  async storeGeneratedFile(input) {
    const s3 = buildS3Client();
    const storageKey = `${input.category}/${crypto.randomUUID()}${normalizeExtension(input.fileExtension)}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET!,
        Key: storageKey,
        Body: input.data,
        ContentType: input.mimeType ?? 'application/octet-stream',
      })
    );

    return {
      storageProvider: 's3',
      storageKey,
      publicUrl: `${env.AWS_S3_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${storageKey}`,
    };
  },

  async deleteFile(storageKey) {
    const s3 = buildS3Client();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: env.AWS_S3_BUCKET!,
        Key: storageKey,
      })
    );
  },
};
