import { createServer, type IncomingMessage } from 'node:http';
import * as analyze from '../api/analyze';
import * as health from '../api/health';
import * as transcribe from '../api/transcribe';

const host = '127.0.0.1';
const port = Number(process.env.MOTOCRAFT_LOCAL_API_PORT || 8787);
const maxBodyBytes = 25 * 1024 * 1024;

type RouteHandler = (request: Request) => Response | Promise<Response>;
type RouteModule = Record<string, RouteHandler | unknown>;

const routes = new Map<string, RouteModule>([
  ['/api/analyze', analyze],
  ['/api/health', health],
  ['/api/transcribe', transcribe],
]);

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error('Request exceeds the 25 MB local limit.');
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url || '/', `http://${host}:${port}`);
    const route = routes.get(url.pathname) as RouteModule | undefined;

    if (!route) {
      outgoing.writeHead(404, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify({ error: 'Not found.' }));
      return;
    }

    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }

    const method = incoming.method || 'GET';
    const init: RequestInit & { duplex?: 'half' } = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = await readBody(incoming);
      init.duplex = 'half';
    }

    const handler = route[method] as RouteHandler | undefined;
    if (typeof handler !== 'function') {
      outgoing.writeHead(405, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify({ error: 'Method not allowed.' }));
      return;
    }

    const response = await handler(new Request(url, init));
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local server error.';
    outgoing.writeHead(message.includes('25 MB') ? 413 : 500, { 'Content-Type': 'application/json' });
    outgoing.end(JSON.stringify({ error: message }));
  }
}).listen(port, host, () => {
  console.log(`MOTOCRAFT AI server ready at http://${host}:${port}`);
  console.log('The Groq key remains in the local server environment.');
});
