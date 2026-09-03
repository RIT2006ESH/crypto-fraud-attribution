package com.cryptofraud.attribution.repository;

import com.cryptofraud.attribution.entity.AddressLabel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AddressLabelRepository extends JpaRepository<AddressLabel, String> {

    Optional<AddressLabel> findByAddressIgnoreCaseAndChain(String address, String chain);

    List<AddressLabel> findByAddressInAndChain(List<String> addresses, String chain);
}
