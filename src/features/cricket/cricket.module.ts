import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db';
import { CricketRepo } from './cricket.repo';
import { FeedIngestService } from './feed-ingest.service';
import { MarketRepo } from './market.repo';
import { MarketService } from './market.service';

@Module({
  imports: [DatabaseModule],
  providers: [CricketRepo, FeedIngestService, MarketRepo, MarketService],
  exports: [FeedIngestService, CricketRepo, MarketService],
})
export class CricketModule {}
