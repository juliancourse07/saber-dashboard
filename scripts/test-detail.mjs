import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = readFileSync(new URL('../detalle.html', import.meta.url), 'utf8');
const script = html.split('<script>')[1].split("document.querySelectorAll('.tabs button').forEach(b => b.onclick")[0];
function context() {
  const ctx = vm.createContext({URLSearchParams, document: {querySelector: () => ({}), querySelectorAll: () => []}});
  vm.runInContext(script, ctx);
  return code => vm.runInContext(code, ctx);
}

test('todos los filtros, incluso las sugerencias de periodo, respetan la ventana descubierta', async () => {
  const run = context();
  await run(`meta = async () => ({columns:[{fieldName:'periodo',dataTypeName:'text'}]});
    soql = async () => ['20195','20202','20211','20212','20232','20252',null].map(periodo => ({periodo}));
    loadSchema(0, {periodo:'20195'})`);
  assert.equal(run(`where('periodo')`), "periodo in ('20211','20212','20232','20252')");
  assert.equal(run('S.filters.periodo'), undefined);
  run("S.filters.periodo = '20252'");
  assert.match(run('q({}).$where'), /AND periodo='20252'/);
});

test('los rankings y listas continúan más allá de la primera página', async () => {
  const run = context();
  const values = await run(`soql = async (_, p) => p.$offset === 0 ? Array(1500).fill(0) : [1,2];
    allGroups('dataset', {}, 0)`);
  assert.equal(values.length, 1502);
  assert.equal(values.at(-1), 2);
});
