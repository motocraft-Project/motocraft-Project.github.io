import { authorize, cors, json, rateLimit } from './_shared.js';

export async function handleTranscribe(request: Request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
    if (!authorize(request)) return json(request, { error: 'Invalid or missing MOTOCRAFT AI access code.' }, 401);
    if (rateLimit(request, 20)) return json(request, { error: 'Too many requests. Wait a minute and try again.' }, 429);
    try {
      const body = await request.json() as { audioBase64?: string; mimeType?: string };
      const match = body.audioBase64?.match(/^data:audio\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return json(request, { error: 'A supported audio recording is required.' }, 400);
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 12_000_000) return json(request, { error: 'Recording is too large. Keep it under two minutes.' }, 413);
      const key = process.env.GROQ_API_KEY; if (!key) return json(request, { error: 'GROQ_API_KEY is not configured.' }, 503);
      const mimeType = body.mimeType || `audio/${match[1]}`;
      const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm';
      const form = new FormData();
      form.set('model', 'whisper-large-v3-turbo'); form.set('response_format', 'json'); form.set('language', 'en');
      form.set('prompt', 'Vehicle acquisition details including VIN, mileage, title, maintenance, damage, repair needs and price.');
      form.set('file', new Blob([bytes], { type: mimeType }), `vehicle-details.${extension}`);
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(55_000) });
      const data = await response.json() as any;
      if (!response.ok) throw new Error(data?.error?.message || `Transcription failed (${response.status}).`);
      return json(request, { text: data.text || '', model: 'whisper-large-v3-turbo' });
    } catch (error) { return json(request, { error: error instanceof Error ? error.message : 'Transcription failed.' }, 502); }
}

export default { fetch: handleTranscribe };
