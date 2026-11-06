import { cors, json } from './_shared';
export default { async fetch(request: Request) { if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors(request)}); return json(request,{ok:true,groqConfigured:Boolean(process.env.GROQ_API_KEY),service:'MOTOCRAFT AI'}); } };
