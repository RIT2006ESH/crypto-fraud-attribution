package com.cryptofraud.attribution.repository;

import com.cryptofraud.attribution.entity.GraphNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GraphNodeRepository extends JpaRepository<GraphNode, String> {
    List<GraphNode> findByTraceId(String traceId);
}
