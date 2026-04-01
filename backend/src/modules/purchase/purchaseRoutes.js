import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./purchaseController.js";

const router = express.Router();
router.use(authorize());

router.get("/vendors", ctrl.listVendors);
router.post("/vendors", ctrl.createVendor);
router.get("/vendors/:id", ctrl.getVendor);
router.patch("/vendors/:id", ctrl.updateVendor);

router.get("/pos", ctrl.listPOs);
router.post("/pos", ctrl.createPO);
router.get("/pos/:id", ctrl.getPO);
router.patch("/pos/:id", ctrl.patchPO);

router.get("/grns", ctrl.listGRNs);
router.post("/grns", ctrl.createGRN);
router.get("/grns/:id", ctrl.getGRN);

router.get("/invoices", ctrl.listPurchaseInvoices);
router.post("/invoices", ctrl.createPurchaseInvoice);

export default router;
