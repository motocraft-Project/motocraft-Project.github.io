import { z } from 'zod';
import { authorize, cors, fetchListingPage, json, rateLimit } from './_shared.js';

const requestSchema = z.object({ url: z.string().trim().min(1, 'Enter a listing URL.').max(500) });

export async function handleFetchListing(request: Request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  if (!authorize(request)) return json(request, { error: 'Invalid or missing MOTOCRAFT AI access code.' }, 401);
  if (rateLimit(request, 10)) return json(request, { error: 'Too many requests. Wait a minute and try again.' }, 429);
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return json(request, { error: parsed.error.issues[0]?.message || 'Invalid request.' }, 400);
    const listing = await fetchListingPage(parsed.data.url);
    return json(request, listing);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read that listing.';
    return json(request, { error: message }, 502);
  }
}

export default { fetch: handleFetchListing };
