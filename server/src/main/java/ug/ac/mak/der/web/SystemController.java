package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/edge-api/v1/system")
public class SystemController {
    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("service", "der-server", "status", "starter-ready", "timestamp", Instant.now().toString(), "dhis2Integrated", false);
    }
}
