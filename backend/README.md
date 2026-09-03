# CaseTrace Backend – Crypto Fraud Attribution Engine

> Production-ready Node.js, TypeScript, Express, Apollo GraphQL, SQLite, Etherscan V2 API, and PDFKit backend for the CaseTrace Cyber-Forensics Workstation.

---

## 🚀 Architectural Overview

CaseTrace Backend provides high-speed, bounded on-chain fund flow tracing, address entity attribution, rule-based risk scoring, Cytoscape-formatted GraphQL graph queries, and official PDF investigation reports.

```
                      ┌─────────────────────────────────┐
                      │   React + Cytoscape Frontend    │
                      └────────────────┬────────────────┘
                                       │
                      ┌────────────────┴────────────────┐
                      │    Express & Apollo Server      │
                      │     (http://localhost:8080)     │
                      └────────────────┬────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
  ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
  │  SQLite DB   │              │ Etherscan V2 │              │    PDFKit    │
  │ (better-sql) │              │  JSON API    │              │ Report Engine│
  └──────────────┘              └──────────────┘              └──────────────┘
```

---

## 📁 Directory Structure

```
backend/
├── data/
│   └── cryptofraud.sqlite         # SQLite database file (created automatically)
├── dist/                          # Compiled JavaScript production build
├── src/
│   ├── bootstrap/
│   │   └── LabelSeeder.ts         # Idempotent CSV label seeder on startup
│   ├── chain/
│   │   └── EthereumChainClient.ts # Etherscan V2 API client
│   ├── config/
│   │   └── index.ts               # Environment configuration
│   ├── controllers/
│   │   └── TraceController.ts     # Express REST endpoints & PDF download
│   ├── db/
│   │   ├── database.ts            # SQLite connection & table DDL
│   │   └── repositories/
│   │       ├── GraphRepository.ts # Node, edge & graph cache repository
│   │       ├── LabelRepository.ts # Address entity attribution repository
│   │       └── TraceRepository.ts # Trace request metadata repository
│   ├── graphql/
│   │   ├── context.ts             # GraphQL context initializer
│   │   ├── resolvers.ts           # Apollo query resolvers
│   │   ├── schema.ts              # GraphQL SDL schema
│   │   └── server.ts              # Apollo Server Express integration
│   ├── services/
│   │   ├── GraphService.ts        # Cytoscape graph formatter & cache manager
│   │   ├── ReportService.ts       # PDFKit forensic report renderer
│   │   ├── RiskScoringService.ts  # Explainable rule-based risk engine
│   │   ├── TraceOrchestrationService.ts # Investigation orchestrator
│   │   └── TraceService.ts        # Bounded BFS fund flow tracing engine
│   ├── types/
│   │   └── index.ts               # Shared TypeScript interfaces & DTOs
│   └── index.ts                   # Main server entrypoint
├── .env.example
├── package.json
├── seed-labels.csv                # Initial labeled address seed CSV
├── README.md                      # Backend documentation
└── tsconfig.json
```

---

## 🛠️ Installation & Setup

1. **Clone & Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment Variables Configuration**:
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *`.env` contents*:
   ```env
   PORT=8080
   ETHERSCAN_API_KEY=YourEtherscanApiKeyToken
   ETHERSCAN_BASE_URL=https://api.etherscan.io/v2/api
   TRACE_MAX_HOPS=4
   TRACE_MAX_NODES=300
   TRACE_MAX_TXS=2000
   TRACE_MAX_FANOUT=20
   TRACE_PREFER_CACHED=false
   LABELS_SEED_ON_STARTUP=true
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Build Production Bundle**:
   ```bash
   npm run build
   npm start
   ```

---

## 📡 API Reference

### 1. REST Endpoints

#### `POST /api/traces` – Create Investigation
- **Request**:
  ```json
  {
    "walletAddress": "0x28C6c06298d514Db089934071355E5743bf21d60",
    "chain": "ethereum",
    "caseId": "CASE-2026-901"
  }
  ```
- **Response**:
  ```json
  {
    "id": "6908e68a-b57f-471b-bbbd-00dd9de58d77",
    "caseId": "CASE-2026-901",
    "walletAddress": "0x28C6c06298d514Db089934071355E5743bf21d60",
    "chain": "ethereum",
    "status": "COMPLETED",
    "hopsTraced": 0,
    "riskScore": 0,
    "riskCategory": "LOW",
    "flaggedPatterns": "No high-risk patterns detected",
    "nearestExchange": {
      "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
      "entity": "Binance",
      "hopDepth": 0
    },
    "nodes": [...],
    "edges": [...]
  }
  ```

#### `GET /api/traces/:id` – Fetch Investigation Details
Returns status, hops traced, risk score, nodes, and edges.

#### `GET /api/traces/:id/report` – Download Investigation PDF Report
Returns a binary PDF document attachment (`Content-Type: application/pdf`).

---

### 2. Apollo GraphQL Endpoint (`POST /graphql`)

#### **Query 1: Fetch Cytoscape-Ready Trace Graph**
```graphql
query GetTraceGraph {
  trace(id: "6908e68a-b57f-471b-bbbd-00dd9de58d77") {
    id
    walletAddress
    chain
    status
    riskScore
    verdict {
      score
      level
      reasons
      nearestExchange
    }
    nodes {
      id
      address
      type
      hopDepth
      confidence
    }
    edges {
      id
      from
      to
      txHash
      amount
      timestamp
    }
  }
}
```

#### **Query 2: Query Entity Attribution for Address**
```graphql
query GetWalletEntity {
  wallet(address: "0x28C6c06298d514Db089934071355E5743bf21d60") {
    address
    labelType
    confidence
    entityName
  }
}
```

---

## 📊 Risk Engine Scoring Rules

| Risk Indicator | Score | Explanation |
| :--- | :--- | :--- |
| **Sanctioned Address** | +50 | Target or downstream node on OFAC/sanction list |
| **Mixer Detected** | +40 | Route through Tornado Cash or privacy tumbler |
| **Rapid Forwarding** | +20 | Consecutive transfers executed within 10 minutes |
| **Exchange Reached** | +15 | Cash-out deposit address detected at regulated entity |
| **Multi-Hop Layering** | +10 | Funds layered across 3+ hops before cash-out |

*Total score capped at 100.* Category bands: `CRITICAL` (>=75), `HIGH` (>=50), `MEDIUM` (>=25), `LOW` (<25).
