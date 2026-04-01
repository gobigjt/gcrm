import * as model from "./commModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

export const listTemplates  = wrap(async (req, res) => res.json({ templates: await model.listTemplates() }));
export const createTemplate = wrap(async (req, res) => {
  if(!req.body.name||!req.body.channel||!req.body.body) return res.status(400).json({message:"name, channel, body required"});
  res.status(201).json({template: await model.createTemplate(req.body)});
});
export const updateTemplate = wrap(async (req, res) => res.json({template: await model.updateTemplate(Number(req.params.id), req.body)}));
export const deleteTemplate = wrap(async (req, res) => { await model.deleteTemplate(Number(req.params.id)); res.json({message:"Deleted"}); });

export const listLogs  = wrap(async (req, res) => res.json({ logs: await model.listLogs(req.query) }));
export const createLog = wrap(async (req, res) => {
  if(!req.body.channel||!req.body.recipient) return res.status(400).json({message:"channel and recipient required"});
  res.status(201).json({log: await model.createLog({...req.body, sent_by: req.user.id})});
});
