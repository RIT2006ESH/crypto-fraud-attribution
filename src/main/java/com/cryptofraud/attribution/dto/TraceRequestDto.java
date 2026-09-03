package com.cryptofraud.attribution.dto;

import jakarta.validation.constraints.NotBlank;

/** Incoming trace request. chain defaults to "ethereum" if omitted. */
public record TraceRequestDto(
        @NotBlank(message = "walletAddress is required") String walletAddress,
        String chain,
        String caseId) {
}
