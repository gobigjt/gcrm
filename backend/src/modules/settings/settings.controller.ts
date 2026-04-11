import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard }    from '../../common/guards/jwt-auth.guard';
import { RolesGuard }      from '../../common/guards/roles.guard';
import { Roles }           from '../../common/decorators/roles.decorator';
import { CurrentUser }     from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('company')   getSettings()     { return this.svc.getCompanySettings(); }
  @UseGuards(RolesGuard) @Roles('Admin')
  @Patch('company') updateSettings(@CurrentUser() u: any, @Body() b: any) { return this.svc.upsertCompanySettings(b, u.id); }

  @Post('company/logo')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'company');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
          const safe = allowed.includes(ext) ? ext : '.png';
          cb(null, `logo-${Date.now()}${safe}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) ||
          file.mimetype === 'image/svg+xml';
        cb(null, ok);
      },
    }),
  )
  uploadCompanyLogo(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() u: any) {
    if (!file) {
      throw new BadRequestException('Upload an image file (JPEG, PNG, WebP, GIF, or SVG), max 2 MB.');
    }
    return this.svc.setCompanyLogoFromUpload(file.filename, u.id);
  }

  @Post('company/favicon')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'company');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const allowed = ['.ico', '.png', '.svg', '.jpg', '.jpeg', '.webp'];
          const safe = allowed.includes(ext) ? ext : '.ico';
          cb(null, `favicon-${Date.now()}${safe}`);
        },
      }),
      limits: { fileSize: 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          /^image\/(x-icon|vnd\.microsoft\.icon|png|svg\+xml|jpeg|webp)$/.test(file.mimetype) ||
          /\.(ico|png|svg|jpe?g|webp)$/i.test(file.originalname || '');
        cb(null, ok);
      },
    }),
  )
  uploadCompanyFavicon(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() u: any) {
    if (!file) {
      throw new BadRequestException('Upload a favicon file (ICO, PNG, SVG, JPG, or WebP), max 1 MB.');
    }
    return this.svc.setCompanyFaviconFromUpload(file.filename, u.id);
  }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Get('permissions')   listPermissions() { return this.svc.listPermissions(); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Get('audit-logs')    getAuditLogs(@Query() q: any) { return this.svc.getAuditLogs(q); }

  @Get('modules')
  listModules() { return this.svc.listModuleSettings(); }

  @UseGuards(RolesGuard) @Roles('Admin')
  @Patch('modules/:module')
  updateModule(@CurrentUser() u: any, @Param('module') module: string, @Body() body: any) {
    return this.svc.updateModuleSettings(module, body, u.id);
  }

  @Get('dashboard')        getDashboardStats()  { return this.svc.getDashboardStats(); }
  @Get('dashboard/charts') getDashboardCharts() { return this.svc.getDashboardCharts(); }

  @UseGuards(RolesGuard) @Roles('Super Admin')
  @Get('platform/summary')
  platformSummary() {
    return this.svc.getPlatformSummary();
  }
}
