package com.cryptofraud.attribution.service;

import com.cryptofraud.attribution.dto.TraceRequestDto;
import com.cryptofraud.attribution.dto.TraceResultDto;
import com.cryptofraud.attribution.entity.*;
import com.cryptofraud.attribution.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class TraceOrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(TraceOrchestrationService.class);

    private final TraceService traceService;
    private final RiskScoringService riskScoringService;
    private final TraceRequestRepository traceRequestRepository;
    private final GraphNodeRepository graphNodeRepository;
    private final GraphEdgeRepository graphEdgeRepository;
    private final AddressLabelRepository addressLabelRepository;
    private final boolean preferCached;

    public TraceOrchestrationService(TraceService traceService,
                                     RiskScoringService riskScoringService,
                                     TraceRequestRepository traceRequestRepository,
                                     GraphNodeRepository graphNodeRepository,
                                     GraphEdgeRepository graphEdgeRepository,
                                     AddressLabelRepository addressLabelRepository,
                                     @Value("${trace.prefer-cached:false}") boolean preferCached) {
        this.traceService = traceService;
        this.riskScoringService = riskScoringService;
        this.traceRequestRepository = traceRequestRepository;
        this.graphNodeRepository = graphNodeRepository;
        this.graphEdgeRepository = graphEdgeRepository;
        this.addressLabelRepository = addressLabelRepository;
        this.preferCached = preferCached;
    }

    public TraceResultDto submit(TraceRequestDto input) {
        String chain = (input.chain() == null || input.chain().isBlank())
                ? "ethereum" : input.chain().toLowerCase();
        String address = input.walletAddress().trim();

        if (preferCached) {
            Optional<TraceResultDto> cached = replay(address, chain, null);
            if (cached.isPresent()) {
                log.info("Serving {} from cache (trace.prefer-cached=true)", address);
                return cached.get();
            }
        }

        TraceRequest request = TraceRequest.builder()
                .caseId(input.caseId())
                .walletAddress(address)
                .chain(chain)
                .status(TraceStatus.QUEUED)
                .build();
        request = traceRequestRepository.save(request);

        request = traceService.trace(request);   // synchronous for the demo

        List<GraphNode> nodes = graphNodeRepository.findByTraceId(request.getId());
        List<GraphEdge> edges = graphEdgeRepository.findByTraceId(request.getId());

        if (request.getStatus() == TraceStatus.COMPLETED) {
            RiskScoringService.Result risk = riskScoringService.score(request, nodes, edges);
            request.setRiskScore(risk.score());
            request.setFlaggedPatterns(String.join(" | ", risk.patterns()));
            request = traceRequestRepository.save(request);
        }

        boolean thin = request.getStatus() != TraceStatus.COMPLETED || nodes.size() <= 1;
        if (thin) {
            Optional<TraceResultDto> cached = replay(address, chain, request.getId());
            if (cached.isPresent()) {
                log.warn("Live trace of {} returned nothing usable; replaying last good trace", address);
                return cached.get();
            }
        }
        return assemble(request, nodes, edges, false);
    }

    public Optional<TraceResultDto> get(String id) {
        return traceRequestRepository.findById(id).map(req -> assemble(req,
                graphNodeRepository.findByTraceId(req.getId()),
                graphEdgeRepository.findByTraceId(req.getId()), false));
    }

    /** Most recent completed trace of the same address, excluding the one just attempted. */
    private Optional<TraceResultDto> replay(String address, String chain, String excludeId) {
        return traceRequestRepository
                .findByWalletAddressIgnoreCaseAndChainAndStatusIn(address, chain, List.of(TraceStatus.COMPLETED))
                .stream()
                .filter(r -> excludeId == null || !excludeId.equals(r.getId()))
                .max(Comparator.comparing(TraceRequest::getCompletedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(r -> assemble(r,
                        graphNodeRepository.findByTraceId(r.getId()),
                        graphEdgeRepository.findByTraceId(r.getId()), true))
                .filter(dto -> !dto.nodes().isEmpty());
    }

    private TraceResultDto assemble(TraceRequest request, List<GraphNode> nodes,
                                    List<GraphEdge> edges, boolean fromCache) {
        TraceResultDto.ExchangeDto nearest = nodes.stream()
                .filter(n -> n.getLabelType() == AddressLabel.LabelType.EXCHANGE)
                .min(Comparator.comparing(GraphNode::getHopDepth))
                .map(n -> new TraceResultDto.ExchangeDto(
                        n.getAddress(),
                        addressLabelRepository
                                .findByAddressIgnoreCaseAndChain(n.getAddress(), request.getChain())
                                .map(AddressLabel::getEntityName).orElse(null),
                        n.getHopDepth()))
                .orElse(null);

        List<TraceResultDto.NodeDto> nodeDtos = nodes.stream()
                .sorted(Comparator.comparing(GraphNode::getHopDepth))
                .map(n -> new TraceResultDto.NodeDto(
                        n.getAddress(), n.getHopDepth(),
                        n.getLabelType() == null ? null : n.getLabelType().name(),
                        n.getLabelConfidence()))
                .toList();

        List<TraceResultDto.EdgeDto> edgeDtos = edges.stream()
                .map(e -> new TraceResultDto.EdgeDto(
                        e.getFromAddress(), e.getToAddress(), e.getTxHash(),
                        e.getAmount(), e.getTxTimestamp()))
                .toList();

        return new TraceResultDto(
                request.getId(), request.getCaseId(), request.getWalletAddress(), request.getChain(),
                request.getStatus() == null ? null : request.getStatus().name(),
                request.getHopsTraced(), request.getRiskScore(),
                RiskScoringService.categorize(request.getRiskScore()),
                request.getFlaggedPatterns(), request.getRequestedAt(), request.getCompletedAt(),
                request.getFailureReason(), fromCache, nearest, nodeDtos, edgeDtos);
    }
}
