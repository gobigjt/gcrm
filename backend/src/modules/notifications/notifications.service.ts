import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FcmPushService } from './fcm-push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly fcmPush: FcmPushService,
  ) {}

  async list(userId: number) {
    const res = await this.db.query(
      `SELECT id, title, body, type, module, link, is_read, created_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [userId],
    );
    return res.rows;
  }

  async unreadCount(userId: number): Promise<number> {
    const res = await this.db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE',
      [userId],
    );
    return Number(res.rows[0].count);
  }

  async markRead(userId: number, id?: number) {
    if (id) {
      await this.db.query(
        'UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2',
        [id, userId],
      );
    } else {
      await this.db.query(
        'UPDATE notifications SET is_read=TRUE WHERE user_id=$1',
        [userId],
      );
    }
    return { ok: true };
  }

  async create(data: {
    user_id: number;
    title:   string;
    body?:   string;
    type?:   string;
    module?: string;
    link?:   string;
  }) {
    const res = await this.db.query(
      `INSERT INTO notifications (user_id,title,body,type,module,link)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.user_id, data.title, data.body ?? null, data.type ?? 'info', data.module ?? null, data.link ?? null],
    );
    return res.rows[0];
  }

  /**
   * In-app notification row + FCM to all active device tokens for the user.
   * FCM `data` values must be strings; extra keys go in `pushPayload`.
   */
  async createInAppAndPush(data: {
    user_id: number;
    title: string;
    body?: string | null;
    type?: string;
    module?: string;
    link?: string | null;
    pushPayload?: Record<string, string>;
  }): Promise<{ sent: number; failed: number }> {
    try {
      const bodyText = data.body != null && data.body !== '' ? String(data.body) : null;
      await this.create({
        user_id: data.user_id,
        title: data.title,
        body: bodyText ?? undefined,
        type: data.type ?? 'info',
        module: data.module ?? undefined,
        link: data.link != null ? String(data.link) : undefined,
      });
      const payload: Record<string, string> = {
        module: String(data.module ?? ''),
        link: data.link != null ? String(data.link) : '',
      };
      for (const [k, v] of Object.entries(data.pushPayload || {})) {
        payload[k] = v == null ? '' : String(v);
      }
      const push = await this.sendPushToUser({
        userId: data.user_id,
        title: data.title,
        body: bodyText ?? undefined,
        payload,
      });
      return { sent: push.sent ?? 0, failed: push.failed ?? 0 };
    } catch {
      /* must not break callers */
      return { sent: 0, failed: 0 };
    }
  }

  async deleteRead(userId: number) {
    await this.db.query(
      'DELETE FROM notifications WHERE user_id=$1 AND is_read=TRUE',
      [userId],
    );
    return { ok: true };
  }

  async registerPushToken(input: {
    userId: number;
    token: string;
    platform?: string;
  }) {
    const token = String(input.token || '').trim();
    if (!token) return { ok: false };
    const platform = String(input.platform || '').trim().slice(0, 32) || null;

    await this.db.query(
      `INSERT INTO notification_push_tokens (user_id, token, platform, is_active, last_seen_at, updated_at)
       VALUES ($1,$2,$3,TRUE,NOW(),NOW())
       ON CONFLICT (token)
       DO UPDATE
          SET user_id = EXCLUDED.user_id,
              platform = EXCLUDED.platform,
              is_active = TRUE,
              last_seen_at = NOW(),
              updated_at = NOW()`,
      [input.userId, token, platform],
    );
    return { ok: true };
  }

  async unregisterPushToken(input: { userId: number; token?: string }) {
    const token = String(input.token || '').trim();
    if (token) {
      await this.db.query(
        `UPDATE notification_push_tokens
            SET is_active = FALSE, updated_at = NOW()
          WHERE user_id = $1 AND token = $2`,
        [input.userId, token],
      );
      return { ok: true };
    }

    await this.db.query(
      `UPDATE notification_push_tokens
          SET is_active = FALSE, updated_at = NOW()
        WHERE user_id = $1`,
      [input.userId],
    );
    return { ok: true };
  }

  async sendPushToUser(data: {
    userId: number;
    title: string;
    body?: string;
    payload?: Record<string, string>;
  }) {
    const tokensRes = await this.db.query(
      `SELECT token
         FROM notification_push_tokens
        WHERE user_id = $1
          AND is_active = TRUE`,
      [data.userId],
    );
    const tokens = tokensRes.rows.map((r) => String(r.token || '').trim()).filter(Boolean);
    if (!tokens.length) return { ok: true, sent: 0, failed: 0 };

    const result = await this.fcmPush.sendToTokens(tokens, {
      title: data.title,
      body: data.body,
      data: data.payload || {},
    });

    if (result.invalidTokens.length) {
      await this.db.query(
        `UPDATE notification_push_tokens
            SET is_active = FALSE, updated_at = NOW()
          WHERE token = ANY($1::text[])`,
        [result.invalidTokens],
      );
    }

    return { ok: true, sent: result.sent, failed: result.failed };
  }

  async testPush(input: {
    actorUserId: number;
    targetUserId?: number;
    title?: string;
    body?: string;
  }) {
    const targetUserId =
      Number.isInteger(Number(input.targetUserId)) && Number(input.targetUserId) > 0
        ? Number(input.targetUserId)
        : Number(input.actorUserId);

    const title = String(input.title || '').trim() || 'Test push notification';
    const body =
      String(input.body || '').trim() ||
      `FCM test sent at ${new Date().toISOString()}`;

    const push = await this.createInAppAndPush({
      user_id: targetUserId,
      title,
      body,
      type: 'info',
      module: 'notifications',
      link: null,
      pushPayload: { source: 'test-push' },
    });

    return {
      ok: true,
      target_user_id: targetUserId,
      sent: push.sent,
      failed: push.failed,
    };
  }
}
