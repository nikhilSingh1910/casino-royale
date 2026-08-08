import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db';
import { JobsModule } from '../../jobs';
import { AuditModule } from '../audit';
import { CricketModule } from '../cricket';
import { IdentityModule } from '../identity';
import { TradingController } from './trading.controller';
import { TradingJobs } from './trading.jobs';
import { TradingRepo } from './trading.repo';
import { TradingService } from './trading.service';

/** Operator console + risk (CM5). Wraps CM4's settlement mechanics behind authz + four-eyes + audit. */
@Module({
  imports: [DatabaseModule, CricketModule, AuditModule, IdentityModule, JobsModule],
  controllers: [TradingController],
  providers: [TradingRepo, TradingService, TradingJobs],
  exports: [TradingService],
})
export class TradingModule {}
