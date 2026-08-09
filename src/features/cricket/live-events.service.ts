import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface LiveEvent {
  matchId: string;
}

/**
 * In-process pub/sub for live match changes (PC4). The ticker — and, in prod, a real feed adapter —
 * publishes; the SSE endpoint streams to clients. Single-instance: a client on one instance misses
 * events published on another. Postgres LISTEN/NOTIFY (or Centrifugo, §7) is the multi-instance path.
 */
@Injectable()
export class LiveEvents {
  private readonly subject = new Subject<LiveEvent>();

  publish(matchId: string): void {
    this.subject.next({ matchId });
  }

  stream(): Observable<LiveEvent> {
    return this.subject.asObservable();
  }
}
