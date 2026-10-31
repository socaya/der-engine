# der-2.3.19 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.18`

## Headline

**Metadata mirror now captures full program-rule-action details.**
`MetadataSyncService.readProgramRules` was storing every action with
`action_type = UNKNOWN` because DHIS2's `/api/programRules?fields=:all`
does not descend into the nested `programRuleActions[]` collection.
A second pass against `/api/programRuleActions?fields=:all` now
reads action type / content / data element / variable binding, keys
them by `programRule.id`, and attaches them to the mirrored rule.

This unlocks the §35 evaluator (shipped in 2.3.18) end-to-end against
live DHIS2 — SHOWERROR / SHOWWARNING / SETMANDATORYFIELD / HIDEFIELD
/ ASSIGN actions now reach the server with real types.

## 1. Change

```java
// src/main/java/.../metadata/MetadataSyncService.java

static final String PROGRAM_RULE_ACTION_PATH =
        "/api/programRuleActions" + FIELDS_ALL;   // new

List<MirroredProgramRule> readProgramRules() {
    JsonNode body = dhis2.fetchJson(PROGRAM_RULE_PATH);
    Map<String, List<MirroredProgramRuleAction>> actionsByRule =
            readProgramRuleActionsByRule();        // new — one call
    for (JsonNode rule : body.withArray("programRules")) {
        String ruleId = requireText(rule, "id");
        List<MirroredProgramRuleAction> actions =
                actionsByRule.getOrDefault(ruleId, new ArrayList<>());
        out.add(new MirroredProgramRule(... actions ...));
    }
}
```

The old inline loop that walked `node.get("programRuleActions")` is
gone — those sub-objects only ever had `{id}`, which produced the
`UNKNOWN` action type on the mirror.

## 2. Before / after on the live mirror

```
BEFORE 2.3.19
der.metadata_program_rule_action.action_type histogram:
  UNKNOWN       393

AFTER 2.3.19 (metadata resync)
  SETMANDATORYFIELD              176
  SHOWERROR                      117
  SHOWWARNING                     92
  ASSIGN                           4
  HIDEFIELD                        3
  ASSIGN_VALUE_FROM_EVENT_LOOKUP   1
```

393 real actions typed correctly.

## 3. Live program-rule E2E (no DB seeding)

Picked an existing AHD rule from the live DHIS2 metadata:

```
rule     Y59HItNV8Ly/nyzPp6WxXvI
cond     d2:hasValue(#{ahd_danger}) && #{ahd_danger} == 'Yes'
var      ahd_danger → DE joFyCeTyp2S
action   SHOWERROR / content: "AHD danger signs present — admit for
                                 inpatient evaluation and treatment …"
```

```
create workflow bound to AHD program          ✓
open run                                      ✓
contribute dataValue joFyCeTyp2S="Yes"        ✓ 200
GET /validation                               ✓ errorCount=1
                                                [ERROR] PROGRAM_RULE_SHOWERROR
                                                "AHD danger signs present …"
```

The §35 evaluator (2.3.18) was already in place — this release just
feeds it real actions.

## 4. Files changed

```
server/.../metadata/MetadataSyncService.java              — + readProgramRuleActionsByRule(),
                                                             PROGRAM_RULE_ACTION_PATH
server/.../metadata/MetadataSyncServiceExtendedTest.java  — test updated: actions
                                                             mock now stubs the actions
                                                             endpoint rather than embedding
                                                             them in the parent response
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.19
```

## 5. Follow-ups

- **HIDEFIELD / ASSIGN** in the §35 evaluator — the mirror now has 3+4
  real occurrences to evaluate against; the evaluator still skips
  them (needs a client-side surface, see 2.3.18 release notes).
- **SETMANDATORYFIELD** (176 real rules) — overlaps with the §36
  REQUIRED_FIELD_MISSING check; could be wired as a validator pass
  that marks the step's field as REQUIRED on the fly before field-
  presence checks run.

## 6. Build + test

```
mvn test -Dtest='MetadataSyncService*'   ✓ 22/22
mvn -q -DskipTests package               ✓ 2.3.19 JAR
POST /sync/metadata                      ✓ 393 actions reclassified
Live program-rule E2E                    ✓ AHD rule fires end-to-end
```
