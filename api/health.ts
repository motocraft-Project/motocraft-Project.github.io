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
    service: 'MOTOCRAFT AI',
    version: '2026-11-06-node-handler'
  }), { status: 200, headers: headers(request) });
}

type NodeRequest = { method?: string; headers: Record<string, string | string[] | undefined> };
type NodeResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export default function health(request: NodeRequest, response: NodeResponse) {
  const requestedOrigin = typeof request.headers.origin === 'string' ? request.headers.origin : '';
  const origin = allowedOrigins.includes(requestedOrigin) ? requestedOrigin : allowedOrigins[0];
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Motocraft-Access-Code');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Vary', 'Origin');

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.end(JSON.stringify({ error: 'Method not allowed.' }));
    return;
  }

  response.statusCode = 200;
  response.end(JSON.stringify({
    ok: true,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    service: 'MOTOCRAFT AI',
    version: '2026-11-06-node-handler'
  }));
}
