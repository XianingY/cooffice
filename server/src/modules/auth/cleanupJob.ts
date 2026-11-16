import type { Logger } from "pino";
import type { RefreshTokenRepository } from "./refreshTokenRepository.js";

export interface CleanupJobOptions {
  repo: RefreshTokenRepository;
  logger: Logger;
  intervalMs?: number;
}

/**
 * Periodically delete expired refresh tokens. The operation is idempotent:
 * re-running it removes only newly expired rows. Failures are logged and the
 * next tick retries, so no external queue is needed for this small task.
 */
export class RefreshTokenCleanupJob {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: CleanupJobOptions) {}

  start(): void {
    if (this.timer) return;
    const interval = this.options.intervalMs ?? 3_600_000;
    this.timer = setInterval(() => this.runOnce(), interval);
    this.timer.unref?.();
    this.options.logger.info({ intervalMs: interval }, "refresh-token cleanup started");
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  runOnce(): number {
    try {
      const removed = this.options.repo.deleteExpired();
      if (removed > 0) this.options.logger.info({ removed }, "expired refresh tokens removed");
      return removed;
    } catch (error) {
      this.options.logger.error({ err: error }, "refresh-token cleanup failed");
      return 0;
    }
  }
}
