import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type StorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  acl?: string;
};

@Injectable()
export class ObjectStorageService {
  private client: S3Client | null = null;
  private cfg: StorageConfig | null = null;

  private readConfig(): StorageConfig {
    if (this.cfg) return this.cfg;

    const bucket = process.env.RAILWAY_BUCKET_NAME || '';
    const endpoint = process.env.RAILWAY_BUCKET_ENDPOINT || '';
    const region = process.env.RAILWAY_BUCKET_REGION || 'auto';
    const accessKeyId = process.env.RAILWAY_BUCKET_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.RAILWAY_BUCKET_SECRET_ACCESS_KEY || '';
    const acl = process.env.RAILWAY_BUCKET_ACL || '';
    const forcePathStyleRaw = String(process.env.RAILWAY_BUCKET_FORCE_PATH_STYLE || '').trim().toLowerCase();
    const forcePathStyle = forcePathStyleRaw ? forcePathStyleRaw === 'true' || forcePathStyleRaw === '1' : true;

    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        'Railway bucket is not configured. Set RAILWAY_BUCKET_NAME, RAILWAY_BUCKET_ENDPOINT, and Railway bucket credentials.',
      );
    }

    this.cfg = {
      bucket,
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      accessKeyId,
      secretAccessKey,
      acl: acl || undefined,
    };
    return this.cfg;
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const cfg = this.readConfig();
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    return this.client;
  }

  private safeExt(mimeType: string | undefined, originalName: string | undefined): string {
    const m = String(mimeType || '').toLowerCase();
    if (m === 'image/jpeg' || m === 'image/jpg' || m === 'image/pjpeg') return 'jpg';
    if (m === 'image/png') return 'png';
    if (m === 'image/webp') return 'webp';
    if (m === 'image/gif') return 'gif';
    if (m === 'image/svg+xml') return 'svg';

    const ext = String(originalName || '')
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase();
    return ext && /^[a-z0-9]{2,8}$/.test(ext) ? ext : 'bin';
  }

  private buildPublicUrl(key: string): string {
    const cfg = this.readConfig();
    if (cfg.endpoint) {
      return `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${key}`;
    }
    throw new InternalServerErrorException('Object storage endpoint is not configured.');
  }

  async uploadPublicImage(file: Express.Multer.File, keyPrefix: string): Promise<{ url: string; key: string }> {
    const cfg = this.readConfig();
    const client = this.getClient();
    if (!file?.buffer || !file.size) {
      throw new InternalServerErrorException('Uploaded file payload is empty.');
    }

    const ext = this.safeExt(file.mimetype, file.originalname);
    const key = `${keyPrefix.replace(/^\/+|\/+$/g, '')}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || undefined,
        CacheControl: 'public, max-age=31536000, immutable',
        ACL: cfg.acl as any,
      }),
    );

    return { key, url: this.buildPublicUrl(key) };
  }

  async deleteByPublicUrl(fileUrl: string | null | undefined): Promise<boolean> {
    const raw = String(fileUrl || '').trim();
    if (!raw || !/^https?:\/\//i.test(raw)) return false;

    const cfg = this.readConfig();
    const client = this.getClient();
    let key = '';

    if (cfg.endpoint) {
      const endpoint = cfg.endpoint.replace(/\/$/, '');
      const marker = `${endpoint}/${cfg.bucket}/`;
      if (raw.startsWith(marker)) key = raw.slice(marker.length);
    }

    if (!key) return false;

    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );
    return true;
  }
}
