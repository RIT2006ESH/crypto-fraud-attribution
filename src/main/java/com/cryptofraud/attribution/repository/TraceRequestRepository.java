package com.cryptofraud.attribution.repository;

import com.cryptofraud.attribution.entity.TraceRequest;
import com.cryptofraud.attribution.entity.TraceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TraceRequestRepository extends JpaRepository<TraceRequest, String> {

    Optional<TraceRequest> findByWalletAddressIgnoreCaseAndChainAndStatusIn(
            String walletAddress, String chain, java.util.List<TraceStatus> statuses);
}
