import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../db';
import { LedgerModule } from '../../ledger';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityRepo } from './identity.repo';

@Module({
  imports: [DatabaseModule, LedgerModule],
  controllers: [AuthController, AccountController],
  providers: [IdentityRepo, AuthService, AccountService],
  exports: [AuthService, AccountService],
})
export class IdentityModule {}
