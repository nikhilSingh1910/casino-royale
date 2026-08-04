import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db';
import { LedgerModule } from '../../ledger';
import { AuditModule } from '../audit';
import { IdentityModule } from '../identity';
import { BetRepo } from './bet.repo';
import { CricketRepo } from './cricket.repo';
import { FeedIngestService } from './feed-ingest.service';
import { MarketRepo } from './market.repo';
import { MarketService } from './market.service';
import { PlacementService } from './placement.service';
import { SettlementService } from './settlement.service';
import { MatchController } from './match.controller';
import { BetController } from './bet.controller';

@Module({
  imports: [DatabaseModule, LedgerModule, IdentityModule, AuditModule],
  controllers: [MatchController, BetController],
  providers: [CricketRepo, FeedIngestService, MarketRepo, MarketService, BetRepo, PlacementService, SettlementService],
  exports: [FeedIngestService, CricketRepo, MarketService, PlacementService, SettlementService],
})
export class CricketModule {}
