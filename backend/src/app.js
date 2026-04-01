import express from "express";
import morgan from "morgan";
import cors from "cors";
import routes from "./routes/index.js";
import config from "./config/index.js";
import db from "./config/database.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api", routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const start = async () => {
  try {
    await db.query('SELECT 1');
    console.log("Database connected");
    app.listen(config.port, () => console.log(`Server listening on port ${config.port}`));
  } catch (err) {
    console.error("Database connection failed", err);
    process.exit(1);
  }
};

start();
