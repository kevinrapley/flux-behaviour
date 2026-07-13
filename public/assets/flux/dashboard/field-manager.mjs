import {
  createField,
  createQuestionGroup,
  deleteFieldEntity,
  updateField,
  updateQuestionGroup
} from './field-configuration.mjs';

export function createFieldManager({ root, tenantId, onPublished = () => {} }) {
  let configuration = null;
  let editor = null;
  let loading = false;

  async function load() {
    if (!root || !tenantId || loading || editor) return;
    loading = true;
    if (!configuration) root.replaceChildren(message('Loading field configuration…'));
    try {
      const response = await fetch(`/api/service-model/${encodeURIComponent(tenantId)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('configuration_unavailable');
      configuration = await response.json();
      editor = null;
      render();
    } catch {
      root.replaceChildren(message('Field configuration could not be loaded. Refresh the dashboard and try again.', 'flux-model-manager__error'));
    } finally {
      loading = false;
    }
  }

  function render() {
    if (!configuration?.model) return;
    const editable = configuration.role === 'owner';
    const fragment = document.createDocumentFragment();
    fragment.append(message(`Published model version ${configuration.model.version}.`, 'flux-model-manager__version'));
    fragment.append(message(editable
      ? 'Question groups declare complexity from 1 to 7. Every field uses an exact publisher data-flux-key and is marked required or optional.'
      : 'You can view this configuration, but only a tenant owner can change it.'));
    if (editable) {
      const toolbar = element('div', 'flux-model-manager__actions');
      const addQuestion = actionButton('Add question group', () => openEditor({ type: 'question-create' }), 'govuk-button');
      addQuestion.disabled = entities('step').length === 0;
      toolbar.append(addQuestion);
      fragment.append(toolbar);
    }
    if (editor) fragment.append(renderEditor());
    fragment.append(renderQuestions(editable));
    root.replaceChildren(fragment);
  }

  function renderQuestions(editable) {
    const wrapper = element('div', 'flux-field-manager__questions');
    const questions = orderedQuestions();
    if (questions.length === 0) {
      wrapper.append(message('No question groups or fields are configured yet. Add an ordered step first, then create a question group and its fields.', 'flux-model-manager__empty'));
      return wrapper;
    }
    for (const question of questions) wrapper.append(renderQuestion(question, editable));
    return wrapper;
  }

  function renderQuestion(question, editable) {
    const article = element('article', 'flux-field-manager__question');
    const heading = element('div', 'flux-model-manager__item-heading');
    const title = element('div');
    title.append(
      element('h3', 'govuk-heading-m', question.label),
      message(hierarchyPath(question.parent_key), 'flux-field-manager__path'),
      keyCopy(question.key),
      message(`Declared complexity: ${question.complexity} of 7`, 'flux-field-manager__complexity')
    );
    heading.append(title);
    if (editable) heading.append(itemActions([
      ['Edit group', () => openEditor({ type: 'question-edit', entityKey: question.key })],
      ['Delete group', () => confirmDelete(question)]
    ]));
    article.append(heading);

    const fieldHeading = element('div', 'flux-model-manager__subheading');
    fieldHeading.append(element('h4', 'govuk-heading-s', 'Fields'));
    if (editable) fieldHeading.append(actionButton('Add field', () => openEditor({ type: 'field-create', questionKey: question.key })));
    article.append(fieldHeading);
    const fields = children(question.key, 'field');
    if (fields.length === 0) article.append(message('No fields are configured in this group.'));
    for (const field of fields) article.append(renderField(field, editable));
    return article;
  }

  function renderField(field, editable) {
    const row = element('div', 'flux-field-manager__field');
    const binding = configuration.model.bindings.find(({ entity_key }) => entity_key === field.key);
    const copy = element('div');
    copy.append(
      element('strong', '', field.label),
      message(field.required ? 'Required field' : 'Optional field', 'flux-field-manager__status'),
      keyCopy(binding?.element_key ?? 'No direct data-flux-key binding')
    );
    row.append(copy);
    if (editable) row.append(itemActions([
      ['Edit field', () => openEditor({ type: 'field-edit', entityKey: field.key })],
      ['Delete field', () => confirmDelete(field)]
    ]));
    return row;
  }

  function renderEditor() {
    const form = element('form', 'flux-model-manager__form');
    form.noValidate = true;
    const definition = editorDefinition();
    form.append(element('h3', 'govuk-heading-m', definition.title), message(definition.copy));
    for (const field of definition.fields) form.append(renderFormField(field));
    const actions = element('div', 'flux-model-manager__actions');
    const save = actionButton('Save and publish', null, 'govuk-button');
    save.type = 'submit';
    actions.append(save, actionButton('Cancel', () => { editor = null; render(); }, 'govuk-button govuk-button--secondary'));
    form.append(actions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void publish(() => definition.mutate(Object.fromEntries(new FormData(form))));
    });
    return form;
  }

  function editorDefinition() {
    if (editor.type === 'question-create') return {
      title: 'Add question group',
      copy: 'Choose the ordered step that exposes these fields, then declare the service complexity of answering the question.',
      fields: [
        selectDefinition('stepKey', 'Parent ordered step', stepOptions()),
        inputDefinition('label', 'Question or field group name', ''),
        complexityDefinition(3)
      ],
      mutate: ({ stepKey, label, complexity }) => createQuestionGroup(configuration.model, { stepKey, label, complexity })
    };
    if (editor.type === 'question-edit') {
      const question = entity(editor.entityKey);
      return {
        title: 'Edit question group',
        copy: `The stable key ${question.key} will not change. Complexity applies to every field in this group.`,
        fields: [inputDefinition('label', 'Question or field group name', question.label), complexityDefinition(question.complexity)],
        mutate: ({ label, complexity }) => updateQuestionGroup(configuration.model, question.key, { label, complexity })
      };
    }
    const editing = editor.type === 'field-edit';
    const field = editing ? entity(editor.entityKey) : null;
    const binding = field ? configuration.model.bindings.find(({ entity_key }) => entity_key === field.key) : null;
    return {
      title: editing ? 'Edit field' : 'Add field',
      copy: editing
        ? `The stable key ${field.key} will not change. Its complexity comes from the parent question group.`
        : 'The publisher data-flux-key must exactly match the field attribute on the connected service.',
      fields: [
        inputDefinition('label', 'Field name', field?.label ?? ''),
        inputDefinition('elementKey', 'Publisher data-flux-key', binding?.element_key ?? '', 'For example, field.application.contact-email.'),
        selectDefinition('required', 'Field requirement', [
          { value: 'true', label: 'Required' },
          { value: 'false', label: 'Optional' }
        ], String(field?.required ?? true))
      ],
      mutate: ({ label, elementKey, required }) => editing
        ? updateField(configuration.model, field.key, { label, elementKey, required })
        : createField(configuration.model, { questionKey: editor.questionKey, label, elementKey, required })
    };
  }

  function complexityDefinition(value) {
    return selectDefinition('complexity', 'Declared complexity', [
      { value: '1', label: '1 — very simple' },
      { value: '2', label: '2 — simple' },
      { value: '3', label: '3 — straightforward' },
      { value: '4', label: '4 — moderate' },
      { value: '5', label: '5 — involved' },
      { value: '6', label: '6 — complex' },
      { value: '7', label: '7 — very complex' }
    ], String(value), 'Declare service complexity, not a judgement about the person completing the field.');
  }

  async function publish(buildNext) {
    if (loading) return;
    loading = true;
    try {
      const next = buildNext();
      root.setAttribute('aria-busy', 'true');
      const response = await fetch(`/api/service-model/${encodeURIComponent(tenantId)}`, {
        method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next)
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) throw new Error('version_conflict');
      if (!response.ok) throw new Error(result.error ?? 'publish_failed');
      configuration = { ...configuration, model: next };
      editor = null;
      render();
      root.prepend(message(`Published model version ${next.version}. New interactions use this configuration; historical interactions keep their original version.`, 'flux-model-manager__success-message'));
      onPublished(next);
    } catch (error) {
      render();
      root.prepend(message(errorCopy(error.message), 'flux-model-manager__error'));
    } finally {
      loading = false;
      root.removeAttribute('aria-busy');
    }
  }

  function confirmDelete(item) {
    let copy = item.type === 'question'
      ? `Delete ${item.label} and every field in this group from the next model version?`
      : `Delete ${item.label} from the next model version?`;
    const dependent = dependentOutcomes(item);
    if (dependent.total > 0) {
      copy += ` This also deletes ${dependent.total} configured outcome${dependent.total === 1 ? '' : 's'}`;
      if (dependent.success > 0) copy += `, including ${dependent.success} configured success event${dependent.success === 1 ? '' : 's'}`;
      copy += '.';
    }
    if (globalThis.confirm(copy)) void publish(() => deleteFieldEntity(configuration.model, item.key));
  }

  function dependentOutcomes(item) {
    const entityKeys = new Set([item.key]);
    if (item.type === 'question') {
      for (const field of children(item.key, 'field')) entityKeys.add(field.key);
    }
    const elementKeys = new Set(configuration.model.bindings
      .filter(({ entity_key }) => entityKeys.has(entity_key))
      .map(({ element_key }) => element_key));
    const outcomeKeys = new Set(configuration.model.key_events
      .filter(({ element_key }) => elementKeys.has(element_key))
      .map(({ outcome_key }) => outcome_key));
    const outcomes = configuration.model.outcomes.filter(({ key }) => outcomeKeys.has(key));
    return { total: outcomes.length, success: outcomes.filter(({ type }) => type === 'success').length };
  }

  function openEditor(nextEditor) {
    editor = nextEditor;
    render();
    root.querySelector('.flux-model-manager__form input, .flux-model-manager__form select')?.focus();
  }

  function orderedQuestions() {
    const result = [];
    for (const transaction of rootEntities('transaction')) {
      for (const task of children(transaction.key, 'task')) {
        for (const step of children(task.key, 'step')) result.push(...children(step.key, 'question'));
      }
    }
    return result;
  }

  function stepOptions() {
    const options = [];
    for (const transaction of rootEntities('transaction')) {
      for (const task of children(transaction.key, 'task')) {
        for (const step of children(task.key, 'step')) {
          options.push({ value: step.key, label: `${transaction.label} — ${task.label} — ${step.label}` });
        }
      }
    }
    return options;
  }

  function hierarchyPath(entityKey) {
    const labels = [];
    let current = entity(entityKey);
    while (current && current.type !== 'service') {
      labels.unshift(current.label);
      current = current.parent_key ? entity(current.parent_key) : null;
    }
    return labels.join(' › ');
  }

  function rootEntities(type) {
    return entities(type).filter((candidate) => entity(candidate.parent_key)?.type === 'service');
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

function inputDefinition(name, label, value, hint) {
  return { type: 'input', name, label, value, hint };
}

function selectDefinition(name, label, options, value = options[0]?.value ?? '', hint) {
  return { type: 'select', name, label, options, value, hint };
}

function renderFormField(definition) {
  const group = element('div', 'govuk-form-group');
  const id = `flux-field-model-${definition.name}`;
  const label = element('label', 'govuk-label govuk-label--s', definition.label);
  label.htmlFor = id;
  group.append(label);
  if (definition.hint) {
    const hint = element('div', 'govuk-hint', definition.hint);
    hint.id = `${id}-hint`;
    group.append(hint);
  }
  const control = definition.type === 'select' ? element('select', 'govuk-select') : element('input', 'govuk-input');
  control.id = id;
  control.name = definition.name;
  control.required = true;
  if (definition.hint) control.setAttribute('aria-describedby', `${id}-hint`);
  if (definition.type === 'select') {
    for (const optionDefinition of definition.options) {
      const option = element('option', '', optionDefinition.label);
      option.value = optionDefinition.value;
      option.selected = option.value === definition.value;
      control.append(option);
    }
  } else {
    control.value = definition.value;
    control.maxLength = 120;
  }
  group.append(control);
  return group;
}

function itemActions(definitions) {
  const actions = element('div', 'flux-model-manager__actions flux-model-manager__actions--item');
  for (const [label, handler] of definitions) actions.append(actionButton(label, handler));
  return actions;
}

function actionButton(label, handler, className = 'govuk-button govuk-button--secondary govuk-button--small') {
  const button = element('button', className, label);
  button.type = 'button';
  if (handler) button.addEventListener('click', handler);
  return button;
}

function keyCopy(value) {
  return message(value, 'flux-model-manager__key');
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
    version_conflict: 'Someone else published a newer model version. Reload the configuration before trying again.',
    label_required: 'Enter a name before publishing.',
    invalid_complexity: 'Choose a declared complexity from 1 to 7.',
    invalid_element_key: 'Enter a valid data-flux-key using lowercase letters, numbers, dots, hyphens or underscores.',
    global_autocomplete_key: 'Use the field-specific data-flux-key from the connected service. Global autocomplete categories cannot identify a field.',
    auth_scoped_key: 'Authentication-scoped keys cannot be configured as fields. Flux excludes authentication interactions from field analytics.',
    invalid_required_status: 'Choose whether the field is required or optional.',
    element_key_in_use: 'That data-flux-key is already assigned elsewhere in the model.'
  };
  return messages[code] ?? 'The field configuration could not be published. Check the details and try again.';
}
