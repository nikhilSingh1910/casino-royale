import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, Session } from './auth.service';

type Req = { headers: Record<string, string | undefined>; session?: Session };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Req>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.validateSession(token);
    if (!session) throw new UnauthorizedException();
    req.session = session;
    return true;
  }
}

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Session => {
    return ctx.switchToHttp().getRequest<{ session: Session }>().session;
  },
);
