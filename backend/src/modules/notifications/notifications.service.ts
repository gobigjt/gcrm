import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

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

  async deleteRead(userId: number) {
    await this.db.query(
      'DELETE FROM notifications WHERE user_id=$1 AND is_read=TRUE',
      [userId],
    );
    return { ok: true };
  }
}
