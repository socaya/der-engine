package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.network.NetworkTopologyService;

/** §2.2.7 Mesh topology — one combined view of DER + devices + peers + WAN
 *  for the admin UI's /network/mesh page. */
@RestController
@RequestMapping(path = "/edge-api/v1/network/mesh",
                produces = MediaType.APPLICATION_JSON_VALUE)
public class NetworkTopologyController {

    private final NetworkTopologyService svc;

    public NetworkTopologyController(final NetworkTopologyService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @GetMapping("/topology")
    public ResponseEntity<Map<String, Object>> topology() {
        return ResponseEntity.ok(svc.topology());
    }
}
