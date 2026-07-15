# Tenant installation tags

Flux separates the public identifier installed on a publisher page from its internal tenant identifier. Every tenant has exactly one active unique installation tag.

## Provisioning lifecycle

An authenticated account must be explicitly present in `platform_admins` before it can call `POST /api/admin/tenants`. Tenant ownership does not confer platform-administrator authority. A valid request supplies a new controlled tenant ID, display name and one or more exact allowed origins.

Provisioning uses one D1 batch to create:

- the tenant;
- a cryptographically generated opaque tag in `tenant_installation_tags`; and
- the authenticated platform administrator's initial `owner` membership.

The tag has the form `flux-` followed by 32 lowercase hexadecimal characters. Database primary-key and unique-tenant constraints enforce one-to-one mapping. A failure leaves no partially provisioned tenant.

Tenant owners can use `/admin/` or call `GET /api/tenant/:tenant/installation` to retrieve the same stable active tag and a complete hosted-module snippet. Viewers cannot retrieve it. The administration surface lets owners change the name and exact origins, manage owner/viewer access, download aggregate data, and move tracking to trash or restore it. It prevents removal or demotion of the final owner.

Moving a tenant to trash immediately revokes its tag and stops collection. Flux records a 35-day recovery window and preserves its configuration and historical analytics during that window; restoring reactivates the same tag. Permanent purge is not automated while the governed retention and deletion policy remains a release blocker, so the displayed date is purge eligibility rather than a claim that physical deletion has occurred.

## Collection boundary

New publisher pages place the issued value in `data-flux-tag`. The browser SDK sends it in the event contract's existing `tenant_id` field. Before origin checking or any analytics storage, the collector resolves the active tag to the internal tenant and replaces the event reference with that internal ID.

The tag is deliberately public because it is present in HTML. It is not a password, API key or proof of tenant access. Security continues to depend on exact tenant origin allow-listing, metadata schema validation, consent and authenticated access to administration and reporting APIs.

## ResearchOps compatibility

Migration `0007_tenant_installation_tags.sql` gives ResearchOps the stable tag `flux-researchops` without changing or deleting the existing `researchops` tenant. The collector also accepts only the literal legacy reference `researchops` as a direct internal tenant ID. No other current or future tenant receives that bypass.

Existing non-ResearchOps tenant rows are backfilled deterministically with unique `flux-existing-<rowid>` tags. New tenant integrations use only `data-flux-tag`; the legacy `data-flux-tenant` attribute remains documented solely for the existing ResearchOps installation.
