import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./salesController.js";

const router = express.Router();
router.use(authorize());

router.get("/customers", ctrl.listCustomers);
router.post("/customers", ctrl.createCustomer);
router.get("/customers/:id", ctrl.getCustomer);
router.patch("/customers/:id", ctrl.updateCustomer);

router.get("/proposals", ctrl.listProposals);
router.post("/proposals", ctrl.createProposal);
router.get("/proposals/:id", ctrl.getProposal);
router.patch("/proposals/:id", ctrl.patchProposal);

router.get("/quotations", ctrl.listQuotations);
router.post("/quotations", ctrl.createQuotation);
router.get("/quotations/:id", ctrl.getQuotation);

router.get("/orders", ctrl.listOrders);
router.post("/orders", ctrl.createOrder);
router.get("/orders/:id", ctrl.getOrder);
router.patch("/orders/:id", ctrl.patchOrder);

router.get("/invoices", ctrl.listInvoices);
router.post("/invoices", ctrl.createInvoice);
router.get("/invoices/:id", ctrl.getInvoice);
router.post("/invoices/:id/payments", ctrl.addPayment);

export default router;
