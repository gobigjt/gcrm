import * as model from "./settingsModel.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
};

export const getSettings    = wrap(async (req, res) => res.json({ settings: await model.getCompanySettings() }));
export const updateSettings = wrap(async (req, res) => res.json({ settings: await model.upsertCompanySettings(req.body) }));

export const listPermissions  = wrap(async (req, res) => res.json({ permissions: await model.listPermissions() }));
export const upsertPermission = wrap(async (req, res) => {
  if(!req.body.role||!req.body.module) return res.status(400).json({message:"role and module required"});
  res.json({permission: await model.upsertPermission(req.body)});
});

export const getAuditLogs = wrap(async (req, res) => res.json({ logs: await model.getAuditLogs(req.query) }));

// Dashboard stats
export const getDashboardStats = wrap(async (req, res) => {
  const db = (await import("../../config/database.js")).default;
  const [leads, invoices, orders, employees] = await Promise.all([
    db.query("SELECT COUNT(*) FROM leads WHERE is_converted=FALSE"),
    db.query("SELECT COALESCE(SUM(total_amount),0) AS revenue FROM invoices WHERE status='paid'"),
    db.query("SELECT COUNT(*) FROM sales_orders WHERE status NOT IN ('delivered','cancelled')"),
    db.query("SELECT COUNT(*) FROM employees WHERE is_active=TRUE"),
  ]);
  res.json({
    stats: {
      open_leads:     Number(leads.rows[0].count),
      revenue:        Number(invoices.rows[0].revenue),
      active_orders:  Number(orders.rows[0].count),
      total_employees:Number(employees.rows[0].count),
    }
  });
});
