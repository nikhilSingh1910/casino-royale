import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityRepo } from './identity.repo';
import { RolesGuard, Role } from './roles.guard';

const reflector = (roles?: Role[]) => ({ getAllAndOverride: () => roles }) as unknown as Reflector;
const repo = (role?: Role) => ({ findById: async () => (role ? { id: 'u', role } : undefined) }) as unknown as IdentityRepo;
const ctx = (session: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ session }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('RolesGuard — the one role policy (rule 9)', () => {
  it('allows a caller whose role is required', async () => {
    const g = new RolesGuard(reflector(['trader']), repo('trader'));
    await expect(g.canActivate(ctx({ userId: 'u' }))).resolves.toBe(true);
  });

  it('forbids a caller whose role is not required', async () => {
    const g = new RolesGuard(reflector(['trader', 'admin']), repo('player'));
    await expect(g.canActivate(ctx({ userId: 'u' }))).rejects.toThrow(ForbiddenException);
  });

  it('is open when the route requires no role', async () => {
    const g = new RolesGuard(reflector(undefined), repo('player'));
    await expect(g.canActivate(ctx({ userId: 'u' }))).resolves.toBe(true);
  });

  it('rejects when SessionGuard did not run (no session)', async () => {
    const g = new RolesGuard(reflector(['trader']), repo('trader'));
    await expect(g.canActivate(ctx(undefined))).rejects.toThrow(UnauthorizedException);
  });
});
