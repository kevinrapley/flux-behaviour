export function originsFromTextarea(value) {
  return String(value).split(/\r?\n/).map((origin) => origin.trim()).filter(Boolean);
}

export function createTenantAdminClient(fetcher = fetch) {
  return {
    list: () => request(fetcher, '/api/admin/tenants'),
    create: (body) => request(fetcher, '/api/admin/tenants', { method: 'POST', body }),
    update: (tenantId, body) => request(fetcher, tenantUrl(tenantId), { method: 'PATCH', body }),
    access: (tenantId) => request(fetcher, `${tenantUrl(tenantId)}/access`),
    grant: (tenantId, body) => request(fetcher, `${tenantUrl(tenantId)}/access`, { method: 'PUT', body }),
    removeAccess: (tenantId, accountId) => request(fetcher, `${tenantUrl(tenantId)}/access/${encodeURIComponent(accountId)}`, { method: 'DELETE' }),
    trash: (tenantId) => request(fetcher, tenantUrl(tenantId), { method: 'DELETE', body: { confirmation: tenantId } }),
    restore: (tenantId) => request(fetcher, `${tenantUrl(tenantId)}/restore`, { method: 'POST' })
  };
}

function tenantUrl(tenantId) {
  return `/api/admin/tenants/${encodeURIComponent(tenantId)}`;
}

async function request(fetcher, url, { method = 'GET', body } = {}) {
  const response = await fetcher(url, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'request_failed');
  return result;
}

export function installTenantAdministration(documentLike = document, client = createTenantAdminClient()) {
  const state = { tenants: [], platformAdmin: false, selectedId: null };
  const tenantSelect = documentLike.querySelector('[data-flux-admin-tenant]');
  if (!tenantSelect) return;
  const panel = documentLike.querySelector('[data-flux-tenant-panel]');
  const message = documentLike.querySelector('[data-flux-admin-message]');
  const messageText = documentLike.querySelector('[data-flux-admin-message-text]');

  const notify = (text, error = false) => {
    message.hidden = false;
    message.classList.toggle('govuk-notification-banner--success', !error);
    messageText.textContent = text;
    message.scrollIntoView?.({ block: 'nearest' });
  };

  const selectedTenant = () => state.tenants.find(({ id }) => id === state.selectedId);

  const renderAccess = async (tenant) => {
    const container = documentLike.querySelector('[data-flux-access-list]');
    container.replaceChildren();
    try {
      const result = await client.access(tenant.id);
      const list = documentLike.createElement('ul');
      list.className = 'govuk-list govuk-list--bullet';
      for (const entry of result.access) {
        const item = documentLike.createElement('li');
        const label = documentLike.createElement('span');
        label.textContent = `${entry.email} — ${entry.role} `;
        const remove = documentLike.createElement('button');
        remove.type = 'button';
        remove.className = 'govuk-button govuk-button--secondary flux-admin-access-remove';
        remove.textContent = 'Remove access';
        remove.addEventListener('click', async () => {
          try {
            await client.removeAccess(tenant.id, entry.account_id);
            notify('Property access removed.');
            await renderAccess(tenant);
          } catch (error) { notify(`Property access was not removed: ${error.message}`, true); }
        });
        item.append(label, remove);
        list.append(item);
      }
      container.append(list);
    } catch (error) {
      container.textContent = `Access list unavailable: ${error.message}`;
    }
  };

  const renderSelected = async () => {
    const tenant = selectedTenant();
    panel.hidden = !tenant;
    if (!tenant) return;
    const active = tenant.status === 'active';
    const canManage = state.platformAdmin || tenant.role === 'owner';
    documentLike.querySelector('[data-flux-tenant-status]').textContent = active ? 'Active' : 'In trash';
    documentLike.querySelector('[data-flux-active-settings]').hidden = !active;
    documentLike.querySelector('[data-flux-trash-settings]').hidden = active;
    documentLike.querySelector('[data-flux-owner-settings]').hidden = !canManage;
    documentLike.querySelector('[data-flux-owner-trash]').hidden = !canManage;
    documentLike.querySelector('[data-flux-restore]').hidden = !canManage;
    documentLike.querySelector('[data-flux-settings-form] [name="name"]').value = tenant.name;
    documentLike.querySelector('[data-flux-settings-form] [name="allowed_origins"]').value = tenant.allowed_origins.join('\n');
    documentLike.querySelector('[data-flux-installation-tag]').textContent = tenant.tag_id ?? 'No active installation tag';
    documentLike.querySelector('[data-flux-export]').href = `${tenantUrl(tenant.id)}/export.csv`;
    documentLike.querySelector('[data-flux-trash-form] [name="confirmation"]').value = '';
    documentLike.querySelector('[data-flux-purge-date]').textContent = tenant.purge_after_ms ? new Date(tenant.purge_after_ms).toLocaleDateString('en-GB', { dateStyle: 'long' }) : 'Not scheduled';
    if (active && canManage) await renderAccess(tenant);
  };

  const renderList = async (preferredId) => {
    const result = await client.list();
    state.tenants = result.tenants;
    state.platformAdmin = result.platform_admin;
    documentLike.querySelector('[data-flux-platform-create]').hidden = !state.platformAdmin;
    tenantSelect.replaceChildren();
    for (const tenant of state.tenants) {
      const option = documentLike.createElement('option');
      option.value = tenant.id;
      option.textContent = `${tenant.name}${tenant.status === 'trashed' ? ' — in trash' : ''}`;
      tenantSelect.append(option);
    }
    state.selectedId = state.tenants.some(({ id }) => id === preferredId) ? preferredId : state.tenants[0]?.id ?? null;
    tenantSelect.value = state.selectedId ?? '';
    await renderSelected();
  };

  tenantSelect.addEventListener('change', async () => { state.selectedId = tenantSelect.value; await renderSelected(); });
  documentLike.querySelector('[data-flux-create-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await client.create({ tenant_id: form.get('tenant_id'), name: form.get('name'), allowed_origins: originsFromTextarea(form.get('allowed_origins')) });
      event.currentTarget.reset();
      notify('Tenant created. Its unique installation tag is ready to use.');
      await renderList(result.tenant_id);
    } catch (error) { notify(`Tenant could not be created: ${error.message}`, true); }
  });
  documentLike.querySelector('[data-flux-settings-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await client.update(state.selectedId, { name: form.get('name'), allowed_origins: originsFromTextarea(form.get('allowed_origins')) });
      notify('Property details saved.');
      await renderList(state.selectedId);
    } catch (error) { notify(`Property details were not saved: ${error.message}`, true); }
  });
  documentLike.querySelector('[data-flux-access-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await client.grant(state.selectedId, { email: form.get('email'), role: form.get('role') });
      event.currentTarget.reset();
      notify('Property access updated.');
      await renderAccess(selectedTenant());
    } catch (error) { notify(`Property access was not updated: ${error.message}`, true); }
  });
  documentLike.querySelector('[data-flux-trash-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const confirmation = new FormData(event.currentTarget).get('confirmation');
    if (confirmation !== state.selectedId) return notify('Enter the exact tenant ID before moving tracking to trash.', true);
    try {
      await client.trash(state.selectedId);
      notify('Tracking moved to trash. New events are no longer accepted.');
      await renderList(state.selectedId);
    } catch (error) { notify(`Tracking was not moved to trash: ${error.message}`, true); }
  });
  documentLike.querySelector('[data-flux-restore]').addEventListener('click', async () => {
    try {
      await client.restore(state.selectedId);
      notify('Tracking restored with its existing installation tag.');
      await renderList(state.selectedId);
    } catch (error) { notify(`Tracking was not restored: ${error.message}`, true); }
  });

  renderList().catch((error) => {
    if (error.message === 'unauthorised') globalThis.location?.assign?.('/account/');
    else notify(`Tenant administration could not be loaded: ${error.message}`, true);
  });
}

if (typeof document !== 'undefined') installTenantAdministration(document);
