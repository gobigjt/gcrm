import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  /** Fire-and-forget — never throws, so it can't break the caller. */
  log(opts: {
    user_id?:  number | null;
    action:    string;
    module?:   string;
    record_id?: number | null;
    details?:  Record<string, any>;
  }): void {
    this.db
      .query(
        `INSERT INTO audit_logs (user_id, action, module, record_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          opts.user_id  ?? null,
          opts.action,
          opts.module   ?? null,
          opts.record_id ?? null,
          opts.details  ? JSON.stringify(opts.details) : null,
        ],
      )
      .catch(() => {}); // silently swallow errors — audit must never crash the app
  }
}
