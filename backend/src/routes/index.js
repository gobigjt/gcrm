import express from "express";
import authRoutes        from "../modules/auth/authRoutes.js";
import leadRoutes        from "../modules/crm/leadRoutes.js";
import salesRoutes       from "../modules/sales/salesRoutes.js";
import purchaseRoutes    from "../modules/purchase/purchaseRoutes.js";
import inventoryRoutes   from "../modules/inventory/inventoryRoutes.js";
import productionRoutes  from "../modules/production/productionRoutes.js";
import financeRoutes     from "../modules/finance/financeRoutes.js";
import hrRoutes          from "../modules/hr/hrRoutes.js";
import commRoutes        from "../modules/communication/commRoutes.js";
import settingsRoutes    from "../modules/settings/settingsRoutes.js";

const router = express.Router();

router.get("/health", (req, res) => res.json({ status: "ok" }));

router.use("/auth",         authRoutes);
router.use("/crm/leads",    leadRoutes);
router.use("/sales",        salesRoutes);
router.use("/purchase",     purchaseRoutes);
router.use("/inventory",    inventoryRoutes);
router.use("/production",   productionRoutes);
router.use("/finance",      financeRoutes);
router.use("/hr",           hrRoutes);
router.use("/communication",commRoutes);
router.use("/settings",     settingsRoutes);

export default router;
