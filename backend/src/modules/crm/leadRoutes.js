import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./leadController.js";

const router = express.Router();
router.use(authorize());

router.get("/stages", ctrl.stages);
router.get("/sources", ctrl.sources);

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
