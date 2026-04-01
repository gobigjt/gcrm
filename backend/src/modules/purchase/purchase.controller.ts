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

  @Get('stats') stats() { return this.svc.stats(); }

  @Get('vendors')        listVendors(@Query('search') s?: string) { return this.svc.listVendors(s); }
  @Post('vendors')       createVendor(@Body() b: any)             { return this.svc.createVendor(b); }
  @Get('vendors/:id')    async getVendor(@Param('id') id: string) { const v=await this.svc.getVendor(Number(id)); if(!v) throw new NotFoundException(); return {vendor:v}; }
  @Patch('vendors/:id')  updateVendor(@Param('id') id: string, @Body() b: any) { return this.svc.updateVendor(Number(id), b); }
  @Delete('vendors/:id') deleteVendor(@Param('id') id: string) { return this.svc.deleteVendor(Number(id)); }

  @Get('pos')           listPOs()    { return this.svc.listPOs(); }
  @Post('pos')          createPO(@Body() b: any, @CurrentUser() u: any) { const {items=[],...d}=b; return this.svc.createPO({...d,created_by:u.id},items); }
  @Get('pos/:id')       async getPO(@Param('id') id: string) { const p=await this.svc.getPO(Number(id)); if(!p) throw new NotFoundException(); return {po:p}; }
  @Patch('pos/:id')     patchPO(@Param('id') id: string, @Body() b: any) { return this.svc.patchPO(Number(id),b.status); }
  @Delete('pos/:id')    deletePO(@Param('id') id: string) { return this.svc.deletePO(Number(id)); }

  @Get('grns')          listGRNs()   { return this.svc.listGRNs(); }
  @Post('grns')         createGRN(@Body() b: any, @CurrentUser() u: any) { const {items=[],...d}=b; return this.svc.createGRN({...d,created_by:u.id},items); }
  @Get('grns/:id')      async getGRN(@Param('id') id: string) { const g=await this.svc.getGRN(Number(id)); if(!g) throw new NotFoundException(); return {grn:g}; }

  @Get('invoices')      listPurchaseInvoices()   { return this.svc.listPurchaseInvoices(); }
  @Post('invoices')     createPurchaseInvoice(@Body() b: any) { return this.svc.createPurchaseInvoice(b); }
}
