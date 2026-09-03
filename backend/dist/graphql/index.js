import { createSchema, createYoga } from "graphql-yoga";
import { config } from "../config.js";
import { LabelService } from "../labels/LabelService.js";
import { TraceOrchestrationService } from "../services/TraceOrchestrationService.js";
import { resolvers } from "./resolvers.js";
import { typeDefs } from "./schema.js";
/**
 * Builds the GraphQL request handler.
 *
 * The orchestration and label services are injected rather than constructed here so REST
 * and GraphQL share one label cache and one Etherscan rate limiter.
 */
export function createGraphQLHandler(deps) {
    const yoga = createYoga({
        schema: createSchema({ typeDefs, resolvers }),
        graphqlEndpoint: config.graphql.path,
        graphiql: config.graphql.graphiql,
        context: () => deps,
        cors: false, // Express owns CORS for the whole app.
        landingPage: false,
        maskedErrors: false,
    });
    // Yoga's node handler takes (IncomingMessage, ServerResponse), which is what Express
    // hands us at runtime; the overload set just isn't assignable to Express's RequestHandler.
    const handle = yoga;
    return (req, res, next) => {
        handle(req, res).catch(next);
    };
}
export { LabelService, TraceOrchestrationService };
