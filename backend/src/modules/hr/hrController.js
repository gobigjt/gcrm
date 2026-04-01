import * as model from "./hrModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

export const listEmployees  = wrap(async (req, res) => res.json({ employees: await model.listEmployees() }));
export const getEmployee    = wrap(async (req, res) => { const e=await model.getEmployee(Number(req.params.id)); e?res.json({employee:e}):res.status(404).json({message:"Not found"}); });
export const createEmployee = wrap(async (req, res) => {
  if(!req.body.employee_code) return res.status(400).json({message:"employee_code required"});
  res.status(201).json({employee: await model.createEmployee(req.body)});
});
export const updateEmployee = wrap(async (req, res) => { const e=await model.updateEmployee(Number(req.params.id),req.body); e?res.json({employee:e}):res.status(404).json({message:"Not found"}); });

export const markAttendance = wrap(async (req, res) => {
  if(!req.body.employee_id||!req.body.date) return res.status(400).json({message:"employee_id and date required"});
  res.json({attendance: await model.markAttendance(req.body)});
});
export const getAttendance = wrap(async (req, res) => {
  const { from, to } = req.query;
  res.json({attendance: await model.getAttendance({ employee_id: Number(req.params.id), from, to })});
});
export const getAttendanceSummary = wrap(async (req, res) => {
  const { from, to } = req.query;
  if(!from||!to) return res.status(400).json({message:"from and to required"});
  res.json({summary: await model.getAttendanceSummary({ from, to })});
});

export const listPayroll      = wrap(async (req, res) => {
  const { month, year } = req.query;
  if(!month||!year) return res.status(400).json({message:"month and year required"});
  res.json({payroll: await model.listPayroll({ month, year })});
});
export const createPayroll    = wrap(async (req, res) => {
  if(!req.body.employee_id||!req.body.month||!req.body.year) return res.status(400).json({message:"employee_id, month, year required"});
  res.status(201).json({payroll: await model.createPayrollEntry(req.body)});
});
export const processPayroll   = wrap(async (req, res) => res.json({payroll: await model.processPayroll(Number(req.params.id))}));
export const payPayroll       = wrap(async (req, res) => res.json({payroll: await model.payPayroll(Number(req.params.id))}));
