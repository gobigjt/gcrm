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

  // Customers
  @Get('customers')            listCustomers(@Query('search') s?: string) { return this.svc.listCustomers(s); }
  @Post('customers')           createCustomer(@Body() b: any)             { return this.svc.createCustomer(b); }
  @Get('customers/:id')        async getCustomer(@Param('id') id: string) { const c = await this.svc.getCustomer(Number(id)); if(!c) throw new NotFoundException(); return {customer:c}; }
  @Patch('customers/:id')      updateCustomer(@Param('id') id: string, @Body() b: any) { return this.svc.updateCustomer(Number(id), b); }
  @Delete('customers/:id')     deleteCustomer(@Param('id') id: string) { return this.svc.deleteCustomer(Number(id)); }

  // Quotations
  @Get('quotations')           listQuotations()                           { return this.svc.listQuotations(); }
  @Post('quotations')          createQuotation(@Body() b: any, @CurrentUser() u: any) { const {items=[],...d}=b; return this.svc.createQuotation({...d,created_by:u.id}, items); }
  @Get('quotations/:id')       async getQuotation(@Param('id') id: string) { const q=await this.svc.getQuotation(Number(id)); if(!q) throw new NotFoundException(); return {quotation:q}; }
  @Patch('quotations/:id')     patchQuotation(@Param('id') id: string, @Body() b: any) { return this.svc.patchQuotation(Number(id), b.status); }
  @Delete('quotations/:id')    deleteQuotation(@Param('id') id: string) { return this.svc.deleteQuotation(Number(id)); }

  // Orders
  @Get('orders')               listOrders()                               { return this.svc.listOrders(); }
  @Post('orders')              createOrder(@Body() b: any, @CurrentUser() u: any) { const {items=[],...d}=b; return this.svc.createOrder({...d,created_by:u.id}, items); }
  @Get('orders/:id')           async getOrder(@Param('id') id: string) { const o=await this.svc.getOrder(Number(id)); if(!o) throw new NotFoundException(); return {order:o}; }
  @Patch('orders/:id')         patchOrder(@Param('id') id: string, @Body() b: any) { return this.svc.patchOrder(Number(id), b.status); }
  @Delete('orders/:id')        deleteOrder(@Param('id') id: string) { return this.svc.deleteOrder(Number(id)); }

  // Invoices
  @Get('invoices')             listInvoices()                             { return this.svc.listInvoices(); }
  @Post('invoices')            createInvoice(@Body() b: any, @CurrentUser() u: any) { const {items=[],...d}=b; return this.svc.createInvoice({...d,created_by:u.id}, items); }
  @Get('invoices/:id')         async getInvoice(@Param('id') id: string) { const inv=await this.svc.getInvoice(Number(id)); if(!inv) throw new NotFoundException(); return {invoice:inv}; }
  @Delete('invoices/:id')      deleteInvoice(@Param('id') id: string) { return this.svc.deleteInvoice(Number(id)); }
  @Post('invoices/:id/payments') addPayment(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.addPayment(Number(id), {...b,created_by:u.id}); }
}
