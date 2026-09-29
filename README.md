# Crypto Fraud Attribution

## Project Overview
The Crypto Fraud Attribution project is a full-stack application designed to trace and analyze cryptocurrency transactions, specifically aimed at identifying fraudulent activities. It visualizes the flow of funds across various addresses to help investigators pinpoint exchanges, mixers, sanctioned entities, and unlabelled wallets involved in suspicious transactions. The platform currently supports cross-chain analysis, specifically handling Ethereum and Tron networks, allowing investigators to submit traces and instantly view the resulting fund flow map, case facts, and risk assessments.

## Backend Architecture
The backend is built using Node.js and TypeScript, exposing both a REST API and a GraphQL interface via GraphQL Yoga. At its core, it integrates with major blockchain APIs like Etherscan and TronGrid to pull live transaction data. It utilizes a `TraceOrchestrationService` to construct the paths of funds and a `LabelService` that references a curated registry of known addresses (such as VASPs, exchanges, and sanctioned addresses) to enrich the trace data. The backend also incorporates a local SQLite database (via `better-sqlite3`) for robust data management and includes capabilities for exporting investigative reports to PDF using `pdfkit`.

## Frontend Application
The frontend is a modern single-page application crafted with React, Vite, and TypeScript. It features a sleek workspace layout that provides investigators with a centralized dashboard. The left sidebar contains a dynamic trace form for inputting addresses, along with responsive panels for displaying attribution results, a risk stamp, and detailed case facts. State management seamlessly coordinates loading states, error handling, and the active chain selection (Ethereum, Tron, or All Chains), ensuring a smooth and responsive user experience. 

## On-Chain Fund Flow Visualization
A standout feature of the working application is the interactive "On-Chain Fund Flow Map." Powered by `cytoscape.js` and `dagre`, this graph component renders complex transaction histories as highly readable directed graphs. The map uses a clear visual legend to distinguish between reported wallets, exchanges/VASPs, mixers, sanctioned addresses, and unlabelled wallets. Different edge styles represent various asset transfers, such as stablecoins versus native tokens. Users can interact with the graph nodes to set focus, which then dynamically updates a detailed Ledger view containing the specific transaction histories of the selected entity.

## Current Working State
As of now, the core tracing pipeline is fully implemented and operational. A user can start the frontend and backend servers, select a supported blockchain, and input a suspicious address. The backend successfully fetches live blockchain data, applies the curated labels, and orchestrates the trace data structure. The frontend immediately renders the results, drawing the fund flow map and populating the risk and attribution metrics. The application handles errors gracefully and provides a polished, professional interface for crypto forensic analysis.

## File Structure

```text
crypto-fraud-attribution/
├── backend/                  # Node.js backend application
│   ├── data/                 # SQLite database files
│   ├── src/
│   │   ├── chain/            # Chain-specific tracing logic (Ethereum, Tron)
│   │   ├── controllers/      # REST API route handlers
│   │   ├── db/               # Database initialization and queries
│   │   ├── graphql/          # GraphQL schema and resolvers
│   │   ├── labels/           # Address labeling and known registry
│   │   ├── services/         # Core business logic (TraceOrchestrationService)
│   │   ├── types/            # TypeScript type definitions
│   │   ├── util/             # Utility functions
│   │   ├── config.ts         # Application configuration (.env parsing)
│   │   └── index.ts          # Backend entry point
│   ├── package.json
│   └── tsconfig.json
└── frontend/                 # React + Vite frontend application
    ├── public/               # Static assets
    ├── src/
    │   ├── assets/           # Images, fonts, etc.
    │   ├── components/       # React components (FlowMap, Ledger, TraceForm, etc.)
    │   ├── api.ts            # Backend API communication layer
    │   ├── App.tsx           # Main React application component
    │   ├── index.css         # Global styles and design system
    │   ├── main.tsx          # Frontend entry point
    │   └── types.ts          # Shared TypeScript interfaces
    ├── package.json
    └── vite.config.ts
```