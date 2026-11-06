import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('out');
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.txt':'text/plain','.woff2':'font/woff2'};
http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(base){if(pathname===base){res.writeHead(302,{Location:base+'/'});res.end();return;}if(!pathname.startsWith(base+'/')){res.writeHead(404);res.end('Not found');return;}pathname=pathname.slice(base.length);}
 let target=path.resolve(root,'.'+pathname);if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return;}
 if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
 if(!fs.existsSync(target)){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);
}).listen(3000,'127.0.0.1',()=>process.stdout.write('MOTOCRAFT demo: http://127.0.0.1:3000\n'));
