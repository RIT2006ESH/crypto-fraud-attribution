/**
 * GraphQL schema for the attribution API.
 *
 * Mirrors the REST payloads one-for-one so the two front doors cannot drift:
 * both are served from TraceOrchestrationService and the same TraceResultDto.
 */
export const typeDefs = /* GraphQL */ `
  enum LabelType {
    EXCHANGE
    MIXER
    SANCTIONED
    UNLABELED
  }

  enum TraceStatus {
    QUEUED
    TRACING
    LABELING
    SCORING
    COMPLETED
    FAILED
  }

  enum RiskCategory {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  "An address that appeared in the traced money flow."
  type TraceNode {
    address: String!
    "0 for the reported wallet, incrementing by one per hop downstream."
    hopDepth: Int!
    labelType: LabelType
    labelConfidence: Float
  }

  "A single value-bearing transaction between two addresses in the trace."
  type TraceEdge {
    fromAddress: String!
    toAddress: String!
    txHash: String!
    "Amount as an exact decimal string (ETH, TRX, USDT, etc.). Never a float."
    amount: String!
    txTimestamp: String
    "Token symbol for ERC-20/TRC-20 transfers. Null for native ETH/TRX."
    tokenSymbol: String
    "Contract address of the transferred token. Null for native transfers."
    tokenAddress: String
    "How the value moved: native | erc20 | trc20."
    transferType: String
  }

  "The closest cash-out point found downstream of the reported wallet."
  type NearestExchange {
    address: String!
    entity: String
    hopDepth: Int!
  }

  type Trace {
    id: ID!
    caseId: String
    walletAddress: String!
    chain: String!
    status: TraceStatus
    hopsTraced: Int
    riskScore: Int
    riskCategory: RiskCategory
    "Human-readable findings, one per detected pattern."
    flaggedPatterns: [String!]!
    requestedAt: String!
    completedAt: String
    failureReason: String
    "True when the live trace produced nothing usable and an earlier trace was replayed."
    servedFromCache: Boolean!
    nearestExchange: NearestExchange
    nodes: [TraceNode!]!
    edges: [TraceEdge!]!
    "Downloadable PDF attribution report for this trace."
    reportUrl: String!
  }

  "Attribution for a single address, resolved from the registry or Etherscan."
  type AddressLabel {
    address: String!
    chain: String!
    labelType: LabelType!
    entityName: String
    confidence: Float
    "Where the attribution came from, e.g. registry:public-labels or etherscan:nametag."
    source: String
  }

  type Health {
    status: String!
    timestamp: String!
    "False when ETHERSCAN_API_KEY is missing — every ETH trace will come back empty."
    etherscanConfigured: Boolean!
    chainId: Int!
    labelRegistrySize: Int!
  }

  "Metadata for a supported blockchain network."
  type ChainInfo {
    "Chain identifier: 'ethereum', 'tron', or 'all' for the multi-chain meta entry."
    id: String!
    name: String!
    "Native coin symbol (ETH, TRX). Empty string for the 'all' meta entry."
    nativeSymbol: String!
    "Common token symbols tracked on this chain."
    tokens: [String!]!
    "True only for the 'all' meta entry that triggers a parallel multi-chain scan."
    multi: Boolean
  }

  input TraceInput {
    walletAddress: String!
    "Chain to trace: 'ethereum', 'tron', or 'all' (default) for parallel scan."
    chain: String = "all"
    caseId: String
  }

  type Query {
    "Fetch a previously submitted trace by id."
    trace(id: ID!): Trace
    "Look up what a single address is, without running a trace."
    addressLabel(address: String!, chain: String = "ethereum"): AddressLabel
    health: Health!
    "List of blockchain networks this system supports, for populating a chain picker."
    chains: [ChainInfo!]!
  }

  type Mutation {
    "Run a live trace and return the assembled result. Use chain='all' for multi-chain."
    submitTrace(input: TraceInput!): Trace!
  }
`;
