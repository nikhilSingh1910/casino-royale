import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db';
import { LedgerModule } from '../../ledger';
import { IdentityModule } from '../identity';
import { BetRepo } from './bet.repo';
import { CricketRepo } from './cricket.repo';
import { FeedIngestService } from './feed-ingest.service';
import { MarketRepo } from './market.repo';
import { MarketService } from './market.service';
import { PlacementService } from './placement.service';

@Module({
  imports: [DatabaseModule, LedgerModule, IdentityModule],
  providers: [CricketRepo, FeedIngestService, MarketRepo, MarketService, BetRepo, PlacementService],
  exports: [FeedIngestService, CricketRepo, MarketService, PlacementService],
})
export class CricketModule {}
