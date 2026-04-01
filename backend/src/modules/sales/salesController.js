import * as model from "./salesModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

// Customers
export const listCustomers = wrap(async (req, res) => res.json({ customers: await model.listCustomers(req.query.search) }));
export const getCustomer   = wrap(async (req, res) => { const c = await model.getCustomer(Number(req.params.id)); c ? res.json({ customer: c }) : res.status(404).json({ message: "Not found" }); });
export const createCustomer = wrap(async (req, res) => { if (!req.body.name) return res.status(400).json({ message: "Name required" }); res.status(201).json({ customer: await model.createCustomer(req.body) }); });
export const updateCustomer = wrap(async (req, res) => { const c = await model.updateCustomer(Number(req.params.id), req.body); c ? res.json({ customer: c }) : res.status(404).json({ message: "Not found" }); });

// Proposals
export const listProposals  = wrap(async (req, res) => res.json({ proposals: await model.listProposals() }));
export const getProposal    = wrap(async (req, res) => { const p = await model.getProposal(Number(req.params.id)); p ? res.json({ proposal: p }) : res.status(404).json({ message: "Not found" }); });
export const createProposal = wrap(async (req, res) => {
  const { items = [], ...data } = req.body;
  data.created_by = req.user.id;
  if (!data.customer_id) return res.status(400).json({ message: "customer_id required" });
  res.status(201).json({ proposal: await model.createProposal(data, items) });
});
export const patchProposal  = wrap(async (req, res) => { const p = await model.updateProposalStatus(Number(req.params.id), req.body.status); res.json({ proposal: p }); });

// Quotations
export const listQuotations  = wrap(async (req, res) => res.json({ quotations: await model.listQuotations() }));
export const getQuotation    = wrap(async (req, res) => { const q = await model.getQuotation(Number(req.params.id)); q ? res.json({ quotation: q }) : res.status(404).json({ message: "Not found" }); });
export const createQuotation = wrap(async (req, res) => {
  const { items = [], ...data } = req.body;
  data.created_by = req.user.id;
  if (!data.customer_id) return res.status(400).json({ message: "customer_id required" });
  res.status(201).json({ quotation: await model.createQuotation(data, items) });
});

// Orders
export const listOrders  = wrap(async (req, res) => res.json({ orders: await model.listOrders() }));
export const getOrder    = wrap(async (req, res) => { const o = await model.getOrder(Number(req.params.id)); o ? res.json({ order: o }) : res.status(404).json({ message: "Not found" }); });
export const createOrder = wrap(async (req, res) => {
  const { items = [], ...data } = req.body;
  data.created_by = req.user.id;
  if (!data.customer_id) return res.status(400).json({ message: "customer_id required" });
  res.status(201).json({ order: await model.createOrder(data, items) });
});
export const patchOrder = wrap(async (req, res) => { const o = await model.updateOrderStatus(Number(req.params.id), req.body.status); res.json({ order: o }); });

// Invoices
export const listInvoices  = wrap(async (req, res) => res.json({ invoices: await model.listInvoices() }));
export const getInvoice    = wrap(async (req, res) => { const inv = await model.getInvoice(Number(req.params.id)); inv ? res.json({ invoice: inv }) : res.status(404).json({ message: "Not found" }); });
export const createInvoice = wrap(async (req, res) => {
  const { items = [], ...data } = req.body;
  data.created_by = req.user.id;
  if (!data.customer_id) return res.status(400).json({ message: "customer_id required" });
  res.status(201).json({ invoice: await model.createInvoice(data, items) });
});

// Payments
export const addPayment = wrap(async (req, res) => {
  const data = { ...req.body, invoice_id: Number(req.params.id), created_by: req.user.id };
  if (!data.amount) return res.status(400).json({ message: "amount required" });
  res.status(201).json({ payment: await model.addPayment(data) });
});
