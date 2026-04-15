import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import * as admin from 'firebase-admin';

type PushPayload = {
  title: string;
  body?: string;
  data?: Record<string, string>;
};

@Injectable()
export class FcmPushService {
  private readonly logger = new Logger(FcmPushService.name);
  private initialized = false;
  private disabled = false;

  private initIfNeeded(): boolean {
    if (this.disabled) return false;
    if (this.initialized) return true;

    try {
      if (admin.apps.length === 0) {
        const fromEnv = (process.env.FCM_SERVICE_ACCOUNT_JSON || '').trim();
        const fromPath = (process.env.FCM_SERVICE_ACCOUNT_PATH || '').trim();
        let creds: Record<string, any> | null = null;

        if (fromEnv) {
          creds = JSON.parse(fromEnv);
        } else if (fromPath && existsSync(fromPath)) {
          creds = JSON.parse(readFileSync(fromPath, 'utf8'));
        }

        if (!creds) {
          this.disabled = true;
          this.logger.warn(
            'FCM disabled: set FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_PATH',
          );
          return false;
        }

        admin.initializeApp({
          credential: admin.credential.cert(creds as admin.ServiceAccount),
        });
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.disabled = true;
      this.logger.error('Failed to initialize Firebase Admin SDK', error as any);
      return false;
    }
  }

  async sendToTokens(tokens: string[], payload: PushPayload) {
    const cleanTokens = Array.from(
      new Set(tokens.map((t) => String(t || '').trim()).filter(Boolean)),
    );
    if (!cleanTokens.length) {
      return { sent: 0, failed: 0, invalidTokens: [] as string[] };
    }
    if (!this.initIfNeeded()) {
      return { sent: 0, failed: cleanTokens.length, invalidTokens: [] as string[] };
    }

    const msg: admin.messaging.MulticastMessage = {
      tokens: cleanTokens,
      notification: {
        title: payload.title,
        body: payload.body || '',
      },
      data: payload.data || {},
    };

    const res = await admin.messaging().sendEachForMulticast(msg);
    const invalidTokens: string[] = [];
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(cleanTokens[idx]);
        }
      }
    });

    return {
      sent: res.successCount,
      failed: res.failureCount,
      invalidTokens,
    };
  }
}
