import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import { BetRejectedError, MatchResultError } from '../features/cricket';
import { AuthError, NotEligibleError } from '../features/identity';
import { ActionNotFoundError, ActionNotPendingError, SoDViolationError } from '../features/trading';
import { ReservationNotFoundError, ReservationNotOpenError, ReservationNotSettledError } from '../ledger';

interface Reply {
  status(code: number): Reply;
  send(body: unknown): void;
}

/**
 * Maps typed domain failures (§3.9) and zod validation to HTTP codes — so a rejected bet is a 400,
 * an ineligible account a 403, a stale reservation a 409, never a leaked 500. One place, app-wide.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<Reply>();
    const { status, body } = this.map(exception);
    reply.status(status).send(body);
  }

  private map(e: unknown): { status: number; body: unknown } {
    if (e instanceof ZodError) {
      return { status: 400, body: { error: 'validation', issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } };
    }
    if (e instanceof BetRejectedError) return { status: 400, body: { error: 'bet_rejected', message: e.message } };
    if (e instanceof MatchResultError) return { status: 400, body: { error: 'invalid_result', message: e.message } };
    if (e instanceof NotEligibleError) return { status: 403, body: { error: 'not_eligible', message: e.message } };
    if (e instanceof SoDViolationError) return { status: 403, body: { error: 'segregation_of_duties', message: e.message } };
    if (e instanceof AuthError) return { status: 401, body: { error: 'auth', message: e.message } };
    if (e instanceof ActionNotFoundError || e instanceof ReservationNotFoundError) {
      return { status: 404, body: { error: 'not_found', message: e.message } };
    }
    if (e instanceof ActionNotPendingError || e instanceof ReservationNotOpenError || e instanceof ReservationNotSettledError) {
      return { status: 409, body: { error: 'conflict', message: e.message } };
    }
    if (e instanceof HttpException) return { status: e.getStatus(), body: e.getResponse() };
    this.logger.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { error: 'internal' } };
  }
}
