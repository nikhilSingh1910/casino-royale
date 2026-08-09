import { LiveEvents } from './live-events.service';

describe('LiveEvents (PC4)', () => {
  it('streams published match changes to subscribers, and stops after unsubscribe', () => {
    const bus = new LiveEvents();
    const seen: string[] = [];
    const sub = bus.stream().subscribe((e) => seen.push(e.matchId));
    bus.publish('m1');
    bus.publish('m2');
    sub.unsubscribe();
    bus.publish('m3'); // after unsubscribe — not delivered
    expect(seen).toEqual(['m1', 'm2']);
  });
});
