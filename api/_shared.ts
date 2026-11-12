import { timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';

export const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://motocraft-project.github.io,http://127.0.0.1:3000,http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);
const buckets = new Map<string, { count: number; reset: number }>();

export function cors(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allow = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Motocraft-Access-Code',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(request) });
}

export function authorize(request: Request) {
  const expected = process.env.MOTOCRAFT_AI_ACCESS_CODE || '';
  const supplied = request.headers.get('x-motocraft-access-code') || '';
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function rateLimit(request: Request, limit = 12) {
  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now(); const current = buckets.get(key);
  if (!current || current.reset < now) { buckets.set(key, { count: 1, reset: now + 60_000 }); return false; }
  current.count += 1; return current.count > limit;
}

export const vehicleSchema = z.object({
  vin: z.string().trim().max(17).default(''), year: z.string().trim().max(4).default(''),
  make: z.string().trim().max(80).default(''), model: z.string().trim().max(80).default(''), trim: z.string().trim().max(80).default(''),
  mileage: z.string().trim().max(12).default(''), purchasePrice: z.string().trim().max(20).default(''),
  targetRetailPrice: z.string().trim().max(20).default(''),
  titleStatus: z.string().trim().max(80).default('Unknown'), location: z.string().trim().max(120).default(''),
  maintenance: z.string().trim().max(12_000).default(''),
  history: z.string().trim().max(12_000).default(''), spokenDetails: z.string().trim().max(12_000).default('')
});

export const analysisRequestSchema = z.object({
  vehicle: vehicleSchema,
  documentText: z.string().max(45_000).default(''),
  evidenceNames: z.array(z.string().max(180)).max(8).default([]),
  images: z.array(z.string().refine(v => /^data:image\/(jpeg|png|webp);base64,/i.test(v), 'Unsupported image')).max(3).default([])
}).superRefine((value, ctx) => {
  if (!value.vehicle.vin && !value.vehicle.make && !value.vehicle.model && !value.documentText && !value.images.length) {
    ctx.addIssue({ code: 'custom', message: 'Provide vehicle details or evidence.' });
  }
  if (value.images.some(v => v.length > 2_800_000)) ctx.addIssue({ code: 'custom', message: 'An image is too large after compression.' });
});

export async function decodeVin(vin: string, year?: string) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) return null;
  const query = year ? `&modelyear=${encodeURIComponent(year)}` : '';
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json${query}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = await response.json() as { Results?: Record<string, string>[] };
    const item = data.Results?.[0]; if (!item) return null;
    const keys = ['VIN','ModelYear','Make','Model','Trim','BodyClass','VehicleType','DriveType','FuelTypePrimary','EngineCylinders','DisplacementL','TransmissionStyle','ErrorCode','ErrorText'];
    return Object.fromEntries(keys.map(k => [k, item[k] || '']).filter(([,v]) => v));
  } catch { return null; }
}

export async function groqChat(payload: unknown) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(55_000)
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data?.error?.message || `Groq request failed (${response.status}).`);
  return data;
}

export function parseModelJson(value: string) {
  const clean = value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(clean);
}

function ipv4Blocked(ip: string) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6Blocked(ip: string) {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fc') || v.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(v)) return true;
  if (v.startsWith('::ffff:')) { const embedded = v.split(':').pop() || ''; if (isIP(embedded) === 4) return ipv4Blocked(embedded); }
  return false;
}

function isBlockedAddress(ip: string) {
  const version = isIP(ip);
  if (version === 4) return ipv4Blocked(ip);
  if (version === 6) return ipv6Blocked(ip);
  return true;
}

async function assertPublicHost(hostname: string) {
  if (/^(localhost|.*\.local)$/i.test(hostname)) throw new Error('That host is not reachable.');
  if (isIP(hostname)) { if (isBlockedAddress(hostname)) throw new Error('That host is not reachable.'); return; }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(r => isBlockedAddress(r.address))) throw new Error('That host is not reachable.');
}

const LISTING_MAX_BYTES = 3_000_000;
const LISTING_TEXT_LIMIT = 8_000;

export async function fetchListingPage(rawUrl: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('Enter a valid http or https listing URL.'); }
  for (let redirects = 0; ; redirects++) {
    if (!/^https?:$/.test(url.protocol)) throw new Error('Only http and https listing URLs are supported.');
    await assertPublicHost(url.hostname);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MotocraftListingReader/1.0)', Accept: 'text/html,application/xhtml+xml' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects >= 3) throw new Error('This listing could not be reached (too many redirects).');
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`The listing site returned an error (${response.status}).`);
    const contentType = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) throw new Error('That link did not return a readable web page.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Could not read the listing content.');
    let received = 0; const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > LISTING_MAX_BYTES) { await reader.cancel(); throw new Error('That page is too large to read.'); }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf-8');
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, LISTING_TEXT_LIMIT);
    if (!text) throw new Error('No readable text was found on that page.');
    return { title: title || url.hostname, text, url: url.toString() };
  }
}
