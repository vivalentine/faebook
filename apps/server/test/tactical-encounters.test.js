const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../../../fixtures/tactical/idol-willow-finale.json');
const { defaultState, normalizeState, validateState } = require('../tactical-encounters');
test('old encounter states gain finale collections without a schema reset', () => {
  const state = defaultState(); delete state.families;
  assert.deepEqual(normalizeState(state).families, []);
});
test('Idol Willow finale fixture is accepted by tactical state validation', () => {
  assert.deepEqual(validateState(normalizeState(fixture.state)), []);
});
test('DM tactical state rejects invalid polygons', () => {
  const state = defaultState(); state.zones.push({ id:'bad', name:'Bad', kind:'hazard', active:true, visible:true, points:[{x:0,y:0},{x:1,y:1}] });
  assert.match(validateState(state).join(','), /invalid zone data/);
});
