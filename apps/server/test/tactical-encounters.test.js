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
test('presentation measurement is persisted and validated', () => {
  const state = defaultState(); state.presentation.measurement = { start:{x:0,y:0}, end:{x:30,y:40}, distance:25, unit:'ft' };
  assert.deepEqual(normalizeState(state).presentation.measurement, state.presentation.measurement);
  assert.deepEqual(validateState(state), []);
  state.presentation.measurement.distance = -1;
  assert.match(validateState(state).join(','), /invalid presentation measurement/);
});
test('normalization repairs stale family membership in both directions', () => {
  const state = defaultState();
  state.families = [{ id:'a', name:'A', memberIds:['token','token','missing'], active:true }, { id:'b', name:'B', memberIds:[], active:true }];
  state.tokens.push({ id:'token', name:'Token', x:0, y:0, size:50, category:'player', conditions:[], visible:true, familyId:'b' });
  const normalized = normalizeState(state);
  assert.deepEqual(normalized.families[0].memberIds, []);
  assert.deepEqual(normalized.families[1].memberIds, ['token']);
  assert.equal(normalized.tokens[0].familyId, 'b');
});
