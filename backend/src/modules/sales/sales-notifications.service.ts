import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { SalesActor } from './sales.service';

@Injectable()
export class SalesNotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  private isSalesExecutiveRole(role?: string): boolean {
    const r = String(role || '').trim().toLowerCase();
    return r === 'sales executive' || r === 'agent';
  }

  private salesQuoteLink(quoteId: number): string {
    const path = `/sales/quotes/${quoteId}`;
    const base = (process.env.WEB_APP_ORIGIN || '').trim().replace(/\/$/, '');
    return base ? `${base}${path}` : path;
  }

  async notifySalesManagerOnExecutiveQuoteCreated(
    quote: { id: number; quotation_number?: string; customer_id?: number },
    actor?: SalesActor,
  ): Promise<void> {
    const actorId = Number(actor?.id);
    if (!Number.isInteger(actorId) || actorId <= 0) return;
    if (!this.isSalesExecutiveRole(actor?.role)) return;
    try {
      const mgrRes = await this.db.query(
        `SELECT m.id, m.name
           FROM users u
           JOIN users m ON m.id = u.sales_manager_id
          WHERE u.id = $1
            AND u.is_active = TRUE
            AND m.is_active = TRUE
          LIMIT 1`,
        [actorId],
      );
      const manager = mgrRes.rows[0];
      if (!manager?.id) return;

      const actorRes = await this.db.query(
        'SELECT name FROM users WHERE id = $1 LIMIT 1',
        [actorId],
      );
      const executiveName = String(actorRes.rows[0]?.name || 'Sales Executive');
      const customerRes = await this.db.query(
        'SELECT name FROM customers WHERE id = $1 LIMIT 1',
        [Number(quote.customer_id || 0)],
      );
      const customerName = String(customerRes.rows[0]?.name || 'Customer');
      const quoteNo = String(quote.quotation_number || `Quote #${quote.id}`);
      const body = `${executiveName} created ${quoteNo} for ${customerName}.`;
      const link = this.salesQuoteLink(quote.id);

      await this.notifications.createInAppAndPush({
        user_id: Number(manager.id),
        title: 'New quotation created',
        body,
        type: 'info',
        module: 'sales',
        link,
        pushPayload: { quotationId: String(quote.id) },
      });
    } catch {
      // Notification failures must never block quotation creation.
    }
  }

  async notifyExecutiveOnQuotationApproved(quotationId: number, actor?: SalesActor): Promise<void> {
    try {
      const q = await this.db.query(
        `SELECT created_by, quotation_number FROM quotations WHERE id = $1 LIMIT 1`,
        [quotationId],
      );
      const row = q.rows[0];
      if (!row) return;
      const execId = Number(row.created_by);
      if (!Number.isInteger(execId) || execId <= 0) return;

      const quoteNo = String(row.quotation_number || `Quote #${quotationId}`);
      const link = this.salesQuoteLink(quotationId);
      let approverSuffix = '';
      const aid = Number(actor?.id);
      if (Number.isInteger(aid) && aid > 0) {
        const ar = await this.db.query('SELECT name FROM users WHERE id = $1 LIMIT 1', [aid]);
        const an = String(ar.rows[0]?.name || '').trim();
        if (an) approverSuffix = ` by ${an}`;
      }
      const body = `${quoteNo} was approved${approverSuffix}.`;

      await this.notifications.createInAppAndPush({
        user_id: execId,
        title: 'Quotation approved',
        body,
        type: 'info',
        module: 'sales',
        link,
        pushPayload: { quotationId: String(quotationId) },
      });
    } catch {
      // Notification failures must never block approval flow.
    }
  }
}

