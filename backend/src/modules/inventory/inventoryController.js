import * as model from "./inventoryModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

export const listProducts  = wrap(async (req, res) => res.json({ products: await model.listProducts(req.query.search) }));
export const getProduct    = wrap(async (req, res) => { const p=await model.getProduct(Number(req.params.id)); p?res.json({product:p}):res.status(404).json({message:"Not found"}); });
export const createProduct = wrap(async (req, res) => { if(!req.body.name) return res.status(400).json({message:"Name required"}); res.status(201).json({product: await model.createProduct(req.body)}); });
export const updateProduct = wrap(async (req, res) => { const p=await model.updateProduct(Number(req.params.id),req.body); p?res.json({product:p}):res.status(404).json({message:"Not found"}); });

export const listWarehouses  = wrap(async (req, res) => res.json({ warehouses: await model.listWarehouses() }));
export const createWarehouse = wrap(async (req, res) => { if(!req.body.name) return res.status(400).json({message:"Name required"}); res.status(201).json({warehouse: await model.createWarehouse(req.body)}); });

export const getStock      = wrap(async (req, res) => res.json({ stock: await model.getStock(Number(req.params.id)) }));
export const listLowStock  = wrap(async (req, res) => res.json({ low_stock: await model.listLowStock() }));
export const adjustStock   = wrap(async (req, res) => {
  const {product_id,warehouse_id,type,quantity,note} = req.body;
  if(!product_id||!warehouse_id||!type||!quantity) return res.status(400).json({message:"product_id, warehouse_id, type, quantity required"});
  await model.adjustStock({product_id,warehouse_id,type,quantity,note,created_by:req.user.id});
  res.json({message:"Stock updated"});
});
export const listMovements = wrap(async (req, res) => res.json({ movements: await model.listMovements(req.query.product_id ? Number(req.query.product_id) : null) }));
