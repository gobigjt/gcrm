import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class LeadPlatformsService {
  constructor(private readonly db: DatabaseService) {}

  private GRAPH_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v20.0';
  private GRAPH_BASE = `https://graph.facebook.com/${this.GRAPH_VERSION}`;

  /** Trim .env values; strip BOM/quotes that break Facebook Login / Graph. */
  private readFacebookEnv(key: string): string | null {
    const raw = process.env[key];
    if (raw == null) return null;
    let s = String(raw).replace(/^\uFEFF/, '').trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      s = s.slice(1, -1).trim();
    }
    return s.length ? s : null;
  }

  /** Meta App IDs are numeric strings (no spaces). */
  private normalizeFacebookAppId(): { appId: string | null; rawPresent: boolean } {
    const raw = this.readFacebookEnv('FACEBOOK_APP_ID');
    if (!raw) return { appId: null, rawPresent: false };
    const digits = raw.replace(/\s/g, '');
    if (!/^\d{8,20}$/.test(digits)) return { appId: null, rawPresent: true };
    return { appId: digits, rawPresent: true };
  }

  private normalizeFacebookSecret(): string | null {
    return this.readFacebookEnv('FACEBOOK_APP_SECRET');
  }

  /**
   * Best-effort page identifier extraction from a Facebook Page URL.
   * - If URL contains numeric id somewhere → return that number.
   * - Else return the last non-empty path segment (usually the username).
   */
  private pageIdFromUrl(pageUrl: string): string | null {
    const u = pageUrl?.trim();
    if (!u) return null;

    // Keep original for query parsing; also strip querystring / fragment for path parsing
    const cleanPath = u.split('?')[0].split('#')[0].trim();

    // 1) numeric page id
    const digitsMatch =
      cleanPath.match(/\/(\d{5,})[\/]?/) ||
      u.match(/[?&]id=(\d{5,})/);
    if (digitsMatch?.[1]) return digitsMatch[1];

    // 2) username / slug
    try {
      const withoutProto = cleanPath.replace(/^https?:\/\//, '');
      const path = withoutProto.split('/').slice(1).join('/'); // remove host
      const parts = path.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      return last || null;
    } catch (_) {
      return null;
    }
  }

  async listFacebookPages() {
    return (
      await this.db.query(
        `
        SELECT
          p.id,
          p.page_id,
          p.page_url,
          p.page_name,
          p.lead_source_id,
          ls.name AS lead_source_name,
          p.created_at
        FROM lead_platform_facebook_pages p
        LEFT JOIN lead_sources ls ON ls.id = p.lead_source_id
        ORDER BY p.created_at DESC
        `,
      )
    ).rows;
  }

  private async defaultLeadSourceId(): Promise<number | null> {
    const res = await this.db.query(`SELECT id FROM lead_sources WHERE name='Facebook Ads' LIMIT 1`);
    return res.rows[0]?.id ?? null;
  }

  async upsertFacebookPage(dto: {
    page_id?: string | null;
    page_url?: string | null;
    page_name?: string | null;
    page_access_token?: string | null;
    lead_source_id?: number | null;
  }) {
    let pageId = dto.page_id?.trim() || null;
    const pageUrl = dto.page_url?.trim() || null;
    if (!pageId && pageUrl) {
      pageId = this.pageIdFromUrl(pageUrl);
    }
    if (!pageId) throw new BadRequestException('Provide page_url or page_id');

    const pageName = dto.page_name?.trim() || null;
    const accessToken = dto.page_access_token?.trim() || null;

    if (accessToken) {
      const dbg = await this.debugFacebookAccessToken(accessToken);
      if (dbg && !dbg.isValid) {
        throw new BadRequestException(
          'Facebook reports this access token is invalid or expired. Use "Continue with Facebook" or create a new Page access token for this Page.',
        );
      }
      if (dbg?.isValid) {
        const ty = dbg.type?.toUpperCase();
        if (ty && ty !== 'PAGE') {
          throw new BadRequestException(
            `The token is not a Page access token (Meta reports type: ${ty}). Use "Continue with Facebook" in Settings, or paste only a Page token for this Page—not a User token.`,
          );
        }
      }
    }

    let leadSourceId = dto.lead_source_id ?? null;
    if (leadSourceId == null) {
      leadSourceId = await this.defaultLeadSourceId();
    }

    return (
      await this.db.query(
        `
        INSERT INTO lead_platform_facebook_pages (page_id, page_url, page_name, page_access_token, lead_source_id)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (page_id) DO UPDATE SET
          page_url = EXCLUDED.page_url,
          page_name = EXCLUDED.page_name,
          page_access_token = EXCLUDED.page_access_token,
          lead_source_id = EXCLUDED.lead_source_id,
          updated_at = NOW()
        RETURNING id
        `,
        [pageId, pageUrl, pageName, accessToken, leadSourceId],
      )
    ).rows[0]?.id;
  }

  async deleteFacebookPage(id: number) {
    const res = await this.db.query('DELETE FROM lead_platform_facebook_pages WHERE id=$1 RETURNING id', [id]);
    if (!res.rows[0]) throw new NotFoundException('Facebook page not found');
    return true;
  }

  private async leadStageIdOrDefault(): Promise<number | null> {
    const res = await this.db.query(`SELECT id FROM lead_stages WHERE name='New' LIMIT 1`);
    return res.rows[0]?.id ?? null;
  }

  private toMapFieldData(fieldData: any): Record<string, string> {
    // field_data usually comes as: [{ name: 'email', values: ['x@y.com'] }, ...]
    if (!fieldData) return {};
    try {
      if (Array.isArray(fieldData)) {
        const out: Record<string, string> = {};
        for (const item of fieldData) {
          const key = String(item?.name ?? '').trim();
          if (!key) continue;
          const vals = item?.values;
          if (Array.isArray(vals) && vals.length > 0) out[key] = String(vals[0]);
          else if (vals != null) out[key] = String(vals);
        }
        return out;
      }
      if (typeof fieldData === 'object') {
        return Object.fromEntries(
          Object.entries(fieldData).map(([k, v]: any) => [k, Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '')]),
        );
      }
    } catch (_) {}
    return {};
  }

  private extractLeadFromFieldData(map: Record<string, string>) {
    const getFirst = (...keys: string[]) => {
      for (const k of keys) {
        const v = map[k];
        if (v && v.trim()) return v.trim();
      }
      return null;
    };

    const fullName = getFirst('full_name', 'fullName', 'name');
    const firstName = getFirst('first_name', 'firstName');
    const lastName = getFirst('last_name', 'lastName');
    const email = getFirst('email', 'email_address', 'emailAddress');
    const phone = getFirst('phone_number', 'phone', 'mobile_number', 'mobile', 'phoneNumber');
    const company = getFirst('company_name', 'company', 'organization', 'org');

    const name =
      fullName ||
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      email ||
      phone ||
      'Facebook Lead';

    return {
      name,
      email: email,
      phone: phone,
      company: company,
    };
  }

  private async fbFetchJson(url: string) {
    const res = await fetch(url, { method: 'GET' });
    const txt = await res.text();
    if (!res.ok) {
      throw new BadRequestException(this.formatFacebookGraphError(res.status, txt));
    }
    try {
      return JSON.parse(txt);
    } catch (_) {
      throw new BadRequestException('Facebook Graph API returned invalid JSON');
    }
  }

  /** Map common Graph OAuth errors to actionable CRM messages. */
  private formatFacebookGraphError(status: number, body: string): string {
    try {
      const j = JSON.parse(body);
      const msg = j?.error?.message || '';
      const code = j?.error?.code;
      if (
        code === 100 &&
        typeof msg === 'string' &&
        (msg.includes('pages_read_engagement') ||
          msg.includes('Page Public Content Access') ||
          msg.includes('Page Public Metadata Access'))
      ) {
        return (
          `Facebook Graph API error (${status}): Lead sync needs a Page access token that includes ` +
          `pages_read_engagement and leads_retrieval. Disconnect this page in Settings, then use ` +
          `"Continue with Facebook" again. In the Meta permission dialog, click "Edit settings" and enable ` +
          `every permission for your Page. In developers.facebook.com → your app → Facebook Login → Settings, ` +
          `ensure pages_show_list, pages_read_engagement, and leads_retrieval are allowed. ` +
          `If the app is Live, these permissions may require App Review. Raw: ${body}`
        );
      }
      if (
        code === 190 &&
        typeof msg === 'string' &&
        msg.toLowerCase().includes('page access token')
      ) {
        return (
          `Facebook Graph API error (${status}): This connection is not using a Page access token (often a User token ` +
            `was saved by mistake). Disconnect this Page in Settings, then use "Continue with Facebook" and select the Page ` +
            `so we store Meta's Page token. Do not paste a User access token from Graph API Explorer into the manual field. Raw: ${body}`
        );
      }
    } catch (_) {
      /* fall through */
    }
    return `Facebook Graph API error (${status}): ${body}`;
  }

  /** Scopes granted to a user or page access token (debug_token). */
  private parseDebugTokenScopes(data: any): string[] {
    const set = new Set<string>();
    if (Array.isArray(data?.scopes)) {
      for (const s of data.scopes) {
        if (s) set.add(String(s).toLowerCase());
      }
    }
    if (Array.isArray(data?.granular_scopes)) {
      for (const g of data.granular_scopes) {
        if (g?.scope) set.add(String(g.scope).toLowerCase());
      }
    }
    return [...set];
  }

  /**
   * Inspect token with app access_token (App ID | App Secret). Returns null if debug fails.
   */
  private async debugFacebookAccessToken(inputToken: string): Promise<{
    isValid: boolean;
    scopes: string[];
    type?: string;
  } | null> {
    const { appId } = this.normalizeFacebookAppId();
    const secret = this.normalizeFacebookSecret();
    if (!appId || !secret || !inputToken?.trim()) return null;
    const appAccessToken = `${appId}|${secret}`;
    const url = new URL(`${this.GRAPH_BASE}/debug_token`);
    url.searchParams.set('input_token', inputToken.trim());
    url.searchParams.set('access_token', appAccessToken);
    try {
      const data = await this.fbFetchJson(url.toString());
      const d = data?.data;
      if (!d) return null;
      return {
        isValid: Boolean(d.is_valid),
        scopes: this.parseDebugTokenScopes(d),
        type: d.type != null ? String(d.type) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Leadgen endpoints require a valid Page access token with lead scopes (errors #190 / #100 otherwise).
   */
  private assertFacebookTokenForLeadSync(
    debug: { isValid: boolean; scopes: string[]; type?: string } | null,
  ) {
    if (!debug) return;

    if (!debug.isValid) {
      throw new BadRequestException(
        'This Facebook connection token is expired or no longer valid. Disconnect the Page in Settings and use "Continue with Facebook" to reconnect.',
      );
    }

    const ty = debug.type?.toUpperCase();
    if (ty && ty !== 'PAGE') {
      throw new BadRequestException(
        `Lead sync requires a Page access token, but this connection has a ${ty} token (common if a User token was pasted manually). ` +
          `Disconnect the Page, then use "Continue with Facebook" and choose your Page—do not use a User access token from Graph API Explorer.`,
      );
    }

    if (!debug.scopes.length) return;
    const required = ['pages_read_engagement', 'leads_retrieval'];
    const missing = required.filter((s) => !debug.scopes.includes(s.toLowerCase()));
    if (!missing.length) return;
    throw new BadRequestException(
      `This Facebook Page token is missing: ${missing.join(', ')}. ` +
        `Disconnect the page, open "Continue with Facebook", and in Meta's dialog use "Edit settings" to grant all permissions for the Page. ` +
        `In Meta App Dashboard → Facebook Login → Settings, allow pages_show_list, pages_read_engagement, and leads_retrieval. ` +
        `Standard access works for app admins/developers/testers; Live apps may need App Review for these permissions.`,
    );
  }

  facebookOAuthConfig() {
    const { appId, rawPresent } = this.normalizeFacebookAppId();
    const secret = this.normalizeFacebookSecret();
    let setupHint: string | null = null;
    if (rawPresent && !appId) {
      setupHint =
        'FACEBOOK_APP_ID must be 8–20 digits only (no letters, spaces, or quotes). Copy the App ID from developers.facebook.com → Your app → App settings → Basic.';
    } else if (!appId && !secret) {
      setupHint =
        'Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in backend .env, then restart the API.';
    } else if (!appId) {
      setupHint = 'FACEBOOK_APP_ID is missing in backend .env.';
    } else if (!secret) {
      setupHint = 'FACEBOOK_APP_SECRET is missing in backend .env.';
    }
    return {
      appId,
      graphVersion: this.GRAPH_VERSION,
      configured: Boolean(appId && secret),
      setupHint: appId && secret ? null : setupHint,
    };
  }

  /**
   * Turn a short-lived User token from Facebook Login into a long-lived User token, then list
   * Pages the user manages with their Page access tokens (for Lead Ads sync).
   */
  async listFacebookPagesForUserAccessToken(userAccessToken: string) {
    const token = userAccessToken?.trim();
    if (!token) throw new BadRequestException('user_access_token is required');

    const { appId } = this.normalizeFacebookAppId();
    const secret = this.normalizeFacebookSecret();
    if (!appId || !secret) {
      throw new BadRequestException(
        'Facebook Login is not configured. Set FACEBOOK_APP_ID (numeric) and FACEBOOK_APP_SECRET on the server.',
      );
    }

    let userToken = token;
    const exUrl = new URL(`${this.GRAPH_BASE}/oauth/access_token`);
    exUrl.searchParams.set('grant_type', 'fb_exchange_token');
    exUrl.searchParams.set('client_id', appId);
    exUrl.searchParams.set('client_secret', secret);
    exUrl.searchParams.set('fb_exchange_token', token);
    try {
      const ex = await this.fbFetchJson(exUrl.toString());
      if (ex?.access_token) userToken = String(ex.access_token);
    } catch {
      // Short-lived token may still work for me/accounts briefly; continue.
    }

    const accUrl = new URL(`${this.GRAPH_BASE}/me/accounts`);
    accUrl.searchParams.set('fields', 'id,name,access_token');
    accUrl.searchParams.set('limit', '100');
    accUrl.searchParams.set('access_token', userToken);

    const raw = await this.fbGetAllPages(accUrl.toString());
    const pages = raw
      .map((p: any) => ({
        id: String(p?.id ?? ''),
        name: (p?.name ?? p?.id ?? '').toString(),
        access_token: (p?.access_token ?? '').toString().trim(),
      }))
      .filter((p) => p.id && p.access_token);

    if (!pages.length) {
      throw new BadRequestException(
        'No Facebook Pages returned. Possible causes: ' +
        '(1) In Meta App Dashboard → Facebook Login → Settings, add optional permissions: pages_show_list, pages_read_engagement, leads_retrieval. ' +
        '(2) In the login dialog, click "Edit settings" and enable all permissions for your Page. ' +
        '(3) Ensure your Facebook account manages at least one Page (not just a personal profile).',
      );
    }

    return { pages };
  }

  private async fbGetAllPages(endpointUrl: string, { limitPerPage = 100 } = {}) {
    // Minimal pagination helper that follows `paging.next` when present.
    // Caps to avoid infinite loops.
    const out: any[] = [];
    let url = endpointUrl;
    let guard = 0;

    while (url && guard++ < 10) {
      const data = await this.fbFetchJson(url);
      const chunk = data?.data;
      if (Array.isArray(chunk)) out.push(...chunk);
      url = data?.paging?.next ?? null;
      // If the API returns all results in one page, `paging.next` will be absent.
      // `limitPerPage` is applied by caller if supported.
    }
    return out;
  }

  async syncFacebookPageLeads(platformRecordId: number) {
    const platformRes = await this.db.query(
      `SELECT * FROM lead_platform_facebook_pages WHERE id=$1`,
      [platformRecordId],
    );
    const platform = platformRes.rows[0];
    if (!platform) throw new NotFoundException('Facebook page not found');

    if (!platform.page_access_token?.trim()) {
      throw new BadRequestException('Missing page_access_token for this Facebook Page');
    }

    const pageId = String(platform.page_id);
    const accessToken = platform.page_access_token.trim();
    const leadSourceId = platform.lead_source_id;

    if (!pageId) throw new BadRequestException('Facebook page_id is missing');

    const tokenDebug = await this.debugFacebookAccessToken(accessToken);
    this.assertFacebookTokenForLeadSync(tokenDebug);

    const stageId = await this.leadStageIdOrDefault();
    const srcId = leadSourceId ?? (await this.defaultLeadSourceId());

    // 1) Fetch leadgen forms for the page
    const formsUrl = new URL(`${this.GRAPH_BASE}/${pageId}/leadgen_forms`);
    formsUrl.searchParams.set('access_token', accessToken);
    formsUrl.searchParams.set('limit', '100');
    // fields selection is optional; keep small
    formsUrl.searchParams.set('fields', 'id,name');

    const forms = await this.fbGetAllPages(formsUrl.toString());

    const createdLeads: number[] = [];
    let importedCount = 0;

    // 2) For each form, fetch leads/submissions
    for (const f of forms) {
      const formId = String(f?.id ?? '');
      if (!formId) continue;

      const leadsUrl = new URL(`${this.GRAPH_BASE}/${formId}/leads`);
      leadsUrl.searchParams.set('access_token', accessToken);
      leadsUrl.searchParams.set('limit', '100');
      leadsUrl.searchParams.set('fields', 'id,created_time,field_data');

      const fbLeads = await this.fbGetAllPages(leadsUrl.toString());

      for (const fbLead of fbLeads) {
        const facebookLeadId = String(fbLead?.id ?? '');
        if (!facebookLeadId) continue;

        // Skip if already imported
        const exists = await this.db.query(
          `SELECT id FROM lead_platform_facebook_leads WHERE facebook_lead_id=$1`,
          [facebookLeadId],
        );
        if (exists.rows[0]) continue;

        const createdTime = fbLead?.created_time ? new Date(fbLead.created_time).toISOString() : null;
        const fieldDataMap = this.toMapFieldData(fbLead?.field_data);
        const extracted = this.extractLeadFromFieldData(fieldDataMap);

        // 3) Import into CRM leads
        const insertLeadRes = await this.db.query(
          `
          INSERT INTO leads (name,email,phone,company,source_id,stage_id,assigned_to,notes,priority,custom_fields)
          VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9)
          RETURNING id
          `,
          [
            extracted.name,
            extracted.email,
            extracted.phone,
            extracted.company,
            srcId,
            stageId,
            `Facebook lead import (form: ${formId})`,
            'warm',
            JSON.stringify({
              facebook_lead_id: facebookLeadId,
              facebook_form_id: formId,
              facebook_page_id: pageId,
              field_data: fieldDataMap,
            }),
          ],
        );
        const crmLeadId = insertLeadRes.rows[0]?.id;

        // 4) Store mapping row
        await this.db.query(
          `
          INSERT INTO lead_platform_facebook_leads
            (page_id, form_id, facebook_lead_id, created_time, field_data, raw_data, crm_lead_id)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            pageId,
            formId,
            facebookLeadId,
            createdTime,
            JSON.stringify(fieldDataMap),
            JSON.stringify(fbLead),
            crmLeadId ?? null,
          ],
        );

        importedCount++;
        if (crmLeadId) createdLeads.push(crmLeadId);
      }
    }

    return { importedCount, createdLeads };
  }

  /**
   * Tokenless import: store Facebook leads you've received externally (webhook payload,
   * manual export, etc.) into CRM and dedupe by facebook_lead_id.
   *
   * This intentionally does not call the Graph API, so it does not require
   * `page_access_token`.
   */
  /**
   * Verifies a Facebook webhook subscription challenge.
   * Meta sends GET with hub.mode=subscribe, hub.verify_token, hub.challenge.
   * Returns the challenge string if valid, null otherwise.
   */
  verifyFacebookWebhookChallenge(mode: string, token: string, challenge: string): string | null {
    const webhookToken = this.readFacebookEnv('FACEBOOK_WEBHOOK_TOKEN');
    if (!webhookToken) return null;
    if (mode !== 'subscribe' || token !== webhookToken) return null;
    return challenge ?? null;
  }

  /**
   * Processes a real-time Facebook leadgen webhook event.
   * Payload format: { object: 'page', entry: [{ id, changes: [{ field: 'leadgen', value: { leadgen_id, page_id, form_id } }] }] }
   * Fetches the lead detail from Graph API and imports into CRM.
   */
  async handleFacebookWebhookEvent(body: any): Promise<void> {
    if (body?.object !== 'page') return;
    for (const entry of body?.entry ?? []) {
      const pageId = String(entry?.id ?? '');
      for (const change of entry?.changes ?? []) {
        if (change?.field !== 'leadgen') continue;
        const value = change?.value;
        const facebookLeadId = String(value?.leadgen_id ?? '');
        const formId = String(value?.form_id ?? '');
        if (!facebookLeadId || !pageId) continue;

        const pageRes = await this.db.query(
          `SELECT * FROM lead_platform_facebook_pages WHERE page_id=$1`,
          [pageId],
        );
        const platform = pageRes.rows[0];
        if (!platform?.page_access_token) continue;

        try {
          const leadUrl = new URL(`${this.GRAPH_BASE}/${facebookLeadId}`);
          leadUrl.searchParams.set('access_token', platform.page_access_token.trim());
          leadUrl.searchParams.set('fields', 'id,created_time,field_data');
          const fbLead = await this.fbFetchJson(leadUrl.toString());
          await this.importFacebookPageLeads(platform.id, { form_id: formId, leads: [fbLead] });
        } catch (e: any) {
          console.error(`[Facebook Webhook] Failed to import lead ${facebookLeadId}:`, e?.message);
        }
      }
    }
  }

  async importFacebookPageLeads(
    platformRecordId: number,
    dto: { form_id?: string | null; leads: any[] },
  ) {
    const platformRes = await this.db.query(
      `SELECT * FROM lead_platform_facebook_pages WHERE id=$1`,
      [platformRecordId],
    );
    const platform = platformRes.rows[0];
    if (!platform) throw new NotFoundException('Facebook page not found');

    if (!Array.isArray(dto.leads) || dto.leads.length === 0) {
      throw new BadRequestException('leads must be a non-empty array');
    }

    const pageId = String(platform.page_id ?? '');
    if (!pageId) throw new BadRequestException('Facebook page_id is missing on this connection');

    const stageId = await this.leadStageIdOrDefault();
    const srcId = platform.lead_source_id ?? (await this.defaultLeadSourceId());
    const formIdFromDto = dto.form_id?.toString().trim() || null;

    let importedCount = 0;

    for (const fbLead of dto.leads) {
      const facebookLeadId = String(fbLead?.id ?? '').trim();
      if (!facebookLeadId) continue;

      // Dedupe
      const exists = await this.db.query(
        `SELECT id FROM lead_platform_facebook_leads WHERE facebook_lead_id=$1`,
        [facebookLeadId],
      );
      if (exists.rows[0]) continue;

      const createdTime = fbLead?.created_time ? new Date(fbLead.created_time).toISOString() : null;
      const fieldDataMap = this.toMapFieldData(fbLead?.field_data);
      const extracted = this.extractLeadFromFieldData(fieldDataMap);
      const formId = String(fbLead?.form_id ?? formIdFromDto ?? '').trim() || null;

      const insertLeadRes = await this.db.query(
        `
          INSERT INTO leads (name,email,phone,company,source_id,stage_id,assigned_to,notes,priority,custom_fields)
          VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9)
          RETURNING id
        `,
        [
          extracted.name,
          extracted.email,
          extracted.phone,
          extracted.company,
          srcId,
          stageId,
          `Facebook lead import (manual)`,
          'warm',
          JSON.stringify({
            facebook_lead_id: facebookLeadId,
            facebook_form_id: formId,
            facebook_page_id: pageId,
            field_data: fieldDataMap,
          }),
        ],
      );

      const crmLeadId = insertLeadRes.rows[0]?.id ?? null;

      await this.db.query(
        `
          INSERT INTO lead_platform_facebook_leads
            (page_id, form_id, facebook_lead_id, created_time, field_data, raw_data, crm_lead_id)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          pageId,
          formId,
          facebookLeadId,
          createdTime,
          JSON.stringify(fieldDataMap),
          JSON.stringify(fbLead),
          crmLeadId,
        ],
      );

      importedCount++;
    }

    return { importedCount };
  }
}

