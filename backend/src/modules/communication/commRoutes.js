import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./commController.js";

const router = express.Router();
router.use(authorize());

router.get("/templates", ctrl.listTemplates);
router.post("/templates", ctrl.createTemplate);
router.patch("/templates/:id", ctrl.updateTemplate);
router.delete("/templates/:id", authorize(["Admin","Manager"]), ctrl.deleteTemplate);

router.get("/logs", ctrl.listLogs);
router.post("/logs", ctrl.createLog);

export default router;
