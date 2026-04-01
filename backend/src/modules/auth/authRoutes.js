import express from "express";
import { register, login, me, listUsers, updateUser } from "./authController.js";
import { authorize } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authorize(), me);
router.get("/users", authorize(["Admin"]), listUsers);
router.patch("/users/:id", authorize(["Admin"]), updateUser);

export default router;
