const CHAVE_SESSAO = 'smartwatts-supabase-session-v1';
export class Banco {
  constructor(config = {}) {
    this.url = String(config.url || '')
      .trim()
      .replace(/\/+$/, '');
    this.chave = String(config.publishableKey || '').trim();
    this.sessao = null;
    this.renovando = null;
  }
  get configurado() {
    try {
      const url = new URL(this.url);
      let chavePublica = this.chave.startsWith('sb_publishable_');
      if (!chavePublica) {
        try {
          chavePublica =
            JSON.parse(atob(this.chave.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
              .role === 'anon';
        } catch {}
      }
      return (
        url.protocol === 'https:' &&
        /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) &&
        url.origin === this.url &&
        chavePublica &&
        this.chave.length > 20
      );
    } catch {
      return false;
    }
  }
  cabecalhos(auth = true) {
    const headers = {
      apikey: this.chave,
      'Content-Type': 'application/json'
    };
    if (auth && this.sessao?.access_token)
      headers.Authorization = `Bearer ${this.sessao.access_token}`;
    return headers;
  }
  async pedir(
    path,
    { method = 'GET', body, auth = true, prefer, retry = true, headers = {} } = {}
  ) {
    const cabecalhos = {
      ...this.cabecalhos(auth),
      ...headers
    };
    if (prefer) cabecalhos.Prefer = prefer;
    let resposta;
    try {
      resposta = await fetch(`${this.url}${path}`, {
        method,
        headers: cabecalhos,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (causa) {
      throw new Error(
        'Não foi possível acessar o Supabase. Confira a internet, a URL e a configuração.',
        {
          cause: causa
        }
      );
    }
    if (resposta.status === 401 && auth && retry && this.sessao?.refresh_token) {
      await this.renovarSessao();
      return this.pedir(path, {
        method,
        body,
        auth,
        prefer,
        retry: false,
        headers
      });
    }
    const texto = await resposta.text();
    let dados;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = texto;
    }
    if (!resposta.ok) {
      const mensagem =
        dados?.msg ||
        dados?.message ||
        dados?.error_description ||
        dados?.error ||
        `Erro ${resposta.status}`;
      throw new Error(mensagem);
    }
    return dados;
  }
  guardarSessao(dados) {
    if (!dados?.access_token) throw new Error('O Supabase não retornou uma sessão válida.');
    this.sessao = {
      access_token: dados.access_token,
      refresh_token: dados.refresh_token,
      expires_at:
        Number(dados.expires_at) ||
        Math.floor(Date.now() / 1000) + (Number(dados.expires_in) || 3600),
      user: dados.user || this.sessao?.user || null
    };
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(this.sessao));
  }
  async restaurarSessao() {
    try {
      const fragmento = new URLSearchParams(globalThis.location?.hash?.slice(1) || '');
      if (fragmento.has('access_token') && fragmento.has('refresh_token')) {
        this.guardarSessao(Object.fromEntries(fragmento));
        history.replaceState(null, '', location.pathname + location.search);
      }
      this.sessao = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
      if (!this.sessao?.access_token) return null;
      if ((this.sessao.expires_at || 0) < Date.now() / 1000 + 60) await this.renovarSessao();
      const usuario = await this.pedir('/auth/v1/user');
      if (!usuario?.id) throw new Error('Sessão inválida');
      this.sessao.user = usuario;
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(this.sessao));
      return usuario;
    } catch {
      this.limparSessao();
      return null;
    }
  }
  async renovarSessao() {
    if (this.renovando) return this.renovando;
    if (!this.sessao?.refresh_token) throw new Error('Sua sessão expirou. Entre novamente.');
    this.renovando = (async () => {
      const dados = await this.pedir('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        auth: false,
        body: {
          refresh_token: this.sessao.refresh_token
        }
      });
      this.guardarSessao(dados);
      return this.sessao;
    })();
    try {
      return await this.renovando;
    } finally {
      this.renovando = null;
    }
  }
  async entrar(email, senha) {
    const dados = await this.pedir('/auth/v1/token?grant_type=password', {
      method: 'POST',
      auth: false,
      body: {
        email,
        password: senha
      }
    });
    this.guardarSessao(dados);
    return this.sessao.user;
  }
  async cadastrar(email, senha) {
    const redirect = globalThis.location ? location.origin + location.pathname : '';
    const path =
      '/auth/v1/signup' + (redirect ? '?redirect_to=' + encodeURIComponent(redirect) : '');
    const dados = await this.pedir(path, {
      method: 'POST',
      auth: false,
      body: {
        email,
        password: senha
      }
    });
    if (dados?.access_token) this.guardarSessao(dados);
    return {
      signedIn: !!dados?.access_token
    };
  }
  async sair() {
    try {
      await this.pedir('/auth/v1/logout', {
        method: 'POST'
      });
    } catch {}
    this.limparSessao();
  }
  limparSessao() {
    this.sessao = null;
    localStorage.removeItem(CHAVE_SESSAO);
  }
  get usuarioId() {
    return this.sessao?.user?.id;
  }
  get email() {
    return this.sessao?.user?.email || '';
  }
  async listar(tabela, ordem = 'created_at') {
    const lista = [];
    for (let inicio = 0; ; inicio += 1000) {
      const ordenacao = encodeURIComponent(`${ordem}.asc`);
      const parte = await this.pedir(`/rest/v1/${tabela}?select=*&order=${ordenacao}`, {
        headers: {
          Range: `${inicio}-${inicio + 999}`,
          'Range-Unit': 'items'
        }
      });
      if (!Array.isArray(parte)) throw new Error('Resposta inesperada do banco de dados.');
      lista.push(...parte);
      if (parte.length < 1000) break;
    }
    return lista;
  }
  async inserir(tabela, registro) {
    const dados = await this.pedir(`/rest/v1/${tabela}?select=*`, {
      method: 'POST',
      body: registro,
      prefer: 'return=representation'
    });
    return dados?.[0];
  }
  async inserirVarios(tabela, registros) {
    if (!registros.length) return;
    for (let i = 0; i < registros.length; i += 300) {
      await this.pedir(`/rest/v1/${tabela}`, {
        method: 'POST',
        body: registros.slice(i, i + 300)
      });
    }
  }
  async alterar(tabela, id, registro) {
    const dados = await this.pedir(`/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'PATCH',
      body: registro,
      prefer: 'return=representation'
    });
    if (!dados?.length) throw new Error('Registro não encontrado ou acesso negado.');
    return dados[0];
  }
  async excluir(tabela, id) {
    const dados = await this.pedir(`/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}&select=id`, {
      method: 'DELETE',
      prefer: 'return=representation'
    });
    if (!dados?.length) throw new Error('Registro não encontrado ou acesso negado.');
  }
  async salvarTarifa(tariff, options = {}) {
    if (!this.usuarioId) throw new Error('É necessário entrar na conta.');
    const registro = {
      user_id: this.usuarioId,
      tariff,
      ...options
    };
    await this.pedir('/rest/v1/sw_settings?on_conflict=user_id', {
      method: 'POST',
      body: registro,
      prefer: 'resolution=merge-duplicates,return=minimal'
    });
  }
}
