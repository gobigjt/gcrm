import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }      from '../../common/guards/jwt-auth.guard';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { InventoryService }  from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('products')           listProducts(@Query('search') s?: string) { return this.svc.listProducts(s); }
  @Post('products')          createProduct(@Body() b: any)             { return this.svc.createProduct(b); }
  @Get('products/:id')       async getProduct(@Param('id') id: string) { const p=await this.svc.getProduct(Number(id)); if(!p) throw new NotFoundException(); return {product:p}; }
  @Patch('products/:id')     updateProduct(@Param('id') id: string, @Body() b: any) { return this.svc.updateProduct(Number(id), b); }
  @Get('products/:id/stock') getStock(@Param('id') id: string) { return this.svc.getStock(Number(id)); }

  @Get('warehouses')         listWarehouses()                           { return this.svc.listWarehouses(); }
  @Post('warehouses')        createWarehouse(@Body() b: any)            { return this.svc.createWarehouse(b); }

  @Get('stock/low')          listLowStock()                             { return this.svc.listLowStock(); }
  @Post('stock/adjust')      adjustStock(@Body() b: any, @CurrentUser() u: any) { return this.svc.adjustStock({...b,created_by:u.id}); }
  @Get('movements')          listMovements(@Query('product_id') pid?: string) { return this.svc.listMovements(pid ? Number(pid) : undefined); }
}
