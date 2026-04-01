import express from "express";
import { authorize } from "../../middleware/authMiddleware.js";
import * as ctrl from "./inventoryController.js";

const router = express.Router();
router.use(authorize());

router.get("/products", ctrl.listProducts);
router.post("/products", ctrl.createProduct);
router.get("/products/:id", ctrl.getProduct);
router.patch("/products/:id", ctrl.updateProduct);
router.get("/products/:id/stock", ctrl.getStock);

router.get("/warehouses", ctrl.listWarehouses);
router.post("/warehouses", ctrl.createWarehouse);

router.get("/stock/low", ctrl.listLowStock);
router.post("/stock/adjust", ctrl.adjustStock);
router.get("/movements", ctrl.listMovements);

export default router;
