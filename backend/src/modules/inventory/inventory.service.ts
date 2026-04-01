import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService }    from '../../redis/redis.service';

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService, private readonly cache: RedisService) {}

  async listProducts(search?: string) {
    const cacheKey = `products:${search||''}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;
    const vals = search ? [`%${search}%`] : [];
    const where = search ? 'WHERE name ILIKE $1 OR sku ILIKE $1 OR hsn_code ILIKE $1' : '';
    const rows = (await this.db.query(`SELECT * FROM products ${where} ORDER BY name`, vals)).rows;
    await this.cache.set(cacheKey, rows, 300);
    return rows;
  }
  async getProduct(id: number) { return (await this.db.query('SELECT * FROM products WHERE id=$1', [id])).rows[0]; }
  async createProduct(d: any) {
    const res = await this.db.query(
      'INSERT INTO products (name,sku,hsn_code,description,unit,purchase_price,sale_price,gst_rate,low_stock_alert) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [d.name, d.sku, d.hsn_code, d.description, d.unit||'pcs', d.purchase_price||0, d.sale_price||0, d.gst_rate||0, d.low_stock_alert||0],
    );
    await this.cache.delPattern('products:*');
    return res.rows[0];
  }
  async updateProduct(id: number, d: any) {
    const fields = ['name','sku','hsn_code','description','unit','purchase_price','sale_price','gst_rate','low_stock_alert','is_active'];
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    for (const f of fields) { if(d[f]!==undefined){ sets.push(`${f}=$${i++}`); vals.push(d[f]); } }
    if(!sets.length) return null;
    vals.push(id);
    const res = await this.db.query(`UPDATE products SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
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
