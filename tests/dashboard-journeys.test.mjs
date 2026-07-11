import test from 'node:test';
import assert from 'node:assert/strict';
import { groupJourneys } from '../src/product/router.mjs';

test('dashboard groups controlled narrative events into their individual sessions', () => {
  const journeys = groupJourneys(
    [
      { id: 'session-returning', visitor_id: 'visitor-1', is_returning_visitor: 1 },
      { id: 'session-new', visitor_id: 'visitor-2', is_returning_visitor: 0 }
    ],
    [
      { session_id: 'session-new', narrative: 'Click on control “auto button 1”.', occurred_at_ms: 2 },
      { session_id: 'session-returning', narrative: 'Type on field “auto input text 2”.', occurred_at_ms: 1 }
    ]
  );

  assert.deepEqual(journeys.map(({ id, events }) => [id, events.map((event) => event.narrative)]), [
    ['session-returning', ['Type on field “auto input text 2”.']],
    ['session-new', ['Click on control “auto button 1”.']]
  ]);
});
