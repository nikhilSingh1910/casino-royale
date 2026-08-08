import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Kysely } from 'kysely';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { Database, KYSELY, migrate } from './db';
import { ConfigService } from './shared/config';
import { DomainExceptionFilter } from './http/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();

  await migrate(app.get<Kysely<Database>>(KYSELY)); // idempotent — a fresh deploy gets its schema at boot (audit O1)

  const config = app.get(ConfigService);
  await app.listen(config.get('PORT'), '0.0.0.0');
}

void bootstrap();
