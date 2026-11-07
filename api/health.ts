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

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: headers(request) });
}

export function GET(request: Request) {
  return new Response(JSON.stringify({
    ok: true,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    service: 'MOTOCRAFT AI'
  }), { status: 200, headers: headers(request) });
}
