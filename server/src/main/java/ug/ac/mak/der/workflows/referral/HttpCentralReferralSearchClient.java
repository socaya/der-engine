package ug.ac.mak.der.workflows.referral;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.dhis2.Dhis2Properties;

/**
 * ADR-0027 alpha.5. Queries central's {@code /api/dataValueSets} for
 * entries under the bound OU, parses the {@code [DER-next-hop:<ou>]}
 * marker from each {@code dataValue.comment}, and returns candidates
 * whose destination matches the local bound OU.
 *
 * <p>Only aggregate scan is implemented in alpha.5. Events + tracker
 * ship in alpha.6, alongside the outbound-side orgUnit rewrite that
 * makes central serve referrals under the destination OU.</p>
 *
 * <p>Enable with {@code der.referral.http.enabled=true}. When
 * disabled, the no-op client remains in effect.</p>
 */
@Component
@Primary
@ConditionalOnProperty(prefix = "der.referral.http", name = "enabled",
        havingValue = "true", matchIfMissing = false)
public class HttpCentralReferralSearchClient implements CentralReferralSearchClient {

    private static final Logger LOG =
            LoggerFactory.getLogger(HttpCentralReferralSearchClient.class);
    private static final Pattern MARKER =
            Pattern.compile("\\[DER-next-hop:([A-Za-z0-9_-]+)\\]");

    private final HttpClient http;
    private final Dhis2Properties props;
    private final ObjectMapper mapper;

    public HttpCentralReferralSearchClient(final HttpClient http,
                                             final Dhis2Properties props,
                                             final ObjectMapper mapper) {
        this.http = Objects.requireNonNull(http, "http");
        this.props = Objects.requireNonNull(props, "props");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Override
    public List<Candidate> findReferrals(final String boundOrgUnitUid, final Instant since) {
        if (props.central().baseUrl() == null || props.central().baseUrl().isBlank()) {
            LOG.debug("central base-url unset; referral search skipped");
            return List.of();
        }
        final String url = props.central().baseUrl()
                + "/api/dataValueSets?orgUnit=" + encode(boundOrgUnitUid)
                + "&children=true&lastUpdated=" + encode(since.toString());
        final HttpResponse<String> resp;
        try {
            final HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofMillis(Math.max(1_000,
                            props.central().connectTimeoutMillis())))
                    .header("Accept", "application/json")
                    .GET();
            if (props.central().username() != null && !props.central().username().isBlank()) {
                final String token = props.central().username() + ":"
                        + (props.central().password() == null ? "" : props.central().password());
                req.header("Authorization", "Basic "
                        + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8)));
            }
            resp = http.send(req.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException ex) {
            LOG.warn("referral HTTP search failed ({}); will retry next tick", ex.getMessage());
            return List.of();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return List.of();
        }
        if (resp.statusCode() / 100 != 2) {
            LOG.warn("referral HTTP search returned HTTP {}; body={}", resp.statusCode(),
                    truncate(resp.body()));
            return List.of();
        }
        return parse(resp.body(), boundOrgUnitUid);
    }

    List<Candidate> parse(final String body, final String boundOrgUnitUid) {
        if (body == null || body.isBlank()) {
            return List.of();
        }
        final JsonNode root;
        try {
            root = mapper.readTree(body);
        } catch (IOException ex) {
            LOG.warn("referral HTTP parse failed: {}", ex.getMessage());
            return List.of();
        }
        final JsonNode dataValues = root.get("dataValues");
        if (dataValues == null || !dataValues.isArray()) {
            return List.of();
        }
        final List<Candidate> out = new ArrayList<>();
        for (final JsonNode dv : dataValues) {
            final JsonNode commentNode = dv.get("comment");
            if (commentNode == null || !commentNode.isTextual()) {
                continue;
            }
            final Matcher m = MARKER.matcher(commentNode.asText());
            if (!m.find()) {
                continue;
            }
            if (!boundOrgUnitUid.equals(m.group(1))) {
                continue;
            }
            final String ref = extractRef(dv);
            out.add(new Candidate(
                    ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE, ref, dv.toString()));
        }
        return out;
    }

    private static String extractRef(final JsonNode dv) {
        final String de = textOrDash(dv.get("dataElement"));
        final String ou = textOrDash(dv.get("orgUnit"));
        final String period = textOrDash(dv.get("period"));
        final String coc = textOrDash(dv.get("categoryOptionCombo"));
        return de + "|" + ou + "|" + period + "|" + coc;
    }

    private static String textOrDash(final JsonNode node) {
        return node == null || !node.isTextual() ? "-" : node.asText();
    }

    private static String encode(final String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String truncate(final String s) {
        if (s == null) {
            return "";
        }
        return s.length() > 200 ? s.substring(0, 200) + "…" : s;
    }
}
