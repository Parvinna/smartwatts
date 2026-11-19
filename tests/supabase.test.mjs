import test from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseAPI} from '../sw-supabase.js';

const store = new Map();
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: k => store.delete(k)
};
const cfg = { url: 'https://exemplo.supabase.co', publishableKey: 'sb_publishable_example_for_testing_only' };
const jsonResponse = (data, status=200) => ({
  ok: status >= 200 && status < 300, status,
  text: async () => JSON.stringify(data)
});

test('configuração: URLs e chaves de exemplo não são consideradas completas', () => {
  assert.equal(new SupabaseAPI({ url: 'https://SEU-PROJETO.supabase.co', publishableKey: 'COLE_SUA_CHAVE_PUBLICA_AQUI' }).configured, false);
  assert.equal(new SupabaseAPI(cfg).configured, true);
});

test('login: envia senha somente ao Supabase Auth e guarda token de sessão', async t => {
  store.clear();
  const old = globalThis.fetch;
  t.after(() => { globalThis.fetch = old; });
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/auth\/v1\/token\?grant_type=password$/);
    assert.equal(init.headers.apikey, cfg.publishableKey);
    assert.deepEqual(JSON.parse(init.body), { email: 'estudante@example.org', password: 'uma-senha-forte' });
    return jsonResponse({ access_token: 'token1', refresh_token: 'token2', expires_in: 3600, user: { id: 'user-1', email: 'estudante@example.org' } });
  };
  const api = new SupabaseAPI(cfg);
  await api.signIn('estudante@example.org', 'uma-senha-forte');
  assert.equal(api.userId, 'user-1');
  assert.equal(api.email, 'estudante@example.org');
  assert.equal(api.session.access_token, 'token1');
});

test('insert: envia token autenticado e retorna linha persistida', async t => {
  const old = globalThis.fetch;
  t.after(() => { globalThis.fetch = old; });
  const api = new SupabaseAPI(cfg);
  api.session = { access_token: 'TOKEN', user: { id: 'ID' } };
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/rest\/v1\/sw_locations\?select=\*$/);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer TOKEN');
    assert.equal(init.headers.Prefer, 'return=representation');
    assert.equal(JSON.parse(init.body).title, 'Minha casa');
    return jsonResponse([{ id: 'loc-123', title: 'Minha casa' }], 201);
  };
  assert.equal((await api.insert('sw_locations', { title: 'Minha casa' })).id, 'loc-123');
});

test('selectAll: pagina consultas maiores que mil linhas', async t => {
  const old = globalThis.fetch;
  t.after(() => { globalThis.fetch = old; });
  let calls = 0;
  const api = new SupabaseAPI(cfg);
  api.session = { access_token: 'TOKEN' };
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/rest\/v1\/sw_readings/);
    calls++;
    return jsonResponse(calls === 1 ? Array.from({length: 1000}, (_, i) => ({ id: i })) : [{ id: 1000 }]);
  };
  assert.equal((await api.selectAll('sw_readings')).length, 1001);
  assert.equal(calls, 2);
});

test('remove: exige retorno do ID, evitando falso sucesso com RLS', async t => {
  const old = globalThis.fetch;
  t.after(() => { globalThis.fetch = old; });
  const api = new SupabaseAPI(cfg);
  api.session = { access_token: 'TOKEN' };
  globalThis.fetch = async () => jsonResponse([]);
  await assert.rejects(api.remove('sw_locations', 'item-1'), /não encontrado ou acesso negado/i);
});
