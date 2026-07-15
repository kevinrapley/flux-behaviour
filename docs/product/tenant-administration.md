# Tenant administration

Flux models each independently tracked website or web application as a tenant, similar to a Google Analytics property. A tenant owns one stable installation tag, one or more exact allowed origins, owner/viewer access bindings, governed aggregate exports and a recoverable trash state. It never owns or exports entered values or raw behavioural telemetry.

## Administration workflow

Open `/admin/` after Google sign-in. The tenant selector scopes every setting and action to one tenant.

Explicit platform administrators can create a tenant by supplying a controlled tenant ID, display name and exact HTTPS origins (HTTP is permitted only for localhost). Creation atomically issues the tenant's unique public installation tag and makes the creating account its first owner. Tenant ownership alone does not grant permission to create other tenants.

Owners can:

- edit the tenant display name and exact origin allow-list;
- copy the stable installation tag and hosted-module snippet;
- grant or update `owner` and `viewer` roles for existing Flux accounts;
- remove direct access, except that Flux never permits the final owner to be removed or demoted;
- download one year of daily aggregate visitors, sessions and interactions; and
- move tracking to trash or restore it.

Viewers can read governed reporting and download aggregate data, but cannot change property settings, access or lifecycle state.

## Trash and recovery

Deleting tenant tracking is a recoverable move to trash. The owner must type the exact tenant ID before Flux accepts the request. Flux immediately revokes the installation tag, excludes the tenant from collection-origin resolution and rejects new events. Configuration, membership and historical analytics remain available for restoration for 35 days; restoration reactivates the same unique tag. Restore requests at or after the recovery deadline are rejected even while permanent purge remains pending.

Flux records the date on which permanent purge becomes eligible, but does not yet automate physical deletion. The retention and deletion policy is still a release blocker, so neither the interface nor API claims that analytics records were permanently erased.

## API map

- `GET /api/admin/tenants` lists the signed-in account's tenants; platform administrators see all tenants.
- `POST /api/admin/tenants` creates a tenant, tag and first owner for a platform administrator.
- `PATCH /api/admin/tenants/:tenant` changes name and exact origins for an owner.
- `GET /api/admin/tenants/:tenant/access` lists direct access bindings.
- `PUT /api/admin/tenants/:tenant/access` grants or updates an existing Flux account's role.
- `DELETE /api/admin/tenants/:tenant/access/:accountId` removes direct access while preserving at least one owner.
- `GET /api/admin/tenants/:tenant/export.csv` downloads bounded daily aggregates.
- `DELETE /api/admin/tenants/:tenant` moves tracking to trash after exact-ID confirmation.
- `POST /api/admin/tenants/:tenant/restore` restores tracking during the recovery window.

All routes require an authenticated Flux session and enforce tenant scope. Lifecycle and configuration changes are written to `tenant_admin_audit`; access records include the affected account, whether access was granted, changed or removed, and the resulting role where one remains. Each access mutation and its audit row execute in one transactional D1 batch. Owner removal and demotion use conditional database writes so concurrent requests cannot remove the final owner. Contract-valid account IDs are decoded and validated at the route boundary before membership lookup.

## Google Analytics pattern and Flux boundaries

The design adapts four established Google Analytics administration concepts:

- a Google Analytics property maps to a Flux tenant;
- property access bindings map to Flux owner/viewer memberships;
- property-scoped reporting maps to Flux's bounded aggregate export; and
- moving a property to Trash Can maps to Flux's recoverable trash state.

Google's Admin API separates configuration from its Data API, and its property lifecycle provides a 35-day recovery period. Flux mirrors those understandable administration concepts, but keeps its stricter public-service boundary: no raw-event or user export, no advertising/audience administration, exact origin enforcement, and no claim of permanent deletion before the governed purge process exists.

References:

- [Google Analytics Admin API overview](https://developers.google.com/analytics/devguides/config/admin/v1)
- [Google Analytics Admin API REST resources](https://developers.google.com/analytics/devguides/config/admin/v1/rest)
- [Google Analytics Data API overview](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Google Analytics Trash Can](https://support.google.com/analytics/answer/9305587?hl=en)
- [Cloudflare D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
