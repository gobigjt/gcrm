import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { DatabaseService } from '../../database/database.service';
import { AuditService }   from '../audit/audit.service';
import { LoginDto }    from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

/**
 * jsonwebtoken: `expiresIn` as a **number** = seconds.
 * As a **string**, values are passed to `ms()` — a digit-only string like "86400" is treated as
 * **86400 milliseconds** (~86s), not 24 hours. Env vars are always strings, so plain numeric
 * values must be parsed to number (seconds) here.
 */
function parseJwtExpiresIn(raw: string | undefined): string | number {
  if (raw == null || raw === '') return '1d';
  const t = String(raw).trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return t;
}

const ACCESS_EXPIRES = parseJwtExpiresIn(process.env.JWT_EXPIRES_IN);

@Injectable()
export class AuthService {
  constructor(
    private readonly db:    DatabaseService,
    private readonly jwt:   JwtService,
    private readonly audit: AuditService,
  ) {}

  private signAccess(user: { id: number; email: string; role: string; role_id?: number }) {
    return this.jwt.sign(
      { id: user.id, email: user.email, role: user.role, role_id: user.role_id },
      { expiresIn: ACCESS_EXPIRES },
    );
  }

  private async issueRefresh(userId: number): Promise<string> {
    const token     = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86_400_000);
    await this.db.query(
      'INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)',
      [userId, token, expiresAt],
    );
    return token;
  }

  async register(dto: RegisterDto) {
    const exists = await this.db.query('SELECT id FROM users WHERE email=$1', [dto.email]);
    if (exists.rows[0]) throw new ConflictException('Email already registered');
    const hashed   = await bcrypt.hash(dto.password, 10);
    const roleName = dto.role || 'Sales Executive';
    const roleRes  = await this.db.query('SELECT id FROM roles WHERE name=$1', [roleName]);
    const roleId   = roleRes.rows[0]?.id ?? null;
    const res = await this.db.query(
      'INSERT INTO users (name,email,password,role,role_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,role_id,avatar_url',
      [dto.name, dto.email, hashed, roleName, roleId],
    );
    const user         = res.rows[0];
    const access_token  = this.signAccess(user);
    const refresh_token = await this.issueRefresh(user.id);
    this.audit.log({ user_id: user.id, action: 'register', module: 'auth', details: { name: user.name, email: user.email } });
    return { user, access_token, refresh_token };
  }

  async login(dto: LoginDto) {
    const res = await this.db.query(
      'SELECT id,name,email,password,role,role_id,avatar_url FROM users WHERE email=$1 AND is_active=TRUE',
      [dto.email],
    );
    const user = res.rows[0];
    if (!user) throw new UnauthorizedException('Invalid email / password');
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid email / password');
    const { password: _, ...safe } = user;
    const access_token  = this.signAccess(safe);
    const refresh_token = await this.issueRefresh(safe.id);
    this.audit.log({ user_id: safe.id, action: 'login', module: 'auth' });
    return { user: safe, access_token, refresh_token };
  }

  async refresh(token: string) {
    const row = await this.db.query(
      `SELECT rt.*, u.id AS uid, u.email, u.role, u.role_id
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
        WHERE rt.token = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW()`,
      [token],
    );
    if (!row.rows[0]) throw new UnauthorizedException('Invalid or expired refresh token');
    const { uid, email, role, role_id, id: tokenId } = row.rows[0];
    // Rotate: revoke old, issue new
    await this.db.query('UPDATE refresh_tokens SET revoked=TRUE WHERE id=$1', [tokenId]);
    const access_token  = this.signAccess({ id: uid, email, role, role_id });
    const refresh_token = await this.issueRefresh(uid);
    return { access_token, refresh_token };
  }

  async logout(token: string) {
    await this.db.query('UPDATE refresh_tokens SET revoked=TRUE WHERE token=$1', [token]);
    return { message: 'Logged out' };
  }

  async me(id: number) {
    const res = await this.db.query(
      'SELECT id,name,email,role,role_id,is_active,created_at,avatar_url FROM users WHERE id=$1', [id],
    );
    return res.rows[0];
  }

  private removeAvatarFile(prevUrl: string | null | undefined) {
    if (!prevUrl || typeof prevUrl !== 'string' || !prevUrl.startsWith('/uploads/users/')) return;
    const fp = join(process.cwd(), 'uploads', 'users', basename(prevUrl));
    try {
      if (existsSync(fp)) unlinkSync(fp);
    } catch {
      /* ignore */
    }
  }

  /** Save profile image; returns updated user (same shape as `me`). */
  async setAvatarFromUpload(userId: number, filename: string) {
    const prevRes = await this.db.query('SELECT avatar_url FROM users WHERE id=$1', [userId]);
    const prev = prevRes.rows[0]?.avatar_url as string | undefined;
    this.removeAvatarFile(prev);
    const rel = `/uploads/users/${filename}`;
    await this.db.query('UPDATE users SET avatar_url=$2, updated_at=NOW() WHERE id=$1', [userId, rel]);
    this.audit.log({ user_id: userId, action: 'update_avatar', module: 'auth' });
    return this.me(userId);
  }

  async clearAvatar(userId: number) {
    const prevRes = await this.db.query('SELECT avatar_url FROM users WHERE id=$1', [userId]);
    const prev = prevRes.rows[0]?.avatar_url as string | undefined;
    this.removeAvatarFile(prev);
    await this.db.query('UPDATE users SET avatar_url=NULL, updated_at=NOW() WHERE id=$1', [userId]);
    this.audit.log({ user_id: userId, action: 'clear_avatar', module: 'auth' });
    return this.me(userId);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const res = await this.db.query('SELECT id,password FROM users WHERE id=$1 AND is_active=TRUE', [userId]);
    const row = res.rows[0];
    if (!row) throw new UnauthorizedException('User not found');
    const ok = await bcrypt.compare(currentPassword, row.password);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.db.query('UPDATE users SET password=$2 WHERE id=$1', [userId, hashed]);
    this.audit.log({ user_id: userId, action: 'change_password', module: 'auth' });
    return { message: 'Password updated' };
  }
}
