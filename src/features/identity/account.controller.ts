import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { AuthService, Session } from './auth.service';
import { changePasswordDto } from './schema';
import { CurrentSession, SessionGuard } from './session.guard';

@Controller('me')
@UseGuards(SessionGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  me(@CurrentSession() s: Session) {
    return this.account.me(s.userId);
  }

  @Get('balance')
  async balance(@CurrentSession() s: Session): Promise<{ available: string; reserved: string }> {
    const b = await this.account.balance(s.userId);
    return { available: b.available.toString(), reserved: b.reserved.toString() };
  }

  @Get('statement')
  async statement(@CurrentSession() s: Session, @Query('limit') limit?: string) {
    const rows = await this.account.statement(s.userId, limit ? Number.parseInt(limit, 10) : 50);
    return rows.map((r) => ({ account: r.account, amount: r.amount.toString(), kind: r.kind, at: r.at }));
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentSession() s: Session, @Body() body: unknown): Promise<void> {
    const dto = changePasswordDto.parse(body);
    await this.auth.changePassword(s.userId, s.sessionId, dto.currentPassword, dto.newPassword);
  }
}
