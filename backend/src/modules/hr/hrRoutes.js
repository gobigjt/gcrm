import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./hrController.js";

const router = express.Router();
router.use(authorize(["Admin","HR","Manager"]));

router.get("/employees", ctrl.listEmployees);
router.post("/employees", ctrl.createEmployee);
router.get("/employees/:id", ctrl.getEmployee);
router.patch("/employees/:id", ctrl.updateEmployee);
router.get("/employees/:id/attendance", ctrl.getAttendance);

router.post("/attendance", ctrl.markAttendance);
router.get("/attendance/summary", ctrl.getAttendanceSummary);

router.get("/payroll", ctrl.listPayroll);
router.post("/payroll", ctrl.createPayroll);
router.patch("/payroll/:id/process", ctrl.processPayroll);
router.patch("/payroll/:id/pay", ctrl.payPayroll);

export default router;
