# ADR-0029 — DHIS2 Edge Agent (upstream broadcast)

- **Status:** Accepted (Phase 13 / der-1.4.0-alpha.9)
- **Related:** ADR-0008 (metadata sync cron)
- **Roadmap:** Initiative 2 (central → edge broadcast)

## Decisions

- **D-EA-1:** The Agent lives in-repo under `agents/dhis2-edge-agent/`
  — separate Maven artifact, independent lifecycle, same Git. It is
  **not** a DHIS2 Core server plugin JAR in alpha.9; the plugin
  packaging + DHIS2 build-chain integration ships in a later alpha.
  Alpha.9 is the scaffold.
- **D-EA-2:** The Agent is a Spring Boot application that polls
  DHIS2 Core's `/api/metadata` with `lastUpdated` filters and
  fans out webhook notifications to a registered edge list. Edge
  registration + webhook retry are post-scaffold concerns.
- **D-EA-3:** Edge-side receiver: `POST /edge-api/v1/sync/notify`
  takes `{ "objects": [ "<uid>", … ], "kinds": [...] }` and
  schedules an immediate `MetadataSyncJob` fire. Idempotent.
  Authenticated any-user; signing / mTLS pairing comes with
  Initiative 3 option B / C spike.
- **D-EA-4:** At-least-once delivery with idempotency keyed on
  DHIS2's `lastUpdated` version. Edges de-dupe locally during the
  sync.
- **D-EA-5:** The Agent repo does not ship with pre-filled DHIS2
  credentials; operators configure via standard Spring
  `application.yml`. The scaffold README documents the config.

## Non-goals

- DHIS2 app-platform JS alternative (option B in the roadmap).
- NATS / Kafka event bus (option C).
- Webhook signing / HMAC — ships with the pairing ceremony.
- Edge registration UI inside DER — admins paste the registration
  URL into the Agent config.
