import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService, Session } from './auth.service';
import { FixedWindowLimiter } from './rate-limit';
import { loginDto, signupDto } from './schema';
import { CurrentSession, SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
  // Demo accounts are anonymous and ledger-funded, so cap creation per process to blunt abuse (audit O3).
  private readonly demoLimiter = new FixedWindowLimiter(30, 60_000);

  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  signup(@Body() body: unknown): Promise<{ userId: string }> {
    const dto = signupDto.parse(body);
    return this.auth.signup(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown): Promise<{ token: string; userId: string }> {
    const dto = loginDto.parse(body);
    return this.auth.login(dto.email, dto.password);
  }

  @Post('demo')
  @HttpCode(200)
  demo(): Promise<{ token: string; userId: string }> {
    if (!this.demoLimiter.tryAcquire(Date.now())) {
      throw new HttpException('Too many demo sign-ups — please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.auth.demo();
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  logout(@CurrentSession() session: Session): Promise<void> {
    return this.auth.logout(session.sessionId);
  }
}
