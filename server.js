import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const args=process.argv; const port=Number(args[args.indexOf('--port')+1])||Number(process.env.PORT)||5173;
const root=new URL('./',import.meta.url);
const allowed={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js','/sw-supabase.js':'sw-supabase.js','/config.js':'config.js'};
http.createServer(async(req,res)=>{try{const file=allowed[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);return res.end('Not found');}const data=await readFile(fileURLToPath(new URL(file,root)));res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(500);res.end('Server error');}}).listen(port,'0.0.0.0',()=>console.log(`SmartWatts disponível em http://localhost:${port}`));
