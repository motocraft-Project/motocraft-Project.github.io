export type AIFileEvidence = {
  id: string;
  name: string;
  kind: 'image' | 'pdf' | 'document' | 'link';
  size: number;
  summary: string;
  text?: string;
  images?: string[];
};

export type VehicleAnalysisInput = {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  mileage: string;
  purchasePrice: string;
  targetRetailPrice: string;
  titleStatus: string;
  location: string;
  maintenance: string;
  history: string;
  spokenDetails: string;
};

export type MoneyRange = { low: number; high: number };
export type RepairLine = { item: string; low: number; high: number; urgency: 'immediate' | 'soon' | 'monitor' };

export type VehicleAnalysisResult = {
  verdict: 'worth_it' | 'negotiate' | 'pass' | 'insufficient_data';
  confidence: number;
  executiveSummary: string;
  evidenceReviewed: string[];
  vehicleIdentity: { vin: string; year: string; make: string; model: string; trim: string; source: string };
  titleAssessment: { rating: 'low_risk' | 'medium_risk' | 'high_risk' | 'unknown'; findings: string[] };
  maintenanceAssessment: { rating: 'good' | 'mixed' | 'poor' | 'unknown'; findings: string[] };
  repairEstimate: MoneyRange & { items: RepairLine[]; basis: string };
  recommendedPurchase: { max: number; rationale: string };
  projectedRetail: MoneyRange & { target: number; basis: string };
  otherCostReserve: number;
  projectedGrossProfit: number;
  riskFlags: string[];
  documentFindings: string[];
  missingInformation: string[];
  assumptions: string[];
  nextSteps: string[];
  model: string;
  analyzedAt: string;
  disclaimer: string;
};

export const emptyVehicleAnalysisInput: VehicleAnalysisInput = {
  vin: '', year: '', make: '', model: '', trim: '', mileage: '', purchasePrice: '', targetRetailPrice: '',
  titleStatus: 'Unknown', location: '', maintenance: '', history: '', spokenDetails: ''
};

export const verdictLabel: Record<VehicleAnalysisResult['verdict'], string> = {
  worth_it: 'Worth considering', negotiate: 'Negotiate', pass: 'Pass', insufficient_data: 'More evidence needed'
};

export const aiCurrency = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(Number.isFinite(value) ? value : 0);
