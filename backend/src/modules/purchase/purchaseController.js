import * as model from "./purchaseModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

export const listVendors  = wrap(async (req, res) => res.json({ vendors: await model.listVendors(req.query.search) }));
export const getVendor    = wrap(async (req, res) => { const v=await model.getVendor(Number(req.params.id)); v ? res.json({vendor:v}) : res.status(404).json({message:"Not found"}); });
export const createVendor = wrap(async (req, res) => { if(!req.body.name) return res.status(400).json({message:"Name required"}); res.status(201).json({vendor: await model.createVendor(req.body)}); });
export const updateVendor = wrap(async (req, res) => { const v=await model.updateVendor(Number(req.params.id),req.body); v ? res.json({vendor:v}) : res.status(404).json({message:"Not found"}); });

export const listPOs  = wrap(async (req, res) => res.json({ pos: await model.listPOs() }));
export const getPO    = wrap(async (req, res) => { const p=await model.getPO(Number(req.params.id)); p ? res.json({po:p}) : res.status(404).json({message:"Not found"}); });
export const createPO = wrap(async (req, res) => {
  const {items=[],...data} = req.body;
  data.created_by = req.user.id;
  if(!data.vendor_id) return res.status(400).json({message:"vendor_id required"});
  res.status(201).json({po: await model.createPO(data, items)});
});
export const patchPO  = wrap(async (req, res) => res.json({po: await model.updatePOStatus(Number(req.params.id), req.body.status)}));

export const listGRNs  = wrap(async (req, res) => res.json({ grns: await model.listGRNs() }));
export const getGRN    = wrap(async (req, res) => { const g=await model.getGRN(Number(req.params.id)); g ? res.json({grn:g}) : res.status(404).json({message:"Not found"}); });
export const createGRN = wrap(async (req, res) => {
  const {items=[],...data} = req.body;
  data.created_by = req.user.id;
  if(!data.po_id) return res.status(400).json({message:"po_id required"});
  res.status(201).json({grn: await model.createGRN(data, items)});
});

export const listPurchaseInvoices  = wrap(async (req, res) => res.json({ invoices: await model.listPurchaseInvoices() }));
export const createPurchaseInvoice = wrap(async (req, res) => {
  if(!req.body.vendor_id || !req.body.invoice_number) return res.status(400).json({message:"vendor_id and invoice_number required"});
  res.status(201).json({invoice: await model.createPurchaseInvoice(req.body)});
});
