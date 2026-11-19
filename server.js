import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const argumentos = process.argv;
const porta =
  Number(argumentos[argumentos.indexOf('--port') + 1]) || Number(process.env.PORT) || 5173;
const pasta = new URL('./', import.meta.url);
const arquivos = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/styles.css': 'styles.css',
  '/app.js': 'app.js',
  '/sw-supabase.js': 'sw-supabase.js',
  '/config.js': 'config.js'
};
http
  .createServer(async (pedido, resposta) => {
    try {
      const arquivo = arquivos[new URL(pedido.url, 'http://localhost').pathname];
      if (!arquivo) {
        resposta.writeHead(404);
        return resposta.end('Not found');
      }
      const conteudo = await readFile(fileURLToPath(new URL(arquivo, pasta)));
      resposta.writeHead(200, {
        'Content-Type': arquivo.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : arquivo.endsWith('.js')
            ? 'text/javascript; charset=utf-8'
            : 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      resposta.end(conteudo);
    } catch {
      resposta.writeHead(500);
      resposta.end('Server error');
    }
  })
  .listen(porta, '0.0.0.0', () =>
    console.log(`SmartWatts disponível em http://localhost:${porta}`)
  );
