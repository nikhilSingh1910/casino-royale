import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentSession, Roles, RolesGuard, Session, SessionGuard } from '../identity';
import { declareResultDto, proposeDto, rejectDto } from './schema';
import { TradingService } from './trading.service';

/** Operator console (XC5.2/XC5.5). Role-gated to trader/admin by the one role policy (rule 9). */
@Controller('trading')
@UseGuards(SessionGuard, RolesGuard)
@Roles('trader', 'admin')
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Post('markets/:id/suspend')
  @HttpCode(204)
  suspend(@Param('id') id: string, @CurrentSession() s: Session): Promise<void> {
    return this.trading.suspendMarket(id, s.userId);
  }

  @Post('markets/:id/reopen')
  @HttpCode(204)
  reopen(@Param('id') id: string, @CurrentSession() s: Session): Promise<void> {
    return this.trading.reopenMarket(id, s.userId);
  }

  @Post('actions')
  propose(@Body() body: unknown, @CurrentSession() s: Session) {
    const dto = proposeDto.parse(body);
    return this.trading.propose(dto.kind, dto.marketId, { reason: dto.reason, correctionId: dto.correctionId }, s.userId);
  }

  /** Declare a real match's result — proposes a four-eyes settle_match action (a second operator approves). */
  @Post('matches/:id/declare-result')
  declareResult(@Param('id') id: string, @Body() body: unknown, @CurrentSession() s: Session) {
    const dto = declareResultDto.parse(body);
    return this.trading.proposeMatchResult(id, dto.winner, dto.reason, s.userId);
  }

  @Post('actions/:id/approve')
  async approve(@Param('id') id: string, @CurrentSession() s: Session) {
    const r = await this.trading.approve(id, s.userId);
    return { kind: r.kind }; // the result detail lives in the audit trail
  }

  @Post('actions/:id/reject')
  @HttpCode(204)
  reject(@Param('id') id: string, @Body() body: unknown, @CurrentSession() s: Session): Promise<void> {
    const dto = rejectDto.parse(body);
    return this.trading.reject(id, s.userId, dto.reason);
  }

  @Get('actions')
  async pendingActions() {
    const rows = await this.trading.pendingActions(50);
    return rows.map((a) => ({ id: a.id, kind: a.kind, marketId: a.market_id, proposedBy: a.proposed_by, createdAt: a.created_at.toISOString() }));
  }

  @Get('audit')
  async audit() {
    const rows = await this.trading.recentAudit(100);
    return rows.map((r) => ({ actor: r.actor, action: r.action, subject: r.subject, at: r.at.toISOString() }));
  }

  @Get('exposure/market/:id')
  async exposureMarket(@Param('id') id: string): Promise<{ liability: string }> {
    return { liability: (await this.trading.exposureByMarket(id)).toString() };
  }

  @Get('exposure/match/:id')
  async exposureMatch(@Param('id') id: string): Promise<{ liability: string }> {
    return { liability: (await this.trading.exposureByMatch(id)).toString() };
  }

  @Get('integrity/market/:id')
  integrity(@Param('id') id: string) {
    return this.trading.integrityFlags(id);
  }
}
