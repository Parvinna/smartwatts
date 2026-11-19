import test from 'node:test';
import assert from 'node:assert/strict';
import { Banco } from '../sw-supabase.js';
const memoria = new Map();
globalThis.localStorage = {
  getItem: k => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, v),
  removeItem: k => memoria.delete(k)
};
const config = {
  url: 'https://exemplo.supabase.co',
  publishableKey: 'sb_publishable_example_for_testing_only'
};
const respostaJson = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(data)
});
test('configuração: URLs e chaves de exemplo não são consideradas completas', () => {
  assert.equal(
    new Banco({
      url: 'https://SEU-PROJETO.supabase.co',
      publishableKey: 'COLE_SUA_CHAVE_PUBLICA_AQUI'
    }).configurado,
    false
  );
  assert.equal(new Banco(config).configurado, true);
});
test('login: envia senha somente ao Supabase Auth e guarda token de sessão', async t => {
  memoria.clear();
  const anterior = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = anterior;
  });
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/auth\/v1\/token\?grant_type=password$/);
    assert.equal(init.headers.apikey, config.publishableKey);
    assert.deepEqual(JSON.parse(init.body), {
      email: 'estudante@example.org',
      password: 'uma-senha-forte'
    });
    return respostaJson({
      access_token: 'token1',
      refresh_token: 'token2',
      expires_in: 3600,
      user: {
        id: 'user-1',
        email: 'estudante@example.org'
      }
    });
  };
  const banco = new Banco(config);
  await banco.entrar('estudante@example.org', 'uma-senha-forte');
  assert.equal(banco.usuarioId, 'user-1');
  assert.equal(banco.email, 'estudante@example.org');
  assert.equal(banco.sessao.access_token, 'token1');
});
test('inserir: envia token autenticado e retorna linha persistida', async t => {
  const anterior = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = anterior;
  });
  const banco = new Banco(config);
  banco.sessao = {
    access_token: 'TOKEN',
    user: {
      id: 'ID'
    }
  };
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/rest\/v1\/sw_locations\?select=\*$/);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer TOKEN');
    assert.equal(init.headers.Prefer, 'return=representation');
    assert.equal(JSON.parse(init.body).title, 'Minha casa');
    return respostaJson(
      [
        {
          id: 'loc-123',
          title: 'Minha casa'
        }
      ],
      201
    );
  };
  assert.equal(
    (
      await banco.inserir('sw_locations', {
        title: 'Minha casa'
      })
    ).id,
    'loc-123'
  );
});
test('listar: pagina consultas maiores que mil linhas', async t => {
  const anterior = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = anterior;
  });
  let chamadas = 0;
  const banco = new Banco(config);
  banco.sessao = {
    access_token: 'TOKEN'
  };
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/rest\/v1\/sw_readings/);
    chamadas++;
    return respostaJson(
      chamadas === 1
        ? Array.from(
            {
              length: 1000
            },
            (_, i) => ({
              id: i
            })
          )
        : [
            {
              id: 1000
            }
          ]
    );
  };
  assert.equal((await banco.listar('sw_readings')).length, 1001);
  assert.equal(chamadas, 2);
});
test('excluir: exige retorno do ID, evitando falso sucesso com RLS', async t => {
  const anterior = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = anterior;
  });
  const banco = new Banco(config);
  banco.sessao = {
    access_token: 'TOKEN'
  };
  globalThis.fetch = async () => respostaJson([]);
  await assert.rejects(banco.excluir('sw_locations', 'item-1'), /não encontrado ou acesso negado/i);
});
