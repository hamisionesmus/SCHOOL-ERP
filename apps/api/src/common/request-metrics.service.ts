import { Injectable } from '@nestjs/common';

/** In-memory counters for every HTTP request this process has handled, since last restart — same
 * "in-memory, single API process" tradeoff already accepted for PresenceService (no DB table, no
 * cross-instance aggregation, correct for the current single-container deployment). Counted at the
 * middleware layer (see RequestMetricsMiddleware), not an interceptor, so a request rejected by a
 * guard (401/403) or a 404 for an unknown route is still counted — those never reach an interceptor. */
@Injectable()
export class RequestMetricsService {
  private total = 0;
  private succeeded = 0;
  private failed = 0;

  recordRequest() {
    this.total++;
  }

  recordResponse(statusCode: number) {
    if (statusCode >= 400) this.failed++;
    else this.succeeded++;
  }

  snapshot() {
    return { total: this.total, succeeded: this.succeeded, failed: this.failed };
  }
}
