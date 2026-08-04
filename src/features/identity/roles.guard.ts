import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Session } from './auth.service';
import { IdentityRepo } from './identity.repo';

export type Role = 'player' | 'admin' | 'trader';
export const ROLES_KEY = 'roles';

/** The one role policy (CLAUDE.md §5 rule 9). Layer after SessionGuard: `@UseGuards(SessionGuard, RolesGuard)`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly repo: IdentityRepo,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<{ session?: Session }>();
    if (!req.session) throw new UnauthorizedException(); // SessionGuard must run first
    const user = await this.repo.findById(req.session.userId);
    if (!user || !required.includes(user.role)) throw new ForbiddenException('insufficient role');
    return true;
  }
}
