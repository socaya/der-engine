package ug.ac.mak.der.device;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import ug.ac.mak.der.network.NetworkEntities;
import ug.ac.mak.der.network.NetworkEntities.ClientLink;
import ug.ac.mak.der.network.NetworkEntities.ClientTrust;
import ug.ac.mak.der.network.NetworkRepository;

@ExtendWith(MockitoExtension.class)
class UnifiedDeviceServiceTest {

    @Mock DeviceService fleetSvc;
    @Mock NetworkRepository networkRepo;

    private final Instant NOW = Instant.parse("2026-11-10T10:00:00Z");

    private EdgeDevice fleetRow(final UUID id, final String name,
                                  final EdgeDevice.Status status) {
        return new EdgeDevice(id, UUID.randomUUID(), null,
                NOW, null, null, NOW, "Mozilla/UA", "fw",
                status, name, EdgeDevice.FormFactor.LAPTOP);
    }

    private NetworkEntities.NetworkClient lanRow(final String deviceId,
                                                   final UUID derId,
                                                   final String hostname,
                                                   final String ip,
                                                   final ClientTrust trust) {
        return new NetworkEntities.NetworkClient(
                deviceId, derId, "alice", hostname, ip, "aa:bb:cc:dd:ee:ff",
                ClientLink.wifi, -55, trust, "fp",
                0L, 0L, NOW, NOW, null, null, null, null);
    }

    @Test
    void mergesWhenDerDeviceIdMatches() {
        final UUID fleetId = UUID.randomUUID();
        when(fleetSvc.list()).thenReturn(List.of(
                fleetRow(fleetId, "Workstation A", EdgeDevice.Status.APPROVED)));
        when(networkRepo.listClients()).thenReturn(List.of(
                lanRow("wa-01", fleetId, "wa-01.lan", "10.0.0.5", ClientTrust.APPROVED)));

        final List<UnifiedDeviceService.UnifiedDevice> out =
                new UnifiedDeviceService(fleetSvc, networkRepo).list();

        assertThat(out).hasSize(1);
        final UnifiedDeviceService.UnifiedDevice u = out.get(0);
        assertThat(u.sources).containsExactlyInAnyOrder("DHIS2_FLEET", "LAN_CLIENT");
        assertThat(u.displayName).isEqualTo("Workstation A");
        assertThat(u.ip).isEqualTo("10.0.0.5");
        assertThat(u.mac).isEqualTo("aa:bb:cc:dd:ee:ff");
        assertThat(u.owner).isEqualTo("alice");
    }

    @Test
    void preservesFleetOnlyDevice() {
        // SM-1 scenario: browser at localhost:5174 registers in
        // edge_device but never appears in network_client. Must still
        // be visible in the unified view (previous bug: it was hidden).
        final UUID fleetId = UUID.randomUUID();
        when(fleetSvc.list()).thenReturn(List.of(
                fleetRow(fleetId, "Browser session", EdgeDevice.Status.PENDING)));
        when(networkRepo.listClients()).thenReturn(List.of());

        final List<UnifiedDeviceService.UnifiedDevice> out =
                new UnifiedDeviceService(fleetSvc, networkRepo).list();

        assertThat(out).hasSize(1);
        assertThat(out.get(0).sources).containsExactly("DHIS2_FLEET");
        assertThat(out.get(0).status).isEqualTo("PENDING");
    }

    @Test
    void preservesLanOnlyDevice() {
        when(fleetSvc.list()).thenReturn(List.of());
        when(networkRepo.listClients()).thenReturn(List.of(
                lanRow("iot-01", null, "iot-01.lan", "10.0.0.9", ClientTrust.PENDING)));

        final List<UnifiedDeviceService.UnifiedDevice> out =
                new UnifiedDeviceService(fleetSvc, networkRepo).list();

        assertThat(out).hasSize(1);
        assertThat(out.get(0).sources).containsExactly("LAN_CLIENT");
        assertThat(out.get(0).ip).isEqualTo("10.0.0.9");
        assertThat(out.get(0).status).isEqualTo("PENDING");
    }

    @Test
    void lanRowReferencingMissingFleetDeviceStandsAlone() {
        // der_device_id points at a fleet row that no longer exists.
        // Shouldn't throw; should emit the LAN row by itself.
        when(fleetSvc.list()).thenReturn(List.of());
        when(networkRepo.listClients()).thenReturn(List.of(
                lanRow("ghost-01", UUID.randomUUID(), "ghost", "10.0.0.11",
                        ClientTrust.APPROVED)));

        final List<UnifiedDeviceService.UnifiedDevice> out =
                new UnifiedDeviceService(fleetSvc, networkRepo).list();

        assertThat(out).hasSize(1);
        assertThat(out.get(0).sources).containsExactly("LAN_CLIENT");
    }

    @Test
    void sortsMostRecentFirst() {
        final UUID oldId = UUID.randomUUID();
        final UUID newId = UUID.randomUUID();
        final EdgeDevice oldDev = new EdgeDevice(oldId, null, null,
                NOW.minusSeconds(3600), null, null,
                NOW.minusSeconds(3600), "UA", null,
                EdgeDevice.Status.APPROVED, "Old", EdgeDevice.FormFactor.LAPTOP);
        final EdgeDevice newDev = new EdgeDevice(newId, null, null,
                NOW, null, null, NOW, "UA", null,
                EdgeDevice.Status.APPROVED, "New", EdgeDevice.FormFactor.LAPTOP);
        when(fleetSvc.list()).thenReturn(List.of(oldDev, newDev));
        when(networkRepo.listClients()).thenReturn(List.of());

        final List<UnifiedDeviceService.UnifiedDevice> out =
                new UnifiedDeviceService(fleetSvc, networkRepo).list();

        assertThat(out.get(0).displayName).isEqualTo("New");
        assertThat(out.get(1).displayName).isEqualTo("Old");
    }
}
