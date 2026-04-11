import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('stats') stats() { return this.svc.stats(); }

  @Get('executives') listSalesExecutives() {
    return this.svc.listSalesExecutives();
  }

  // Customers
  @Get('customers')            listCustomers(@Query('search') s?: string) { return this.svc.listCustomers(s); }
  @Post('customers')           createCustomer(@Body() b: any)             { return this.svc.createCustomer(b); }
  @Get('customers/:id')        async getCustomer(@Param('id') id: string) { const c = await this.svc.getCustomer(Number(id)); if(!c) throw new NotFoundException(); return {customer:c}; }
  @Patch('customers/:id')      updateCustomer(@Param('id') id: string, @Body() b: any) { return this.svc.updateCustomer(Number(id), b); }
  @Delete('customers/:id')     deleteCustomer(@Param('id') id: string) { return this.svc.deleteCustomer(Number(id)); }

  // Quotations
  @Get('quotations')           listQuotations(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('status')      status?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
  ) {
    return this.svc.listQuotations({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      status,
      from,
      to,
    });
  }
  @Post('quotations') async createQuotation(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    const created_by = await this.svc.resolveDocumentCreatedBy(u, d.created_by);
    return this.svc.createQuotation({ ...d, created_by }, items);
  }
  @Get('quotations/:id')       async getQuotation(@Param('id') id: string) { const q=await this.svc.getQuotation(Number(id)); if(!q) throw new NotFoundException(); return {quotation:q}; }
  @Patch('quotations/:id')     async patchQuotation(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const body = { ...b };
    if (body.created_by !== undefined) {
      body.created_by = await this.svc.resolveDocumentCreatedBy(u, body.created_by);
    }
    const q = await this.svc.patchQuotation(Number(id), body);
    if (!q) throw new NotFoundException();
    return { quotation: q };
  }
  @Delete('quotations/:id')    deleteQuotation(@Param('id') id: string) { return this.svc.deleteQuotation(Number(id)); }

  // Orders
  @Get('orders')               listOrders(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('status')      status?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
  ) {
    return this.svc.listOrders({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      status,
      from,
      to,
    });
  }
  @Post('orders') async createOrder(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    const created_by = await this.svc.resolveDocumentCreatedBy(u, d.created_by);
    return this.svc.createOrder({ ...d, created_by }, items);
  }
  @Get('orders/:id')           async getOrder(@Param('id') id: string) { const o=await this.svc.getOrder(Number(id)); if(!o) throw new NotFoundException(); return {order:o}; }
  @Patch('orders/:id') async patchOrder(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const body = typeof b === 'string' ? { status: b } : { ...b };
    if (body.created_by !== undefined) {
      body.created_by = await this.svc.resolveDocumentCreatedBy(u, body.created_by);
    }
    return this.svc.patchOrder(Number(id), body);
  }
  @Delete('orders/:id')        deleteOrder(@Param('id') id: string) { return this.svc.deleteOrder(Number(id)); }

  // Invoices
  @Get('invoices')             listInvoices(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('status')      status?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
  ) {
    return this.svc.listInvoices({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      status,
      from,
      to,
    });
  }
  @Post('invoices') async createInvoice(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    const created_by = await this.svc.resolveDocumentCreatedBy(u, d.created_by);
    return this.svc.createInvoice({ ...d, created_by }, items);
  }
  @Get('invoices/:id')         async getInvoice(@Param('id') id: string) { const inv=await this.svc.getInvoice(Number(id)); if(!inv) throw new NotFoundException(); return {invoice:inv}; }
  @Patch('invoices/:id')       async patchInvoice(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    const body = { ...b };
    if (body.created_by !== undefined) {
      body.created_by = await this.svc.resolveDocumentCreatedBy(u, body.created_by);
    }
    const inv = await this.svc.patchInvoice(Number(id), body);
    if (!inv) throw new NotFoundException();
    return { invoice: inv };
  }
  @Delete('invoices/:id')      deleteInvoice(@Param('id') id: string) { return this.svc.deleteInvoice(Number(id)); }
  @Post('invoices/:id/payments') addPayment(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.addPayment(Number(id), {...b,created_by:u.id}); }

  @Get('payments') listPayments(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
  ) {
    return this.svc.listPayments({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      from,
      to,
    });
  }

  @Get('returns') listReturns(
    @Query('customer_id') customer_id?: string,
    @Query('created_by')  created_by?: string,
    @Query('from')        from?: string,
    @Query('to')          to?: string,
  ) {
    return this.svc.listReturns({
      customer_id: customer_id ? Number(customer_id) : undefined,
      created_by: created_by ? Number(created_by) : undefined,
      from,
      to,
    });
  }

  @Post('returns') createReturn(@Body() b: any, @CurrentUser() u: any) {
    const { items = [], ...d } = b;
    return this.svc.createReturn({ ...d, created_by: u.id }, items);
  }

  @Get('returns/:id') async getReturn(@Param('id') id: string) {
    const r = await this.svc.getReturn(Number(id));
    if (!r) throw new NotFoundException();
    return { saleReturn: r };
  }

  @Delete('returns/:id') deleteReturn(@Param('id') id: string) { return this.svc.deleteReturn(Number(id)); }

  @Post('returns/:id/payments') addReturnPayment(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) {
    return this.svc.addReturnPayment(Number(id), { ...b, created_by: u.id });
  }
}
