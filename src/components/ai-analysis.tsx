'use client';

import { useRef, useState } from 'react';
import { BrainCircuit, CarFront, Check, CircleAlert, FileSearch, FileText, Image as ImageIcon, LoaderCircle, Mic, MicOff, Paperclip, Play, ShieldCheck, Sparkles, Trash2, Upload, Volume2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { aiCurrency, emptyVehicleAnalysisInput, verdictLabel, type AIFileEvidence, type VehicleAnalysisInput, type VehicleAnalysisResult } from '@/lib/ai';
import { labelVehicle, type Database, type Row } from '@/lib/demo';

const API_ORIGIN=(process.env.NEXT_PUBLIC_AI_API_URL||'').replace(/\/$/,'');
const BASE_PATH=process.env.NEXT_PUBLIC_BASE_PATH||'';
const MAX_FILES=8;

const endpoint=(path:string)=>`${API_ORIGIN}${path}`;
const fileSize=(bytes:number)=>bytes<1_000_000?`${Math.round(bytes/1000)} KB`:`${(bytes/1_000_000).toFixed(1)} MB`;
const blobToDataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});

async function compressImage(file:Blob,max=1500,quality=.78){
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',quality);
}

async function processPdf(file:File):Promise<AIFileEvidence>{
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=`${BASE_PATH}/pdf.worker.min.mjs`;
 const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;const text:string[]=[];const images:string[]=[];
 for(let pageNumber=1;pageNumber<=Math.min(pdf.numPages,12);pageNumber++){
  const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();
  text.push(content.items.map(item=>'str' in item?item.str:'').join(' '));
  if(pageNumber<=3){const viewport=page.getViewport({scale:1.15});const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport} as never).promise;images.push(canvas.toDataURL('image/jpeg',.68));}
 }
 return{id:crypto.randomUUID(),name:file.name,kind:'pdf',size:file.size,summary:`${pdf.numPages} page PDF · first ${Math.min(pdf.numPages,12)} pages processed`,text:text.join('\n').slice(0,30000),images};
}

async function processFile(file:File):Promise<AIFileEvidence>{
 if(file.size>15_000_000)throw Error(`${file.name} exceeds the 15 MB input limit.`);
 if(file.type.startsWith('image/'))return{id:crypto.randomUUID(),name:file.name,kind:'image',size:file.size,summary:'Image compressed for visual inspection',images:[await compressImage(file)]};
 if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf'))return processPdf(file);
 if(file.name.toLowerCase().endsWith('.docx')){const mammoth=await import('mammoth/mammoth.browser');const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return{id:crypto.randomUUID(),name:file.name,kind:'document',size:file.size,summary:'DOCX text extracted',text:result.value.slice(0,30000)};}
 if(/\.(txt|csv|json|md)$/i.test(file.name)||file.type.startsWith('text/'))return{id:crypto.randomUUID(),name:file.name,kind:'document',size:file.size,summary:'Text document extracted',text:(await file.text()).slice(0,30000)};
 throw Error(`${file.name} is not a supported image, PDF, DOCX, TXT, CSV, JSON, or Markdown file.`);
}

function ResultList({items,empty='None identified'}:{items:string[];empty?:string}){return <ul className="ai-result-list">{items?.length?items.map((item,i)=><li key={`${item}-${i}`}><Check size={13}/><span>{item}</span></li>):<li className="muted">{empty}</li>}</ul>}

export function AIAnalysis({db}:{db:Database}){
 const [input,setInput]=useState<VehicleAnalysisInput>(emptyVehicleAnalysisInput);const [files,setFiles]=useState<AIFileEvidence[]>([]);const [accessCode,setAccessCode]=useState('');
 const [result,setResult]=useState<VehicleAnalysisResult|null>(null);const [busy,setBusy]=useState(false);const [fileBusy,setFileBusy]=useState(false);const [recording,setRecording]=useState(false);const [transcribing,setTranscribing]=useState(false);
 const recorder=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);const fileInput=useRef<HTMLInputElement|null>(null);
 const set=(key:keyof VehicleAnalysisInput,value:string)=>setInput(current=>({...current,[key]:value}));
 function selectVehicle(id:string){const v=db.inventory.find(row=>row.id===id);if(!v)return;setInput(current=>({...current,vin:v.vin||'',year:v.year||'',make:v.make||'',model:v.model||'',trim:v.trim||'',mileage:v.mileage||'',purchasePrice:v.purchase||'',titleStatus:v.title||'Unknown',maintenance:db.repairs.filter(r=>r.vehicleId===v.id).map(r=>`${r.date}: ${r.description}; parts $${r.parts||0}; labor $${r.labor||0}; status ${r.status}`).join('\n')}));}
 async function addFiles(list:FileList|null){if(!list)return;const selected=[...list].slice(0,MAX_FILES-files.length);if(!selected.length){toast.error(`Upload up to ${MAX_FILES} evidence files.`);return;}setFileBusy(true);try{const processed:AIFileEvidence[]=[];for(const file of selected)processed.push(await processFile(file));setFiles(current=>[...current,...processed]);toast.success(`${processed.length} evidence file${processed.length===1?'':'s'} processed in your browser.`);}catch(error){toast.error(error instanceof Error?error.message:'Could not process the file.');}finally{setFileBusy(false);if(fileInput.current)fileInput.current.value='';}}
 async function call(path:string,body:unknown){if(!API_ORIGIN)throw Error('The secure AI service has not been deployed yet.');if(!accessCode.trim())throw Error('Enter the private MOTOCRAFT AI access code.');const response=await fetch(endpoint(path),{method:'POST',headers:{'Content-Type':'application/json','X-Motocraft-Access-Code':accessCode},body:JSON.stringify(body)});const data=await response.json().catch(()=>({error:'Invalid server response.'}));if(!response.ok)throw Error(data.error||`Request failed (${response.status}).`);return data;}
 async function analyze(){setBusy(true);setResult(null);try{const documentText=files.map(file=>file.text?`--- ${file.name} ---\n${file.text}`:'').filter(Boolean).join('\n').slice(0,45000);const images=files.flatMap(file=>file.images||[]).slice(0,5);const analysis=await call('/api/analyze',{vehicle:input,documentText,evidenceNames:files.map(file=>file.name),images});setResult(analysis as VehicleAnalysisResult);toast.success('Vehicle analysis complete.');}catch(error){toast.error(error instanceof Error?error.message:'Analysis failed.');}finally{setBusy(false);}}
 async function startRecording(){try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';const media=new MediaRecorder(stream,{mimeType:mime});chunks.current=[];media.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};media.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());setRecording(false);const audio=new Blob(chunks.current,{type:media.mimeType});setTranscribing(true);try{const data=await call('/api/transcribe',{audioBase64:await blobToDataUrl(audio),mimeType:media.mimeType});set('spokenDetails',[input.spokenDetails,data.text].filter(Boolean).join('\n'));toast.success('Voice details transcribed.');}catch(error){toast.error(error instanceof Error?error.message:'Transcription failed.');}finally{setTranscribing(false);}};recorder.current=media;media.start();setRecording(true);}catch{toast.error('Microphone access was not available.');}}
 function stopRecording(){recorder.current?.stop();}
 function readResult(){if(!result||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const text=`${verdictLabel[result.verdict]}. ${result.executiveSummary}. Recommended maximum purchase ${aiCurrency(result.recommendedPurchase.max)}. Target retail ${aiCurrency(result.projectedRetail.target)}. Estimated repairs ${aiCurrency(result.repairEstimate.low)} to ${aiCurrency(result.repairEstimate.high)}.`;window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));}
 const verdictTone=result?.verdict==='worth_it'?'positive':result?.verdict==='pass'?'negative':'warning';
 return <div className="ai-page">
  <div className="ai-hero card"><div className="ai-hero-icon"><BrainCircuit size={27}/></div><div><span className="eyebrow">GROQ-POWERED ACQUISITION SUPPORT</span><h2>Turn evidence into a purchase decision.</h2><p>Combine vehicle facts, title and maintenance reports, photos, PDFs, and spoken notes to estimate risk, repairs, a maximum purchase price, and a retail target.</p></div><div className="ai-model-pills"><span><Sparkles size={12}/> Efficient model routing</span><span><ShieldCheck size={12}/> Server-protected key</span></div></div>
  {!API_ORIGIN&&<div className="ai-config-warning"><CircleAlert size={18}/><div><strong>Secure AI service setup is pending</strong><p>The analysis interface is ready, but the server endpoint and Groq secret must be deployed before requests can run. The API key is never accepted by this browser page.</p></div></div>}
  <div className="ai-workbench">
   <section className="card ai-input-card"><div className="card-heading"><div><h2>Vehicle and deal</h2><p>Start with an inventory record or enter a proposed purchase.</p></div><CarFront size={19}/></div><div className="ai-form">
    <label className="full-width">Load session vehicle<select aria-label="Load session vehicle" defaultValue="" onChange={e=>selectVehicle(e.target.value)}><option value="">Manual entry</option>{db.inventory.map((v:Row)=><option key={v.id} value={v.id}>{v.stock} · {labelVehicle(db,v.id)}</option>)}</select></label>
    <label>VIN<input value={input.vin} maxLength={17} onChange={e=>set('vin',e.target.value.toUpperCase())} placeholder="17-character VIN"/></label><label>Location<input value={input.location} onChange={e=>set('location',e.target.value)} placeholder="City, state"/></label>
    <label>Year<input value={input.year} inputMode="numeric" onChange={e=>set('year',e.target.value)} placeholder="2022"/></label><label>Make<input value={input.make} onChange={e=>set('make',e.target.value)} placeholder="Toyota"/></label><label>Model<input value={input.model} onChange={e=>set('model',e.target.value)} placeholder="Camry"/></label><label>Trim<input value={input.trim} onChange={e=>set('trim',e.target.value)} placeholder="SE"/></label>
    <label>Mileage<input value={input.mileage} inputMode="numeric" onChange={e=>set('mileage',e.target.value)} placeholder="45,000"/></label><label>Proposed purchase price<input value={input.purchasePrice} inputMode="decimal" onChange={e=>set('purchasePrice',e.target.value)} placeholder="12000"/></label>
    <label>Title status<select value={input.titleStatus} onChange={e=>set('titleStatus',e.target.value)}>{['Unknown','Clean','Pending','Rebuilt','Salvage','Flood','Lemon / buyback'].map(value=><option key={value}>{value}</option>)}</select></label><label>Desired gross margin<input value={input.desiredMargin} inputMode="decimal" onChange={e=>set('desiredMargin',e.target.value)} placeholder="2500"/></label>
    <label className="full-width">Maintenance information<textarea rows={3} value={input.maintenance} onChange={e=>set('maintenance',e.target.value)} placeholder="Service dates, mileage, work performed, missing intervals..."/></label>
    <label className="full-width">Known history and condition<textarea rows={3} value={input.history} onChange={e=>set('history',e.target.value)} placeholder="Accidents, warning lights, paintwork, rust, tire/brake condition, inspection notes..."/></label>
    <label className="full-width voice-field">Spoken details<div className="voice-box"><textarea rows={4} value={input.spokenDetails} onChange={e=>set('spokenDetails',e.target.value)} placeholder="Record or type additional details..."/><button type="button" className={`record-button ${recording?'recording':''}`} onClick={recording?stopRecording:startRecording} disabled={transcribing}>{transcribing?<LoaderCircle className="spin"/>:recording?<MicOff/>:<Mic/>}<span>{transcribing?'Transcribing':recording?'Stop':'Record'}</span></button></div></label>
   </div></section>
   <section className="card ai-evidence-card"><div className="card-heading"><div><h2>Evidence</h2><p>Documents stay in memory and are prepared in your browser.</p></div><Paperclip size={19}/></div><button className="ai-dropzone" onClick={()=>fileInput.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void addFiles(e.dataTransfer.files)}} disabled={fileBusy}><input ref={fileInput} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,.docx,.txt,.csv,.json,.md" onChange={e=>void addFiles(e.target.files)}/>{fileBusy?<LoaderCircle className="spin"/>:<Upload/>}<strong>{fileBusy?'Processing evidence…':'Drop reports and photos here'}</strong><span>Images, PDF, DOCX, TXT, CSV, JSON, or MD · up to 8 files</span></button>
    <div className="ai-file-list">{files.map(file=><div key={file.id}><div className="ai-file-icon">{file.kind==='image'?<ImageIcon/>:<FileText/>}</div><div><strong>{file.name}</strong><span>{file.summary} · {fileSize(file.size)}</span></div><button aria-label={`Remove ${file.name}`} onClick={()=>setFiles(current=>current.filter(item=>item.id!==file.id))}><X size={15}/></button></div>)}{!files.length&&<div className="ai-empty-evidence"><FileSearch size={26}/><p>Add title reports, maintenance records, inspection PDFs, auction condition reports, or damage photos.</p></div>}</div>
    <div className="ai-privacy-note"><ShieldCheck size={16}/><p>Uploaded content is sent to the configured server and Groq only when you select Analyze. MOTOCRAFT does not persist it in this demo.</p></div>
    <label className="ai-access-code">Private AI access code<input type="password" autoComplete="off" value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Team access code"/><small>This is your team access code, not the Groq API key.</small></label>
    <Button className="ai-analyze-button" onClick={analyze} disabled={busy||fileBusy}>{busy?<LoaderCircle className="spin"/>:<Sparkles/>}{busy?'Reviewing evidence…':'Analyze purchase'}</Button>
   </section>
  </div>
  {result&&<section className="card ai-results"><div className="ai-results-heading"><div><span className={`ai-verdict ${verdictTone}`}>{verdictLabel[result.verdict]}</span><h2>{result.vehicleIdentity.year} {result.vehicleIdentity.make} {result.vehicleIdentity.model}</h2><p>{result.executiveSummary}</p></div><div className="ai-confidence"><span>Confidence</span><strong>{Math.round(result.confidence)}%</strong><Button variant="outline" size="sm" onClick={readResult}><Volume2 size={14}/> Read aloud</Button></div></div>
   <div className="ai-price-grid"><div><span>Maximum purchase</span><strong>{aiCurrency(result.recommendedPurchase.max)}</strong><p>{result.recommendedPurchase.rationale}</p></div><div><span>Estimated repairs</span><strong>{aiCurrency(result.repairEstimate.low)}–{aiCurrency(result.repairEstimate.high)}</strong><p>{result.repairEstimate.basis}</p></div><div><span>Target retail</span><strong>{aiCurrency(result.projectedRetail.target)}</strong><p>{aiCurrency(result.projectedRetail.low)}–{aiCurrency(result.projectedRetail.high)}</p></div><div><span>Projected gross profit</span><strong className={result.projectedGrossProfit>=0?'positive':'negative'}>{aiCurrency(result.projectedGrossProfit)}</strong><p>Before taxes and unlisted costs</p></div></div>
   <div className="ai-results-grid"><article><h3>Risk flags</h3><ResultList items={result.riskFlags}/></article><article><h3>Document findings</h3><ResultList items={result.documentFindings}/></article><article><h3>Title assessment · {result.titleAssessment.rating.replaceAll('_',' ')}</h3><ResultList items={result.titleAssessment.findings}/></article><article><h3>Maintenance · {result.maintenanceAssessment.rating}</h3><ResultList items={result.maintenanceAssessment.findings}/></article></div>
   <div className="ai-repair-table"><h3>Repair estimate breakdown</h3>{result.repairEstimate.items?.length?<table><thead><tr><th>Item</th><th>Urgency</th><th>Low</th><th>High</th></tr></thead><tbody>{result.repairEstimate.items.map((item,i)=><tr key={`${item.item}-${i}`}><td>{item.item}</td><td><span className={`ai-urgency ${item.urgency}`}>{item.urgency}</span></td><td>{aiCurrency(item.low)}</td><td>{aiCurrency(item.high)}</td></tr>)}</tbody></table>:<p className="muted">No repair lines could be estimated from the supplied evidence.</p>}</div>
   <div className="ai-results-grid"><article><h3>Missing information</h3><ResultList items={result.missingInformation}/></article><article><h3>Recommended next steps</h3><ResultList items={result.nextSteps}/></article><article><h3>Assumptions</h3><ResultList items={result.assumptions}/></article><article><h3>Evidence reviewed</h3><ResultList items={result.evidenceReviewed}/></article></div>
   <div className="ai-disclaimer"><CircleAlert size={16}/><p>{result.disclaimer}</p><span>{result.model}</span></div>
  </section>}
 </div>;
}
