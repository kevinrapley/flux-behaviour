const ACTION_LABELS = Object.freeze({ click: 'Click', touch: 'Touch', tab: 'Tab', focus: 'Focus', input: 'Type', nav: 'Navigate', kbd: 'Key interaction', assist: 'Open help' });

export function describeInteraction(event) {
  const metadata = event.metadata ?? event;
  const method = ACTION_LABELS[metadata.interaction_type] ?? ACTION_LABELS[event.event_class] ?? 'Interact';
  const label = String(event.element_key ?? 'unknown').replace(/[._:-]+/g, ' ').trim();
  const parts = [`${method} on ${event.role || 'element'} “${label || 'unknown'}”`];
  const dwell = Number.isInteger(metadata.duration_ms) ? metadata.duration_ms : null;
  const typed = Number.isInteger(metadata.key_press_count) ? metadata.key_press_count : Number.isInteger(metadata.value_length) ? metadata.value_length : null;
  if (dwell !== null) parts.push(`after dwelling for ${Math.round(dwell / 100) / 10}s`);
  if (typed !== null) parts.push(`then typing ${typed} character${typed === 1 ? '' : 's'}`);
  if (metadata.pointer_type && metadata.pointer_type !== 'unknown') parts.push(`using ${metadata.pointer_type}`);
  return `${parts.join(', ')}.`;
}
