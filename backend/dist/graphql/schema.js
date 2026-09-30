/**
 * GraphQL schema for the attribution API.
 */
export const typeDefs = /* GraphQL */ `
  enum LabelType {
    EXCHANGE
    MIXER
    SANCTIONED
    UNLABELED
  }

  enum InvestigationStatus {
    IDLE
    VALIDATING
    QUEUED
    RUNNING
    PROCESSING
    COMPLETED
    PARTIAL
    FAILED
  }

  enum RiskCategory {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type GraphNode {
    id: ID!
    address: String!
    chain: String!
    entityName: String
    entityType: LabelType
    label: String
    hop: Int!
    isTarget: Boolean!
    isKnownEntity: Boolean!
    riskLevel: RiskCategory
    attributionConfidence: Float
    transferCount: Int
    incomingCount: Int
    outgoingCount: Int
  }

  type GraphEdge {
    id: ID!
    source: String!
    target: String!
    chain: String!
    asset: String
    assetType: String
    transferCount: Int!
    aggregateAmount: String!
    firstSeen: String
    lastSeen: String
    isKeyPath: Boolean
    riskLevel: RiskCategory
    transactionIds: [String!]!
  }

  type Graph {
    nodes: [GraphNode!]!
    edges: [GraphEdge!]!
  }

  type Investigation {
    id: ID!
    status: InvestigationStatus!
    metadata: InvestigationMetadata
    graph: Graph
    ledger: [TraceEdge!]!
    attribution: Attribution
    risk: Risk
    findings: [String!]!
    provenance: Provenance
  }

  type InvestigationMetadata {
    caseReference: String
    walletAddress: String!
    chain: String!
    requestedAt: String!
    completedAt: String
    failureReason: String
  }

  type Attribution {
    nearestExchange: NearestExchange
  }

  type NearestExchange {
    address: String!
    entity: String
    hopDepth: Int!
  }

  type Risk {
    score: Int
    category: RiskCategory
  }

  type Provenance {
    servedFromCache: Boolean!
    reportUrl: String!
  }

  "A single value-bearing transaction between two addresses in the trace."
  type TraceEdge {
    fromAddress: String!
    toAddress: String!
    txHash: String!
    amount: String!
    txTimestamp: String
    tokenSymbol: String
    tokenAddress: String
    transferType: String
  }

  type AddressLabel {
    address: String!
    chain: String!
    labelType: LabelType!
    entityName: String
    confidence: Float
    source: String
  }

  type Health {
    status: String!
    timestamp: String!
    etherscanConfigured: Boolean!
    chainId: Int!
    labelRegistrySize: Int!
  }

  type ChainInfo {
    id: String!
    name: String!
    nativeSymbol: String!
    tokens: [String!]!
    multi: Boolean
  }

  input TraceInput {
    walletAddress: String!
    chain: String = "all"
    caseId: String
  }

  type Query {
    investigation(id: ID!): Investigation
    addressLabel(address: String!, chain: String = "ethereum"): AddressLabel
    health: Health!
    chains: [ChainInfo!]!
  }

  type Mutation {
    submitInvestigation(input: TraceInput!): Investigation!
  }
`;
