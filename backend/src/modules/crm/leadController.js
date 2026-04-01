import * as model from "./leadModel.js";

// ─── Leads ────────────────────────────────────────────────
export async function index(req, res) {
  try {
    const leads = await model.listLeads(req.query);
    res.json({ leads });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function show(req, res) {
  try {
    const lead = await model.getLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function create(req, res) {
  try {
    if (!req.body.name) return res.status(400).json({ message: "Name is required" });
    const lead = await model.createLead(req.body);
    res.status(201).json({ lead });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function update(req, res) {
  try {
    const lead = await model.updateLead(Number(req.params.id), req.body);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function remove(req, res) {
  try {
    await model.deleteLead(Number(req.params.id));
    res.json({ message: "Lead deleted" });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

// ─── Stages & Sources ─────────────────────────────────────
export async function stages(req, res) {
  try { res.json({ stages: await model.listStages() }); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function sources(req, res) {
  try { res.json({ sources: await model.listSources() }); }
  catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

// ─── Activities ───────────────────────────────────────────
export async function getActivities(req, res) {
  try {
    const activities = await model.listActivities(Number(req.params.id));
    res.json({ activities });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function addActivity(req, res) {
  try {
    const { type, description } = req.body;
    if (!type || !description) return res.status(400).json({ message: "type and description required" });
    const activity = await model.createActivity({
      lead_id: Number(req.params.id),
      user_id: req.user.id,
      type,
      description,
    });
    res.status(201).json({ activity });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

// ─── Follow-ups ────────────────────────────────────────────
export async function getFollowups(req, res) {
  try {
    const followups = await model.listFollowups(Number(req.params.id));
    res.json({ followups });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function addFollowup(req, res) {
  try {
    const { due_date, description, assigned_to } = req.body;
    if (!due_date) return res.status(400).json({ message: "due_date required" });
    const followup = await model.createFollowup({
      lead_id: Number(req.params.id),
      assigned_to: assigned_to || req.user.id,
      due_date,
      description,
    });
    res.status(201).json({ followup });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}

export async function doneFollowup(req, res) {
  try {
    const followup = await model.updateFollowup(Number(req.params.fid), { is_done: true });
    res.json({ followup });
  } catch (err) { console.error(err); res.status(500).json({ message: "Internal server error" }); }
}
