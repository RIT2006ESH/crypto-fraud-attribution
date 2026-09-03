package com.cryptofraud.attribution.chain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Chain-agnostic representation of a single value transfer.
 * Maps cleanly onto a GraphEdge once persisted.
 */
public record ChainTransaction(
        String txHash,
        String fromAddress,
        String toAddress,
        BigDecimal amount,   // native units (ETH), already converted from wei
        Instant timestamp,
        String chain
) {}
