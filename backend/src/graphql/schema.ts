export const typeDefs = `#graphql
  type Query {
    trace(id: ID!): Trace
    wallet(address: String!): Wallet
  }

  type Verdict {
    score: Int!
    level: String!
    reasons: [String!]!
    nearestExchange: String
  }

  type Wallet {
    address: String!
    labelType: String
    confidence: Float
    entityName: String
  }

  type Trace {
    id: ID!
    walletAddress: String!
    chain: String!
    status: String!
    riskScore: Int!
    verdict: Verdict
    nodes: [GraphNode!]!
    edges: [GraphEdge!]!
  }

  type GraphNode {
    id: ID!
    address: String!
    type: String!
    hopDepth: Int!
    confidence: Float
  }

  type GraphEdge {
    id: ID!
    from: String!
    to: String!
    txHash: String!
    amount: String!
    timestamp: String!
  }
`;
