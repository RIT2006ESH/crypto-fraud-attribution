import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { initDatabase } from "./db/database.js";
import { seedLabels } from "./bootstrap/LabelSeeder.js";
import { traceRouter } from "./controllers/TraceController.js";

console.log("Starting Crypto Fraud Attribution Node.js Server...");

// 1. Initialize DB tables
initDatabase();

// 2. Seed address labels
seedLabels();

// 3. Setup Express Server
const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/traces", traceRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "UP", timestamp: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`Crypto Fraud Attribution server running on http://localhost:${config.port}`);
});
