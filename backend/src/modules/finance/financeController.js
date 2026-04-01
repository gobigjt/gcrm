import * as model from "./financeModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

export const listAccounts  = wrap(async (req, res) => res.json({ accounts: await model.listAccounts() }));
export const createAccount = wrap(async (req, res) => {
  if(!req.body.code||!req.body.name||!req.body.type) return res.status(400).json({message:"code, name, type required"});
  res.status(201).json({account: await model.createAccount(req.body)});
});

export const listJournals  = wrap(async (req, res) => res.json({ journals: await model.listJournals(req.query) }));
export const getJournal    = wrap(async (req, res) => { const j=await model.getJournal(Number(req.params.id)); j?res.json({journal:j}):res.status(404).json({message:"Not found"}); });
export const createJournal = wrap(async (req, res) => {
  const {lines=[],...data}=req.body;
  data.created_by = req.user.id;
  if(!data.description) return res.status(400).json({message:"description required"});
  if(lines.length < 2) return res.status(400).json({message:"At least 2 journal lines required"});
  res.status(201).json({journal: await model.createJournal(data,lines)});
});

export const listExpenses  = wrap(async (req, res) => res.json({ expenses: await model.listExpenses(req.query) }));
export const createExpense = wrap(async (req, res) => {
  if(!req.body.amount) return res.status(400).json({message:"amount required"});
  res.status(201).json({expense: await model.createExpense({...req.body, created_by: req.user.id})});
});

export const getPLReport = wrap(async (req, res) => {
  const { from, to } = req.query;
  if(!from||!to) return res.status(400).json({message:"from and to dates required"});
  res.json({ report: await model.getPLReport({ from, to }) });
});

export const getLedger = wrap(async (req, res) => {
  const { from, to } = req.query;
  if(!from||!to) return res.status(400).json({message:"from and to dates required"});
  res.json({ ledger: await model.getLedger(Number(req.params.id), { from, to }) });
});
