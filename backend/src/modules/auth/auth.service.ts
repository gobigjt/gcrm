import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { AuditService }   from '../audit/audit.service';
import { LoginDto }    from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const ACCESS_EXPIRES  = process.env.JWT_EXPIRES_IN  || '1d';
const REFRESH_DAYS    = Number(process.env.REFRESH_TOKEN_DAYS || 7);

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
    const roleName = dto.role || 'Agent';
    const roleRes  = await this.db.query('SELECT id FROM roles WHERE name=$1', [roleName]);
    const roleId   = roleRes.rows[0]?.id ?? null;
    const res = await this.db.query(
      'INSERT INTO users (name,email,password,role,role_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role,role_id',
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
      'SELECT id,name,email,password,role,role_id FROM users WHERE email=$1 AND is_active=TRUE', [dto.email],
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
      'SELECT id,name,email,role,role_id,is_active,created_at FROM users WHERE id=$1', [id],
    );
    return res.rows[0];
  }
}
