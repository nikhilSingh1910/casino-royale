import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db';
import { CricketRepo } from './cricket.repo';
import { FeedIngestService } from './feed-ingest.service';

@Module({
  imports: [DatabaseModule],
  providers: [CricketRepo, FeedIngestService],
  exports: [FeedIngestService, CricketRepo],
})
export class CricketModule {}
