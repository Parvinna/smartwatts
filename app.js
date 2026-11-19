'use strict';

const elemento = s => document.querySelector(s),
  elementos = s => [...document.querySelectorAll(s)];
const desenhos = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  leaf: '<path d="M20 3C7 2 1 9 5 16s17 4 15-13Z"/><path d="M4 21 15 9"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
  wallet: '<path d="M20 8V5H4v14h16V8ZM4 8h16"/><path d="M20 11h-6v5h6M17 13.5h.1"/>',
  activity: '<path d="M2 12h4l3-8 6 16 3-8h4"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3v.1"/>',
  pie: '<path d="M12 3v9h9A9 9 0 1 1 12 3Z"/><path d="M16 3v5h5a9 9 0 0 0-5-5Z"/>',
  office: '<path d="M5 21V3h14v18M9 7h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1M9 21v-3h6v3"/>',
  warehouse: '<path d="M3 21V8l9-5 9 5v13M7 21V11h10v10M7 15h10M7 18h10"/>'
};
const icone = n =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${desenhos[n] || desenhos.home}</svg>`;
function carregarIcones() {
  elementos('[data-icon]').forEach(e => (e.innerHTML = icone(e.dataset.icon)));
}
const escapar = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c]
  );
const numero = n =>
    new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1
    }).format(n),
  reais = n =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(n);
const cores = ['#527448', '#94b86d', '#d4e5b4', '#c2ab72', '#789b9b'];
import { Banco } from './sw-supabase.js';
const banco = new Banco(window.SMARTWATTS_CONFIG || {});
let dados = {
  tariff: 0.89,
  locations: [],
  readings: []
};
let unidade = 'kwh',
  pagina = 'overview',
  salvando = false;
let tempoAviso;
function avisar(t) {
  elemento('#toast').textContent = t;
  elemento('#toast').classList.add('show');
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(() => elemento('#toast').classList.remove('show'), 4500);
}
function mostrarErro(e) {
  console.error(e);
  avisar('Falha ao comunicar com o banco: ' + (e?.message || 'erro desconhecido'));
}
function marcarSalvamento(v) {
  salvando = v;
  elementos('[data-db-action]').forEach(b => (b.disabled = v));
}
function exigirLogin() {
  if (!banco.usuarioId) throw Error('Entre na sua conta para continuar.');
}
function lerLocal(x) {
  return {
    id: x.id,
    title: x.title,
    type: x.type,
    city: x.city,
    street: x.street,
    number: x.number,
    cep: x.cep,
    district: x.district,
    extra: x.extra
  };
}
function lerLeitura(x) {
  return {
    id: x.id,
    location: x.location_id,
    date: x.reading_date,
    kwh: Number(x.kwh),
    due: x.due_date || ''
  };
}
async function carregar() {
  exigirLogin();
  const [settings, locations, readings] = await Promise.all([
    banco.listar('sw_settings', 'user_id'),
    banco.listar('sw_locations'),
    banco.listar('sw_readings')
  ]);
  dados = {
    tariff: settings.length ? Number(settings[0].tariff) : 0.89,
    locations: locations.map(lerLocal),
    readings: readings.map(lerLeitura)
  };
  atualizarTela();
}
function mostrarLogin(show) {
  document.body.classList.toggle('auth-required', show);
  elemento('#auth-screen').hidden = !show;
  if (!show) {
    elemento('#auth-password').value = '';
  }
}
function mostrarUsuario() {
  const email = banco.email || 'Conta SmartWatts';
  elemento('#profile-email').textContent = email;
  elemento('#profile-name').textContent = email.split('@')[0] || 'Meu espaço';
  elemento('#top-avatar').textContent = email.slice(0, 2).toUpperCase();
  elemento('#user-avatar').textContent = email.slice(0, 2).toUpperCase();
}
function avisoLogin(msg, type = 'info') {
  const el = elemento('#auth-message');
  el.textContent = msg;
  el.dataset.type = type;
}
async function entrar() {
  elemento('#auth-submit').disabled = true;
  avisoLogin('Conectando ao Supabase...');
  try {
    const email = elemento('#auth-email').value.trim();
    const password = elemento('#auth-password').value;
    if (!email || !password) throw Error('Informe e-mail e senha.');
    if (elemento('#auth-mode').value === 'signup') {
      const result = await banco.cadastrar(email, password);
      if (!result.signedIn) {
        avisoLogin('Conta criada. Confirme seu e-mail e volte para entrar.', 'success');
        elemento('#auth-mode').value = 'login';
        elemento('#auth-submit').textContent = 'Entrar';
        return;
      }
    } else await banco.entrar(email, password);
    await abrirConta();
  } catch (err) {
    avisoLogin(err.message || 'Falha na autenticação.', 'error');
  } finally {
    elemento('#auth-submit').disabled = false;
  }
}
async function abrirConta() {
  mostrarUsuario();
  await carregar();
  elemento('#app-footer-note').textContent = 'Dados sincronizados no Supabase';
  mostrarLogin(false);
  abrirPagina(location.hash.slice(1) || 'overview');
  avisar('Dados sincronizados com o Supabase.');
}
async function iniciar() {
  elemento('#month-filter').value = dataHoje().slice(0, 7);
  const footer = elemento('#app-footer-note');
  footer.textContent = 'Aguardando autenticação no Supabase';
  elemento('#auth-config').hidden = banco.configurado;
  elemento('#auth-form').hidden = !banco.configurado;
  mostrarLogin(true);
  carregarIcones();
  if (!banco.configurado) {
    avisoLogin('Preencha config.js com a URL e a chave pública do projeto Supabase.', 'error');
    return;
  }
  try {
    const user = await banco.restaurarSessao();
    if (user) {
      await abrirConta();
    } else avisoLogin('Entre com sua conta do SmartWatts ou crie uma nova.');
  } catch (err) {
    avisoLogin('Não foi possível carregar os dados: ' + err.message, 'error');
    mostrarLogin(true);
  }
}
function montarOpcoes(sel, all = true) {
  const old = sel.value;
  sel.innerHTML =
    (all ? '<option value="all">Todos os locais</option>' : '') +
    dados.locations
      .map(l => `<option value="${escapar(l.id)}">${escapar(l.title)}</option>`)
      .join('');
  if ([...sel.options].some(o => o.value === old)) sel.value = old;
}
function filtrar(
  month = elemento('#month-filter').value,
  loc = elemento('#location-filter').value
) {
  return dados.readings.filter(
    r => (!month || r.date.startsWith(month)) && (!loc || loc === 'all' || r.location === loc)
  );
}
const somar = rs => rs.reduce((n, r) => n + Number(r.kwh), 0);
function abrirPagina(p) {
  pagina = ['overview', 'locations', 'history'].includes(p) ? p : 'overview';
  elementos('.page').forEach(e => (e.hidden = e.id !== pagina));
  elementos('.nav-item[data-page]').forEach(e =>
    e.classList.toggle('active', e.dataset.page === pagina)
  );
  const titles = {
    overview: [
      'Sua energia, sob controle',
      'Uma visão clara do consumo. Mais espaço para economizar.',
      'Visão geral'
    ],
    locations: [
      'Cada espaço, uma nova perspectiva',
      'Acompanhe a energia dos lugares que importam para você.',
      'Meus locais'
    ],
    history: [
      'Sua energia tem uma história',
      'Todas as leituras, organizadas para facilitar suas escolhas.',
      'Histórico'
    ]
  };
  elemento('#page-title').innerHTML = titles[pagina][0] + '<span>.</span>';
  elemento('#page-subtitle').textContent = titles[pagina][1];
  elemento('#breadcrumb-title').textContent = titles[pagina][2];
  history.replaceState(null, '', '#' + pagina);
  atualizarTela();
}
function mostrarLocais(container, editable = false) {
  container.innerHTML = dados.locations.length
    ? dados.locations
        .map((l, i) => {
          const k = somar(filtrar(elemento('#month-filter').value, l.id));
          return `<article class="location-card"><div class="location-head"><span class="location-icon">${icone(l.type)}</span><div><h3>${escapar(l.title)}</h3><p>${escapar(l.city || 'Endereço não informado')}</p></div><button data-view-location="${escapar(l.id)}" aria-label="Ver consumo de ${escapar(l.title)}">↗</button></div><div class="location-metrics"><strong>${numero(k)}<small>kWh</small></strong><span>${reais(k * dados.tariff)}</span></div>${editable ? `<p class="modal-copy" style="font-size:10px;margin-top:12px">${escapar(l.street)}${l.number ? ', ' + escapar(l.number) : ''} ${escapar(l.extra)}</p><div class="location-actions"><button class="text-button" data-edit-location="${escapar(l.id)}">Editar local</button><button class="text-button danger" data-delete-location="${escapar(l.id)}">Excluir</button></div>` : ''}</article>`;
        })
        .join('')
    : '<div class="empty">Nenhum local cadastrado. Adicione seu primeiro espaço.</div>';
}
function atualizarTela() {
  montarOpcoes(elemento('#location-filter'));
  montarOpcoes(elemento('#history-location'));
  elemento('#location-count').textContent = dados.locations.length;
  const rows = filtrar(),
    k = somar(rows);
  const month = elemento('#month-filter').value;
  const date = new Date((month || new Date().toISOString().slice(0, 7)) + '-01T12:00:00');
  elemento('#period-caption').textContent = month
    ? date.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
      })
    : 'Todos os períodos';
  elemento('#stat-consumption').innerHTML = `${numero(k)} <small>kWh</small>`;
  elemento('#stat-cost').textContent = reais(k * dados.tariff);
  elemento('#stat-average').innerHTML =
    `${numero(rows.length ? k / rows.length : 0)} <small>kWh</small>`;
  elemento('#stat-locations').innerHTML =
    `${dados.locations.length.toString().padStart(2, '0')} <small>locais</small>`;
  elemento('#reading-count').textContent = `${rows.length} leituras neste período`;
  elemento('#tariff-label').textContent = reais(dados.tariff) + '/kWh';
  date.setMonth(date.getMonth() - 1);
  const prev = somar(
    filtrar(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  );
  elemento('#consumption-change').textContent = prev
    ? `${numero(((k - prev) / prev) * 100)}% vs. total do mês anterior`
    : 'Sem comparação anterior';
  desenharGrafico(rows);
  const sums = dados.locations
    .map(l => ({
      l,
      v: somar(rows.filter(r => r.location === l.id))
    }))
    .filter(x => x.v > 0);
  let pos = 0;
  elemento('#donut').style.background = k
    ? `conic-gradient(${sums
        .map((s, i) => {
          const start = pos;
          pos += (s.v / k) * 100;
          return `${cores[i % cores.length]} ${start}% ${pos}%`;
        })
        .join(',')})`
    : '#ecf1e6';
  elemento('#donut-total').textContent = numero(k);
  elemento('#breakdown-legend').innerHTML = sums.length
    ? sums
        .map(
          (s, i) =>
            `<div class="legend-row"><i style="background:${cores[i % cores.length]}"></i>${escapar(s.l.title)}<strong>${numero(s.v)} kWh</strong><small>${numero((s.v / k) * 100)}%</small></div>`
        )
        .join('')
    : '<div class="empty">Sem leituras neste período.</div>';
  mostrarLocais(elemento('#overview-locations'));
  mostrarLocais(elemento('#all-locations'), true);
  mostrarHistorico();
  carregarIcones();
}
function desenharGrafico(rows) {
  const map = {};
  rows.forEach(r => (map[r.date] = (map[r.date] || 0) + r.kwh));
  const dates = Object.keys(map).sort();
  if (!dates.length) {
    elemento('#chart').innerHTML = '<div class="empty">Nenhuma leitura para este filtro.</div>';
    return;
  }
  const vals = dates.map(d => map[d] * (unidade === 'money' ? dados.tariff : 1)),
    max = Math.max(...vals, 1) * 1.25,
    w = 620,
    h = 180,
    left = 40,
    right = 12,
    top = 15,
    bottom = 26;
  const x = i => left + (i * (w - left - right)) / Math.max(1, dates.length - 1),
    y = v => h - bottom - (v / max) * (h - top - bottom);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`);
  const lines = [0, 0.25, 0.5, 0.75, 1]
    .map(
      f =>
        `<line x1="${left}" x2="${w - right}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="#edf1e7" stroke-dasharray="3 5"/><text x="28" y="${y(max * f) + 3}" text-anchor="end" fill="#a1ab95" font-size="8">${numero(max * f)}</text>`
    )
    .join('');
  const labels = dates
    .map((d, i) =>
      i % Math.max(1, Math.ceil(dates.length / 7)) === 0 || i === dates.length - 1
        ? `<text x="${x(i)}" y="177" text-anchor="middle" fill="#a1ab95" font-size="8">${d.slice(8)}/${d.slice(5, 7)}</text>`
        : ''
    )
    .join('');
  elemento('#chart').innerHTML =
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Consumo por dia em ${unidade === 'money' ? 'reais' : 'quilowatts-hora'}"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c6dea9" stop-opacity=".65"/><stop offset="1" stop-color="#eaf2df" stop-opacity=".1"/></linearGradient></defs>${lines}<path d="M${left},${y(0)} L${pts.join(' L')} L${x(dates.length - 1)},${y(0)}Z" fill="url(#area)"/><polyline points="${pts.join(' ')}" fill="none" stroke="#7fa45d" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#fff" stroke="#7fa45d" stroke-width="1.5"><title>${dates[i].split('-').reverse().join('/')}: ${unidade === 'money' ? reais(v) : numero(v) + ' kWh'}</title></circle>`).join('')}${labels}</svg>`;
}
function filtrarHistorico() {
  return filtrar(elemento('#history-month').value, elemento('#history-location').value).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
}
function mostrarHistorico() {
  const rs = filtrarHistorico();
  elemento('#history-rows').innerHTML = rs.length
    ? rs
        .map(
          r =>
            `<tr><td>${r.date.split('-').reverse().join('/')}</td><td>${escapar(dados.locations.find(l => l.id === r.location)?.title || 'Local removido')}</td><td>${numero(r.kwh)} kWh</td><td>${reais(r.kwh * dados.tariff)}</td><td>${r.due ? r.due.split('-').reverse().join('/') : '—'}</td><td><button class="text-button danger" data-delete-reading="${escapar(r.id)}" aria-label="Excluir leitura de ${escapar(r.date)}">Excluir</button></td></tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="empty">Nenhuma leitura encontrada.</td></tr>';
  elemento('#table-total').textContent =
    `${rs.length} registros · ${numero(somar(rs))} kWh · ${reais(somar(rs) * dados.tariff)} estimados`;
}
function abrirModal(title, content) {
  elemento('#modal-title').textContent = title;
  elemento('#modal-content').innerHTML = content;
  elemento('#modal').showModal();
}
function dataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function salvarFormulario(form, task) {
  if (salvando) return;
  const button = form.querySelector('[type="submit"]');
  const text = button?.textContent;
  marcarSalvamento(true);
  if (button) {
    button.disabled = true;
    button.textContent = 'Salvando...';
  }
  const old = elemento('#modal-error');
  if (old) old.textContent = '';
  try {
    await task();
    elemento('#modal').close();
    await carregar();
    avisar('Alterações salvas no Supabase.');
  } catch (err) {
    if (old) old.textContent = err.message || String(err);
    mostrarErro(err);
  } finally {
    marcarSalvamento(false);
    if (button) {
      button.disabled = false;
      button.textContent = text;
    }
  }
}
function formularioLocal(id) {
  const l = dados.locations.find(x => x.id === id) || {};
  abrirModal(
    id ? 'Editar local' : 'Um novo espaço',
    `<form id="location-form"><div class="form-grid"><label class="full">Nome do local<input name="title" required maxlength="45" value="${escapar(l.title)}" placeholder="Ex.: Minha casa"></label><label class="full">Tipo de espaço<select name="type">${[
      ['home', 'Casa'],
      ['office', 'Trabalho'],
      ['warehouse', 'Galpão']
    ]
      .map(([v, n]) => `<option value="${v}" ${l.type === v ? 'selected' : ''}>${n}</option>`)
      .join('')}</select></label>${[
      ['cep', 'CEP'],
      ['city', 'Cidade'],
      ['district', 'Bairro'],
      ['number', 'Número'],
      ['street', 'Rua'],
      ['extra', 'Complemento']
    ]
      .map(
        ([n, t]) =>
          `<label>${t}<input name="${n}" maxlength="100" value="${escapar(l[n])}"></label>`
      )
      .join(
        ''
      )}</div><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" data-close>Cancelar</button><button class="primary" data-db-action type="submit">Salvar local</button></div></form>`
  );
  elemento('#location-form').onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.title = data.title.trim();
    if (!data.title) return;
    salvarFormulario(e.target, async () => {
      exigirLogin();
      if (id) await banco.alterar('sw_locations', id, data);
      else
        await banco.inserir('sw_locations', {
          ...data,
          user_id: banco.usuarioId
        });
    });
  };
}
function formularioLeitura() {
  if (!dados.locations.length) {
    avisar('Cadastre um local antes de adicionar leituras.');
    formularioLocal();
    return;
  }
  abrirModal(
    'Adicionar leitura',
    `<p class="modal-copy" style="margin-bottom:18px">Informe o consumo do intervalo em kWh, não o valor acumulado do medidor.</p><form id="reading-form"><div class="form-grid"><label class="full">Local<select name="location">${dados.locations.map(l => `<option value="${escapar(l.id)}">${escapar(l.title)}</option>`).join('')}</select></label><label>Data da leitura<input name="date" type="date" required value="${dataHoje()}"></label><label>Consumo (kWh)<input name="kwh" type="number" min="0.01" max="10000000" step="0.01" required placeholder="Ex.: 12.5"></label><label class="full">Vencimento (opcional)<input name="due" type="date"></label></div><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button class="secondary" type="button" data-close>Cancelar</button><button class="primary" type="submit" data-db-action>Salvar leitura</button></div></form>`
  );
  elemento('#reading-form').onsubmit = e => {
    e.preventDefault();
    const r = Object.fromEntries(new FormData(e.target));
    if (!Number.isFinite(+r.kwh) || +r.kwh <= 0) return;
    salvarFormulario(e.target, async () => {
      exigirLogin();
      await banco.inserir('sw_readings', {
        user_id: banco.usuarioId,
        location_id: r.location,
        reading_date: r.date,
        kwh: +r.kwh,
        due_date: r.due || null
      });
      elemento('#month-filter').value = r.date.slice(0, 7);
      elemento('#location-filter').value = 'all';
    });
  };
}
function confirmar(title, copy, action) {
  abrirModal(
    title,
    `<p class="modal-copy">${escapar(copy)}</p><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button class="secondary" data-close>Cancelar</button><button class="primary" id="confirm-delete" data-db-action>Confirmar exclusão</button></div>`
  );
  elemento('#confirm-delete').onclick = async () => {
    if (salvando) return;
    marcarSalvamento(true);
    elemento('#confirm-delete').textContent = 'Excluindo...';
    try {
      await action();
      elemento('#modal').close();
      await carregar();
      avisar('Registro removido do Supabase.');
    } catch (err) {
      elemento('#modal-error').textContent = err.message;
      mostrarErro(err);
    } finally {
      marcarSalvamento(false);
    }
  };
}
async function criarExemplo() {
  exigirLogin();
  if (dados.locations.length || dados.readings.length)
    throw Error('Dados de demonstração só podem ser criados em uma conta vazia.');
  const sample = [
    {
      title: 'Casa',
      type: 'home',
      city: 'Curitiba',
      street: 'Rua das Araucárias',
      number: '120',
      cep: '',
      district: 'Centro',
      extra: ''
    },
    {
      title: 'Trabalho',
      type: 'office',
      city: 'Curitiba',
      street: 'Avenida República',
      number: '450',
      cep: '',
      district: 'Centro',
      extra: 'Sala 08'
    },
    {
      title: 'Galpão',
      type: 'warehouse',
      city: 'Recife',
      street: 'Rua do Comércio',
      number: '82',
      cep: '',
      district: 'Centro',
      extra: ''
    }
  ].map(l => ({
    ...l,
    id: crypto.randomUUID(),
    user_id: banco.usuarioId
  }));
  await banco.inserirVarios('sw_locations', sample);
  const today = new Date();
  const rows = [];
  for (let days = 0; days < 30; days++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    sample.forEach((loc, i) => {
      rows.push({
        user_id: banco.usuarioId,
        location_id: loc.id,
        reading_date: date,
        kwh: Number(
          ((i === 0 ? 12 : i === 1 ? 7 : 4) + (Math.sin(days * 0.7 + i) + 1) * 3).toFixed(2)
        )
      });
    });
  }
  await banco.inserirVarios('sw_readings', rows);
}
function formularioTarifa() {
  abrirModal(
    'Preferências de energia',
    `<form id="settings-form"><p class="modal-copy" style="margin-bottom:18px">A estimativa usa consumo × tarifa. Não inclui impostos, bandeiras ou outras cobranças. A alteração recalcula todas as estimativas, inclusive as anteriores.</p><div class="form-grid"><label class="full">Tarifa por kWh (R$)<input type="number" name="tariff" min="0.01" max="100" step="0.0001" required value="${dados.tariff}"></label></div><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit" data-db-action>Salvar preferências</button></div></form><div class="settings-extra"><strong>Dados para apresentação</strong><p>É possível criar 30 dias de leituras fictícias para demonstrar o funcionamento dos gráficos em uma conta vazia.</p><button class="secondary" id="create-demo-data" ${dados.locations.length || dados.readings.length ? 'disabled' : ''}>Criar dados de demonstração</button></div>`
  );
  elemento('#settings-form').onsubmit = e => {
    e.preventDefault();
    const t = Number(new FormData(e.target).get('tariff'));
    if (!Number.isFinite(t) || t <= 0 || t > 100) return;
    salvarFormulario(e.target, () => banco.salvarTarifa(t));
  };
  elemento('#create-demo-data').onclick = () =>
    confirmar(
      'Criar dados demonstrativos?',
      'Serão criados 3 locais e 90 leituras fictícias nesta conta do Supabase.',
      criarExemplo
    );
}
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.page) abrirPagina(b.dataset.page);
  if (b.hasAttribute('data-close')) elemento('#modal').close();
  if (b.dataset.unit) {
    unidade = b.dataset.unit;
    elementos('[data-unit]').forEach(x => x.classList.toggle('selected', x === b));
    desenharGrafico(filtrar());
  }
  if (b.dataset.editLocation) formularioLocal(b.dataset.editLocation);
  if (b.dataset.viewLocation) {
    elemento('#location-filter').value = b.dataset.viewLocation;
    abrirPagina('overview');
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
  if (b.dataset.deleteLocation) {
    const id = b.dataset.deleteLocation,
      count = dados.readings.filter(r => r.location === id).length;
    confirmar(
      'Excluir local?',
      `O local e suas ${count} leituras serão excluídos do banco de dados. Esta ação não pode ser desfeita.`,
      () => banco.excluir('sw_locations', id)
    );
  }
  if (b.dataset.deleteReading)
    confirmar(
      'Excluir leitura?',
      'Esta leitura será removida permanentemente do banco de dados.',
      () => banco.excluir('sw_readings', b.dataset.deleteReading)
    );
});
elemento('#close-modal').onclick = () => elemento('#modal').close();
elemento('#new-record').onclick = formularioLeitura;
elemento('#new-location').onclick = () => formularioLocal();
elemento('#hero-history').onclick = () => abrirPagina('history');
elemento('#location-filter').onchange = atualizarTela;
elemento('#month-filter').onchange = atualizarTela;
elemento('#history-location').onchange = mostrarHistorico;
elemento('#history-month').onchange = mostrarHistorico;
elemento('#clear-history').onclick = () => {
  elemento('#history-location').value = 'all';
  elemento('#history-month').value = '';
  mostrarHistorico();
};
elemento('#settings').onclick = formularioTarifa;
elemento('#help').onclick = () =>
  abrirModal(
    'Sobre o SmartWatts',
    '<p class="modal-copy">Este protótipo permite acompanhar consumo e custos por local. Os registros são armazenados em um banco PostgreSQL no Supabase, vinculados à sua conta. Não há integração com medidores físicos; você insere as leituras manualmente. kWh representa energia consumida.</p>'
  );
elemento('#tip-button').onclick = () =>
  abrirModal(
    'Conheça seu padrão de consumo',
    '<p class="modal-copy">Registre leituras em intervalos iguais e compare dias com rotinas semelhantes. Quando o consumo subir, observe quais equipamentos e hábitos mudaram. Comece pelos aparelhos que ficam ligados por mais tempo.</p>'
  );
elemento('#export').onclick = () => {
  const cell = v =>
    '"' +
    String(v ?? '')
      .replace(/^[=+@\-]/, "'")
      .replace(/"/g, '""') +
    '"';
  const rows = [
    ['Data', 'Local', 'Consumo (kWh)', 'Custo estimado (R$)', 'Vencimento'],
    ...filtrarHistorico().map(r => [
      r.date,
      dados.locations.find(l => l.id === r.location)?.title || '',
      r.kwh.toString().replace('.', ','),
      (r.kwh * dados.tariff).toFixed(2).replace('.', ','),
      r.due
    ])
  ];
  const blob = new Blob(['\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8'
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'smartwatts-historico.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  avisar('Histórico exportado.');
};
elemento('#mobile-settings').onclick = () => elemento('#settings').click();
elemento('#logout').onclick = async () => {
  try {
    await banco.sair();
    dados = {
      tariff: 0.89,
      locations: [],
      readings: []
    };
    elemento('#app-footer-note').textContent = 'Aguardando autenticação no Supabase';
    avisoLogin('Sessão encerrada. Faça login novamente.');
    mostrarLogin(true);
  } catch (f) {
    mostrarErro(f);
  }
};
elemento('#auth-form').onsubmit = e => {
  e.preventDefault();
  entrar();
};
elemento('#auth-switch').onclick = () => {
  const m = elemento('#auth-mode'),
    signup = m.value !== 'signup';
  m.value = signup ? 'signup' : 'login';
  elemento('#auth-submit').textContent = signup ? 'Criar conta' : 'Entrar';
  elemento('#auth-switch').textContent = signup ? 'Já tenho conta' : 'Criar uma conta';
  avisoLogin(
    signup
      ? 'Use um e-mail válido. Pode ser necessário confirmar a conta por e-mail.'
      : 'Entre com seu e-mail e senha do SmartWatts.'
  );
};
window.addEventListener('hashchange', () => {
  if (!document.body.classList.contains('auth-required')) abrirPagina(location.hash.slice(1));
});
iniciar();
