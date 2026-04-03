import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service';
import { LeadsService } from './leads.service';

@ApiTags('Lead Capture')
@Controller('capture')
export class LeadCaptureController {
  constructor(
    private readonly db: DatabaseService,
    private readonly leads: LeadsService,
  ) {}

  @Get(':formKey')
  @ApiOperation({ summary: 'Get form fields by form key (public)' })
  @ApiParam({ name: 'formKey', example: 'contact-us' })
  async getForm(@Param('formKey') formKey: string) {
    const res = await this.db.query(
      `SELECT id, title, fields FROM lead_forms WHERE form_key=$1 AND is_active=TRUE`,
      [formKey],
    );
    if (!res.rows[0]) throw new NotFoundException('Form not found');
    return res.rows[0];
  }

  @Post(':formKey')
  @ApiOperation({ summary: 'Submit a lead capture form (public)' })
  @ApiParam({ name: 'formKey', example: 'contact-us' })
  async submitForm(@Param('formKey') formKey: string, @Body() body: any) {
    const formRes = await this.db.query(
      `SELECT id, default_source_id, default_stage_id, assigned_to FROM lead_forms WHERE form_key=$1 AND is_active=TRUE`,
      [formKey],
    );
    if (!formRes.rows[0]) throw new NotFoundException('Form not found');
    const form = formRes.rows[0];

    // Save raw submission
    const submissionRes = await this.db.query(
      `INSERT INTO lead_form_submissions (form_id, data) VALUES ($1,$2) RETURNING id`,
      [form.id, JSON.stringify(body)],
    );

    // Auto-create lead from submission if name/email/phone present
    const name  = body.name  || body.full_name || null;
    const email = body.email || null;
    const phone = body.phone || body.mobile    || null;

    let leadId: number | null = null;
    if (name || email || phone) {
      const lead = await this.leads.create({
        name,
        email,
        phone,
        source_id: form.default_source_id ?? null,
        stage_id: form.default_stage_id ?? null,
        assigned_to: form.assigned_to ?? null,
        notes: body.message || body.notes || null,
      });
      leadId = lead?.id ?? null;
    }

    return {
      submission_id: submissionRes.rows[0].id,
      lead_id:       leadId,
      message:       'Thank you! We will get back to you shortly.',
    };
  }
}
