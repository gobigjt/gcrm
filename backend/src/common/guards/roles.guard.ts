import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    // Super Admin bypasses all role checks
    if (user?.role === 'Super Admin') return true;
    if (!roles.includes(user?.role)) throw new ForbiddenException('Forbidden');
    return true;
  }
}
