import { traceOrchestrationService } from "../services/TraceOrchestrationService.js";
import { labelRepository } from "../db/repositories/index.js";
import { graphService } from "../services/GraphService.js";
export async function createContext() {
    return {
        orchestrationService: traceOrchestrationService,
        labelRepository,
        graphService,
    };
}
