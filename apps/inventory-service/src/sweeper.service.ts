import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InventoryService } from './inventory.service';

/**
 * Periodically releases abandoned holds — reservations stuck in HELD past their
 * TTL because rental-service crashed before its BookRented event confirmed them.
 * This is what makes the reserve path self-healing: a leaked decrement is
 * eventually returned to availability.
 */
@Injectable()
export class SweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SweeperService.name);
  private timer?: NodeJS.Timeout;
  private readonly intervalMs: number;

  constructor(
    private readonly inventory: InventoryService,
    config: ConfigService,
  ) {
    this.intervalMs = Number(config.get('SWEEP_INTERVAL_SECONDS', '15')) * 1000;
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.inventory
        .sweepExpired()
        .catch((err) => this.logger.error(`sweep failed: ${err.message}`));
    }, this.intervalMs);
    // Don't keep the process alive solely for the sweep timer.
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
