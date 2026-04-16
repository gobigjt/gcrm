import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { LeadsService } from './leads.service';

@Injectable()
export class LeadPlatformsService {
  private readonly log = new Logger(LeadPlatformsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly leads: LeadsService,
  ) {}

  private async notifyLeadCreated(crmLeadId: number | null | undefined): Promise<void> {
    if (!crmLeadId) return;
    try {
      await this.leads.notifyAfterLeadRowPull(Number(crmLeadId));
    } catch {
      /* notifications must not break imports */
    }
  }

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
        await this.notifyLeadCreated(crmLeadId);

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
      await this.notifyLeadCreated(crmLeadId);

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

  async listGoogleSheets() {
    return (
      await this.db.query(
        `SELECT g.id, g.sheet_url, g.sheet_gid, g.lead_source_id, g.data_start_row, g.is_active, g.created_at, g.updated_at,
                ls.name AS lead_source_name
           FROM lead_platform_google_sheets g
      LEFT JOIN lead_sources ls ON ls.id = g.lead_source_id
          ORDER BY g.created_at DESC`,
      )
    ).rows;
  }

  async upsertGoogleSheet(dto: {
    id?: number | null;
    sheet_url?: string | null;
    sheet_gid?: string | null;
    lead_source_id?: number | null;
    data_start_row?: number | string | null;
    is_active?: boolean | null;
  }) {
    const sheetUrl = String(dto.sheet_url || '').trim();
    if (!sheetUrl) throw new BadRequestException('sheet_url is required');
    let leadSourceId = dto.lead_source_id ?? null;
    if (leadSourceId == null) leadSourceId = await this.defaultLeadSourceId();
    const gid = String(dto.sheet_gid || '').trim() || null;
    const active = dto.is_active == null ? true : Boolean(dto.is_active);

    const parseDataStartRow = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1) {
        throw new BadRequestException('data_start_row must be a positive integer, or empty for header-row CSV mode');
      }
      return Math.floor(n);
    };

    if (dto.id) {
      let dataStartRow: number | null | undefined;
      if (dto.data_start_row !== undefined) {
        dataStartRow =
          dto.data_start_row === null || dto.data_start_row === ''
            ? null
            : parseDataStartRow(dto.data_start_row);
      }
      const params =
        dataStartRow === undefined
          ? [dto.id, sheetUrl, gid, leadSourceId, active]
          : [dto.id, sheetUrl, gid, leadSourceId, active, dataStartRow];
      const res = await this.db.query(
        dataStartRow === undefined
          ? `UPDATE lead_platform_google_sheets
                SET sheet_url=$2, sheet_gid=$3, lead_source_id=$4, is_active=$5, updated_at=NOW()
              WHERE id=$1
          RETURNING id`
          : `UPDATE lead_platform_google_sheets
                SET sheet_url=$2, sheet_gid=$3, lead_source_id=$4, is_active=$5, data_start_row=$6, updated_at=NOW()
              WHERE id=$1
          RETURNING id`,
        params,
      );
      if (!res.rows[0]) throw new NotFoundException('Google Sheet config not found');
      return res.rows[0].id;
    }

    let dataStartRow: number | null = 15;
    if (dto.data_start_row !== undefined) {
      if (dto.data_start_row === null || dto.data_start_row === '') dataStartRow = null;
      else dataStartRow = parseDataStartRow(dto.data_start_row);
    }
    return (
      await this.db.query(
        `INSERT INTO lead_platform_google_sheets (sheet_url, sheet_gid, lead_source_id, data_start_row, is_active)
         VALUES ($1,$2,$3,$4,$5)
      RETURNING id`,
        [sheetUrl, gid, leadSourceId, dataStartRow, active],
      )
    ).rows[0]?.id;
  }

  async deleteGoogleSheet(id: number) {
    const res = await this.db.query('DELETE FROM lead_platform_google_sheets WHERE id=$1 RETURNING id', [id]);
    if (!res.rows[0]) throw new NotFoundException('Google Sheet config not found');
    return true;
  }

  private parseGoogleSheetId(url: string): string | null {
    const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m?.[1] || null;
  }

  /** Google CSV can be large/slow; avoid hanging the Nest request indefinitely. */
  private async fetchGoogleSheetCsvText(csvUrl: string, timeoutMs = 90_000): Promise<string> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(csvUrl, {
        method: 'GET',
        headers: { Accept: 'text/csv,text/plain,*/*' },
        signal: ac.signal,
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new BadRequestException(
            'Google denied access to this sheet CSV (401/403). Make sure the sheet/tab is shared as "Anyone with the link can view" or use a published CSV URL (File -> Share -> Publish to web).',
          );
        }
        throw new BadRequestException(`Unable to fetch sheet CSV (${res.status})`);
      }
      return await res.text();
    } catch (e: any) {
      if (e?.name === 'AbortError' || ac.signal.aborted) {
        throw new BadRequestException(
          `Timed out fetching Google Sheet CSV after ${timeoutMs / 1000}s. Try again, use a published CSV link, or reduce sheet size.`,
        );
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  private buildGoogleSheetCsvUrl(sheetUrl: string, gid?: string | null): string {
    const trimmed = String(sheetUrl || '').trim();
    if (!trimmed) throw new BadRequestException('sheet_url is required');
    if (/output=csv/i.test(trimmed) || /format=csv/i.test(trimmed) || /tqx=out:csv/i.test(trimmed)) return trimmed;
    if (/\/pub(\?|$)/i.test(trimmed)) {
      return trimmed.includes('?') ? `${trimmed}&output=csv` : `${trimmed}?output=csv`;
    }
    const id = this.parseGoogleSheetId(trimmed);
    if (!id) throw new BadRequestException('Invalid Google Sheet URL');
    const g = String(gid || '').trim() || '0';
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(g)}`;
  }

  private parseCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (ch === '"') {
        if (inQuotes && csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(cell);
        cell = '';
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && csv[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  private normHeader(h: string): string {
    return String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  private valByKeys(rec: Record<string, string>, keys: string[]): string | null {
    for (const k of keys) {
      const v = rec[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  }

  /** Fixed export layout: A=0 … R=17 (lead id, …, contact, email, phone, city, state, zip). */
  private static readonly GSHEET_COL = {
    LEAD_ID: 0,
    STATUS: 9,
    SALES_PERSON: 10,
    SOURCE: 11,
    CONTACT_NAME: 12,
    EMAIL: 13,
    PHONE: 14,
    CITY: 15,
    STATE: 16,
    ZIP: 17,
  } as const;

  private gsCell(row: string[], idx: number): string {
    return String(row[idx] ?? '').trim();
  }

  private mergeSheetCustomFields(prev: unknown, patch: Record<string, unknown>): Record<string, unknown> {
    const base =
      prev && typeof prev === 'object' && !Array.isArray(prev)
        ? { ...(prev as Record<string, unknown>) }
        : {};
    return { ...base, ...patch };
  }

  private truncatePhoneDb(v: string | null): string | null {
    if (!v) return null;
    const t = v.trim();
    if (!t) return null;
    return t.length > 20 ? t.slice(0, 20) : t;
  }

  private buildCityStateZipLine(city: string, state: string, zip: string): string | null {
    const parts = [city, state, zip].map((s) => String(s || '').trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  private async resolveStageIdByName(name: string, fallbackId: number | null): Promise<number | null> {
    const t = name?.trim();
    if (!t) return fallbackId;
    const res = await this.db.query(
      `SELECT id FROM lead_stages WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
      [t],
    );
    return res.rows[0]?.id ?? fallbackId;
  }

  private async resolveUserIdByName(name: string): Promise<number | null> {
    const t = name?.trim();
    if (!t) return null;
    const res = await this.db.query(
      `SELECT id FROM users WHERE is_active=TRUE AND LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
      [t],
    );
    return res.rows[0]?.id ?? null;
  }

  /** L column: fb / facebook → Facebook Ads; ig / instagram → Instagram (or Website fallback). */
  private async resolveSourceIdFromSheetCell(raw: string, fallbackId: number | null): Promise<number | null> {
    const t = String(raw || '').trim().toLowerCase();
    if (!t) return fallbackId;
    if (t === 'fb' || t.includes('facebook')) {
      const r = await this.db.query(
        `SELECT id FROM lead_sources WHERE LOWER(TRIM(name)) IN ('facebook ads','facebook') ORDER BY id LIMIT 1`,
      );
      return r.rows[0]?.id ?? fallbackId;
    }
    if (t === 'ig' || t.includes('instagram')) {
      const r = await this.db.query(
        `SELECT id FROM lead_sources WHERE LOWER(TRIM(name)) = 'instagram' LIMIT 1`,
      );
      if (r.rows[0]?.id) return r.rows[0].id;
      const w = await this.db.query(`SELECT id FROM lead_sources WHERE LOWER(TRIM(name)) = 'website' LIMIT 1`);
      return w.rows[0]?.id ?? fallbackId;
    }
    const exact = await this.db.query(
      `SELECT id FROM lead_sources WHERE LOWER(TRIM(name)) = $1 LIMIT 1`,
      [t],
    );
    return exact.rows[0]?.id ?? fallbackId;
  }

  /** In-memory lookups so sheet sync does not run 3+ SQL round-trips per row. */
  private buildStageLookup(): Promise<Map<string, number>> {
    return this.db.query(`SELECT id, name FROM lead_stages`).then((res) => {
      const m = new Map<string, number>();
      for (const row of res.rows) {
        const k = String(row.name || '').trim().toLowerCase();
        if (k) m.set(k, row.id);
      }
      return m;
    });
  }

  private buildUserLookup(): Promise<Map<string, number>> {
    return this.db
      .query(`SELECT id, name, email FROM users WHERE is_active = TRUE`)
      .then((res) => {
        const m = new Map<string, number>();
        for (const row of res.rows) {
          const nk = String(row.name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
          if (nk && !m.has(nk)) m.set(nk, row.id);
          const ek = String(row.email || '').trim().toLowerCase();
          if (ek && !m.has(ek)) m.set(ek, row.id);
        }
        return m;
      });
  }

  private buildSourceResolver(fallbackId: number | null): Promise<(raw: string) => number | null> {
    return this.db.query(`SELECT id, name FROM lead_sources`).then((res) => {
      const byLower = new Map<string, number>();
      for (const row of res.rows) {
        byLower.set(String(row.name || '').trim().toLowerCase(), row.id);
      }
      return (raw: string) => {
        const t = String(raw || '').trim().toLowerCase();
        if (!t) return fallbackId;
        if (t === 'fb' || t.includes('facebook')) {
          return byLower.get('facebook ads') ?? byLower.get('facebook') ?? fallbackId;
        }
        if (t === 'ig' || t.includes('instagram')) {
          return byLower.get('instagram') ?? byLower.get('website') ?? fallbackId;
        }
        return byLower.get(t) ?? fallbackId;
      };
    });
  }

  private stageIdFromLookup(stageByLower: Map<string, number>, raw: string, fallback: number | null): number | null {
    const k = String(raw || '').trim().toLowerCase();
    if (!k) return fallback;
    return stageByLower.get(k) ?? fallback;
  }

  private userIdFromLookup(userByLower: Map<string, number>, raw: string): number | null {
    let k = String(raw || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!k) return null;
    const hit = userByLower.get(k);
    if (hit != null) return hit;
    // Sheet sometimes stores "Name <email@x.com>" or "email@x.com"
    const emailLike = k.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    if (emailLike) {
      const e = emailLike[0].toLowerCase();
      const byEmail = userByLower.get(e);
      if (byEmail != null) return byEmail;
    }
    return null;
  }

  private async syncGoogleSheetLeadsLegacy(
    cfg: any,
    rows: string[][],
  ): Promise<{
    importedCount: number;
    createdLeads: number[];
    stats: Record<string, number>;
  }> {
    const headers = rows[0].map((h) => this.normHeader(h));
    const stageId = await this.leadStageIdOrDefault();
    const srcId = cfg.lead_source_id ?? (await this.defaultLeadSourceId());
    const createdLeads: number[] = [];
    let importedCount = 0;
    let skippedEmptyIdentity = 0;
    let skippedDuplicates = 0;
    let processedRows = 0;
    const totalRows = Math.max(0, rows.length - 1);

    for (let i = 1; i < rows.length; i++) {
      processedRows++;
      const cols = rows[i];
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rec[h] = String(cols[idx] || '').trim();
      });

      const name = this.valByKeys(rec, ['name', 'fullname', 'leadname']) || '';
      const email = this.valByKeys(rec, ['email', 'emailaddress']);
      const phone = this.valByKeys(rec, ['phone', 'phonenumber', 'mobile', 'mobilenumber']);
      const company = this.valByKeys(rec, ['company', 'companyname', 'organization']);
      const notes = this.valByKeys(rec, ['notes', 'remark', 'remarks', 'comment']);
      const leadName = name || email || phone || '';
      if (!leadName) {
        skippedEmptyIdentity++;
        continue;
      }

      const dedupe = await this.db.query(
        `SELECT id FROM leads
          WHERE (($1::text IS NOT NULL AND email=$1) OR ($2::text IS NOT NULL AND phone=$2))
          ORDER BY id DESC
          LIMIT 1`,
        [email, phone],
      );
      if (dedupe.rows[0]) {
        skippedDuplicates++;
        continue;
      }

      const ins = await this.db.query(
        `INSERT INTO leads (name,email,phone,company,source_id,stage_id,assigned_to,notes,priority,custom_fields)
         VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,'warm',$8)
         RETURNING id`,
        [
          leadName,
          email,
          phone,
          company,
          srcId,
          stageId,
          notes || 'Imported from Google Sheet',
          JSON.stringify({ import_source: 'google_sheet', config_id: cfg.id, row_index: i + 1 }),
        ],
      );
      const id = ins.rows[0]?.id;
      if (id) {
        createdLeads.push(id);
        importedCount++;
        await this.notifyLeadCreated(id);
      }
    }

    const createdRows = importedCount;
    const skippedRows = Math.max(0, processedRows - createdRows);
    return {
      importedCount,
      createdLeads,
      stats: {
        totalRows,
        processedRows,
        createdRows,
        updatedRows: 0,
        skippedRows,
        skippedEmptyIdentity,
        skippedDuplicates,
      },
    };
  }

  private async syncGoogleSheetLeadsFixed(
    cfg: any,
    rows: string[][],
    dataStart1Based: number,
  ): Promise<{
    importedCount: number;
    createdLeads: number[];
    stats: Record<string, number>;
  }> {
    const C = LeadPlatformsService.GSHEET_COL;
    const startIdx = dataStart1Based - 1;
    if (rows.length <= startIdx) {
      return {
        importedCount: 0,
        createdLeads: [],
        stats: {
          totalRows: 0,
          processedRows: 0,
          createdRows: 0,
          updatedRows: 0,
          skippedRows: 0,
          skippedEmptyIdentity: 0,
          skippedDuplicates: 0,
        },
      };
    }

    const fallbackSourceId = await this.defaultLeadSourceId();
    const sourceFallback = cfg.lead_source_id ?? fallbackSourceId;
    const [defaultStageId, stageByLower, userByLower, resolveSource] = await Promise.all([
      this.leadStageIdOrDefault(),
      this.buildStageLookup(),
      this.buildUserLookup(),
      this.buildSourceResolver(sourceFallback),
    ]);

    const existingRes = await this.db.query(
      `SELECT id, custom_fields FROM leads WHERE (custom_fields->>'google_sheet_config_id') = $1`,
      [String(cfg.id)],
    );
    const existingBySheetId = new Map<string, { id: number; custom_fields: unknown }>();
    for (const row of existingRes.rows) {
      const cf = row.custom_fields as Record<string, unknown> | null;
      const lid = cf?.google_sheet_lead_id;
      if (lid != null && String(lid).trim()) {
        existingBySheetId.set(String(lid).trim(), { id: row.id, custom_fields: row.custom_fields });
      }
    }

    const emailsForDedupe = new Set<string>();
    const phonesForDedupe = new Set<string>();
    for (let i = startIdx; i < rows.length; i++) {
      const r = rows[i];
      const sheetLeadId = this.gsCell(r, C.LEAD_ID);
      if (sheetLeadId) continue;
      const em = this.gsCell(r, C.EMAIL);
      const ph = this.truncatePhoneDb(this.gsCell(r, C.PHONE) || null);
      if (em) emailsForDedupe.add(em.trim().toLowerCase());
      if (ph) phonesForDedupe.add(ph);
    }

    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    if (emailsForDedupe.size) {
      const er = await this.db.query(
        `SELECT lower(trim(email)) AS e FROM leads
          WHERE email IS NOT NULL AND trim(email) <> '' AND lower(trim(email)) = ANY($1::text[])`,
        [[...emailsForDedupe]],
      );
      for (const x of er.rows) {
        if (x.e) existingEmails.add(String(x.e));
      }
    }
    if (phonesForDedupe.size) {
      const pr = await this.db.query(`SELECT phone FROM leads WHERE phone = ANY($1::text[])`, [[...phonesForDedupe]]);
      for (const x of pr.rows) {
        if (x.phone) existingPhones.add(String(x.phone));
      }
    }

    const createdLeads: number[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    let skippedEmptyIdentity = 0;
    let skippedDuplicates = 0;
    let processedRows = 0;
    const totalRows = Math.max(0, rows.length - startIdx);

    for (let i = startIdx; i < rows.length; i++) {
      processedRows++;
      const r = rows[i];
      const sheetLeadId = this.gsCell(r, C.LEAD_ID);
      const statusRaw = this.gsCell(r, C.STATUS);
      const salesPersonRaw = this.gsCell(r, C.SALES_PERSON);
      const sourceRaw = this.gsCell(r, C.SOURCE);
      const contactName = this.gsCell(r, C.CONTACT_NAME);
      const email = this.gsCell(r, C.EMAIL) || null;
      const phoneRaw = this.gsCell(r, C.PHONE);
      const phone = this.truncatePhoneDb(phoneRaw || null);
      const city = this.gsCell(r, C.CITY);
      const state = this.gsCell(r, C.STATE);
      const zip = this.gsCell(r, C.ZIP);
      const address = this.buildCityStateZipLine(city, state, zip);

      const leadName = contactName || email || phone || '';
      if (!leadName) {
        skippedEmptyIdentity++;
        continue;
      }

      const stageId = this.stageIdFromLookup(stageByLower, statusRaw, defaultStageId);
      const sourceId = resolveSource(sourceRaw) ?? sourceFallback;
      const salesPersonTrimmed = String(salesPersonRaw || '').trim();
      const assignedTo = salesPersonTrimmed ? this.userIdFromLookup(userByLower, salesPersonTrimmed) : null;

      const sheetMeta: Record<string, unknown> = {
        import_source: 'google_sheet',
        google_sheet_config_id: String(cfg.id),
        google_sheet_lead_id: sheetLeadId || null,
        sheet_row_1based: i + 1,
        sheet_status: statusRaw || null,
        sheet_sales_person: salesPersonRaw || null,
        sheet_source_raw: sourceRaw || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
      };

      const notesLine = 'Imported from Google Sheet';

      if (sheetLeadId) {
        const row0 = existingBySheetId.get(sheetLeadId);
        if (row0) {
          const merged = this.mergeSheetCustomFields(row0.custom_fields, sheetMeta);
          // Preserve CRM assignee when the sheet leaves Sales person blank; if the cell has a value
          // but lookup fails, keep the existing assignee instead of writing NULL.
          await this.db.query(
            `UPDATE leads SET
               name=$1, email=$2, phone=$3, source_id=$4, stage_id=$5,
               assigned_to = CASE
                 WHEN NULLIF(TRIM($6::text), '') IS NULL THEN assigned_to
                 ELSE COALESCE($7::int, assigned_to)
               END,
               address=$8, custom_fields=$9::jsonb, updated_at=NOW()
             WHERE id=$10`,
            [
              leadName,
              email,
              phone,
              sourceId,
              stageId,
              salesPersonTrimmed,
              assignedTo,
              address,
              JSON.stringify(merged),
              row0.id,
            ],
          );
          updatedCount++;
          importedCount++;
          continue;
        }
      }

      if (sheetLeadId) {
        const ins = await this.db.query(
          `INSERT INTO leads (name,email,phone,company,source_id,stage_id,assigned_to,notes,priority,custom_fields,address)
           VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,'warm',$8::jsonb,$9)
           RETURNING id`,
          [
            leadName,
            email,
            phone,
            sourceId,
            stageId,
            assignedTo,
            notesLine,
            JSON.stringify(sheetMeta),
            address,
          ],
        );
        const newId = ins.rows[0]?.id;
        if (newId) {
          createdLeads.push(newId);
          importedCount++;
          existingBySheetId.set(sheetLeadId, { id: newId, custom_fields: sheetMeta });
          await this.notifyLeadCreated(newId);
        }
        continue;
      }

      const emailKey = email ? email.trim().toLowerCase() : '';
      const dup =
        (emailKey && existingEmails.has(emailKey)) || (phone && existingPhones.has(phone));
      if (dup) {
        skippedDuplicates++;
        continue;
      }

      const ins = await this.db.query(
        `INSERT INTO leads (name,email,phone,company,source_id,stage_id,assigned_to,notes,priority,custom_fields,address)
         VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,'warm',$8::jsonb,$9)
         RETURNING id`,
        [
          leadName,
          email,
          phone,
          sourceId,
          stageId,
          assignedTo,
          notesLine,
          JSON.stringify({ ...sheetMeta, google_sheet_lead_id: null }),
          address,
        ],
      );
      const newId = ins.rows[0]?.id;
      if (newId) {
        createdLeads.push(newId);
        importedCount++;
        if (emailKey) existingEmails.add(emailKey);
        if (phone) existingPhones.add(phone);
        await this.notifyLeadCreated(newId);
      }
    }

    const createdRows = createdLeads.length;
    const skippedRows = skippedEmptyIdentity + skippedDuplicates;
    return {
      importedCount,
      createdLeads,
      stats: {
        totalRows,
        processedRows,
        createdRows,
        updatedRows: updatedCount,
        skippedRows,
        skippedEmptyIdentity,
        skippedDuplicates,
      },
    };
  }

  async syncGoogleSheetLeads(configId: number) {
    const cfgRes = await this.db.query('SELECT * FROM lead_platform_google_sheets WHERE id=$1', [configId]);
    const cfg = cfgRes.rows[0];
    if (!cfg) throw new NotFoundException('Google Sheet config not found');
    if (!cfg.is_active) {
      return {
        importedCount: 0,
        createdLeads: [],
        stats: {
          totalRows: 0,
          processedRows: 0,
          createdRows: 0,
          updatedRows: 0,
          skippedRows: 0,
          skippedEmptyIdentity: 0,
          skippedDuplicates: 0,
        },
      };
    }

    const csvUrl = this.buildGoogleSheetCsvUrl(cfg.sheet_url, cfg.sheet_gid);
    const csvText = await this.fetchGoogleSheetCsvText(csvUrl);
    const rows = this.parseCsv(csvText);
    if (rows.length < 2) {
      return {
        importedCount: 0,
        createdLeads: [],
        stats: {
          totalRows: 0,
          processedRows: 0,
          createdRows: 0,
          updatedRows: 0,
          skippedRows: 0,
          skippedEmptyIdentity: 0,
          skippedDuplicates: 0,
        },
      };
    }

    const dr = cfg.data_start_row;
    if (dr != null && Number(dr) >= 1) {
      return this.syncGoogleSheetLeadsFixed(cfg, rows, Number(dr));
    }
    return this.syncGoogleSheetLeadsLegacy(cfg, rows);
  }

  /** Sync every active connected sheet (sequential). Used by the 10-minute cron. */
  async syncAllActiveGoogleSheets(): Promise<void> {
    const res = await this.db.query(
      `SELECT id FROM lead_platform_google_sheets WHERE is_active = TRUE ORDER BY id ASC`,
    );
    for (const row of res.rows) {
      const id = Number(row.id);
      try {
        const r = await this.syncGoogleSheetLeads(id);
        this.log.log(
          `Google Sheets auto-sync config=${id}: ${r.importedCount} saved (${r.stats?.createdRows ?? 0} new, ${r.stats?.updatedRows ?? 0} updated)`,
        );
      } catch (e: any) {
        this.log.warn(`Google Sheets auto-sync config=${id} failed: ${e?.message ?? e}`);
      }
    }
  }
}

