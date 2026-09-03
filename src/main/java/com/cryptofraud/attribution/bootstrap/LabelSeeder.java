package com.cryptofraud.attribution.bootstrap;

import com.cryptofraud.attribution.entity.AddressLabel;
import com.cryptofraud.attribution.repository.AddressLabelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Loads the known exchange / mixer / sanctioned address list on startup.
 * Idempotent: an address already present for a chain is left untouched, so
 * editing the CSV and restarting only adds what is new.
 */
@Component
public class LabelSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LabelSeeder.class);
    private static final String CSV = "labels/seed-labels.csv";

    private final AddressLabelRepository repository;
    private final boolean enabled;

    public LabelSeeder(AddressLabelRepository repository,
                       @Value("${labels.seed-on-startup:true}") boolean enabled) {
        this.repository = repository;
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("Label seeding disabled");
            return;
        }
        ClassPathResource resource = new ClassPathResource(CSV);
        if (!resource.exists()) {
            log.warn("{} not found; every address will trace as UNLABELED", CSV);
            return;
        }

        int added = 0, skipped = 0, malformed = 0;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean header = true;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                if (header) { header = false; continue; }

                String[] c = line.split(",", -1);
                if (c.length < 4) { malformed++; continue; }

                String address = c[0].trim();
                String chain = c[1].trim().toLowerCase();
                if (repository.findByAddressIgnoreCaseAndChain(address, chain).isPresent()) {
                    skipped++;
                    continue;
                }
                try {
                    repository.save(AddressLabel.builder()
                            .address(address)
                            .chain(chain)
                            .labelType(AddressLabel.LabelType.valueOf(c[2].trim().toUpperCase()))
                            .entityName(c[3].trim())
                            .source(c.length > 4 ? c[4].trim() : "seed")
                            .confidence(c.length > 5 && !c[5].isBlank() ? Double.parseDouble(c[5].trim()) : 0.9)
                            .build());
                    added++;
                } catch (IllegalArgumentException e) {
                    malformed++;
                }
            }
        } catch (Exception e) {
            log.error("Label seeding aborted: {}", e.getMessage());
            return;
        }
        log.info("Labels seeded: {} added, {} already present, {} malformed", added, skipped, malformed);
    }
}
