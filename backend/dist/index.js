import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { initDatabase } from "./db/database.js";
import { seedLabels } from "./bootstrap/LabelSeeder.js";
import { traceRouter } from "./controllers/TraceController.js";
import { setupGraphQLServer } from "./graphql/server.js";
async function startServer() {
    console.log("Starting CaseTrace Node.js + GraphQL Server...");
    // 1. Initialize SQLite database & tables
    initDatabase();
    // 2. Seed address labels
    seedLabels();
    // 3. Setup Express Application
    const app = express();
    app.use(cors());
    app.use(express.json());
    // REST API Routes
    app.use("/api/traces", traceRouter);
    // Health check endpoint
    app.get("/health", (req, res) => {
        res.json({ status: "UP", timestamp: new Date().toISOString() });
    });
    // 4. Setup Apollo GraphQL Server (/graphql)
    await setupGraphQLServer(app);
    app.listen(config.port, () => {
        console.log(`CaseTrace Server running on http://localhost:${config.port}`);
        console.log(`REST API: http://localhost:${config.port}/api/traces`);
        console.log(`GraphQL Endpoint: http://localhost:${config.port}/graphql`);
    });
}
startServer().catch((err) => {
    console.error("Failed to start CaseTrace server:", err);
    process.exit(1);
});
