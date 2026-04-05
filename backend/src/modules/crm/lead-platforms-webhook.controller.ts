import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, RawBody, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { Response } from 'express';
import { LeadPlatformsService } from './lead-platforms.service';

/**
 * Public webhook endpoints for Facebook Lead Ads real-time delivery.
 *
 * Setup in Meta App Dashboard → Your App → Webhooks:
 *   Callback URL : https://<your-domain>/api/crm/facebook-webhook
 *   Verify Token : value of FACEBOOK_WEBHOOK_TOKEN in backend .env
 *   Subscriptions: leadgen
 *
 * Then for each connected Page subscribe once via Graph API Explorer:
 *   POST /<page_id>/subscribed_apps
 *     ?subscribed_fields=leadgen&access_token=<page_access_token>
 */
@ApiTags('Lead Platforms')
@Controller('crm/facebook-webhook')
export class LeadPlatformsWebhookController {
  constructor(private readonly svc: LeadPlatformsService) {}

  /**
   * Meta webhook verification: GET with hub.mode=subscribe, hub.verify_token, hub.challenge.
   * Returns the challenge plaintext if the verify_token matches FACEBOOK_WEBHOOK_TOKEN.
   */
  @Get()
  @ApiOperation({ summary: 'Facebook webhook verification (Meta subscription challenge)' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = this.svc.verifyFacebookWebhookChallenge(mode, token, challenge);
    if (result === null) {
      return res.status(403).send('Forbidden: invalid verify_token or mode');
    }
    return res.status(200).send(result);
  }

  /**
   * Meta webhook event delivery: POST with leadgen change payload.
   * Verifies the x-hub-signature-256 header using FACEBOOK_APP_SECRET.
   * Responds 200 immediately; lead import runs async.
   */
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Facebook webhook event receiver (real-time lead delivery)' })
  async receiveWebhook(
    @RawBody() rawBody: Buffer,
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    // Verify HMAC-SHA256 signature from Meta using App Secret.
    // Only skipped if App Secret is not configured (dev environments).
    const secret = process.env.FACEBOOK_APP_SECRET?.trim();
    if (secret && rawBody) {
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      const sigBuf = Buffer.from(signature ?? '', 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      const valid =
        sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
      if (!valid) {
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    // Run import without awaiting — Meta expects a 200 within ~20 s.
    this.svc.handleFacebookWebhookEvent(body).catch((e) =>
      console.error('[Facebook Webhook] Unhandled error:', e?.message),
    );
    return { ok: true };
  }
}
