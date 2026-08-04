import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from './shared/config';
import { HealthModule } from './health/health.module';
import { LedgerModule } from './ledger';
import { IdentityModule } from './features/identity';
import { CricketModule } from './features/cricket';
import { TradingModule } from './features/trading';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: { level: config.get('LOG_LEVEL') },
      }),
    }),
    HealthModule,
    LedgerModule,
    IdentityModule,
    CricketModule,
    TradingModule,
  ],
})
export class AppModule {}
