package com.cryptofraud.attribution.web;

import com.cryptofraud.attribution.dto.TraceRequestDto;
import com.cryptofraud.attribution.dto.TraceResultDto;
import com.cryptofraud.attribution.service.ReportService;
import com.cryptofraud.attribution.service.TraceOrchestrationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/traces")
public class TraceController {

    private final TraceOrchestrationService orchestrationService;
    private final ReportService reportService;

    public TraceController(TraceOrchestrationService orchestrationService, ReportService reportService) {
        this.orchestrationService = orchestrationService;
        this.reportService = reportService;
    }

    @PostMapping
    public ResponseEntity<TraceResultDto> submit(@Valid @RequestBody TraceRequestDto request) {
        return ResponseEntity.ok(orchestrationService.submit(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TraceResultDto> get(@PathVariable String id) {
        return orchestrationService.get(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/report")
    public ResponseEntity<byte[]> report(@PathVariable String id) {
        return orchestrationService.get(id)
                .map(result -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "attachment; filename=\"" + fileName(result) + "\"")
                        .contentType(MediaType.APPLICATION_PDF)
                        .body(reportService.render(result)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static String fileName(TraceResultDto result) {
        String ref = result.caseId() == null || result.caseId().isBlank()
                ? result.id() : result.caseId();
        return "attribution-" + ref.replaceAll("[^A-Za-z0-9._-]", "_") + ".pdf";
    }
}
