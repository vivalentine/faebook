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
  const state = defaultState(); state.presentation.measurement = { start:{x:0,y:0}, end:{x:30,y:40}, distance:25, horizontal:25, vertical:0, mode:'2d', unit:'ft' };
  assert.deepEqual(normalizeState(state).presentation.measurement, {...state.presentation.measurement,start:{...state.presentation.measurement.start,altitude:0},end:{...state.presentation.measurement.end,altitude:0},mode:'2d',horizontal:25,vertical:0});
  assert.deepEqual(validateState(state), []);
  state.presentation.measurement.distance = -1;
  assert.match(validateState(state).join(','), /invalid presentation measurement/);
});
test('legacy positioned objects normalize altitude to zero and preserve serialized altitude', () => {
  const state=defaultState(); state.tokens.push({id:'flyer',name:'Flyer',x:1,y:2,size:50,category:'enemy',conditions:[],visible:true});
  assert.equal(normalizeState(JSON.parse(JSON.stringify(state))).tokens[0].altitude,0); state.tokens[0].altitude=40;
  assert.equal(normalizeState(JSON.parse(JSON.stringify(state))).tokens[0].altitude,40);
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

test('normalizeState defaults legacy tether style and anaglyph calibration',()=>{
 const state=defaultState();state.tethers=[{id:'legacy',category:'anchor',active:true,from:{x:0,y:0},to:{x:1,y:1}}];
 const normalized=normalizeState(state,1);assert.equal(normalized.tethers[0].style,'normal');assert.deepEqual(normalized.battlefield.anaglyph,{separation:6,opacity:.45,strokeWidth:2,red:'#ff1744',cyan:'#00e5ff'});
});
test('normalizeState preserves anaglyph tether style and battlefield calibration',()=>{const state=defaultState();state.tethers=[{id:'a',style:'anaglyph',category:'anchor',active:true,from:{x:0,y:0},to:{x:1,y:1}}];state.battlefield.anaglyph={separation:9,opacity:.6,strokeWidth:3,red:'#ff0000',cyan:'#00ffff'};const normalized=normalizeState(state,1);assert.equal(normalized.tethers[0].style,'anaglyph');assert.equal(normalized.battlefield.anaglyph.separation,9)});
