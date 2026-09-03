package com.cryptofraud.attribution.chain;

import java.util.List;

/**
 * Abstraction over a blockchain data provider. One implementation per chain
 * (EthereumChainClient today; Bsc/Polygon later — the multi-chain roadmap item).
 */
public interface ChainClient {

    /** Chain identifier this client serves, e.g. "ethereum". Matches TraceRequest.chain. */
    String chain();

    /**
     * Outgoing value transfers from an address (funds LEAVING the wallet).
     * This is the direction we follow when tracing victim funds forward toward
     * a cash-out point (an exchange deposit address).
     */
    List<ChainTransaction> getOutgoingTransactions(String address);
}
