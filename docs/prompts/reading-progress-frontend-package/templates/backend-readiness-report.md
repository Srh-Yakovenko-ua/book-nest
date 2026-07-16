# Backend readiness report — Reading Progress

## Status

`READY | READY_WITH_DIFFERENCES | PARTIALLY_READY | BLOCKED`

## Endpoint

- Route:
- Controller/handler:
- Service/use case:
- Generated hook:
- Generated response type:

## Query support

| Capability | Status | Actual name/behavior | Notes |
|---|---|---|---|
| activityRange 7d/14d/all | | | |
| page | | | |
| limit | | | |
| sort asc/desc | | | |

## Response support

| Section / field group | Status | Actual mapping | Critical? |
|---|---|---|---|
| summary current progress | | | yes |
| status dates | | | yes |
| reading period | | | yes |
| active stats | | | yes |
| best/last activity | | | yes |
| forecast | | | no/conditional |
| completeness | | | yes for legacy state |
| activity summary | | | yes |
| chart points with zero days | | | yes |
| grouped history days | | | yes |
| events | | | yes |
| server pagination | | | yes |

## Mutation invalidation readiness

- Progress mutation:
- Status mutation:
- Available query-key helper:
- Recommended invalidation:

## Commands run

- Backend typecheck:
- Backend tests:
- Schema/OpenAPI generation:
- Client generation/check:

## Differences from expected contract

1.
2.

## Blockers

1.
2.

## Decision

- [ ] Proceed with full frontend implementation.
- [ ] Proceed with mapping differences.
- [ ] Proceed partially and document blocked sections.
- [ ] Stop because a critical contract is missing.
