import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./leadController.js";

const router = express.Router();
router.use(authorize());

router.get("/stages", ctrl.stages);
router.get("/sources", ctrl.sources);

// ─── Masters ──────────────────────────────────────────────
router.get("/masters/sources",        ctrl.listMasterSources);
router.post("/masters/sources",       authorize(["Admin"]), ctrl.createMasterSource);
router.patch("/masters/sources/:id",  authorize(["Admin"]), ctrl.updateMasterSource);
router.delete("/masters/sources/:id", authorize(["Admin"]), ctrl.removeMasterSource);

router.get("/masters/segments",       ctrl.listSegments);
router.post("/masters/segments",      authorize(["Admin"]), ctrl.createSegment);
router.patch("/masters/segments/:id", authorize(["Admin"]), ctrl.updateSegment);
router.delete("/masters/segments/:id",authorize(["Admin"]), ctrl.removeSegment);

router.get("/masters/priorities",       ctrl.listPriorities);
router.post("/masters/priorities",      authorize(["Admin"]), ctrl.createPriority);
router.patch("/masters/priorities/:id", authorize(["Admin"]), ctrl.updatePriority);
router.delete("/masters/priorities/:id",authorize(["Admin"]), ctrl.removePriority);

router.get("/", ctrl.index);
router.post("/", ctrl.create);
router.get("/:id", ctrl.show);
router.patch("/:id", ctrl.update);
router.delete("/:id", authorize(["Admin","Manager"]), ctrl.remove);

router.get("/:id/activities", ctrl.getActivities);
router.post("/:id/activities", ctrl.addActivity);

router.get("/:id/followups", ctrl.getFollowups);
router.post("/:id/followups", ctrl.addFollowup);
router.patch("/:id/followups/:fid/done", ctrl.doneFollowup);

export default router;
