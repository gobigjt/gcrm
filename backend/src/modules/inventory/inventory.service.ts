import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService, private readonly cache: RedisService) {}

  private isSuperAdmin(ctx?: any): boolean {
    return String(ctx?.role || '').trim().toLowerCase() === 'super admin';
  }

  private requireTenantId(ctx?: any): number {
    if (this.isSuperAdmin(ctx)) return 0;
    const tenantId = Number(ctx?.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) throw new ForbiddenException('Tenant context is required');
    return tenantId;
  }

  private mapProductWriteError(error: unknown): never {
    const e = error as { code?: string; constraint?: string };
    if (e?.code === '23505') {
      if (e.constraint === 'uq_products_tenant_sku') {
        throw new ConflictException('SKU already exists');
      }
      if (e.constraint === 'uq_products_tenant_code') {
        throw new ConflictException('Product code already exists');
      }
      throw new ConflictException('Duplicate product code');
    }
    throw error;
  }

  private toNullableInt(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'string') {
      const t = value.trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isInteger(n) ? n : null;
    }
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
  }

  async listBrands(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query('SELECT * FROM brands WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY name', [tenantId])).rows;
  }

  async createBrand(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.query(
      `INSERT INTO brands (name, tenant_id) VALUES ($1, $2)
       ON CONFLICT (tenant_id, name) DO UPDATE SET name=EXCLUDED.name
       RETURNING *`,
      [name, tenantId || null],
    );
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async updateBrand(id: number, d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.query('UPDATE brands SET name=$2 WHERE id=$1 AND ($3::integer = 0 OR tenant_id = $3) RETURNING *', [id, name, tenantId]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async deleteBrand(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const used = (await this.db.query('SELECT COUNT(*)::int AS c FROM products WHERE brand_id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId])).rows[0]?.c ?? 0;
    if (used > 0) throw new BadRequestException('Brand is used by products and cannot be deleted');
    const res = await this.db.query('DELETE FROM brands WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2) RETURNING *', [id, tenantId]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async listCategories(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query('SELECT * FROM categories WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY name', [tenantId])).rows;
  }

  async createCategory(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.query(
      `INSERT INTO categories (name, tenant_id) VALUES ($1, $2)
       ON CONFLICT (tenant_id, name) DO UPDATE SET name=EXCLUDED.name
       RETURNING *`,
      [name, tenantId || null],
    );
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async updateCategory(id: number, d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const old = (await this.db.query('SELECT * FROM categories WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId])).rows[0];
    if (!old) return null;
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.transaction(async (client) => {
      const upd = await client.query('UPDATE categories SET name=$2 WHERE id=$1 AND ($3::integer = 0 OR tenant_id = $3) RETURNING *', [id, name, tenantId]);
      await client.query('UPDATE products SET category=$2 WHERE category=$1 AND ($3::integer = 0 OR tenant_id = $3)', [old.name, name, tenantId]);
      return upd.rows[0];
    });
    await this.cache.delPattern('products:*');
    return res;
  }

  async deleteCategory(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const cat = (await this.db.query('SELECT * FROM categories WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2)', [id, tenantId])).rows[0];
    if (!cat) return null;
    const used = (await this.db.query('SELECT COUNT(*)::int AS c FROM products WHERE category=$1 AND ($2::integer = 0 OR tenant_id = $2)', [cat.name, tenantId])).rows[0]?.c ?? 0;
    if (used > 0) throw new BadRequestException('Category is used by products and cannot be deleted');
    const res = await this.db.query('DELETE FROM categories WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2) RETURNING *', [id, tenantId]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async listProducts(search?: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const cacheKey = `products:${tenantId || 'all'}:${search||''}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;
    const vals: any[] = [tenantId];
    let where = 'WHERE ($1::integer = 0 OR p.tenant_id = $1)';
    if (search) {
      vals.push(`%${search}%`);
      where += ' AND (p.name ILIKE $2 OR p.sku ILIKE $2 OR p.hsn_code ILIKE $2 OR p.code ILIKE $2 OR p.category ILIKE $2)';
    }
    const rows = (await this.db.query(
      `SELECT p.*,
          b.name AS brand_name,
          COALESCE(st.total_stock, 0) AS total_stock
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN (
         SELECT product_id, SUM(quantity) AS total_stock
         FROM stock
         GROUP BY product_id
       ) st ON st.product_id = p.id
       ${where}
       ORDER BY p.name`,
      vals,
    )).rows;
    await this.cache.set(cacheKey, rows, 300);
    return rows;
  }
  async getProduct(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT p.*,
          b.name AS brand_name,
          COALESCE(st.total_stock, 0) AS total_stock
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN (
         SELECT product_id, SUM(quantity) AS total_stock
         FROM stock
         GROUP BY product_id
       ) st ON st.product_id = p.id
       WHERE p.id=$1 AND ($2::integer = 0 OR p.tenant_id = $2)`,
      [id, tenantId],
    )).rows[0];
  }
  async createProduct(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const brandId = this.toNullableInt(d?.brand_id);
    const purchasePrice = Number(d?.purchase_price);
    const salePrice = Number(d?.sale_price);
    const gstRate = Number(d?.gst_rate);
    const lowStockAlert = Number(d?.low_stock_alert);
    let res;
    try {
      res = await this.db.query(
        'INSERT INTO products (name,code,sku,hsn_code,category,brand_id,description,unit,purchase_price,sale_price,image_url,gst_rate,low_stock_alert,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
        [
          d.name,
          d.code,
          d.sku,
          d.hsn_code,
          d.category,
          brandId,
          d.description,
          d.unit || 'pcs',
          Number.isFinite(purchasePrice) ? purchasePrice : 0,
          Number.isFinite(salePrice) ? salePrice : 0,
          d.image_url,
          Number.isFinite(gstRate) ? gstRate : 0,
          Number.isFinite(lowStockAlert) ? lowStockAlert : 0,
          tenantId || null,
        ],
      );
    } catch (error) {
      this.mapProductWriteError(error);
    }
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }
  async updateProduct(id: number, d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const fields = ['name','code','sku','hsn_code','category','brand_id','description','unit','purchase_price','sale_price','image_url','gst_rate','low_stock_alert','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) {
      if (d[f] === undefined) continue;
      let nextVal = d[f];
      if (f === 'brand_id') {
        nextVal = this.toNullableInt(d[f]);
      }
      sets.push(`${f}=$${i++}`);
      vals.push(nextVal);
    }
    if(!sets.length) return null;
    vals.push(id, tenantId);
    let res;
    try {
      res = await this.db.query(`UPDATE products SET ${sets.join(',')} WHERE id=$${i} AND ($${i+1}::integer = 0 OR tenant_id = $${i+1}) RETURNING *`, vals);
    } catch (error) {
      this.mapProductWriteError(error);
    }
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async deleteProduct(id: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const res = await this.db.query('DELETE FROM products WHERE id=$1 AND ($2::integer = 0 OR tenant_id = $2) RETURNING *', [id, tenantId]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async setProductImage(id: number, imageUrl: string, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const res = await this.db.query('UPDATE products SET image_url=$2 WHERE id=$1 AND ($3::integer = 0 OR tenant_id = $3) RETURNING *', [id, imageUrl, tenantId]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async listWarehouses(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query('SELECT * FROM warehouses WHERE ($1::integer = 0 OR tenant_id = $1) ORDER BY name', [tenantId])).rows;
  }
  async createWarehouse(d: any, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query('INSERT INTO warehouses (name,location,tenant_id) VALUES ($1,$2,$3) RETURNING *', [d.name, d.location, tenantId || null])).rows[0];
  }

  async getStock(productId: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT s.*,w.name AS warehouse_name FROM stock s JOIN warehouses w ON w.id=s.warehouse_id
       WHERE s.product_id=$1 AND ($2::integer = 0 OR s.tenant_id = $2)`, [productId, tenantId]
    )).rows;
  }
  async listLowStock(ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    return (await this.db.query(
      `SELECT p.name,p.sku,p.low_stock_alert,COALESCE(SUM(s.quantity),0) AS total_stock
       FROM products p LEFT JOIN stock s ON s.product_id=p.id
       WHERE ($1::integer = 0 OR p.tenant_id = $1)
       GROUP BY p.id HAVING COALESCE(SUM(s.quantity),0) <= p.low_stock_alert AND p.low_stock_alert > 0
       ORDER BY total_stock ASC`, [tenantId]
    )).rows;
  }
  async adjustStock(d: { product_id: number; warehouse_id: number; type: string; quantity: number; note?: string; created_by: number }, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    await this.db.transaction(async (client) => {
      const delta = d.type === 'out' ? -Math.abs(d.quantity) : Math.abs(d.quantity);
      await client.query(
        `INSERT INTO stock (product_id,warehouse_id,quantity,tenant_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET quantity=stock.quantity+$3,updated_at=NOW(),tenant_id=COALESCE(stock.tenant_id,EXCLUDED.tenant_id)`,
        [d.product_id, d.warehouse_id, delta, tenantId || null],
      );
      await client.query('INSERT INTO stock_movements (product_id,warehouse_id,type,quantity,note,created_by,tenant_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [d.product_id, d.warehouse_id, d.type, Math.abs(d.quantity), d.note, d.created_by, tenantId || null]);
    });
    await this.cache.delPattern('products:*');
  }
  async listMovements(productId?: number, ctx?: any) {
    const tenantId = this.requireTenantId(ctx);
    const vals: any[] = [tenantId];
    let cond = 'WHERE ($1::integer = 0 OR sm.tenant_id = $1)';
    if (productId) {
      vals.push(productId);
      cond += ' AND sm.product_id=$2';
    }
    return (await this.db.query(
      `SELECT sm.*,p.name AS product_name,w.name AS warehouse_name FROM stock_movements sm
       JOIN products p ON p.id=sm.product_id JOIN warehouses w ON w.id=sm.warehouse_id
       ${cond} ORDER BY sm.created_at DESC LIMIT 200`, vals
    )).rows;
  }
}
