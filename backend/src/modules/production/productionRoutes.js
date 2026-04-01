import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./productionController.js";

const router = express.Router();
router.use(authorize());

router.get("/boms", ctrl.listBOMs);
router.post("/boms", ctrl.createBOM);
router.get("/boms/:id", ctrl.getBOM);

router.get("/work-orders", ctrl.listWorkOrders);
router.post("/work-orders", ctrl.createWorkOrder);
router.get("/work-orders/:id", ctrl.getWorkOrder);
router.patch("/work-orders/:id", ctrl.updateWorkOrder);

export default router;
