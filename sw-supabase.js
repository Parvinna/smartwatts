/**
 * Cliente Supabase para o SmartWatts.
 * Usa as APIs oficiais Auth e PostgREST (fetch nativo), sem dependências externas.
 * Somente a chave pública/publishable deve ser usada aqui.
 */
const SESSION_KEY = 'smartwatts-supabase-session-v1';

export class SupabaseAPI {
  constructor(config = {}) {
    this.url = String(config.url || '').trim().replace(/\/+$/, '');
    this.key = String(config.publishableKey || '').trim();
    this.session = null;
    this.refreshing = null;
  }

  get configured() {
    try {
      const url = new URL(this.url);
      let publicKey = this.key.startsWith('sb_publishable_');
      if (!publicKey) {
        try { publicKey = JSON.parse(atob(this.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch {}
      }
      return url.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) &&
        url.origin === this.url && publicKey && this.key.length > 20;
    } catch { return false; }
  }

  headers(auth = true) {
    const headers = { 'apikey': this.key, 'Content-Type': 'application/json' };
    if (auth && this.session?.access_token) headers.Authorization = `Bearer ${this.session.access_token}`;
    return headers;
  }

  async request(path, { method = 'GET', body, auth = true, prefer, retry = true, headers = {} } = {}) {
    const reqHeaders = { ...this.headers(auth), ...headers };
    if (prefer) reqHeaders.Prefer = prefer;
    let response;
    try {
      response = await fetch(`${this.url}${path}`, { method, headers: reqHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (cause) {
      throw new Error('Não foi possível acessar o Supabase. Confira a internet, a URL e a configuração.', { cause });
    }
    if (response.status === 401 && auth && retry && this.session?.refresh_token) {
      await this.refreshSession();
      return this.request(path, { method, body, auth, prefer, retry: false, headers });
    }
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error_description || data?.error || `Erro ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  storeSession(data) {
    if (!data?.access_token) throw new Error('O Supabase não retornou uma sessão válida.');
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(data.expires_at) || Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
      user: data.user || this.session?.user || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
  }

  async restoreSession() {
    try {
      const fragment = new URLSearchParams(globalThis.location?.hash?.slice(1) || '');
      if (fragment.has('access_token') && fragment.has('refresh_token')) {
        this.storeSession(Object.fromEntries(fragment));
        history.replaceState(null, '', location.pathname + location.search);
      }
      this.session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!this.session?.access_token) return null;
      if ((this.session.expires_at || 0) < Date.now() / 1000 + 60) await this.refreshSession();
      const user = await this.request('/auth/v1/user');
      if (!user?.id) throw new Error('Sessão inválida');
      this.session.user = user;
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      return user;
    } catch {
      this.clearSession();
      return null;
    }
  }

  async refreshSession() {
    if (this.refreshing) return this.refreshing;
    if (!this.session?.refresh_token) throw new Error('Sua sessão expirou. Entre novamente.');
    this.refreshing = (async () => {
      const data = await this.request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', auth: false, body: { refresh_token: this.session.refresh_token }
      });
      this.storeSession(data);
      return this.session;
    })();
    try { return await this.refreshing; } finally { this.refreshing = null; }
  }

  async signIn(email, password) {
    const data = await this.request('/auth/v1/token?grant_type=password', {
      method: 'POST', auth: false, body: { email, password }
    });
    this.storeSession(data);
    return this.session.user;
  }

  async signUp(email, password) {
    const redirect = globalThis.location ? location.origin + location.pathname : '';
    const path = '/auth/v1/signup' + (redirect ? '?redirect_to=' + encodeURIComponent(redirect) : '');
    const data = await this.request(path, {
      method: 'POST', auth: false, body: { email, password }
    });
    if (data?.access_token) this.storeSession(data);
    return { signedIn: !!data?.access_token };
  }

  async signOut() {
    try { await this.request('/auth/v1/logout', { method: 'POST' }); } catch { /* remove a sessão local mesmo sem conexão */ }
    this.clearSession();
  }

  clearSession() {
    this.session = null;
    localStorage.removeItem(SESSION_KEY);
  }

  get userId() { return this.session?.user?.id; }
  get email() { return this.session?.user?.email || ''; }

  async selectAll(table, orderBy = 'created_at') {
    const output = [];
    for (let from = 0; ; from += 1000) {
      const order = encodeURIComponent(`${orderBy}.asc`);
      const part = await this.request(`/rest/v1/${table}?select=*&order=${order}`, {
        headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }
      });
      if (!Array.isArray(part)) throw new Error('Resposta inesperada do banco de dados.');
      output.push(...part);
      if (part.length < 1000) break;
    }
    return output;
  }

  async insert(table, row) {
    const data = await this.request(`/rest/v1/${table}?select=*`, {
      method: 'POST', body: row, prefer: 'return=representation'
    });
    return data?.[0];
  }

  async insertMany(table, rows) {
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i += 300) {
      await this.request(`/rest/v1/${table}`, { method: 'POST', body: rows.slice(i, i + 300) });
    }
  }

  async update(table, id, row) {
    const data = await this.request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'PATCH', body: row, prefer: 'return=representation'
    });
    if (!data?.length) throw new Error('Registro não encontrado ou acesso negado.');
    return data[0];
  }

  async remove(table, id) {
    const data = await this.request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id`, {
      method: 'DELETE', prefer: 'return=representation'
    });
    if (!data?.length) throw new Error('Registro não encontrado ou acesso negado.');
  }

  async saveSettings(tariff, options = {}) {
    if (!this.userId) throw new Error('É necessário entrar na conta.');
    const row = { user_id: this.userId, tariff, ...options };
    await this.request('/rest/v1/sw_settings?on_conflict=user_id', {
      method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal'
    });
  }
}
