import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AuthService }  from './auth.service';
import { LoginDto }     from './dto/login.dto';
import { RegisterDto }  from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'Returns user + access_token + refresh_token' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('login')
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Returns user + access_token + refresh_token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ schema: { properties: { refresh_token: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Returns new access_token + refresh_token' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body('refresh_token') token: string) { return this.auth.refresh(token); }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke refresh token and log out' })
  @ApiBody({ schema: { properties: { refresh_token: { type: 'string' } } } })
  logout(@Body('refresh_token') token: string) { return this.auth.logout(token); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: any) { return this.auth.me(user.id); }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.current_password, dto.new_password);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Upload current user profile photo (JPEG, PNG, WebP, GIF; max 2 MB)' })
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
          const dir = join(process.cwd(), 'uploads', 'users');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
          const safe = allowed.includes(ext) ? ext : '.jpg';
          cb(null, `avatar-${Date.now()}${safe}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          /^image\/(jpeg|jpg|pjpeg|png|webp|gif)$/i.test(file.mimetype)
          || (file.mimetype === 'application/octet-stream' &&
            /\.(jpe?g|png|webp|gif)$/i.test(file.originalname || ''));
        cb(null, ok);
      },
    }),
  )
  async uploadMyAvatar(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: any) {
    if (!file) {
      throw new BadRequestException(
        'Could not read the image. Use JPEG, PNG, WebP, or GIF under 2 MB.',
      );
    }
    const u = await this.auth.setAvatarFromUpload(user.id, file.filename);
    return { user: u };
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove current user profile photo' })
  async deleteMyAvatar(@CurrentUser() user: any) {
    const u = await this.auth.clearAvatar(user.id);
    return { user: u };
  }
}
