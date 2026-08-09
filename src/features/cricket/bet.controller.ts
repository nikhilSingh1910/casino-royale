import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { chips } from '../../shared/money';
import { CurrentSession, Session, SessionGuard } from '../identity';
import { BetHistoryItem, BetHistoryService } from './bet-history.service';
import { PlacementService } from './placement.service';
import { placeBetDto, placeRunnerBetDto } from './schema';

interface PlacedBet {
  id: string;
  side: string;
  stake: bigint;
  reserved: bigint;
  potential_payout: bigint;
  status: string;
}
const serialize = (b: PlacedBet) => ({
  id: b.id,
  side: b.side,
  stake: b.stake.toString(),
  reserved: b.reserved.toString(),
  potentialPayout: b.potential_payout.toString(),
  status: b.status,
});

const serializeHistory = (b: BetHistoryItem) => ({
  id: b.id,
  placedAt: b.placedAt.toISOString(),
  match: b.match,
  market: b.market,
  marketType: b.marketType,
  selection: b.selection,
  side: b.side,
  stake: b.stake.toString(),
  price: b.price.toString(),
  status: b.status,
  pnl: b.pnl === null ? null : b.pnl.toString(),
});

/** Placing a bet requires a session — the userId is the caller's, never taken from the body. */
@Controller()
@UseGuards(SessionGuard)
export class BetController {
  constructor(
    private readonly placement: PlacementService,
    private readonly history: BetHistoryService,
  ) {}

  /** The caller's own bet history (open + settled) with per-bet P&L — userId from the session. */
  @Get('me/bets')
  async myBets(@CurrentSession() s: Session, @Query('limit') limit?: string): Promise<ReturnType<typeof serializeHistory>[]> {
    const items = await this.history.forUser(s.userId, limit ? Number.parseInt(limit, 10) : 50);
    return items.map(serializeHistory);
  }

  @Post('bets')
  @HttpCode(201)
  async placeBet(@Body() body: unknown, @CurrentSession() s: Session): Promise<ReturnType<typeof serialize>> {
    const dto = placeBetDto.parse(body);
    const bet = await this.placement.placeBet({
      userId: s.userId,
      marketId: dto.marketId,
      side: dto.side,
      stake: chips(BigInt(dto.stake)),
      seenLineValue: dto.seenLineValue,
      seenPrice: BigInt(dto.seenPrice),
      idempotencyKey: dto.idempotencyKey,
    });
    return serialize(bet);
  }

  @Post('runner-bets')
  @HttpCode(201)
  async placeRunnerBet(@Body() body: unknown, @CurrentSession() s: Session): Promise<ReturnType<typeof serialize>> {
    const dto = placeRunnerBetDto.parse(body);
    const bet = await this.placement.placeRunnerBet({
      userId: s.userId,
      marketId: dto.marketId,
      runnerId: dto.runnerId,
      side: dto.side,
      stake: chips(BigInt(dto.stake)),
      seenPrice: BigInt(dto.seenPrice),
      idempotencyKey: dto.idempotencyKey,
    });
    return serialize(bet);
  }
}
