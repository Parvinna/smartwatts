# SmartWatts — monitoramento de energia

Dashboard acadêmico para registrar e acompanhar consumo de energia elétrica por local, com autenticação e PostgreSQL no Supabase.

## Funcionalidades

- Cadastro, edição e exclusão de locais (casa, trabalho e galpão)
- Registro de consumo em kWh, data da leitura e vencimento opcional
- Dashboard: consumo total, custo estimado, média por leitura, gráfico por dia e participação por local
- Histórico filtrável e exportação de CSV
- Tarifa editável por usuário
- Autenticação por e-mail e senha no **Supabase Auth**
- Armazenamento persistente no **Supabase Postgres**, com isolamento de registros por usuário (RLS)
- Dados fictícios opcionais (3 locais e 90 leituras) para demonstração

## Instalação ativa

Esta versão está configurada no projeto Supabase **SmartWatt02** (`agdtvxxoeynajsmqeleq`). A configuração do navegador contém somente a chave publicável. O site usa GitHub Pages e não depende da Vercel.

Abra o site publicado, clique em **Criar uma conta** e confirme o e-mail. O acesso do SmartWatts é independente do login administrativo do Supabase.

## Configurar outra instalação

1. Crie ou escolha **um projeto Supabase descartável**, separado de outras aplicações.
2. No painel Supabase → **SQL Editor**, execute o arquivo [`database.sql`](database.sql) para criar as 3 tabelas.
3. Em **Project Settings → API Keys** (ou **Connect**), copie a URL do projeto e a chave **publishable** (`sb_publishable_...`) ou a antiga chave `anon`. **Não utilize** `service_role`, `sb_secret_...`, senha do banco, token de acesso ou credenciais pessoais.
4. Abra o arquivo [`config.js`](config.js) e substitua SOMENTE os dois campos de exemplo:

   ```js
   window.SMARTWATTS_CONFIG = {
     url: 'https://SEU_PROJECT_REF.supabase.co',
     publishableKey: 'sb_publishable_SUA_CHAVE_PUBLICA'
   };
   ```

5. Abra o projeto e use **Criar uma conta** no SmartWatts. Se a confirmação de e-mail estiver habilitada no Supabase, confirme antes de entrar. A senha dessa conta é do **usuário do SmartWatts**, não a senha administrativa do painel Supabase.
6. Para confirmar a configuração do banco, execute [`verify_smartwatts.sql`](verify_smartwatts.sql) no SQL Editor e confira as 3 tabelas e as políticas RLS.

> A chave publicável foi criada para uso no navegador e pode constar num repositório público. O banco deve ter RLS habilitada para impedir acesso a dados de outras contas. **Não publique senhas ou chaves secretas**.

## Executar localmente

Requisitos: Node.js 18+.

```bash
npm run dev
```

Acesse <http://localhost:5173>.

```bash
npm run check  # Sintaxe dos arquivos JS
npm test       # Testes automatizados da camada Supabase
```

Não é necessário instalar dependências adicionais; o cliente utiliza a API REST oficial do Supabase via `fetch` nativo do navegador.

## Publicação

O projeto inclui [`vercel.json`](vercel.json) para publicar os arquivos estáticos na Vercel. Importar o repositório GitHub, usar a pasta raiz e executar o deploy. O `config.js` precisa ter URL e chave pública corretas **antes** do uso do site em produção.

### GitHub Pages

A publicação usa **Settings → Pages → Deploy from a branch → main → /(root)**. O arquivo `.nojekyll` mantém os arquivos estáticos e os caminhos relativos permitem o subcaminho do repositório.

## Reset de desenvolvimento

O arquivo [`reset_smartwatts.sql`](reset_smartwatts.sql) exclui **apenas** as tabelas `sw_*` deste aplicativo, com os dados existentes. Use **somente** em ambiente de testes. Em seguida, execute `database.sql` para reconstruir a estrutura.

## Estrutura

```text
index.html              Interface
styles.css              Estilos
app.js                  Dashboard e lógica de telas
sw-supabase.js          Autenticação e CRUD Supabase REST
config.js               URL e chave pública (substituir placeholders)
database.sql            Estrutura, índices, grants e RLS
verify_smartwatts.sql   Consulta de diagnóstico
reset_smartwatts.sql    Reset opcional e destrutivo, limitado ao SmartWatts
server.js               Servidor estático local
vercel.json             Regras de implantação
.nojekyll               Publicação estática no GitHub Pages
tests/                  Testes sem dependências de terceiros
```

## Limitações do protótipo

- Leituras são inseridas manualmente; **não há integração com medidores inteligentes**.
- A estimativa de custo é `kWh × tarifa`, sem impostos, bandeiras tarifárias ou taxas extras.
- Os dados anteriormente salvos apenas no navegador **não são migrados automaticamente**.
- Em outra instalação, configure a URL, chave pública, tabelas e URLs de redirecionamento no Supabase Auth.
