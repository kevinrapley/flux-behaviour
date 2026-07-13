import {
  createFunnel,
  createStep,
  createSuccessEvent,
  createTask,
  deleteEntity,
  deleteSuccessEvent,
  moveEntity,
  updateEntity,
  updateStep,
  updateSuccessEvent
} from './task-funnel-configuration.mjs';

export function createTaskFunnelManager({ root, tenantId, onPublished = () => {} }) {
  let configuration = null;
  let editor = null;
  let loading = false;

  async function load() {
    if (!root || !tenantId || loading) return;
    loading = true;
    if (!configuration) root.replaceChildren(message('Loading configuration…'));
    try {
      const response = await fetch(`/api/service-model/${encodeURIComponent(tenantId)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('configuration_unavailable');
      configuration = await response.json();
      editor = null;
      render();
    } catch {
      root.replaceChildren(message('Task and funnel configuration could not be loaded. Refresh the dashboard and try again.', 'flux-model-manager__error'));
    } finally {
      loading = false;
    }
  }

  function render() {
    if (!configuration?.model) return;
    const fragment = document.createDocumentFragment();
    fragment.append(message(`Published model version ${configuration.model.version}.`, 'flux-model-manager__version'));
    if (configuration.role !== 'owner') {
      fragment.append(message('You can view this configuration, but only a tenant owner can change it.'));
      fragment.append(renderFunnels(false));
      root.replaceChildren(fragment);
      return;
    }
    fragment.append(message('Stable keys are retained when names change. Step and success-event keys must match data-flux-key values on the connected service.'));
    const toolbar = element('div', 'flux-model-manager__actions');
    toolbar.append(actionButton('Add funnel', () => openEditor({ type: 'funnel-create' }), 'govuk-button'));
    fragment.append(toolbar);
    if (editor) fragment.append(renderEditor());
    fragment.append(renderFunnels(true));
    root.replaceChildren(fragment);
  }

  function renderFunnels(editable) {
    const wrapper = element('div', 'flux-model-manager__funnels');
    const funnels = entities('transaction');
    if (funnels.length === 0) {
      wrapper.append(message('No funnels are configured yet. Add a funnel, then add its tasks, ordered steps and success event.', 'flux-model-manager__empty'));
      return wrapper;
    }
    funnels.forEach((funnel, funnelIndex) => wrapper.append(renderFunnel(funnel, funnelIndex, funnels.length, editable)));
    return wrapper;
  }

  function renderFunnel(funnel, index, total, editable) {
    const article = element('article', 'flux-model-manager__funnel');
    const heading = element('div', 'flux-model-manager__item-heading');
    const title = element('div');
    title.append(element('h3', 'govuk-heading-m', funnel.label), keyCopy(funnel.key));
    heading.append(title);
    if (editable) {
      heading.append(itemActions([
        ['Edit', () => openEditor({ type: 'entity-edit', entityKey: funnel.key })],
        ['Move up', () => publish(() => moveEntity(configuration.model, funnel.key, -1)), index === 0],
        ['Move down', () => publish(() => moveEntity(configuration.model, funnel.key, 1)), index === total - 1],
        ['Delete', () => confirmDelete(funnel)]
      ]));
    }
    article.append(heading);

    const successHeading = element('div', 'flux-model-manager__subheading');
    successHeading.append(element('h4', 'govuk-heading-s', 'Success events'));
    if (editable) successHeading.append(actionButton('Add success event', () => openEditor({ type: 'success-create', transactionKey: funnel.key })));
    article.append(successHeading);
    const outcomes = configuration.model.outcomes.filter(({ transaction_key, type }) => transaction_key === funnel.key && type === 'success');
    if (outcomes.length === 0) article.append(message('No success event is configured, so Flux cannot report completion for this funnel.', 'flux-model-manager__warning'));
    for (const outcome of outcomes) article.append(renderSuccess(outcome, editable));

    const taskHeading = element('div', 'flux-model-manager__subheading');
    taskHeading.append(element('h4', 'govuk-heading-s', 'Tasks and ordered steps'));
    if (editable) taskHeading.append(actionButton('Add task', () => openEditor({ type: 'task-create', transactionKey: funnel.key })));
    article.append(taskHeading);
    const tasks = children(funnel.key, 'task');
    if (tasks.length === 0) article.append(message('No tasks are configured for this funnel.'));
    tasks.forEach((task, taskIndex) => article.append(renderTask(task, taskIndex, tasks.length, editable)));
    return article;
  }

  function renderTask(task, index, total, editable) {
    const section = element('section', 'flux-model-manager__task');
    const heading = element('div', 'flux-model-manager__item-heading');
    const title = element('div');
    title.append(element('h5', 'govuk-heading-s', task.label), keyCopy(task.key));
    heading.append(title);
    if (editable) heading.append(itemActions([
      ['Edit', () => openEditor({ type: 'entity-edit', entityKey: task.key })],
      ['Move up', () => publish(() => moveEntity(configuration.model, task.key, -1)), index === 0],
      ['Move down', () => publish(() => moveEntity(configuration.model, task.key, 1)), index === total - 1],
      ['Delete', () => confirmDelete(task)]
    ]));
    section.append(heading);
    const steps = children(task.key, 'step');
    const list = element('ol', 'flux-model-manager__steps');
    for (const [stepIndex, step] of steps.entries()) {
      const item = element('li', 'flux-model-manager__step');
      const binding = configuration.model.bindings.find(({ entity_key }) => entity_key === step.key);
      const copy = element('div');
      copy.append(element('strong', '', step.label), keyCopy(binding?.element_key ?? 'No direct data-flux-key binding'));
      item.append(copy);
      if (editable) item.append(itemActions([
        ['Edit', () => openEditor({ type: 'step-edit', entityKey: step.key })],
        ['Move up', () => publish(() => moveEntity(configuration.model, step.key, -1)), stepIndex === 0],
        ['Move down', () => publish(() => moveEntity(configuration.model, step.key, 1)), stepIndex === steps.length - 1],
        ['Delete', () => confirmDelete(step)]
      ]));
      list.append(item);
    }
    if (steps.length === 0) section.append(message('No ordered steps are configured for this task.'));
    else section.append(list);
    if (editable) section.append(actionButton('Add step', () => openEditor({ type: 'step-create', taskKey: task.key })));
    return section;
  }

  function renderSuccess(outcome, editable) {
    const keyEvent = configuration.model.key_events.find(({ outcome_key }) => outcome_key === outcome.key);
    const row = element('div', 'flux-model-manager__success');
    const copy = element('div');
    copy.append(
      element('strong', '', outcome.label),
      keyCopy(`${keyEvent?.action ?? 'No action'} on ${keyEvent?.element_key ?? 'no data-flux-key'}`)
    );
    row.append(copy);
    if (editable) row.append(itemActions([
      ['Edit', () => openEditor({ type: 'success-edit', outcomeKey: outcome.key })],
      ['Delete', () => confirmSuccessDelete(outcome)]
    ]));
    return row;
  }

  function renderEditor() {
    const form = element('form', 'flux-model-manager__form');
    form.noValidate = true;
    const definition = editorDefinition();
    form.append(element('h3', 'govuk-heading-m', definition.title), message(definition.copy));
    for (const field of definition.fields) form.append(formField(field));
    const actions = element('div', 'flux-model-manager__actions');
    const save = actionButton('Save and publish', null, 'govuk-button');
    save.type = 'submit';
    actions.append(save, actionButton('Cancel', () => { editor = null; render(); }, 'govuk-button govuk-button--secondary'));
    form.append(actions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      void publish(() => definition.mutate(values));
    });
    return form;
  }

  function editorDefinition() {
    if (editor.type === 'funnel-create') return {
      title: 'Add funnel',
      copy: 'A funnel is a service transaction. Add tasks, ordered steps and a success event after publishing it.',
      fields: [labelField('label', 'Funnel name', '')],
      mutate: ({ label }) => createFunnel(configuration.model, { label })
    };
    if (editor.type === 'task-create') return {
      title: 'Add task', copy: 'Tasks group the ordered steps people take within this funnel.',
      fields: [labelField('label', 'Task name', '')],
      mutate: ({ label }) => createTask(configuration.model, { transactionKey: editor.transactionKey, label })
    };
    if (editor.type === 'step-create') return stepDefinition('Add step', '', '', ({ label, elementKey }) => createStep(configuration.model, { taskKey: editor.taskKey, label, elementKey }));
    if (editor.type === 'step-edit') {
      const step = entity(editor.entityKey);
      const binding = configuration.model.bindings.find(({ entity_key }) => entity_key === step.key);
      return stepDefinition('Edit step', step.label, binding?.element_key ?? '', ({ label, elementKey }) => updateStep(configuration.model, step.key, { label, elementKey }));
    }
    if (editor.type === 'entity-edit') {
      const current = entity(editor.entityKey);
      return {
        title: `Edit ${current.type === 'transaction' ? 'funnel' : 'task'}`,
        copy: `The stable key ${current.key} will not change.`,
        fields: [labelField('label', `${current.type === 'transaction' ? 'Funnel' : 'Task'} name`, current.label)],
        mutate: ({ label }) => updateEntity(configuration.model, current.key, { label })
      };
    }
    const editing = editor.type === 'success-edit';
    const outcome = editing ? configuration.model.outcomes.find(({ key }) => key === editor.outcomeKey) : null;
    const keyEvent = outcome ? configuration.model.key_events.find(({ outcome_key }) => outcome_key === outcome.key) : null;
    return {
      title: editing ? 'Edit success event' : 'Add success event',
      copy: 'Flux counts completion only when this exact event is accepted. The data-flux-key must exist on the connected service.',
      fields: [
        labelField('label', 'Success event name', outcome?.label ?? ''),
        labelField('action', 'Flux action', keyEvent?.action ?? 'flow.submit', 'For example, flow.submit or page.loaded.'),
        labelField('elementKey', 'Publisher data-flux-key', keyEvent?.element_key ?? '', 'For example, form.application.submit or page.application.confirmation.')
      ],
      mutate: ({ label, action, elementKey }) => editing
        ? updateSuccessEvent(configuration.model, outcome.key, { label, action, elementKey })
        : createSuccessEvent(configuration.model, { transactionKey: editor.transactionKey, label, action, elementKey })
    };
  }

  function stepDefinition(title, label, elementKey, mutate) {
    return {
      title,
      copy: 'Steps define funnel order. The key must exactly match a data-flux-key on the connected service.',
      fields: [
        labelField('label', 'Step name', label),
        labelField('elementKey', 'Publisher data-flux-key', elementKey, 'For example, page.application.check or form.application.details.')
      ],
      mutate
    };
  }

  async function publish(buildNext) {
    if (loading) return;
    loading = true;
    try {
      const next = buildNext();
      root.setAttribute('aria-busy', 'true');
      const response = await fetch(`/api/service-model/${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next)
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) throw new Error('version_conflict');
      if (!response.ok) throw new Error(result.error ?? 'publish_failed');
      configuration = { ...configuration, model: next };
      editor = null;
      render();
      root.prepend(message(`Published model version ${next.version}. New interactions will use this configuration; historical interactions keep their original version.`, 'flux-model-manager__success-message'));
      onPublished(next);
    } catch (error) {
      const copy = error.message === 'version_conflict'
        ? 'Someone else published a newer model version. Reload the configuration before trying again.'
        : errorCopy(error.message);
      render();
      root.prepend(message(copy, 'flux-model-manager__error'));
    } finally {
      loading = false;
      root.removeAttribute('aria-busy');
    }
  }

  function confirmDelete(item) {
    const noun = item.type === 'transaction' ? 'funnel and all of its tasks and steps' : `${item.type} and everything beneath it`;
    if (globalThis.confirm(`Delete ${item.label}? This will remove the ${noun} from the next model version.`)) {
      void publish(() => deleteEntity(configuration.model, item.key));
    }
  }

  function confirmSuccessDelete(outcome) {
    if (globalThis.confirm(`Delete the ${outcome.label} success event from the next model version?`)) {
      void publish(() => deleteSuccessEvent(configuration.model, outcome.key));
    }
  }

  function openEditor(nextEditor) {
    editor = nextEditor;
    render();
    root.querySelector('.flux-model-manager__form input')?.focus();
  }

  function entities(type) {
    return configuration.model.entities.filter((candidate) => candidate.type === type).sort(byPosition);
  }

  function children(parentKey, type) {
    return configuration.model.entities.filter((candidate) => candidate.type === type && candidate.parent_key === parentKey).sort(byPosition);
  }

  function entity(key) {
    return configuration.model.entities.find((candidate) => candidate.key === key);
  }

  return { load };
}

function labelField(name, label, value, hint) {
  return { name, label, value, hint };
}

function formField({ name, label, value, hint }) {
  const group = element('div', 'govuk-form-group');
  const id = `flux-model-${name}`;
  const labelNode = element('label', 'govuk-label govuk-label--s', label);
  labelNode.htmlFor = id;
  group.append(labelNode);
  if (hint) {
    const hintNode = element('div', 'govuk-hint', hint);
    hintNode.id = `${id}-hint`;
    group.append(hintNode);
  }
  const input = element('input', 'govuk-input');
  input.id = id;
  input.name = name;
  input.value = value;
  input.required = true;
  input.maxLength = name === 'elementKey' ? 160 : name === 'action' ? 80 : 120;
  if (hint) input.setAttribute('aria-describedby', `${id}-hint`);
  group.append(input);
  return group;
}

function itemActions(definitions) {
  const actions = element('div', 'flux-model-manager__actions flux-model-manager__actions--item');
  for (const [label, handler, disabled = false] of definitions) {
    const button = actionButton(label, handler);
    button.disabled = disabled;
    actions.append(button);
  }
  return actions;
}

function actionButton(label, handler, className = 'govuk-button govuk-button--secondary govuk-button--small') {
  const button = element('button', className, label);
  button.type = 'button';
  if (handler) button.addEventListener('click', handler);
  return button;
}

function keyCopy(value) {
  return element('p', 'govuk-body-s flux-model-manager__key', value);
}

function message(copy, className = '') {
  return element('p', `govuk-body${className ? ` ${className}` : ''}`, copy);
}

function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function byPosition(left, right) {
  return left.position - right.position || left.key.localeCompare(right.key);
}

function errorCopy(code) {
  const messages = {
    label_required: 'Enter a name before publishing.',
    invalid_element_key: 'Enter a valid data-flux-key using lowercase letters, numbers, dots, hyphens or underscores.',
    invalid_action: 'Enter a valid Flux action using lowercase letters, numbers, dots, hyphens or underscores.',
    element_key_in_use: 'That data-flux-key is already assigned elsewhere in the model.',
    element_key_in_other_funnel: 'That data-flux-key belongs to another funnel.'
  };
  return messages[code] ?? 'The model could not be published. Check the configuration and try again.';
}
