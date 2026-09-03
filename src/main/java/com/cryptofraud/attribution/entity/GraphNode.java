package com.cryptofraud.attribution.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "graph_nodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GraphNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "trace_id", nullable = false)
    private String traceId;

    @Column(nullable = false)
    private String address;

    @Column(name = "hop_depth", nullable = false)
    private Integer hopDepth;

    @Enumerated(EnumType.STRING)
    @Column(name = "label_type")
    private AddressLabel.LabelType labelType;

    @Column(name = "label_confidence")
    private Double labelConfidence;

    @Builder.Default
    @Column(name = "partial_data")
    private Boolean partialData = false;
}
