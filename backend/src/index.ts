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

// Mount the trace router — also exposes GET /api/traces/chains
app.use("/api/traces", createTraceRouter(orchestrationService));

// Top-level alias: GET /api/chains (more discoverable for frontend consumers)
app.get("/api/chains", (_req, res) => {
  res.json(config.supportedChains);
});

app.get("/health", (_req, res) => {
  res.json({
    status: "UP",
    timestamp: new Date().toISOString(),
    etherscanConfigured: Boolean(config.etherscan.apiKey) && config.etherscan.apiKey !== "YourApiKeyToken",
    tronGridConfigured: Boolean(config.tronGrid.apiKey),
    chainId: config.etherscan.chainId,
    supportedChains: config.supportedChains.filter((c) => !c.multi).map((c) => c.id),
    labelRegistrySize: KNOWN_ADDRESSES.length,
  });
});

app.listen(config.port, () => {
  const base = `http://localhost:${config.port}`;
  const chains = config.supportedChains.filter((c) => !c.multi).map((c) => c.id).join(", ");
  console.log(`REST      ${base}/api/traces`);
  console.log(`Chains    ${base}/api/chains  (${chains})`);
  console.log(`GraphQL   ${base}${config.graphql.path}${config.graphql.graphiql ? "  (GraphiQL enabled)" : ""}`);
  console.log(`Labels    ${KNOWN_ADDRESSES.length} curated addresses (ETH + Tron) + live Etherscan lookup`);
  console.log(`Etherscan chainid=${config.etherscan.chainId}, ${config.etherscan.rateLimitPerSec} calls/sec`);
  console.log(`TronGrid  ${config.tronGrid.apiKey ? "key configured" : "public (no key)"}, ${config.tronGrid.rateLimitPerSec} calls/sec`);
});
