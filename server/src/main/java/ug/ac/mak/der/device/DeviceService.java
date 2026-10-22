package ug.ac.mak.der.device;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.security.PasswordHasher;

/** Enrol / approve / heartbeat / revoke for the device fleet. ADR-0019. */
@Service
@ConditionalOnBean(EdgeDeviceRepository.class)
public class DeviceService {

    private final EdgeDeviceRepository repo;
    private final PasswordHasher hasher;

    public DeviceService(final EdgeDeviceRepository repo, final PasswordHasher hasher) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.hasher = Objects.requireNonNull(hasher, "hasher");
    }

    public List<EdgeDevice> list() {
        return repo.findAll();
    }

    public Optional<EdgeDevice> get(final UUID deviceId) {
        return repo.findById(deviceId);
    }

    /**
     * Enrols or re-registers a device. Returns {@link EnrolResult} with
     * the row + a one-shot enrolment token the caller stores locally.
     * The server only persists the Argon2id hash of the token.
     */
    public EnrolResult enrol(final UUID deviceId, final UUID actingUser,
                               final String userAgent) {
        Objects.requireNonNull(deviceId, "deviceId");
        final String token = UUID.randomUUID().toString() + "-"
                + UUID.randomUUID().toString();
        final String tokenHash = hasher.hash(token);
        final EdgeDevice row = repo.upsertEnrol(deviceId, actingUser, userAgent, tokenHash);
        return new EnrolResult(row, token);
    }

    public Outcome approve(final UUID deviceId, final UUID actor) {
        return transition(deviceId, EdgeDevice.Status.APPROVED, actor,
                EnumAllowed.ANY_EXCEPT_REVOKED);
    }

    public Outcome suspend(final UUID deviceId, final UUID actor) {
        return transition(deviceId, EdgeDevice.Status.SUSPENDED, actor,
                EnumAllowed.ANY_EXCEPT_REVOKED);
    }

    public Outcome revoke(final UUID deviceId, final UUID actor) {
        return transition(deviceId, EdgeDevice.Status.REVOKED, actor,
                EnumAllowed.ANY);
    }

    public HeartbeatOutcome heartbeat(final UUID deviceId) {
        final Optional<EdgeDevice> d = repo.findById(deviceId);
        if (d.isEmpty()) {
            return HeartbeatOutcome.NOT_FOUND;
        }
        if (d.get().status() == EdgeDevice.Status.REVOKED) {
            return HeartbeatOutcome.REVOKED;
        }
        repo.heartbeat(deviceId);
        return HeartbeatOutcome.OK;
    }

    public int delete(final UUID deviceId) {
        return repo.delete(deviceId);
    }

    private Outcome transition(final UUID deviceId, final EdgeDevice.Status next,
                                 final UUID actor, final EnumAllowed allowed) {
        final Optional<EdgeDevice> d = repo.findById(deviceId);
        if (d.isEmpty()) {
            return Outcome.NOT_FOUND;
        }
        if (allowed == EnumAllowed.ANY_EXCEPT_REVOKED
                && d.get().status() == EdgeDevice.Status.REVOKED) {
            return Outcome.REVOKED_IS_TERMINAL;
        }
        final int rows = repo.updateStatus(deviceId, next, actor);
        return rows > 0 ? Outcome.OK : Outcome.NOT_FOUND;
    }

    public record EnrolResult(EdgeDevice device, String enrolmentToken) { }

    public enum Outcome { OK, NOT_FOUND, REVOKED_IS_TERMINAL }

    public enum HeartbeatOutcome { OK, NOT_FOUND, REVOKED }

    private enum EnumAllowed { ANY, ANY_EXCEPT_REVOKED }
}
