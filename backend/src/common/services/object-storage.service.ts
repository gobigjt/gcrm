import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

  private cleanEnv(raw: string | undefined): string {
    let s = String(raw || '').replace(/^\uFEFF/, '').trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    return s;
  }

  private readConfig(): StorageConfig {
    if (this.cfg) return this.cfg;

    const bucket = this.cleanEnv(process.env.RAILWAY_BUCKET_NAME);
    const endpoint = this.cleanEnv(process.env.RAILWAY_BUCKET_ENDPOINT);
    const region = this.cleanEnv(process.env.RAILWAY_BUCKET_REGION) || 'auto';
    const accessKeyId = this.cleanEnv(process.env.RAILWAY_BUCKET_ACCESS_KEY_ID);
    const secretAccessKey = this.cleanEnv(process.env.RAILWAY_BUCKET_SECRET_ACCESS_KEY);
    const acl = this.cleanEnv(process.env.RAILWAY_BUCKET_ACL);
    const forcePathStyleRaw = this.cleanEnv(process.env.RAILWAY_BUCKET_FORCE_PATH_STYLE).toLowerCase();
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
    return `/uploads/bucket/${key}`;
  }

  private extractKeyFromPathOrUrl(fileUrl: string | null | undefined): string | null {
    const raw = String(fileUrl || '').trim();
    if (!raw) return null;
    if (raw.startsWith('/uploads/bucket/')) return raw.slice('/uploads/bucket/'.length);
    if (raw.startsWith('/api/uploads/bucket/')) return raw.slice('/api/uploads/bucket/'.length);

    const cfg = this.readConfig();
    if (cfg.endpoint) {
      const endpoint = cfg.endpoint.replace(/\/$/, '');
      const marker = `${endpoint}/${cfg.bucket}/`;
      if (raw.startsWith(marker)) return raw.slice(marker.length);
    }
    return null;
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
    const key = this.extractKeyFromPathOrUrl(fileUrl);
    if (!key) return false;

    const client = this.getClient();
    const cfg = this.readConfig();

    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );
    return true;
  }

  async readPublicAsset(pathOrUrl: string): Promise<{ body: Buffer; contentType: string; cacheControl?: string }> {
    const key = this.extractKeyFromPathOrUrl(pathOrUrl);
    if (!key) {
      throw new InternalServerErrorException('Invalid bucket asset path.');
    }

    const cfg = this.readConfig();
    const client = this.getClient();
    const obj = await client.send(
      new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );
    const bytes = obj.Body ? await obj.Body.transformToByteArray() : new Uint8Array();
    return {
      body: Buffer.from(bytes),
      contentType: obj.ContentType || 'application/octet-stream',
      cacheControl: obj.CacheControl || undefined,
    };
  }
}
