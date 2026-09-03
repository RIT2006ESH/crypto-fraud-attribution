package com.cryptofraud.attribution.chain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Pulls normal (ETH) transactions for an address from the Etherscan V2 API.
 * MVP scope: normal transactions only (action=txlist). ERC-20 token transfers
 * (USDT, etc.) would use action=tokentx — a later enhancement.
 *
 * Binds JSON into small records (no JsonNode) so the code doesn't depend on
 * Jackson's version-specific classes — safe under the Jackson 3 packaging in Spring Boot 4.
 */
@Component
public class EthereumChainClient implements ChainClient {

    private static final Logger log = LoggerFactory.getLogger(EthereumChainClient.class);
    private static final BigDecimal WEI_PER_ETH = new BigDecimal("1000000000000000000");

    private final RestClient restClient;
    private final String apiKey;

    public EthereumChainClient(
            RestClient.Builder restClientBuilder,
            @Value("${etherscan.base-url:https://api.etherscan.io/v2/api}") String baseUrl,
            @Value("${etherscan.api-key}") String apiKey) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
    }

    @Override
    public String chain() {
        return "ethereum";
    }

    @Override
    public List<ChainTransaction> getOutgoingTransactions(String address) {
        EtherscanResponse response;
        try {
            response = restClient.get()
                    .uri(uri -> uri
                            .queryParam("chainid", 1)          // Etherscan V2: 1 = Ethereum mainnet
                            .queryParam("module", "account")
                            .queryParam("action", "txlist")
                            .queryParam("address", address)
                            .queryParam("startblock", 0)
                            .queryParam("endblock", 99999999)
                            .queryParam("sort", "asc")
                            .queryParam("apikey", apiKey)
                            .build())
                    .retrieve()
                    .body(EtherscanResponse.class);
        } catch (Exception e) {
            // Covers network errors AND the Etherscan quirk where "result" comes back
            // as a String (e.g. "Max rate limit reached") instead of an array.
            log.warn("Etherscan call failed for {}: {}", address, e.getMessage());
            return List.of();
        }

        if (response == null || response.result() == null) {
            return List.of();
        }

        List<ChainTransaction> txs = new ArrayList<>();
        for (EtherscanTx tx : response.result()) {
            if (tx.from() == null || !tx.from().equalsIgnoreCase(address)) {
                continue;   // outgoing only: funds leaving this wallet
            }
            if ("1".equals(tx.isError())) {
                continue;   // skip reverted transactions
            }
            if (tx.to() == null || tx.to().isBlank()) {
                continue;   // contract creation, no recipient to follow
            }
            BigDecimal amountEth = new BigDecimal(tx.value() == null ? "0" : tx.value())
                    .divide(WEI_PER_ETH);
            if (amountEth.signum() == 0) {
                continue;   // zero-value tx, usually a contract call
            }
            long epochSeconds = tx.timeStamp() == null ? 0L : Long.parseLong(tx.timeStamp());
            txs.add(new ChainTransaction(
                    tx.hash(),
                    tx.from(),
                    tx.to(),
                    amountEth,
                    Instant.ofEpochSecond(epochSeconds),
                    "ethereum"));
        }
        return txs;
    }

    /* --- Minimal shapes of the Etherscan JSON we care about --- */

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record EtherscanResponse(String status, String message, List<EtherscanTx> result) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record EtherscanTx(
            String hash,
            String from,
            String to,
            String value,
            String timeStamp,
            String isError) {}
}
