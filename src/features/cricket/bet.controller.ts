import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { chips } from '../../shared/money';
import { CurrentSession, Session, SessionGuard } from '../identity';
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

/** Placing a bet requires a session — the userId is the caller's, never taken from the body. */
@Controller()
@UseGuards(SessionGuard)
export class BetController {
  constructor(private readonly placement: PlacementService) {}

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
