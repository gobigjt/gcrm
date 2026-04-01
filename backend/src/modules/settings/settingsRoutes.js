import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./settingsController.js";

const router = express.Router();
router.use(authorize());

router.get("/company", ctrl.getSettings);
router.patch("/company", authorize(["Admin"]), ctrl.updateSettings);

router.get("/permissions", authorize(["Admin"]), ctrl.listPermissions);
router.post("/permissions", authorize(["Admin"]), ctrl.upsertPermission);

router.get("/audit-logs", authorize(["Admin"]), ctrl.getAuditLogs);

router.get("/dashboard", ctrl.getDashboardStats);

export default router;
