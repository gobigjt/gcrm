import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ObjectStorageService } from '../services/object-storage.service';

@Controller('uploads')
export class BucketAssetsController {
  constructor(private readonly objectStorage: ObjectStorageService) {}

  @Get('bucket/*')
  async serveBucketAsset(@Req() req: Request, @Res() res: Response) {
    const key = String((req.params as any)?.[0] || '').trim();
    if (!key) throw new NotFoundException('File not found');
    try {
      const asset = await this.objectStorage.readPublicAsset(`/uploads/bucket/${key}`);
      res.setHeader('Content-Type', asset.contentType || 'application/octet-stream');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (asset.cacheControl) res.setHeader('Cache-Control', asset.cacheControl);
      return res.status(200).send(asset.body);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
