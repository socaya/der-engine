# DHIS2 Edge Agent (ADR-0029)

Upstream broadcast agent for the DHIS2 Edge Runtime (DER).

Alpha.9 is a scaffold — the module compiles and runs as a Spring Boot
shell. Metadata polling + webhook dispatch to registered edges land in
subsequent alphas.

## Build

```
./mvnw -pl agents/dhis2-edge-agent package
```

## Run

```
java -jar agents/dhis2-edge-agent/target/dhis2-edge-agent-*.jar
```

Configure via `application.yml` (see `src/main/resources/`).

## Protocol

The Agent polls DHIS2 Core's `/api/metadata?filter=lastUpdated:gt:...`
and dispatches:

```
POST <edge>/edge-api/v1/sync/notify
    { "objects": [ "<uid>", ... ], "kinds": [ ... ] }
```

Each edge receives the notification and schedules an immediate
`MetadataSyncJob` fire for the specified objects.

See `docs/architecture/decisions/0029-dhis2-edge-agent.md`.
