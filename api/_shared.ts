import { timingSafeEqual } from 'node:crypto';
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
  titleStatus: z.string().trim().max(80).default('Unknown'), location: z.string().trim().max(120).default(''),
  desiredMargin: z.string().trim().max(20).default('2500'), maintenance: z.string().trim().max(12_000).default(''),
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
