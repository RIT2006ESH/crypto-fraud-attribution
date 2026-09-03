package com.cryptofraud.attribution.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "address_labels", uniqueConstraints = @UniqueConstraint(columnNames = {"address", "chain"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddressLabel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private String chain;

    @Enumerated(EnumType.STRING)
    @Column(name = "label_type", nullable = false)
    private LabelType labelType;

    private String entityName;

    private String source;

    private Double confidence;

    public enum LabelType {
        EXCHANGE, MIXER, SANCTIONED, UNLABELED
    }
}
