import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '../shared/config';
import { createDb } from './db';

export const KYSELY = 'KYSELY_DB';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KYSELY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createDb(config.get('DATABASE_URL')),
    },
  ],
  exports: [KYSELY],
})
export class DatabaseModule {}
