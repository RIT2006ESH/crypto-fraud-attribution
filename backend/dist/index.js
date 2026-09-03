import express from "express";
import cors from "cors";
import { config, assertConfig } from "./config.js";
import { initDatabase } from "./db/database.js";
import { createTraceRouter } from "./controllers/TraceController.js";
import { LabelService } from "./labels/LabelService.js";
import { KNOWN_ADDRESSES } from "./labels/knownAddresses.js";
import { TraceOrchestrationService } from "./services/TraceOrchestrationService.js";
import { createGraphQLHandler } from "./graphql/index.js";
console.log("Starting Crypto Fraud Attribution server...");
assertConfig();
initDatabase();
// One LabelService (and therefore one label cache) shared by REST and GraphQL.
const labelService = new LabelService();
const orchestrationService = new TraceOrchestrationService(labelService);
const app = express();
app.use(cors());
const graphqlHandler = createGraphQLHandler({ orchestrationService, labelService });
// Mounted before express.json(): Yoga parses its own request body.
app.use(config.graphql.path, graphqlHandler);
app.use(express.json());
app.use("/api/traces", createTraceRouter(orchestrationService));
app.get("/health", (_req, res) => {
    res.json({
        status: "UP",
        timestamp: new Date().toISOString(),
        etherscanConfigured: Boolean(config.etherscan.apiKey) && config.etherscan.apiKey !== "YourApiKeyToken",
        chainId: config.etherscan.chainId,
        labelRegistrySize: KNOWN_ADDRESSES.length,
    });
});
app.listen(config.port, () => {
    const base = `http://localhost:${config.port}`;
    console.log(`REST      ${base}/api/traces`);
    console.log(`GraphQL   ${base}${config.graphql.path}${config.graphql.graphiql ? "  (GraphiQL enabled)" : ""}`);
    console.log(`Labels    ${KNOWN_ADDRESSES.length} curated addresses + live Etherscan lookup`);
    console.log(`Etherscan chainid=${config.etherscan.chainId}, ${config.etherscan.rateLimitPerSec} calls/sec`);
});
