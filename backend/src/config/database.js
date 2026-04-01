import pkg from "pg";
const { Pool } = pkg;
import config from "./index.js";

const pool = new Pool({ connectionString: config.databaseUrl });

export default {
  query: (text, params) => pool.query(text, params),
  pool
};
