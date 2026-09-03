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
    "Native ETH as an exact decimal string; never a float."
    amount: String!
    txTimestamp: String
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
    "False when ETHERSCAN_API_KEY is missing — every trace will come back empty."
    etherscanConfigured: Boolean!
    chainId: Int!
    labelRegistrySize: Int!
  }

  input TraceInput {
    walletAddress: String!
    chain: String = "ethereum"
    caseId: String
  }

  type Query {
    "Fetch a previously submitted trace by id."
    trace(id: ID!): Trace
    "Look up what a single address is, without running a trace."
    addressLabel(address: String!, chain: String = "ethereum"): AddressLabel
    health: Health!
  }

  type Mutation {
    "Run a live trace against Etherscan and return the assembled result."
    submitTrace(input: TraceInput!): Trace!
  }
`;
