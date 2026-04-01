import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./financeController.js";

const router = express.Router();
router.use(authorize(["Admin","Accountant"]));

router.get("/accounts", ctrl.listAccounts);
router.post("/accounts", ctrl.createAccount);

router.get("/journals", ctrl.listJournals);
router.post("/journals", ctrl.createJournal);
router.get("/journals/:id", ctrl.getJournal);

router.get("/expenses", ctrl.listExpenses);
router.post("/expenses", ctrl.createExpense);

router.get("/reports/pl", ctrl.getPLReport);
router.get("/accounts/:id/ledger", ctrl.getLedger);

export default router;
