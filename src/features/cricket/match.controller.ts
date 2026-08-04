import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { MarketService, MatchView } from './market.service';

/** Public market data for the lobby and market view (D37/CM-web). Prices cross the wire as strings. */
@Controller('matches')
export class MatchController {
  constructor(private readonly markets: MarketService) {}

  @Get()
  async list() {
    const matches = await this.markets.listMatches();
    return matches.map((m) => ({ id: m.match_id, name: m.name, competition: m.competition, status: m.status, startsAt: m.starts_at }));
  }

  @Get(':id')
  async view(@Param('id') id: string) {
    const view = await this.markets.getMatchView(id);
    if (!view) throw new NotFoundException('match not found');
    return serialize(view);
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
