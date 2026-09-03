import { traceOrchestrationService } from "../services/TraceOrchestrationService.js";
import { labelRepository } from "../db/repositories/index.js";
import { graphService } from "../services/GraphService.js";

export interface GraphQLContext {
  orchestrationService: typeof traceOrchestrationService;
  labelRepository: typeof labelRepository;
  graphService: typeof graphService;
}

export async function createContext(): Promise<GraphQLContext> {
  return {
    orchestrationService: traceOrchestrationService,
    labelRepository,
    graphService,
  };
}
