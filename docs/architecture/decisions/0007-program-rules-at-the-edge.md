# ADR-0007: Program-rule execution at the edge

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related requirements: FR-07-01 … FR-07-08, FR-08-01 … FR-08-06, FR-11-03
- Related ADRs: ADR-0004 (hybrid architecture), ADR-0005 (custom DHIS2 apps —
  deferred), ADR-0006 (compatibility engine)

## Context

The hybrid architecture (ADR-0004) requires DER to emulate DHIS2's `/api/*`
write path end-to-end at the edge. For `POST /api/dataValueSets` (Phase 03.5)
that is tractable because aggregate values have no rule-driven side effects —
the DHIS2 server-side pipeline for aggregates only validates value types,
option-set membership and simple numeric ranges.

Tracker + event writes (Phase 03.6b) are different. DHIS2 programs can attach
**program rules** that fire on event / enrollment / TEI changes and whose
actions determine whether the write is even accepted. The rules reference
data-elements, tracked-entity attributes, constants, previous events, and a
handful of environment variables (`V{current_date}`, `V{enrollment_date}`,
`V{org_unit_count}`, …). They evaluate against a context DHIS2 assembles
server-side; mobile clients receive the rule metadata via
`/api/programRules*` and run their own (JavaScript) `@dhis2/rules-engine`
for UI effects.

DER has three ways to behave:

1. **Trust the device-client's engine** (JavaScript `@dhis2/rules-engine` via
   `@dhis2/app-runtime`) and accept whatever the client sends. Any non-browser
   client (curl, mobile capture, bulk upload) bypasses rules entirely. **Rejected**
   because DER must be a drop-in `/api/*` emulator for every DHIS2 client.
2. **Defer every action to central**: DER accepts writes locally, journals them,
   and lets DHIS2 reject on drain. Fast to ship but destroys the "offline-first
   with real guard-rails" thesis — a clinic staffer wouldn't know the write
   broke a mandatory-field rule until the journal attempts central import days
   later. **Rejected** by the Phase 03.6b scope agreement.
3. **Reimplement the server-impacting rule actions in Java inside DER.** DER's
   `RuleEngine` loads mirrored program rules on write and runs them against a
   `RuleContext` assembled from the incoming event + mirror data. Actions that
   affect the write (ASSIGN, SHOWERROR, WARNINGONCOMPLETE, ERRORONCOMPLETE,
   SETMANDATORYFIELD, SHOWWARNING) run in Java; actions that only affect UI
   (HIDEFIELD, HIDESECTION, HIDEPROGRAMSTAGE, DISPLAYTEXT, DISPLAYKEYVALUEPAIR,
   CREATEEVENT) are mirrored for the device-client but ignored by the server
   path. **Chosen.**

## Decision

Build a lean Java **program-rule engine** inside DER at
`ug.ac.mak.der.rules.*` and run it on every `POST /api/events`,
`POST /api/tracker` and (later) `POST /api/dataValueSets` write. Scope:

### Expression grammar

Hand-written recursive-descent parser (not ANTLR — keeps the build toolchain
unchanged; the DHIS2 program-rule syntax is a small, stable subset).

Supported syntax:

| Construct | Example |
|---|---|
| Data-element reference | `#{psUid.deUid}` |
| TEI-attribute reference | `A{teaUid}` |
| Constant reference | `C{constUid}` |
| Environment variable | `V{current_date}` |
| Numeric literal | `3.14`, `42` |
| String literal | `'hello'`, `"hello"` |
| Boolean literal | `true`, `false` |
| Null literal | `null` |
| Unary | `-x`, `!x` |
| Arithmetic | `+ - * /` |
| Relational | `== != < > <= >=` |
| Logical | `&& ||` |
| Ternary | `cond ? a : b` |
| `d2:` function | `d2:hasValue(#{psUid.deUid})` |
| Parens | `(a + b) * c` |

### Supported `d2:` functions (Phase 03.6b target set)

Chosen to cover the top-of-the-funnel real-world rules in Uganda MoH and WHO
reference packages. Add-on functions tracked in
`docs/verification/rules/d2-function-coverage.csv`.

- Null / existence: `d2:hasValue`, `d2:zing`, `d2:oizp`, `d2:zpvc`.
- Numeric: `d2:ceil`, `d2:floor`, `d2:round`, `d2:modulus`.
- Counting: `d2:count`, `d2:countIfValue`, `d2:countIfZeroPos`.
- Dates: `d2:daysBetween`, `d2:weeksBetween`, `d2:monthsBetween`,
  `d2:yearsBetween`, `d2:minutesBetween`, `d2:addDays`, `d2:lastEventDate`.
- Strings: `d2:concatenate`, `d2:left`, `d2:right`, `d2:substring`,
  `d2:length`, `d2:split`, `d2:validatePattern`.
- Program context: `d2:inOrgUnitGroup`, `d2:extractDataMatrixValue`.

### Supported rule actions

**Server-impacting (executed by DER on write):**

- `ASSIGN` — compute `data` expression; apply as value in the derived
  output map; persist alongside the write.
- `SHOWERROR` — if `condition` evaluates true, reject the write with the
  rule's `content` as the error message.
- `SHOWWARNING` — if true, emit a warning in the response; the write
  continues.
- `WARNINGONCOMPLETE` — fires only when the event's `status` transitions
  to COMPLETED. Non-blocking.
- `ERRORONCOMPLETE` — fires only on COMPLETED transition. Rejects.
- `SETMANDATORYFIELD` — marks a field required for this write; the service
  rejects when the field is blank.

**UI-only (recorded in the mirror; ignored by DER's write path):**

- `HIDEFIELD`, `HIDESECTION`, `HIDEPROGRAMSTAGE`, `DISPLAYTEXT`,
  `DISPLAYKEYVALUEPAIR`, `SENDMESSAGE`, `SCHEDULEMESSAGE`.

**Explicitly deferred (not Phase 03.6b):**

- `CREATEEVENT` — mutates graph structure; deferred to Phase 05 because the
  local-store answer for cascading inserts needs its own ADR.

### Rule context

Per write, DER assembles a `RuleContext` snapshot that gives expressions a
read-only view of:

- The current event's `programStageUid.dataElementUid` map.
- The enrollment's TEI attribute values (if present).
- Previous events of the same program stage for this enrollment (for
  `d2:lastEventDate`, `d2:count*`).
- `metadata_constant` values (post-mirror).
- Environment variables: `current_date`, `enrollment_date`, `event_date`,
  `due_date`, `org_unit_count`, `program_stage_name`, `environment`.

### Semantics

- Rules evaluated in `priority DESC NULLS LAST` order (matches DHIS2's own
  evaluator ordering).
- `ASSIGN` outputs are visible to subsequent rules in the same evaluation
  pass (DHIS2 behaviour).
- A grammar error in `condition` or `data` is logged, the rule is skipped,
  and the write continues when `der.rules.strict=false`. When
  `strict=true` (default), a grammar error becomes HTTP 500 so the
  operator sees the broken rule immediately.
- `der.rules.enabled=false` disables the engine entirely (diagnostic-only).

### Non-goals (deliberate)

- Full d2:function parity with DHIS2's own evaluator. New functions are
  tracked and added per-release as real pilot program rules surface them.
- Rule-side `createEvent` cascades (Phase 05).
- Lint / compile step for rules at metadata-sync time (Phase 05).
- UI-side rendering of HIDEFIELD/HIDESECTION/… — that is the device-client's
  job and `@dhis2/rules-engine` already handles it in the DER UI.

### Observability

New audit events: `RULE_FIRED_ASSIGN`, `RULE_FIRED_SHOWERROR`,
`RULE_FIRED_WARNING`, `RULE_FIRED_ONCOMPLETE`, `RULE_SKIPPED_GRAMMAR`,
`RULE_ENGINE_DISABLED`. Each event records the rule UID, the compiled
condition value (true/false), the executed action, and the message
rendered.

## Consequences

### Positive

- DER's `/api/events` and `/api/tracker` writes behave as DHIS2 clients
  expect for the actions that actually control write admission.
- Rules are enforced for any client, not only `@dhis2/app-runtime` clients.
- Rules evolution tracked explicitly in
  `docs/verification/rules/d2-function-coverage.csv`.

### Negative

- Scope of the engine is non-trivial (parser + evaluator + ~25 d2
  functions). Mitigated by a hand-written parser and a well-defined
  function subset.
- Edge-vs-central semantic drift is possible as DHIS2 evolves. Mitigated
  by:
  - A parity test fixture per d2 function (DHIS2 reference outputs
    reproduced).
  - A new ADR-0007-addendum per DHIS2 minor release that documents engine
    deltas, carried alongside the matching `V2XxProfile` update.

### Risk

If DER's engine rejects a write that DHIS2 would have accepted (or vice
versa), the device-client would see a different outcome offline than
online. Mitigation: strict grammar + warning on skipped rules + the
d2-function coverage register so operators can see which rules might
behave differently.
