import { ConfigService } from './config.service';

/** M0 / C2.1 — config is validated at boot; a bad env crashes on start, not mid-job. */
describe('ConfigService', () => {
  const original = process.env;
  afterEach(() => {
    process.env = original;
  });

  it('throws on a missing required key (DATABASE_URL)', () => {
    process.env = { NODE_ENV: 'test' } as NodeJS.ProcessEnv;
    expect(() => new ConfigService()).toThrow(/DATABASE_URL/);
  });

  it('parses and coerces a valid environment', () => {
    process.env = {
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    } as NodeJS.ProcessEnv;
    const config = new ConfigService();
    expect(config.get('PORT')).toBe(4000);
    expect(config.get('NODE_ENV')).toBe('test');
  });
});
