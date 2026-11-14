package ug.ac.mak.der.network;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.device.DeviceAdjacencyService;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfigRepository;
import ug.ac.mak.der.network.NetworkEntities.ClientLink;
import ug.ac.mak.der.network.NetworkEntities.ClientTrust;
import ug.ac.mak.der.network.NetworkEntities.ConnectivityState;
import ug.ac.mak.der.network.NetworkEntities.NetworkClient;
import ug.ac.mak.der.network.NetworkEntities.NetworkStatus;

class NetworkTopologyServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-14T10:00:00Z");

    private NetworkClient client(final String deviceId,
                                    final ClientTrust trust,
                                    final String hostname,
                                    final String owner,
                                    final String ip) {
        return new NetworkClient(
                deviceId, UUID.randomUUID(), owner, hostname,
                ip, "aa:bb:cc:dd:ee:ff", ClientLink.wifi, -55,
                trust, "fp",
                0L, 0L,
                NOW.minusSeconds(3600), NOW.minusSeconds(30),
                null, trust == ClientTrust.APPROVED ? NOW.minusSeconds(60) : null,
                null);
    }

    private NetworkTopologyService svc(final List<NetworkClient> clients) {
        final NetworkCaService ca = mock(NetworkCaService.class);
        when(ca.fingerprint()).thenReturn("fp-der");
        final NetworkRepository repo = mock(NetworkRepository.class);
        when(repo.listPeers()).thenReturn(List.of());
        final NetworkService net = mock(NetworkService.class);
        when(net.listClients()).thenReturn(clients);
        when(net.listAllForTopology()).thenReturn(clients);
        when(net.status()).thenReturn(new NetworkStatus(
                ConnectivityState.CONNECTED,
                true, true, true, true, true,
                "192.168.50.1", "192.168.50.0/24", "der.local",
                NOW, List.of()));
        @SuppressWarnings("unchecked") final ObjectProvider<DeviceAdjacencyService> adj =
                mock(ObjectProvider.class);
        when(adj.getIfAvailable()).thenReturn(null);
        @SuppressWarnings("unchecked") final ObjectProvider<Dhis2ConnectionConfigRepository> dhis =
                mock(ObjectProvider.class);
        when(dhis.getIfAvailable()).thenReturn(null);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), org.mockito.ArgumentMatchers
                .eq(Long.class), org.mockito.ArgumentMatchers.<Object>any()))
                .thenReturn(0L);
        return new NetworkTopologyService(ca, repo, net, adj, dhis, jdbc);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> devicesOf(final Map<String, Object> topology) {
        return (List<Map<String, Object>>) topology.get("devices");
    }

    @Test
    void topologyOmitsNonApprovedDevices() {
        final NetworkTopologyService s = svc(List.of(
                client("d-pending", ClientTrust.PENDING, "phone-pending", null, "10.0.0.2"),
                client("d-revoked", ClientTrust.REVOKED, "phone-revoked", null, "10.0.0.3"),
                client("d-blocked", ClientTrust.BLOCKED, "phone-blocked", null, "10.0.0.4"),
                client("d-approved", ClientTrust.APPROVED, "clinic-tablet", null, "10.0.0.5")));
        final List<Map<String, Object>> devices = devicesOf(s.topology());
        assertThat(devices).hasSize(1);
        assertThat(devices.get(0).get("id")).isEqualTo("d-approved");
        assertThat(devices.get(0).get("deviceStatus")).isEqualTo("APPROVED");
    }

    @Test
    void approvedDeviceLabelUsesHostnameFirst() {
        final NetworkTopologyService s = svc(List.of(
                client("d1", ClientTrust.APPROVED, "clinic-tablet", "jane", "10.0.0.10")));
        assertThat(devicesOf(s.topology()).get(0).get("name"))
                .isEqualTo("clinic-tablet");
    }

    @Test
    void approvedDeviceLabelFallsBackToOwnerWhenHostnameBlank() {
        final NetworkTopologyService s = svc(List.of(
                client("d1", ClientTrust.APPROVED, "", "jane", "10.0.0.10")));
        assertThat(devicesOf(s.topology()).get(0).get("name")).isEqualTo("jane");
    }

    @Test
    void approvedDeviceLabelFallsBackToIpWhenHostnameAndOwnerBlank() {
        final NetworkTopologyService s = svc(List.of(
                client("d1", ClientTrust.APPROVED, null, null, "10.0.0.10")));
        assertThat(devicesOf(s.topology()).get(0).get("name")).isEqualTo("10.0.0.10");
    }

    @Test
    void approvedDeviceLabelFallsBackToUnnamedWhenAllMetadataAbsent() {
        final NetworkTopologyService s = svc(List.of(
                client("d1", ClientTrust.APPROVED, null, null, null)));
        assertThat(devicesOf(s.topology()).get(0).get("name"))
                .isEqualTo("Unnamed device");
    }

    @Test
    void summaryCountsReflectApprovedOnly() {
        final NetworkTopologyService s = svc(List.of(
                client("d-pending", ClientTrust.PENDING, "p", null, "10.0.0.2"),
                client("d-approved1", ClientTrust.APPROVED, "a1", null, "10.0.0.5"),
                client("d-approved2", ClientTrust.APPROVED, "a2", null, "10.0.0.6")));
        @SuppressWarnings("unchecked") final Map<String, Object> summary =
                (Map<String, Object>) s.topology().get("summary");
        assertThat(summary.get("devices")).isEqualTo(2);
    }
}
