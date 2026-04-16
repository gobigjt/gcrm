import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Get('stats') stats(@CurrentUser() u: any) { return this.svc.stats(u); }

  @Get('executives') listSalesExecutives(@CurrentUser() u: any) {
    return this.svc.listSalesExecutives(u);
  }

  /** One-time PDF download: file is removed from disk after the response completes. */
  @Get('generated-pdfs/:fileName')
  streamGeneratedPdf(@Param('fileName') fileName: string, @Res({ passthrough: false }) res: Response): void {
    const safe = basename(fileName);
    if (!/^(quotation|order|invoice)-\d+-\d+\.pdf$/.test(safe)) {
      res.status(400).json({ statusCode: 400, message: 'Invalid file name' });
      return;
    }
    const filePath = join(process.cwd(), 'uploads', 'pdfs', safe);
    if (!existsSync(filePath)) {
      res.status(404).json({ statusCode: 404, message: 'Not found' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
    const stream = createReadStream(filePath);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      void unlink(filePath).catch(() => {});
    };
    res.once('finish', cleanup);
    res.once('close', cleanup);
    stream.once('error', () => {
      cleanup();
      if (!res.writableEnded) res.destroy();
    });
    stream.pipe(res);
  }

  // Customers
  @Get('customers')            listCustomers(@Query('search') s?: string, @CurrentUser() u?: any) { return this.svc.listCustomers(s, u); }
  @Post('customers')           createCustomer(@Body() b: any, @CurrentUser() u: any)             { return this.svc.createCustomer({ ...b, created_by: u?.id ?? null }, u); }
  @Get('customers/:id')        async getCustomer(@Param('id') id: string, @CurrentUser() u: any) { const c = await this.svc.getCustomer(Number(id), u); if(!c) throw new NotFoundException(); return {customer:c}; }
  @Patch('customers/:id')      updateCustomer(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.updateCustomer(Number(id), b, u); }
  @Delete('customers/:id')     deleteCustomer(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deleteCustomer(Number(id), u); }

  // Quotations
  @Get('quotations')           listQuotations(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('status')      status?: string,
    @Query('approval_status') approval_status?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
    @CurrentUser() u?: any,
  ) {
    return this.svc.listQuotations({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      status,
      approval_status,
      from,
      to,
    }, u);
  }
  @Post('quotations') async createQuotation(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    const created_by = await this.svc.resolveDocumentCreatedBy(u, d.created_by);
    return this.svc.createQuotation({ ...d, created_by }, items, { id: u?.id, role: u?.role });
  }
  @Get('quotations/:id')       async getQuotation(@Param('id') id: string, @CurrentUser() u: any) { const q=await this.svc.getQuotation(Number(id), u); if(!q) throw new NotFoundException(); return {quotation:q}; }
  @Get('quotations/:id/pdf') async getQuotationPdf(@Param('id') id: string, @CurrentUser() u: any) {
    const out = await this.svc.generateSalesPdfFile('quotation', Number(id), { id: u?.id, role: u?.role });
    if (!out) throw new NotFoundException();
    return out;
  }
  @Patch('quotations/:id')     async patchQuotation(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const body = { ...b };
    if (body.created_by !== undefined) {
      body.created_by = await this.svc.resolveDocumentCreatedBy(u, body.created_by);
    }
    const q = await this.svc.patchQuotation(Number(id), body, { id: u?.id, role: u?.role });
    if (!q) throw new NotFoundException();
    return { quotation: q };
  }
  @Delete('quotations/:id')    deleteQuotation(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deleteQuotation(Number(id), u); }

  // Orders
  @Get('orders')               listOrders(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('status')      status?: string,
    @Query('approval_status') approval_status?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
    @CurrentUser() u?: any,
  ) {
    return this.svc.listOrders({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      status,
      approval_status,
      from,
      to,
    }, u);
  }
  @Post('orders') async createOrder(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    const created_by = await this.svc.resolveDocumentCreatedBy(u, d.created_by);
    return this.svc.createOrder({ ...d, created_by }, items, { id: u?.id, role: u?.role });
  }
  @Get('orders/:id')           async getOrder(@Param('id') id: string, @CurrentUser() u: any) { const o=await this.svc.getOrder(Number(id), u); if(!o) throw new NotFoundException(); return {order:o}; }
  @Get('orders/:id/pdf') async getOrderPdf(@Param('id') id: string, @CurrentUser() u: any) {
    const out = await this.svc.generateSalesPdfFile('order', Number(id), { id: u?.id, role: u?.role });
    if (!out) throw new NotFoundException();
    return out;
  }
  @Patch('orders/:id') async patchOrder(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const body = typeof b === 'string' ? { status: b } : { ...b };
    if (body.created_by !== undefined) {
      body.created_by = await this.svc.resolveDocumentCreatedBy(u, body.created_by);
    }
    return this.svc.patchOrder(Number(id), body, { id: u?.id, role: u?.role });
  }
  @Delete('orders/:id')        deleteOrder(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deleteOrder(Number(id), u); }

  // Invoices
  @Get('invoices')             listInvoices(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('status')      status?: string,
    @Query('approval_status') approval_status?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
    @CurrentUser() u?: any,
  ) {
    return this.svc.listInvoices({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      status,
      approval_status,
      from,
      to,
    }, u);
  }
  @Post('invoices') async createInvoice(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    const created_by = await this.svc.resolveDocumentCreatedBy(u, d.created_by);
    return this.svc.createInvoice({ ...d, created_by }, items, { id: u?.id, role: u?.role });
  }
  @Get('invoices/:id')         async getInvoice(@Param('id') id: string, @CurrentUser() u: any) { const inv=await this.svc.getInvoice(Number(id), u); if(!inv) throw new NotFoundException(); return {invoice:inv}; }
  @Get('invoices/:id/pdf') async getInvoicePdf(@Param('id') id: string, @CurrentUser() u: any) {
    const out = await this.svc.generateSalesPdfFile('invoice', Number(id), { id: u?.id, role: u?.role });
    if (!out) throw new NotFoundException();
    return out;
  }
  @Patch('invoices/:id')       async patchInvoice(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const body = { ...b };
    if (body.created_by !== undefined) {
      body.created_by = await this.svc.resolveDocumentCreatedBy(u, body.created_by);
    }
    const inv = await this.svc.patchInvoice(Number(id), body, { id: u?.id, role: u?.role });
    if (!inv) throw new NotFoundException();
    return { invoice: inv };
  }
  @Delete('invoices/:id')      deleteInvoice(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deleteInvoice(Number(id), u); }
  @Post('invoices/:id/payments') addPayment(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.addPayment(Number(id), {...b,created_by:u.id}, u); }

  @Get('payments') listPayments(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
    @CurrentUser() u?: any,
  ) {
    return this.svc.listPayments({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      from,
      to,
    }, u);
  }

  @Get('returns') listReturns(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
    @CurrentUser() u?: any,
  ) {
    return this.svc.listReturns({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      from,
      to,
    }, u);
  }

  @Post('returns') createReturn(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    return this.svc.createReturn({ ...d, created_by: u.id }, items, u);
  }

  @Get('returns/:id') async getReturn(@Param('id') id: string, @CurrentUser() u: any) {
    const r = await this.svc.getReturn(Number(id), u);
    if (!r) throw new NotFoundException();
    return { saleReturn: r };
  }

  @Delete('returns/:id') deleteReturn(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deleteReturn(Number(id), u); }

  @Post('returns/:id/payments') addReturnPayment(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    return this.svc.addReturnPayment(Number(id), { ...b, created_by: u.id }, u);
  }
}
