import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService, private readonly cache: RedisService) {}

  private mapProductWriteError(error: unknown): never {
    const e = error as { code?: string; constraint?: string };
    if (e?.code === '23505') {
      if (e.constraint === 'products_sku_key') {
        throw new ConflictException('SKU already exists');
      }
      if (e.constraint === 'products_code_key') {
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

  async listBrands() {
    return (await this.db.query('SELECT * FROM brands ORDER BY name')).rows;
  }

  async createBrand(d: any) {
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.query(
      `INSERT INTO brands (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name
       RETURNING *`,
      [name],
    );
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async updateBrand(id: number, d: any) {
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.query('UPDATE brands SET name=$2 WHERE id=$1 RETURNING *', [id, name]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async deleteBrand(id: number) {
    const used = (await this.db.query('SELECT COUNT(*)::int AS c FROM products WHERE brand_id=$1', [id])).rows[0]?.c ?? 0;
    if (used > 0) throw new BadRequestException('Brand is used by products and cannot be deleted');
    const res = await this.db.query('DELETE FROM brands WHERE id=$1 RETURNING *', [id]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async listCategories() {
    return (await this.db.query('SELECT * FROM categories ORDER BY name')).rows;
  }

  async createCategory(d: any) {
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.query(
      `INSERT INTO categories (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name
       RETURNING *`,
      [name],
    );
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async updateCategory(id: number, d: any) {
    const old = (await this.db.query('SELECT * FROM categories WHERE id=$1', [id])).rows[0];
    if (!old) return null;
    const name = (d?.name ?? '').toString().trim();
    if (!name) return null;
    const res = await this.db.transaction(async (client) => {
      const upd = await client.query('UPDATE categories SET name=$2 WHERE id=$1 RETURNING *', [id, name]);
      await client.query('UPDATE products SET category=$2 WHERE category=$1', [old.name, name]);
      return upd.rows[0];
    });
    await this.cache.delPattern('products:*');
    return res;
  }

  async deleteCategory(id: number) {
    const cat = (await this.db.query('SELECT * FROM categories WHERE id=$1', [id])).rows[0];
    if (!cat) return null;
    const used = (await this.db.query('SELECT COUNT(*)::int AS c FROM products WHERE category=$1', [cat.name])).rows[0]?.c ?? 0;
    if (used > 0) throw new BadRequestException('Category is used by products and cannot be deleted');
    const res = await this.db.query('DELETE FROM categories WHERE id=$1 RETURNING *', [id]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async listProducts(search?: string) {
    const cacheKey = `products:${search||''}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;
    const vals = search ? [`%${search}%`] : [];
    const where = search ? 'WHERE p.name ILIKE $1 OR p.sku ILIKE $1 OR p.hsn_code ILIKE $1 OR p.code ILIKE $1 OR p.category ILIKE $1' : '';
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
  async getProduct(id: number) {
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
       WHERE p.id=$1`,
      [id],
    )).rows[0];
  }
  async createProduct(d: any) {
    const brandId = this.toNullableInt(d?.brand_id);
    const purchasePrice = Number(d?.purchase_price);
    const salePrice = Number(d?.sale_price);
    const gstRate = Number(d?.gst_rate);
    const lowStockAlert = Number(d?.low_stock_alert);
    let res;
    try {
      res = await this.db.query(
        'INSERT INTO products (name,code,sku,hsn_code,category,brand_id,description,unit,purchase_price,sale_price,image_url,gst_rate,low_stock_alert) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
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
        ],
      );
    } catch (error) {
      this.mapProductWriteError(error);
    }
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }
  async updateProduct(id: number, d: any) {
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
    vals.push(id);
    let res;
    try {
      res = await this.db.query(`UPDATE products SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    } catch (error) {
      this.mapProductWriteError(error);
    }
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async deleteProduct(id: number) {
    const res = await this.db.query('DELETE FROM products WHERE id=$1 RETURNING *', [id]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async setProductImage(id: number, imageUrl: string) {
    const res = await this.db.query('UPDATE products SET image_url=$2 WHERE id=$1 RETURNING *', [id, imageUrl]);
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }

  async listWarehouses() { return (await this.db.query('SELECT * FROM warehouses ORDER BY name')).rows; }
  async createWarehouse(d: any) {
    return (await this.db.query('INSERT INTO warehouses (name,location) VALUES ($1,$2) RETURNING *', [d.name, d.location])).rows[0];
  }

  async getStock(productId: number) {
    return (await this.db.query(
      `SELECT s.*,w.name AS warehouse_name FROM stock s JOIN warehouses w ON w.id=s.warehouse_id WHERE s.product_id=$1`, [productId]
    )).rows;
  }
  async listLowStock() {
    return (await this.db.query(
      `SELECT p.name,p.sku,p.low_stock_alert,COALESCE(SUM(s.quantity),0) AS total_stock
       FROM products p LEFT JOIN stock s ON s.product_id=p.id
       GROUP BY p.id HAVING COALESCE(SUM(s.quantity),0) <= p.low_stock_alert AND p.low_stock_alert > 0
       ORDER BY total_stock ASC`
    )).rows;
  }
  async adjustStock(d: { product_id: number; warehouse_id: number; type: string; quantity: number; note?: string; created_by: number }) {
    await this.db.transaction(async (client) => {
      const delta = d.type === 'out' ? -Math.abs(d.quantity) : Math.abs(d.quantity);
      await client.query(
        `INSERT INTO stock (product_id,warehouse_id,quantity) VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET quantity=stock.quantity+$3,updated_at=NOW()`,
        [d.product_id, d.warehouse_id, delta],
      );
      await client.query('INSERT INTO stock_movements (product_id,warehouse_id,type,quantity,note,created_by) VALUES ($1,$2,$3,$4,$5,$6)',
        [d.product_id, d.warehouse_id, d.type, Math.abs(d.quantity), d.note, d.created_by]);
    });
    await this.cache.delPattern('products:*');
  }
  async listMovements(productId?: number) {
    const cond = productId ? 'WHERE sm.product_id=$1' : '';
    const vals = productId ? [productId] : [];
    return (await this.db.query(
      `SELECT sm.*,p.name AS product_name,w.name AS warehouse_name FROM stock_movements sm
       JOIN products p ON p.id=sm.product_id JOIN warehouses w ON w.id=sm.warehouse_id
       ${cond} ORDER BY sm.created_at DESC LIMIT 200`, vals
    )).rows;
  }
}
