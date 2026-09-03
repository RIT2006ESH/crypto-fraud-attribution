import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { createContext } from "./context.js";
import cors from "cors";
import express from "express";
export async function setupGraphQLServer(app) {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
    });
    await server.start();
    const middleware = expressMiddleware(server, {
        context: createContext,
    });
    app.use("/graphql", cors(), express.json(), middleware);
    console.log("[GraphQL] Apollo Server mounted at /graphql");
}
