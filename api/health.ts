import { runWebHandler, type VercelRequestLike, type VercelResponseLike } from '../server/vercel-adapter';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://motocraft-project.github.io,http://127.0.0.1:3000,http://localhost:3000')
  .split(',').map(value => value.trim()).filter(Boolean);

function headers(request: Request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Motocraft-Access-Code',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
}

export function handleHealth(request: Request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: headers(request) });
  return new Response(JSON.stringify({
    ok: true,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    service: 'MOTOCRAFT AI'
  }), { status: 200, headers: headers(request) });
}
export default function health(request: VercelRequestLike, response: VercelResponseLike) {
  return runWebHandler(request, response, handleHealth);
}
