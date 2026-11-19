# SmartWatts

Aplicação para acompanhar o consumo de energia de casas e outros locais.
Feita com HTML, CSS, JavaScript e Supabase.

[Ver o site](https://parvinna.github.io/smartwatts/)

## O que faz

- Login e cadastro com e-mail e senha.
- Cadastro, edição e exclusão de locais.
- Registro de leituras em kWh.
- Gráficos de consumo e estimativa de custo pela tarifa informada.
- Histórico com filtros e exportação em CSV.

As leituras são informadas manualmente. O custo é calculado por kWh × tarifa,
sem impostos ou taxas adicionais. Cada conta acessa seus próprios dados.

## Rodar no computador

É necessário ter Node.js 18 ou mais recente.

```bash
npm run dev
```

Abra http://localhost:5173. Não há dependências para instalar.

Para verificar o código:

```bash
npm run check
npm test
```

## Arquivos

- `index.html` e `styles.css`: interface e estilos.
- `app.js`: telas, formulários, gráficos e filtros.
- `sw-supabase.js`: login e comunicação com o banco.
- `config.js`: endereço do Supabase e chave pública.
- `database.sql`: tabelas e regras de acesso.
- `server.js`: servidor para rodar no computador.

## Banco de dados

O site usa o projeto SmartWatt02 no Supabase e está publicado no GitHub Pages.
Para usar outro projeto, execute `database.sql`, atualize `config.js` com a URL
e a chave pública e configure o endereço do site no Supabase Auth.
Nunca coloque chaves secretas ou senhas no código.

`verify_smartwatts.sql` confere a estrutura do banco.
`reset_smartwatts.sql` apaga as tabelas e os dados do SmartWatts; use somente
se quiser começar novamente e depois execute `database.sql`.
