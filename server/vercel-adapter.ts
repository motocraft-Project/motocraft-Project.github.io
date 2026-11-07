import type { IncomingMessage, ServerResponse } from 'node:http';

export type VercelRequestLike = IncomingMessage & { body?: unknown };
export type VercelResponseLike = ServerResponse;
export type WebHandler = (request: Request) => Response | Promise<Response>;

async function requestBody(request: VercelRequestLike) {
  if (request.body !== undefined) {
    if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return request.body;
    return JSON.stringify(request.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export async function runWebHandler(
  incoming: VercelRequestLike,
  outgoing: VercelResponseLike,
  handler: WebHandler
) {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }
    headers.delete('content-length');

    const method = incoming.method || 'GET';
    const protocol = String(incoming.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = incoming.headers.host || 'localhost';
    const url = new URL(incoming.url || '/', `${protocol}://${host}`);
    const init: RequestInit & { duplex?: 'half' } = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
      const body = await requestBody(incoming);
      if (body !== undefined) {
        init.body = typeof body === 'string'
          ? body
          : body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
        init.duplex = 'half';
      }
    }

    const response = await handler(new Request(url, init));
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.statusCode = 500;
    outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
    outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Server error.' }));
  }
}
