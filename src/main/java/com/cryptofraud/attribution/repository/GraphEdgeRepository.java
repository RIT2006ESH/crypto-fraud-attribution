package com.cryptofraud.attribution.repository;

import com.cryptofraud.attribution.entity.GraphEdge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GraphEdgeRepository extends JpaRepository<GraphEdge, String> {
    List<GraphEdge> findByTraceId(String traceId);
}
