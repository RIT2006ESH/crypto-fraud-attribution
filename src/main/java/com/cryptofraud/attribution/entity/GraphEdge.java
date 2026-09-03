package com.cryptofraud.attribution.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "graph_edges")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GraphEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "trace_id", nullable = false)
    private String traceId;

    @Column(name = "from_address", nullable = false)
    private String fromAddress;

    @Column(name = "to_address", nullable = false)
    private String toAddress;

    @Column(name = "tx_hash", nullable = false)
    private String txHash;

    @Column(precision = 38, scale = 18)
    private BigDecimal amount;

    @Column(name = "tx_timestamp")
    private Instant txTimestamp;
}
