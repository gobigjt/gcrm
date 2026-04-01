import * as model from "./productionModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

export const listBOMs  = wrap(async (req, res) => res.json({ boms: await model.listBOMs() }));
export const getBOM    = wrap(async (req, res) => { const b=await model.getBOM(Number(req.params.id)); b?res.json({bom:b}):res.status(404).json({message:"Not found"}); });
export const createBOM = wrap(async (req, res) => {
  const {items=[],...data}=req.body;
  if(!data.product_id||!data.name) return res.status(400).json({message:"product_id and name required"});
  res.status(201).json({bom: await model.createBOM(data,items)});
});

export const listWorkOrders  = wrap(async (req, res) => res.json({ work_orders: await model.listWorkOrders(req.query.status) }));
export const getWorkOrder    = wrap(async (req, res) => { const w=await model.getWorkOrder(Number(req.params.id)); w?res.json({work_order:w}):res.status(404).json({message:"Not found"}); });
export const createWorkOrder = wrap(async (req, res) => {
  if(!req.body.product_id||!req.body.quantity) return res.status(400).json({message:"product_id and quantity required"});
  res.status(201).json({work_order: await model.createWorkOrder({...req.body, created_by: req.user.id})});
});
export const updateWorkOrder = wrap(async (req, res) => { const w=await model.updateWorkOrder(Number(req.params.id),req.body); w?res.json({work_order:w}):res.status(404).json({message:"Not found"}); });
