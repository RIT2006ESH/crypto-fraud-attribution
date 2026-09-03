import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { createContext, GraphQLContext } from "./context.js";
import { Express, RequestHandler } from "express";
import cors from "cors";
import express from "express";

export async function setupGraphQLServer(app: Express) {
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
  });

  await server.start();

  const middleware = expressMiddleware(server, {
    context: createContext,
  }) as unknown as RequestHandler;

  app.use("/graphql", cors<cors.CorsRequest>(), express.json(), middleware);

  console.log("[GraphQL] Apollo Server mounted at /graphql");
}
