package com.cryptofraud.attribution.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "trace_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TraceRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "case_id")
    private String caseId;

    @Column(name = "wallet_address", nullable = false)
    private String walletAddress;

    @Column(nullable = false)
    private String chain;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TraceStatus status = TraceStatus.QUEUED;

    private Integer hopsTraced;

    private Integer riskScore;

    @Column(columnDefinition = "TEXT")
    private String flaggedPatterns; // stored as comma-separated for MVP; JSON column later if needed

    @Column(name = "requested_at", nullable = false)
    @Builder.Default
    private Instant requestedAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "failure_reason")
    private String failureReason;
}
