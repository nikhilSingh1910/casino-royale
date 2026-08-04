import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService, Session } from './auth.service';
import { loginDto, signupDto } from './schema';
import { CurrentSession, SessionGuard } from './session.guard';

@Controller('auth')
export class AuthController {
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

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  logout(@CurrentSession() session: Session): Promise<void> {
    return this.auth.logout(session.sessionId);
  }
}
