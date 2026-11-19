'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const paths={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',leaf:'<path d="M20 3C7 2 1 9 5 16s17 4 15-13Z"/><path d="M4 21 15 9"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',wallet:'<path d="M20 8V5H4v14h16V8ZM4 8h16"/><path d="M20 11h-6v5h6M17 13.5h.1"/>',activity:'<path d="M2 12h4l3-8 6 16 3-8h4"/>',plus:'<path d="M12 4v16M4 12h16"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3v.1"/>',pie:'<path d="M12 3v9h9A9 9 0 1 1 12 3Z"/><path d="M16 3v5h5a9 9 0 0 0-5-5Z"/>',office:'<path d="M5 21V3h14v18M9 7h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1M9 21v-3h6v3"/>',warehouse:'<path d="M3 21V8l9-5 9 5v13M7 21V11h10v10M7 15h10M7 18h10"/>'};
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[n]||paths.home}</svg>`;
function icons(){$$('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n), money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const colors=['#527448','#94b86d','#d4e5b4','#c2ab72','#789b9b'];

import {SupabaseAPI} from './sw-supabase.js';
const api=new SupabaseAPI(window.SMARTWATTS_CONFIG||{});
let state={tariff:0.89,locations:[],readings:[]};
let unit='kwh',page='overview',busy=false;
let toastTimer;
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function fail(e){console.error(e);toast('Falha ao comunicar com o banco: '+(e?.message||'erro desconhecido'));}
function setBusy(v){busy=v;$$('[data-db-action]').forEach(b=>b.disabled=v);}
function onlyLoggedIn(){if(!api.userId)throw Error('Entre na sua conta para continuar.');}
function fromLocation(x){return {id:x.id,title:x.title,type:x.type,city:x.city,street:x.street,number:x.number,cep:x.cep,district:x.district,extra:x.extra};}
function fromReading(x){return {id:x.id,location:x.location_id,date:x.reading_date,kwh:Number(x.kwh),due:x.due_date||''};}
async function reload(){
  onlyLoggedIn();
  const [settings,locations,readings]=await Promise.all([api.selectAll('sw_settings','user_id'),api.selectAll('sw_locations'),api.selectAll('sw_readings')]);
  state={tariff:settings.length?Number(settings[0].tariff):0.89,locations:locations.map(fromLocation),readings:readings.map(fromReading)};
  render();
}
function setAuthVisible(show){
  document.body.classList.toggle('auth-required',show);
  $('#auth-screen').hidden=!show;
  if(!show){$('#auth-password').value='';}
}
function setProfile(){
  const email=api.email||'Conta SmartWatts';
  $('#profile-email').textContent=email;
  $('#profile-name').textContent=email.split('@')[0]||'Meu espaço';
  $('#top-avatar').textContent=email.slice(0,2).toUpperCase();
  $('#user-avatar').textContent=email.slice(0,2).toUpperCase();
}
function authMessage(msg,type='info'){
  const el=$('#auth-message');el.textContent=msg;el.dataset.type=type;
}
async function loginFlow(){
  $('#auth-submit').disabled=true;
  authMessage('Conectando ao Supabase...');
  try{
    const email=$('#auth-email').value.trim();const password=$('#auth-password').value;
    if(!email||!password)throw Error('Informe e-mail e senha.');
    if($('#auth-mode').value==='signup'){
      const result=await api.signUp(email,password);
      if(!result.signedIn){authMessage('Conta criada. Confirme seu e-mail e volte para entrar.','success');$('#auth-mode').value='login';$('#auth-submit').textContent='Entrar';return;}
    }else await api.signIn(email,password);
    await signedIn();
  }catch(err){authMessage(err.message||'Falha na autenticação.','error');}finally{$('#auth-submit').disabled=false;}
}
async function signedIn(){
  setProfile();
  await reload();
  $('#app-footer-note').textContent='Dados sincronizados no Supabase';
  setAuthVisible(false);
  navigate(location.hash.slice(1)||'overview');
  toast('Dados sincronizados com o Supabase.');
}
async function boot(){
  $('#month-filter').value=localDate().slice(0,7);
  const footer=$('#app-footer-note');footer.textContent='Aguardando autenticação no Supabase';
  $('#auth-config').hidden=api.configured;
  $('#auth-form').hidden=!api.configured;
  setAuthVisible(true);
  icons();
  if(!api.configured){authMessage('Preencha config.js com a URL e a chave pública do projeto Supabase.','error');return;}
  try{const user=await api.restoreSession();if(user){await signedIn();}else authMessage('Entre com sua conta do SmartWatts ou crie uma nova.');}
  catch(err){authMessage('Não foi possível carregar os dados: '+err.message,'error');setAuthVisible(true);}
}
function options(sel,all=true){const old=sel.value;sel.innerHTML=(all?'<option value="all">Todos os locais</option>':'')+state.locations.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('');if([...sel.options].some(o=>o.value===old))sel.value=old;}
function filtered(month=$('#month-filter').value,loc=$('#location-filter').value){return state.readings.filter(r=>(!month||r.date.startsWith(month))&&(!loc||loc==='all'||r.location===loc));}
const total=rs=>rs.reduce((n,r)=>n+Number(r.kwh),0);
function navigate(p){page=['overview','locations','history'].includes(p)?p:'overview';$$('.page').forEach(e=>e.hidden=e.id!==page);$$('.nav-item[data-page]').forEach(e=>e.classList.toggle('active',e.dataset.page===page));const titles={overview:['Sua energia, sob controle','Uma visão clara do consumo. Mais espaço para economizar.','Visão geral'],locations:['Cada espaço, uma nova perspectiva','Acompanhe a energia dos lugares que importam para você.','Meus locais'],history:['Sua energia tem uma história','Todas as leituras, organizadas para facilitar suas escolhas.','Histórico']};$('#page-title').innerHTML=titles[page][0]+'<span>.</span>';$('#page-subtitle').textContent=titles[page][1];$('#breadcrumb-title').textContent=titles[page][2];history.replaceState(null,'','#'+page);render();}
function locationCards(container,editable=false){container.innerHTML=state.locations.length?state.locations.map((l,i)=>{const k=total(filtered($('#month-filter').value,l.id));return `<article class="location-card"><div class="location-head"><span class="location-icon">${icon(l.type)}</span><div><h3>${esc(l.title)}</h3><p>${esc(l.city||'Endereço não informado')}</p></div><button data-view-location="${esc(l.id)}" aria-label="Ver consumo de ${esc(l.title)}">↗</button></div><div class="location-metrics"><strong>${num(k)}<small>kWh</small></strong><span>${money(k*state.tariff)}</span></div>${editable?`<p class="modal-copy" style="font-size:10px;margin-top:12px">${esc(l.street)}${l.number?', '+esc(l.number):''} ${esc(l.extra)}</p><div class="location-actions"><button class="text-button" data-edit-location="${esc(l.id)}">Editar local</button><button class="text-button danger" data-delete-location="${esc(l.id)}">Excluir</button></div>`:''}</article>`}).join(''):'<div class="empty">Nenhum local cadastrado. Adicione seu primeiro espaço.</div>';}
function render(){options($('#location-filter'));options($('#history-location'));$('#location-count').textContent=state.locations.length;const rows=filtered(),k=total(rows);const month=$('#month-filter').value;const date=new Date((month||new Date().toISOString().slice(0,7))+'-01T12:00:00');$('#period-caption').textContent=month?date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'Todos os períodos';$('#stat-consumption').innerHTML=`${num(k)} <small>kWh</small>`;$('#stat-cost').textContent=money(k*state.tariff);$('#stat-average').innerHTML=`${num(rows.length?k/rows.length:0)} <small>kWh</small>`;$('#stat-locations').innerHTML=`${state.locations.length.toString().padStart(2,'0')} <small>locais</small>`;$('#reading-count').textContent=`${rows.length} leituras neste período`;$('#tariff-label').textContent=money(state.tariff)+'/kWh';date.setMonth(date.getMonth()-1);const prev=total(filtered(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`));$('#consumption-change').textContent=prev?`${num((k-prev)/prev*100)}% vs. total do mês anterior`:'Sem comparação anterior';drawChart(rows);const sums=state.locations.map(l=>({l,v:total(rows.filter(r=>r.location===l.id))})).filter(x=>x.v>0);let pos=0;$('#donut').style.background=k?`conic-gradient(${sums.map((s,i)=>{const start=pos;pos+=s.v/k*100;return `${colors[i%colors.length]} ${start}% ${pos}%`;}).join(',')})`:'#ecf1e6';$('#donut-total').textContent=num(k);$('#breakdown-legend').innerHTML=sums.length?sums.map((s,i)=>`<div class="legend-row"><i style="background:${colors[i%colors.length]}"></i>${esc(s.l.title)}<strong>${num(s.v)} kWh</strong><small>${num(s.v/k*100)}%</small></div>`).join(''):'<div class="empty">Sem leituras neste período.</div>';locationCards($('#overview-locations'));locationCards($('#all-locations'),true);renderHistory();icons();}
function drawChart(rows){const map={};rows.forEach(r=>map[r.date]=(map[r.date]||0)+r.kwh);const dates=Object.keys(map).sort();if(!dates.length){$('#chart').innerHTML='<div class="empty">Nenhuma leitura para este filtro.</div>';return;}const vals=dates.map(d=>map[d]*(unit==='money'?state.tariff:1)),max=Math.max(...vals,1)*1.25,w=620,h=180,left=40,right=12,top=15,bottom=26;const x=i=>left+i*(w-left-right)/Math.max(1,dates.length-1),y=v=>h-bottom-v/max*(h-top-bottom);const pts=vals.map((v,i)=>`${x(i)},${y(v)}`);const lines=[0,.25,.5,.75,1].map(f=>`<line x1="${left}" x2="${w-right}" y1="${y(max*f)}" y2="${y(max*f)}" stroke="#edf1e7" stroke-dasharray="3 5"/><text x="28" y="${y(max*f)+3}" text-anchor="end" fill="#a1ab95" font-size="8">${num(max*f)}</text>`).join('');const labels=dates.map((d,i)=>i%Math.max(1,Math.ceil(dates.length/7))===0||i===dates.length-1?`<text x="${x(i)}" y="177" text-anchor="middle" fill="#a1ab95" font-size="8">${d.slice(8)}/${d.slice(5,7)}</text>`:'').join('');$('#chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Consumo por dia em ${unit==='money'?'reais':'quilowatts-hora'}"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c6dea9" stop-opacity=".65"/><stop offset="1" stop-color="#eaf2df" stop-opacity=".1"/></linearGradient></defs>${lines}<path d="M${left},${y(0)} L${pts.join(' L')} L${x(dates.length-1)},${y(0)}Z" fill="url(#area)"/><polyline points="${pts.join(' ')}" fill="none" stroke="#7fa45d" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>${vals.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#fff" stroke="#7fa45d" stroke-width="1.5"><title>${dates[i].split('-').reverse().join('/')}: ${unit==='money'?money(v):num(v)+' kWh'}</title></circle>`).join('')}${labels}</svg>`;}
function historyRows(){return filtered($('#history-month').value,$('#history-location').value).sort((a,b)=>b.date.localeCompare(a.date));}
function renderHistory(){const rs=historyRows();$('#history-rows').innerHTML=rs.length?rs.map(r=>`<tr><td>${r.date.split('-').reverse().join('/')}</td><td>${esc(state.locations.find(l=>l.id===r.location)?.title||'Local removido')}</td><td>${num(r.kwh)} kWh</td><td>${money(r.kwh*state.tariff)}</td><td>${r.due?r.due.split('-').reverse().join('/'):'—'}</td><td><button class="text-button danger" data-delete-reading="${esc(r.id)}" aria-label="Excluir leitura de ${esc(r.date)}">Excluir</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhuma leitura encontrada.</td></tr>';$('#table-total').textContent=`${rs.length} registros · ${num(total(rs))} kWh · ${money(total(rs)*state.tariff)} estimados`;
}
function modal(title,content){$('#modal-title').textContent=title;$('#modal-content').innerHTML=content;$('#modal').showModal();}

function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
async function submitRemote(form,task){
  if(busy)return;
  const button=form.querySelector('[type="submit"]');const text=button?.textContent;
  setBusy(true);if(button){button.disabled=true;button.textContent='Salvando...';}
  const old=$('#modal-error');if(old)old.textContent='';
  try{await task();$('#modal').close();await reload();toast('Alterações salvas no Supabase.');}
  catch(err){if(old)old.textContent=err.message||String(err);fail(err);}
  finally{setBusy(false);if(button){button.disabled=false;button.textContent=text;}}
}
function locationForm(id){
  const l=state.locations.find(x=>x.id===id)||{};
  modal(id?'Editar local':'Um novo espaço',`<form id="location-form"><div class="form-grid"><label class="full">Nome do local<input name="title" required maxlength="45" value="${esc(l.title)}" placeholder="Ex.: Minha casa"></label><label class="full">Tipo de espaço<select name="type">${[['home','Casa'],['office','Trabalho'],['warehouse','Galpão']].map(([v,n])=>`<option value="${v}" ${l.type===v?'selected':''}>${n}</option>`).join('')}</select></label>${[['cep','CEP'],['city','Cidade'],['district','Bairro'],['number','Número'],['street','Rua'],['extra','Complemento']].map(([n,t])=>`<label>${t}<input name="${n}" maxlength="100" value="${esc(l[n])}"></label>`).join('')}</div><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" data-close>Cancelar</button><button class="primary" data-db-action type="submit">Salvar local</button></div></form>`);
  $('#location-form').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));data.title=data.title.trim();if(!data.title)return;submitRemote(e.target,async()=>{
    onlyLoggedIn();
    if(id)await api.update('sw_locations',id,data);
    else await api.insert('sw_locations',{...data,user_id:api.userId});
  });};
}
function readingForm(){
  if(!state.locations.length){toast('Cadastre um local antes de adicionar leituras.');locationForm();return;}
  modal('Adicionar leitura',`<p class="modal-copy" style="margin-bottom:18px">Informe o consumo do intervalo em kWh, não o valor acumulado do medidor.</p><form id="reading-form"><div class="form-grid"><label class="full">Local<select name="location">${state.locations.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('')}</select></label><label>Data da leitura<input name="date" type="date" required value="${localDate()}"></label><label>Consumo (kWh)<input name="kwh" type="number" min="0.01" max="10000000" step="0.01" required placeholder="Ex.: 12.5"></label><label class="full">Vencimento (opcional)<input name="due" type="date"></label></div><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button class="secondary" type="button" data-close>Cancelar</button><button class="primary" type="submit" data-db-action>Salvar leitura</button></div></form>`);
  $('#reading-form').onsubmit=e=>{e.preventDefault();const r=Object.fromEntries(new FormData(e.target));if(!Number.isFinite(+r.kwh)||+r.kwh<=0)return;
    submitRemote(e.target,async()=>{onlyLoggedIn();await api.insert('sw_readings',{user_id:api.userId,location_id:r.location,reading_date:r.date,kwh:+r.kwh,due_date:r.due||null});$('#month-filter').value=r.date.slice(0,7);$('#location-filter').value='all';});
  };
}
function confirmation(title,copy,action){
  modal(title,`<p class="modal-copy">${esc(copy)}</p><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button class="secondary" data-close>Cancelar</button><button class="primary" id="confirm-delete" data-db-action>Confirmar exclusão</button></div>`);
  $('#confirm-delete').onclick=async()=>{if(busy)return;setBusy(true);$('#confirm-delete').textContent='Excluindo...';try{await action();$('#modal').close();await reload();toast('Registro removido do Supabase.');}catch(err){$('#modal-error').textContent=err.message;fail(err);}finally{setBusy(false);}};
}
async function demoData(){
  onlyLoggedIn();
  if(state.locations.length||state.readings.length)throw Error('Dados de demonstração só podem ser criados em uma conta vazia.');
  const sample=[{title:'Casa',type:'home',city:'Curitiba',street:'Rua das Araucárias',number:'120',cep:'',district:'Centro',extra:''},{title:'Trabalho',type:'office',city:'Curitiba',street:'Avenida República',number:'450',cep:'',district:'Centro',extra:'Sala 08'},{title:'Galpão',type:'warehouse',city:'Recife',street:'Rua do Comércio',number:'82',cep:'',district:'Centro',extra:''}]
   .map(l=>({...l,id:crypto.randomUUID(),user_id:api.userId}));
  await api.insertMany('sw_locations',sample);
  const today=new Date();const rows=[];
  for(let days=0;days<30;days++){
    const dt=new Date(today.getFullYear(),today.getMonth(),today.getDate()-days);const date=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    sample.forEach((loc,i)=>{rows.push({user_id:api.userId,location_id:loc.id,reading_date:date,kwh:Number(((i===0?12:i===1?7:4)+(Math.sin(days*.7+i)+1)*3).toFixed(2))});});
  }
  await api.insertMany('sw_readings',rows);
}
function settingsForm(){
  modal('Preferências de energia',`<form id="settings-form"><p class="modal-copy" style="margin-bottom:18px">A estimativa usa consumo × tarifa. Não inclui impostos, bandeiras ou outras cobranças. A alteração recalcula todas as estimativas, inclusive as anteriores.</p><div class="form-grid"><label class="full">Tarifa por kWh (R$)<input type="number" name="tariff" min="0.01" max="100" step="0.0001" required value="${state.tariff}"></label></div><p class="form-error" id="modal-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit" data-db-action>Salvar preferências</button></div></form><div class="settings-extra"><strong>Dados para apresentação</strong><p>É possível criar 30 dias de leituras fictícias para demonstrar o funcionamento dos gráficos em uma conta vazia.</p><button class="secondary" id="create-demo-data" ${state.locations.length||state.readings.length?'disabled':''}>Criar dados de demonstração</button></div>`);
  $('#settings-form').onsubmit=e=>{e.preventDefault();const t=Number(new FormData(e.target).get('tariff'));if(!Number.isFinite(t)||t<=0||t>100)return;submitRemote(e.target,()=>api.saveSettings(t));};
  $('#create-demo-data').onclick=()=>confirmation('Criar dados demonstrativos?','Serão criados 3 locais e 90 leituras fictícias nesta conta do Supabase.',demoData);
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.page)navigate(b.dataset.page);
  if(b.hasAttribute('data-close'))$('#modal').close();
  if(b.dataset.unit){unit=b.dataset.unit;$$('[data-unit]').forEach(x=>x.classList.toggle('selected',x===b));drawChart(filtered());}
  if(b.dataset.editLocation)locationForm(b.dataset.editLocation);
  if(b.dataset.viewLocation){$('#location-filter').value=b.dataset.viewLocation;navigate('overview');window.scrollTo({top:0,behavior:'smooth'});}
  if(b.dataset.deleteLocation){const id=b.dataset.deleteLocation,count=state.readings.filter(r=>r.location===id).length;confirmation('Excluir local?',`O local e suas ${count} leituras serão excluídos do banco de dados. Esta ação não pode ser desfeita.`,()=>api.remove('sw_locations',id));}
  if(b.dataset.deleteReading)confirmation('Excluir leitura?','Esta leitura será removida permanentemente do banco de dados.',()=>api.remove('sw_readings',b.dataset.deleteReading));
});
$('#close-modal').onclick=()=>$('#modal').close();
$('#new-record').onclick=readingForm;
$('#new-location').onclick=()=>locationForm();
$('#hero-history').onclick=()=>navigate('history');
$('#location-filter').onchange=render;
$('#month-filter').onchange=render;
$('#history-location').onchange=renderHistory;
$('#history-month').onchange=renderHistory;
$('#clear-history').onclick=()=>{$('#history-location').value='all';$('#history-month').value='';renderHistory();};
$('#settings').onclick=settingsForm;
$('#help').onclick=()=>modal('Sobre o SmartWatts','<p class="modal-copy">Este protótipo permite acompanhar consumo e custos por local. Os registros são armazenados em um banco PostgreSQL no Supabase, vinculados à sua conta. Não há integração com medidores físicos; você insere as leituras manualmente. kWh representa energia consumida.</p>');
$('#tip-button').onclick=()=>modal('Conheça seu padrão de consumo','<p class="modal-copy">Registre leituras em intervalos iguais e compare dias com rotinas semelhantes. Quando o consumo subir, observe quais equipamentos e hábitos mudaram. Comece pelos aparelhos que ficam ligados por mais tempo.</p>');
$('#export').onclick=()=>{const cell=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'").replace(/"/g,'""')+'"';const rows=[['Data','Local','Consumo (kWh)','Custo estimado (R$)','Vencimento'],...historyRows().map(r=>[r.date,state.locations.find(l=>l.id===r.location)?.title||'',r.kwh.toString().replace('.',','),(r.kwh*state.tariff).toFixed(2).replace('.',','),r.due])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='smartwatts-historico.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Histórico exportado.');};
$('#mobile-settings').onclick=()=>$('#settings').click();
$('#logout').onclick=async()=>{try{await api.signOut();state={tariff:0.89,locations:[],readings:[]};$('#app-footer-note').textContent='Aguardando autenticação no Supabase';authMessage('Sessão encerrada. Faça login novamente.');setAuthVisible(true);}catch(f){fail(f);}};
$('#auth-form').onsubmit=e=>{e.preventDefault();loginFlow();};
$('#auth-switch').onclick=()=>{const m=$('#auth-mode'),signup=m.value!=='signup';m.value=signup?'signup':'login';$('#auth-submit').textContent=signup?'Criar conta':'Entrar';$('#auth-switch').textContent=signup?'Já tenho conta':'Criar uma conta';authMessage(signup?'Use um e-mail válido. Pode ser necessário confirmar a conta por e-mail.':'Entre com seu e-mail e senha do SmartWatts.');};
window.addEventListener('hashchange',()=>{if(!document.body.classList.contains('auth-required'))navigate(location.hash.slice(1));});
boot();
