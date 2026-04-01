import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }       from '../../common/guards/jwt-auth.guard';
import { CurrentUser }        from '../../common/decorators/current-user.decorator';
import { ProductionService }  from './production.service';

@ApiTags('Production')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly svc: ProductionService) {}

  @Get('boms')      listBOMs()  { return this.svc.listBOMs(); }
  @Post('boms')     createBOM(@Body() b: any) { const {items=[],...d}=b; return this.svc.createBOM(d, items); }
  @Get('boms/:id')  async getBOM(@Param('id') id: string) { const bom=await this.svc.getBOM(Number(id)); if(!bom) throw new NotFoundException(); return {bom}; }

  @Get('work-orders')       listWorkOrders(@Query('status') s?: string) { return this.svc.listWorkOrders(s); }
  @Post('work-orders')      createWO(@Body() b: any, @CurrentUser() u: any) { return this.svc.createWorkOrder({...b,created_by:u.id}); }
  @Get('work-orders/:id')   async getWO(@Param('id') id: string) { const w=await this.svc.getWorkOrder(Number(id)); if(!w) throw new NotFoundException(); return {work_order:w}; }
  @Patch('work-orders/:id') updateWO(@Param('id') id: string, @Body() b: any) { return this.svc.updateWorkOrder(Number(id), b); }
}
