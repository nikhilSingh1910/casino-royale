import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db';
import { AuditRepo } from './audit.repo';
import { AuditService } from './audit.service';

@Module({
  imports: [DatabaseModule],
  providers: [AuditRepo, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
