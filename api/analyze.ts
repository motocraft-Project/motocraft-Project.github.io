import { analysisRequestSchema, authorize, cors, decodeVin, groqChat, json, parseModelJson, rateLimit } from './_shared.js';

const systemPrompt = `You are MOTOCRAFT's cautious vehicle acquisition analyst. Evaluate only supplied evidence and the NHTSA VIN specification data. Never claim to have queried CARFAX, AutoCheck, NMVTIS, auction history, maintenance networks, live listings, or title databases. Uploaded reports may be summarized but not independently verified. Produce preliminary USD estimates, not quotes. Use conservative ranges, state assumptions, and flag missing evidence. Repair estimates must include parts and labor as broad market ranges. Retail estimates must be based on the supplied facts, condition, mileage, title status and location; explicitly say when market-comparable data is absent. If the user supplies a target retail price, treat it as their own market estimate: use it as projectedRetail.target unless the supplied evidence clearly contradicts it, and if you adjust away from it or lack evidence to confirm it, say so in assumptions or riskFlags. Never silently return a retail estimate of 0 or omit projectedRetail.target when a target retail price was supplied. The user's purchasePrice is their final, already-negotiated buying price, not a ceiling for you to propose: set recommendedPurchase.max equal to the supplied purchasePrice, and use its rationale to state whether that price leaves acceptable margin against projected retail and repair costs, flagging risk in riskFlags if it does not. When evidence includes text extracted from an online listing, also assess whether the listing itself shows common scam or misrepresentation signals (price far below plausible market value with no explanation, pressure to move payment off-platform, wire transfer/gift-card/cashier's-check-only demands, inability to meet or inspect in person, vague or copy-pasted descriptions, mismatched seller location, or VIN/mileage/photos inconsistent with the stated vehicle) and record any such findings in riskFlags and documentFindings; note in the executive summary if the listing cannot be independently verified. Return valid JSON only with this exact shape:
{"verdict":"worth_it|negotiate|pass|insufficient_data","confidence":0,"executiveSummary":"","evidenceReviewed":[""],"vehicleIdentity":{"vin":"","year":"","make":"","model":"","trim":"","source":""},"titleAssessment":{"rating":"low_risk|medium_risk|high_risk|unknown","findings":[""]},"maintenanceAssessment":{"rating":"good|mixed|poor|unknown","findings":[""]},"repairEstimate":{"low":0,"high":0,"items":[{"item":"","low":0,"high":0,"urgency":"immediate|soon|monitor"}],"basis":""},"recommendedPurchase":{"max":0,"rationale":""},"projectedRetail":{"low":0,"target":0,"high":0,"basis":""},"otherCostReserve":0,"riskFlags":[""],"documentFindings":[""],"missingInformation":[""],"assumptions":[""],"nextSteps":[""]}}`;

export async function handleAnalyze(request: Request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
    if (!authorize(request)) return json(request, { error: 'Invalid or missing MOTOCRAFT AI access code.' }, 401);
    if (rateLimit(request)) return json(request, { error: 'Too many requests. Wait a minute and try again.' }, 429);
    try {
      const parsed = analysisRequestSchema.safeParse(await request.json());
      if (!parsed.success) return json(request, { error: parsed.error.issues[0]?.message || 'Invalid analysis request.' }, 400);
      const { vehicle, documentText, evidenceNames, images } = parsed.data;
      const vinDecode = await decodeVin(vehicle.vin, vehicle.year);
      const textModel = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-20b';
      const visionModel = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
      let model = images.length ? visionModel : textModel;
      let usedImages = images.length > 0;
      const evidence = JSON.stringify({ vehicle, nhtsaVinSpecifications: vinDecode, evidenceNames, extractedDocumentText: documentText }, null, 2);
      const buildContent = (withImages: boolean): any[] => [{ type: 'text', text: `Analyze this proposed acquisition.\n${evidence}` }, ...(withImages ? images.map(image => ({ type: 'image_url', image_url: { url: image } })) : [])];
      let completion;
      try {
        completion = await groqChat({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: buildContent(usedImages) }], response_format: { type: 'json_object' }, temperature: 0.1, max_completion_tokens: 2600 });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!usedImages || !/too large|rate_limit|tokens per minute/i.test(message)) throw error;
        usedImages = false; model = textModel;
        completion = await groqChat({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: buildContent(false) }], response_format: { type: 'json_object' }, temperature: 0.1, max_completion_tokens: 2600 });
      }
      const result = parseModelJson(completion.choices?.[0]?.message?.content || '{}');
      if (images.length && !usedImages) result.riskFlags = [...(result.riskFlags || []), 'Uploaded photos/pages were skipped for this run because they exceeded the AI provider\'s size limit; this analysis is based on extracted text only.'];
      const userPurchasePrice = Number(vehicle.purchasePrice || 0);
      if (userPurchasePrice > 0) result.recommendedPurchase = { ...(result.recommendedPurchase || {}), max: userPurchasePrice };
      const repairMid = (Number(result.repairEstimate?.low || 0) + Number(result.repairEstimate?.high || 0)) / 2;
      const purchase = Number(result.recommendedPurchase?.max || vehicle.purchasePrice || 0);
      const reserve = Number(result.otherCostReserve || 0);
      const retailEstimate = Number(result.projectedRetail?.target || 0);
      const userTarget = Number(vehicle.targetRetailPrice || 0);
      // Without a real retail figure, 0 - purchase - repairs reads as a fabricated full-price loss.
      // Fall back to the user's own target, or break even on purchase price, instead of a misleading number.
      const retail = retailEstimate > 0 ? retailEstimate : userTarget > 0 ? userTarget : purchase;
      result.projectedGrossProfit = Math.round(retail - purchase - repairMid - reserve);
      result.model = model; result.analyzedAt = new Date().toISOString();
      result.disclaimer = 'Preliminary AI decision support only. Verify title, ownership, recalls, inspection findings, repair quotes, taxes, fees and live market comparables before purchasing or pricing a vehicle.';
      return json(request, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed.';
      return json(request, { error: message }, /configured/.test(message) ? 503 : 502);
    }
}

export default { fetch: handleAnalyze };
