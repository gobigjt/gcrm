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

  @Get('brands')            listBrands()                              { return this.svc.listBrands(); }
  @Post('brands')           async createBrand(@Body() b: any)          { const r = await this.svc.createBrand(b); if (!r) throw new BadRequestException('name is required'); return { brand: r }; }
  @Patch('brands/:id')      async updateBrand(@Param('id') id: string, @Body() b: any) { const r = await this.svc.updateBrand(Number(id), b); if (!r) throw new BadRequestException('name is required'); return { brand: r }; }
  @Delete('brands/:id')     async deleteBrand(@Param('id') id: string) { const r = await this.svc.deleteBrand(Number(id)); if (!r) throw new NotFoundException(); return { brand: r }; }

  @Get('categories')        listCategories()                            { return this.svc.listCategories(); }
  @Post('categories')       async createCategory(@Body() b: any)        { const r = await this.svc.createCategory(b); if (!r) throw new BadRequestException('name is required'); return { category: r }; }
  @Patch('categories/:id')  async updateCategory(@Param('id') id: string, @Body() b: any) { const r = await this.svc.updateCategory(Number(id), b); if (!r) throw new BadRequestException('name is required'); return { category: r }; }
  @Delete('categories/:id') async deleteCategory(@Param('id') id: string) { const r = await this.svc.deleteCategory(Number(id)); if (!r) throw new NotFoundException(); return { category: r }; }

  @Get('products')           listProducts(@Query('search') s?: string) { return this.svc.listProducts(s); }
  @Post('products')          createProduct(@Body() b: any)             { return this.svc.createProduct(b); }
  @Get('products/:id')       async getProduct(@Param('id') id: string) { const p=await this.svc.getProduct(Number(id)); if(!p) throw new NotFoundException(); return {product:p}; }
  @Patch('products/:id')     updateProduct(@Param('id') id: string, @Body() b: any) { return this.svc.updateProduct(Number(id), b); }
  @Delete('products/:id')    async deleteProduct(@Param('id') id: string) { const p=await this.svc.deleteProduct(Number(id)); if(!p) throw new NotFoundException(); return {product:p}; }
  @Get('products/:id/stock') getStock(@Param('id') id: string) { return this.svc.getStock(Number(id)); }

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
  async uploadProductImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Upload an image file (JPEG, PNG, WebP, or GIF), max 3 MB.');
    const productId = Number(id);
    if (!Number.isFinite(productId) || productId < 1) throw new BadRequestException('Invalid product id');
    const rel = `/uploads/products/${file.filename}`;
    const updated = await this.svc.setProductImage(productId, rel);
    if (!updated) throw new NotFoundException();
    return { product: updated };
  }

  @Get('warehouses')         listWarehouses()                           { return this.svc.listWarehouses(); }
  @Post('warehouses')        createWarehouse(@Body() b: any)            { return this.svc.createWarehouse(b); }

  @Get('stock/low')          listLowStock()                             { return this.svc.listLowStock(); }
  @Post('stock/adjust')      adjustStock(@Body() b: any, @CurrentUser() u: any) { return this.svc.adjustStock({...b,created_by:u.id}); }
  @Get('movements')          listMovements(@Query('product_id') pid?: string) { return this.svc.listMovements(pid ? Number(pid) : undefined); }
}
