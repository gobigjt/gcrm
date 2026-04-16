import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }    from '../../common/guards/jwt-auth.guard';
import { CurrentUser }     from '../../common/decorators/current-user.decorator';
import { PurchaseService } from './purchase.service';

@ApiTags('Purchase')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('purchase')
export class PurchaseController {
  constructor(private readonly svc: PurchaseService) {}

  @Get('stats') stats(@CurrentUser() u: any) { return this.svc.stats(u); }

  @Get('vendors')        listVendors(@Query('search') s?: string, @CurrentUser() u?: any) { return this.svc.listVendors(s, u); }
  @Post('vendors')       createVendor(@Body() b: any, @CurrentUser() u: any)             { return this.svc.createVendor(b, u); }
  @Get('vendors/:id')    async getVendor(@Param('id') id: string, @CurrentUser() u: any) { const v=await this.svc.getVendor(Number(id), u); if(!v) throw new NotFoundException(); return {vendor:v}; }
  @Patch('vendors/:id')  updateVendor(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.updateVendor(Number(id), b, u); }
  @Delete('vendors/:id') deleteVendor(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deleteVendor(Number(id), u); }

  @Get('pos')           listPOs(@CurrentUser() u: any)    { return this.svc.listPOs(u); }
  @Post('pos')          createPO(@Body() b: any, @CurrentUser() u: any) { const {items=[],...d}=b; return this.svc.createPO({...d,created_by:u.id},items, u); }
  @Get('pos/:id')       async getPO(@Param('id') id: string, @CurrentUser() u: any) { const p=await this.svc.getPO(Number(id), u); if(!p) throw new NotFoundException(); return {po:p}; }
  @Patch('pos/:id')     patchPO(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.patchPO(Number(id),b.status, u); }
  @Delete('pos/:id')    deletePO(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.deletePO(Number(id), u); }

  @Get('grns')          listGRNs(@CurrentUser() u: any)   { return this.svc.listGRNs(u); }
  @Post('grns')         createGRN(@Body() b: any, @CurrentUser() u: any) { const {items=[],...d}=b; return this.svc.createGRN({...d,created_by:u.id},items, u); }
  @Get('grns/:id')      async getGRN(@Param('id') id: string, @CurrentUser() u: any) { const g=await this.svc.getGRN(Number(id), u); if(!g) throw new NotFoundException(); return {grn:g}; }

  @Get('invoices')      listPurchaseInvoices(@CurrentUser() u: any)   { return this.svc.listPurchaseInvoices(u); }
  @Post('invoices')     createPurchaseInvoice(@Body() b: any, @CurrentUser() u: any) { return this.svc.createPurchaseInvoice(b, u); }
}
