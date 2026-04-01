import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import * as userModel from "../models/userModel.js";

function signToken(user) {
  const payload = { id: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: Number(config.jwtExpiresIn) });
}

export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });
    const exists = await userModel.findUserByEmail(email);
    if (exists) return res.status(409).json({ message: "User already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ name, email, password: hashed, role });
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Missing credentials" });
    const user = await userModel.findUserByEmail(email);
    if (!user) return res.status(401).json({ message: "Invalid email / password" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid email / password" });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: signToken(user) });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
}
