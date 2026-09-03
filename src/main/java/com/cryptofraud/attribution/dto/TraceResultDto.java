package com.cryptofraud.attribution.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record TraceResultDto(
        String id,
        String caseId,
        String walletAddress,
        String chain,
        String status,
        Integer hopsTraced,
        Integer riskScore,
        String riskCategory,
        String flaggedPatterns,
        Instant requestedAt,
        Instant completedAt,
        String failureReason,
        boolean servedFromCache,
        ExchangeDto nearestExchange,
        List<NodeDto> nodes,
        List<EdgeDto> edges) {

    public record NodeDto(String address, Integer hopDepth, String labelType, Double labelConfidence) {}
    public record EdgeDto(String fromAddress, String toAddress, String txHash, BigDecimal amount, Instant txTimestamp) {}
    public record ExchangeDto(String address, String entity, Integer hopDepth) {}
}
