import { Global, Module } from '@nestjs/common';
import { JobQueue } from './job-queue.service';

/** The durable job queue (D45). Global so any feature can register a handler and enqueue work. */
@Global()
@Module({
  providers: [JobQueue],
  exports: [JobQueue],
})
export class JobsModule {}
