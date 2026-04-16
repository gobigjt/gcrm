import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }      from '../../common/guards/jwt-auth.guard';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { InventoryService }  from './inventory.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('brands')            listBrands(@CurrentUser() u: any)                              { return this.svc.listBrands(u); }
  @Post('brands')           async createBrand(@Body() b: any, @CurrentUser() u: any)          { const r = await this.svc.createBrand(b, u); if (!r) throw new BadRequestException('name is required'); return { brand: r }; }
  @Patch('brands/:id')      async updateBrand(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { const r = await this.svc.updateBrand(Number(id), b, u); if (!r) throw new BadRequestException('name is required'); return { brand: r }; }
  @Delete('brands/:id')     async deleteBrand(@Param('id') id: string, @CurrentUser() u: any) { const r = await this.svc.deleteBrand(Number(id), u); if (!r) throw new NotFoundException(); return { brand: r }; }

  @Get('categories')        listCategories(@CurrentUser() u: any)                            { return this.svc.listCategories(u); }
  @Post('categories')       async createCategory(@Body() b: any, @CurrentUser() u: any)        { const r = await this.svc.createCategory(b, u); if (!r) throw new BadRequestException('name is required'); return { category: r }; }
  @Patch('categories/:id')  async updateCategory(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { const r = await this.svc.updateCategory(Number(id), b, u); if (!r) throw new BadRequestException('name is required'); return { category: r }; }
  @Delete('categories/:id') async deleteCategory(@Param('id') id: string, @CurrentUser() u: any) { const r = await this.svc.deleteCategory(Number(id), u); if (!r) throw new NotFoundException(); return { category: r }; }

  @Get('products')           listProducts(@Query('search') s?: string, @CurrentUser() u?: any) { return this.svc.listProducts(s, u); }
  @Post('products')          createProduct(@Body() b: any, @CurrentUser() u: any)             { return this.svc.createProduct(b, u); }
  @Get('products/:id')       async getProduct(@Param('id') id: string, @CurrentUser() u: any) { const p=await this.svc.getProduct(Number(id), u); if(!p) throw new NotFoundException(); return {product:p}; }
  @Patch('products/:id')     updateProduct(@Param('id') id: string, @Body() b: any, @CurrentUser() u: any) { return this.svc.updateProduct(Number(id), b, u); }
  @Delete('products/:id')    async deleteProduct(@Param('id') id: string, @CurrentUser() u: any) { const p=await this.svc.deleteProduct(Number(id), u); if(!p) throw new NotFoundException(); return {product:p}; }
  @Get('products/:id/stock') getStock(@Param('id') id: string, @CurrentUser() u: any) { return this.svc.getStock(Number(id), u); }

  @Post('products/:id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'products');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
          const safe = allowed.includes(ext) ? ext : '.png';
          cb(null, `product-${Date.now()}${safe}`);
        },
      }),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
    }),
  )
  async uploadProductImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() u: any) {
    if (!file) throw new BadRequestException('Upload an image file (JPEG, PNG, WebP, or GIF), max 3 MB.');
    const productId = Number(id);
    if (!Number.isFinite(productId) || productId < 1) throw new BadRequestException('Invalid product id');
    const rel = `/uploads/products/${file.filename}`;
    const updated = await this.svc.setProductImage(productId, rel, u);
    if (!updated) throw new NotFoundException();
    return { product: updated };
  }

  @Get('warehouses')         listWarehouses(@CurrentUser() u: any)                           { return this.svc.listWarehouses(u); }
  @Post('warehouses')        createWarehouse(@Body() b: any, @CurrentUser() u: any)            { return this.svc.createWarehouse(b, u); }

  @Get('stock/low')          listLowStock(@CurrentUser() u: any)                             { return this.svc.listLowStock(u); }
  @Post('stock/adjust')      adjustStock(@Body() b: any, @CurrentUser() u: any) { return this.svc.adjustStock({...b,created_by:u.id}, u); }
  @Get('movements')          listMovements(@Query('product_id') pid?: string, @CurrentUser() u?: any) { return this.svc.listMovements(pid ? Number(pid) : undefined, u); }
}
