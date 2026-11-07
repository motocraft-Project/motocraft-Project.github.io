import { analysisRequestSchema, authorize, cors, decodeVin, groqChat, json, parseModelJson, rateLimit } from './_shared';

const systemPrompt = `You are MOTOCRAFT's cautious vehicle acquisition analyst. Evaluate only supplied evidence and the NHTSA VIN specification data. Never claim to have queried CARFAX, AutoCheck, NMVTIS, auction history, maintenance networks, live listings, or title databases. Uploaded reports may be summarized but not independently verified. Produce preliminary USD estimates, not quotes. Use conservative ranges, state assumptions, and flag missing evidence. Repair estimates must include parts and labor as broad market ranges. Retail estimates must be based on the supplied facts, condition, mileage, title status and location; explicitly say when market-comparable data is absent. Return valid JSON only with this exact shape:
{"verdict":"worth_it|negotiate|pass|insufficient_data","confidence":0,"executiveSummary":"","evidenceReviewed":[""],"vehicleIdentity":{"vin":"","year":"","make":"","model":"","trim":"","source":""},"titleAssessment":{"rating":"low_risk|medium_risk|high_risk|unknown","findings":[""]},"maintenanceAssessment":{"rating":"good|mixed|poor|unknown","findings":[""]},"repairEstimate":{"low":0,"high":0,"items":[{"item":"","low":0,"high":0,"urgency":"immediate|soon|monitor"}],"basis":""},"recommendedPurchase":{"max":0,"rationale":""},"projectedRetail":{"low":0,"target":0,"high":0,"basis":""},"otherCostReserve":0,"riskFlags":[""],"documentFindings":[""],"missingInformation":[""],"assumptions":[""],"nextSteps":[""]}}`;

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
    if (!authorize(request)) return json(request, { error: 'Invalid or missing MOTOCRAFT AI access code.' }, 401);
    if (rateLimit(request)) return json(request, { error: 'Too many requests. Wait a minute and try again.' }, 429);
    try {
      const parsed = analysisRequestSchema.safeParse(await request.json());
      if (!parsed.success) return json(request, { error: parsed.error.issues[0]?.message || 'Invalid analysis request.' }, 400);
      const { vehicle, documentText, evidenceNames, images } = parsed.data;
      const vinDecode = await decodeVin(vehicle.vin, vehicle.year);
      const model = images.length ? (process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b') : (process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-20b');
      const evidence = JSON.stringify({ vehicle, nhtsaVinSpecifications: vinDecode, evidenceNames, extractedDocumentText: documentText }, null, 2);
      const content: any[] = [{ type: 'text', text: `Analyze this proposed acquisition.\n${evidence}` }, ...images.map(image => ({ type: 'image_url', image_url: { url: image } }))];
      const completion = await groqChat({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content }], response_format: { type: 'json_object' }, temperature: 0.1, max_completion_tokens: 2600 });
      const result = parseModelJson(completion.choices?.[0]?.message?.content || '{}');
      const repairMid = (Number(result.repairEstimate?.low || 0) + Number(result.repairEstimate?.high || 0)) / 2;
      const purchase = Number(result.recommendedPurchase?.max || vehicle.purchasePrice || 0);
      const retail = Number(result.projectedRetail?.target || 0); const reserve = Number(result.otherCostReserve || 0);
      result.projectedGrossProfit = Math.round(retail - purchase - repairMid - reserve);
      result.model = model; result.analyzedAt = new Date().toISOString();
      result.disclaimer = 'Preliminary AI decision support only. Verify title, ownership, recalls, inspection findings, repair quotes, taxes, fees and live market comparables before purchasing or pricing a vehicle.';
      return json(request, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed.';
      return json(request, { error: message }, /configured/.test(message) ? 503 : 502);
    }
}
