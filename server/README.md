# DER server

Spring Boot starter for **DER-owned** orchestration and management functions, not a substitute for DHIS2 Core.

## Run

`mvn spring-boot:run` with Java 21 and Maven 3.9+. Use `curl http://localhost:8085/edge-api/v1/system/health` for a local smoke check.

## Responsibilities

Provisioning, status, durable synchronisation orchestration, conflict handling, audit, and monitoring after implementation. Business record manipulation should use supported DHIS2 APIs or reviewed extension points. In particular, a separate service cannot assume that its journal write is atomic with a DHIS2 database transaction.

## Next

Implement secure config, typed API models, persistence migrations, version-specific adapters, tests and secure operational endpoints; the health endpoint is the only functional API in this starter.
