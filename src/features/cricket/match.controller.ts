import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { MarketService, MatchView, RunnerPrice } from './market.service';

const serPrice = (p: RunnerPrice | null) => (p ? { back: p.back.toString(), lay: p.lay.toString() } : null);

/** Public market data for the lobby and market view (D37/CM-web). Prices cross the wire as strings. */
@Controller('matches')
export class MatchController {
  constructor(private readonly markets: MarketService) {}

  @Get()
  async list() {
    const matches = await this.markets.listMatches();
    return matches.map((m) => ({
      id: m.id,
      name: m.name,
      competition: m.competition,
      status: m.status,
      startsAt: m.startsAt,
      odds: { home: serPrice(m.odds.home), draw: serPrice(m.odds.draw), away: serPrice(m.odds.away) },
    }));
  }

  @Get(':id')
  async view(@Param('id') id: string) {
    const view = await this.markets.getMatchView(id);
    if (!view) throw new NotFoundException('match not found');
    return serialize(view);
  }

  @Get(':id/score')
  async score(@Param('id') id: string) {
    const s = await this.markets.getScore(id);
    if (!s) throw new NotFoundException('match not found');
    return s; // numbers/strings only — no bigint to serialize
  }
}

const serialize = (v: MatchView) => ({
  id: v.id,
  name: v.name,
  competition: v.competition,
  status: v.status,
  markets: v.markets.map((m) => ({
    id: m.id,
    type: m.type,
    name: m.name,
    status: m.status,
    runners: m.runners.map((r) => ({ id: r.id, name: r.name, back: r.back.toString(), lay: r.lay.toString() })),
    fancy: m.fancy ? { line: m.fancy.line, overs: m.fancy.overs, back: m.fancy.back.toString(), lay: m.fancy.lay.toString() } : null,
  })),
});
