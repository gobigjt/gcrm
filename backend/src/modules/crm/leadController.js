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

// ─── CRM Masters ──────────────────────────────────────────

function masterController(masterModel, key) {
  return {
    async list(req, res) {
      try { res.json(await masterModel.list()); }
      catch (err) { console.error(err); res.status(500).json({ message: 'Internal server error' }); }
    },
    async create(req, res) {
      try {
        const { name, color } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
        const extra = color !== undefined ? { color } : {};
        const row = await masterModel.create(name.trim(), extra);
        res.status(201).json(row);
      } catch (err) { console.error(err); res.status(500).json({ message: 'Internal server error' }); }
    },
    async update(req, res) {
      try {
        const { name, color } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
        const extra = color !== undefined ? { color } : {};
        const row = await masterModel.update(Number(req.params.id), name.trim(), extra);
        if (!row) return res.status(404).json({ message: 'Not found' });
        res.json(row);
      } catch (err) { console.error(err); res.status(500).json({ message: 'Internal server error' }); }
    },
    async remove(req, res) {
      try {
        await masterModel.remove(Number(req.params.id));
        res.json({ message: 'Deleted' });
      } catch (err) { console.error(err); res.status(500).json({ message: 'Internal server error' }); }
    },
  };
}

const _sources    = masterController(model.sourcesMaster,    'sources');
const _segments   = masterController(model.segmentsMaster,   'segments');
const _priorities = masterController(model.prioritiesMaster, 'priorities');

export const listMasterSources  = _sources.list.bind(_sources);
export const createMasterSource = _sources.create.bind(_sources);
export const updateMasterSource = _sources.update.bind(_sources);
export const removeMasterSource = _sources.remove.bind(_sources);

export const listSegments     = _segments.list.bind(_segments);
export const createSegment    = _segments.create.bind(_segments);
export const updateSegment    = _segments.update.bind(_segments);
export const removeSegment    = _segments.remove.bind(_segments);

export const listPriorities   = _priorities.list.bind(_priorities);
export const createPriority   = _priorities.create.bind(_priorities);
export const updatePriority   = _priorities.update.bind(_priorities);
export const removePriority   = _priorities.remove.bind(_priorities);

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
