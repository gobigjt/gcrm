import jwt from "jsonwebtoken";
import config from "../config/index.js";

export function authorize(roles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token" });
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = payload;
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }
  };
}
