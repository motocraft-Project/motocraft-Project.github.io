'use client';

import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, CarFront, Check, CircleAlert, FileInput, FileSearch, FileText, Image as ImageIcon, Link2, LoaderCircle, Mic, MicOff, Paperclip, ShieldCheck, Sparkles, Trash2, Upload, Volume2, X } from 'lucide-react';
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
function extractPrice(text:string):string{const matches=[...text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d{4,6})(?:\.\d{2})?/g)].map(m=>Number(m[1].replace(/,/g,'')));const candidate=matches.find(n=>n>=500&&n<=500000);return candidate?String(candidate):'';}
const US_STATE_CODES=['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
const KNOWN_MAKES=['Mercedes-Benz','Mercedes','Land Rover','Rolls-Royce','Alfa Romeo','Aston Martin','Chevrolet','Chevy','Cadillac','Chrysler','Volkswagen','Mitsubishi','Infiniti','Hyundai','Porsche','Maserati','Lamborghini','Ferrari','Bentley','Lincoln','Genesis','Subaru','Jaguar','Nissan','Toyota','Honda','Mazda','Lexus','Acura','Buick','Dodge','Jeep','Ford','Audi','Volvo','Tesla','Kia','Ram','GMC','BMW','Fiat','Mini','VW'];
const MAKE_ALIASES:Record<string,string>={Chevy:'Chevrolet',VW:'Volkswagen',Mercedes:'Mercedes-Benz'};
function extractMileage(text:string):string{const match=text.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:mi\.?\b|miles\b|mileage\b)/i);return match?match[1].replace(/,/g,''):'';}
function extractVin(text:string):string{const match=text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);return match?match[1].toUpperCase():'';}
function extractLocation(text:string):string{const pattern=new RegExp(`\\b([A-Z][a-zA-Z.'-]+(?:\\s[A-Z][a-zA-Z.'-]+)?),\\s*(${US_STATE_CODES.join('|')})\\b`);const match=text.match(pattern);return match?`${match[1]}, ${match[2]}`:'';}
function parseListingTitle(title:string):{year:string;make:string;model:string;trim:string}{
 const empty={year:'',make:'',model:'',trim:''};if(!title)return empty;
 let clean=title.split(/[|•·]/)[0].trim();clean=clean.replace(/\bfor sale\b.*/i,'').trim();
 clean=clean.replace(/^(Certified\s+Pre-?Owned|Certified\s+Used|Pre-?Owned|Brand\s+New|New|Used)\s+/i,'').trim();
 const yearMatch=clean.match(/\b(19[5-9]\d|20[0-4]\d)\b/);const year=yearMatch?.[1]||'';
 let rest=year?clean.slice(clean.indexOf(year)+year.length).trim():clean;
 const makeEntry=KNOWN_MAKES.find(make=>new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(rest));
 if(!makeEntry)return{...empty,year};
 const make=MAKE_ALIASES[makeEntry]||makeEntry;rest=rest.slice(makeEntry.length).trim();
 const words=rest.split(/\s+/).filter(Boolean);const model=words.shift()||'';const trim=words.join(' ');
 return{year,make,model,trim};
}
function parseListingDetails(title:string,text:string){const{year,make,model,trim}=parseListingTitle(title);return{year,make,model,trim,vin:extractVin(text),mileage:extractMileage(text),location:extractLocation(text)};}
function parseListingQueryParams(url:string){
 const empty={vin:'',year:'',make:'',model:'',price:'',location:''};
 let params:URLSearchParams;try{params=new URL(url).searchParams;}catch{return empty;}
 const vin=(params.get('vin')||params.get('vinSlug')||params.get('VIN')||'').toUpperCase();
 const year=params.get('year')||'';const make=params.get('make')||'';const model=params.get('model')||'';
 const price=params.get('sellingPrice')||params.get('dealerPrice')||params.get('price')||params.get('askingPrice')||params.get('listPrice')||'';
 const zip=params.get('zipCode')||params.get('zip')||'';
 return{vin:/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)?vin:'',year,make,model,price:/^\d+(\.\d+)?$/.test(price)?String(Math.round(Number(price))):'',location:zip?`ZIP ${zip}`:''};
}
function titleFromFilename(name:string):string{return name.replace(/\.(pdf|docx|txt|csv|json|md)$/i,'').replace(/\s+_\s+/g,' | ').trim();}
const ACCESS_CODE_STORAGE_KEY='motocraft-ai-access-code';
function readStoredAccessCode():string{if(typeof window==='undefined')return'';try{return window.localStorage.getItem(ACCESS_CODE_STORAGE_KEY)||'';}catch{return'';}}
function storeAccessCode(value:string){try{if(value)window.localStorage.setItem(ACCESS_CODE_STORAGE_KEY,value);else window.localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);}catch{/* ignore storage errors (private browsing, blocked) */}}

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
  if(pageNumber<=2){const viewport=page.getViewport({scale:.7});const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport} as never).promise;images.push(canvas.toDataURL('image/jpeg',.5));}
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
 const [input,setInput]=useState<VehicleAnalysisInput>(emptyVehicleAnalysisInput);const [files,setFiles]=useState<AIFileEvidence[]>([]);const [accessCode,setAccessCodeState]=useState(readStoredAccessCode);
 function setAccessCode(value:string){setAccessCodeState(value);storeAccessCode(value);}
 const [result,setResult]=useState<VehicleAnalysisResult|null>(null);const [busy,setBusy]=useState(false);const [fileBusy,setFileBusy]=useState(false);const [recording,setRecording]=useState(false);const [transcribing,setTranscribing]=useState(false);
 const [serviceUnavailable,setServiceUnavailable]=useState(false);const [listingUrl,setListingUrl]=useState('');const [listingBusy,setListingBusy]=useState(false);const [listingPrice,setListingPrice]=useState('');
 const recorder=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);const fileInput=useRef<HTMLInputElement|null>(null);const resultsRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch(endpoint('/api/health'),{signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>null);setServiceUnavailable(!response.ok||!data?.ok||!data?.groqConfigured);}).catch(error=>{if(error?.name!=='AbortError')setServiceUnavailable(true);});return()=>controller.abort();},[]);
 useEffect(()=>{if(result)resultsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[result]);
 const set=(key:keyof VehicleAnalysisInput,value:string)=>setInput(current=>({...current,[key]:value}));
 function selectVehicle(id:string){const v=db.inventory.find(row=>row.id===id);setFiles([]);setListingUrl('');setResult(null);if(!v){setInput(emptyVehicleAnalysisInput);setListingPrice('');return;}setInput({...emptyVehicleAnalysisInput,vin:v.vin||'',year:v.year||'',make:v.make||'',model:v.model||'',trim:v.trim||'',mileage:v.mileage||'',location:v.location||'',purchasePrice:v.purchase||'',titleStatus:v.title||'Unknown',history:v.history||'',maintenance:db.repairs.filter(r=>r.vehicleId===v.id).map(r=>`${r.date}: ${r.description}; parts $${r.parts||0}; labor $${r.labor||0}; status ${r.status}`).join('\n')});setListingPrice(v.asking||'');}
 async function addFiles(list:FileList|null){if(!list)return;const selected=[...list].slice(0,MAX_FILES-files.length);if(!selected.length){toast.error(`Upload up to ${MAX_FILES} evidence files.`);return;}setFileBusy(true);try{const processed:AIFileEvidence[]=[];for(const file of selected)processed.push(await processFile(file));setFiles(current=>[...current,...processed]);toast.success(`${processed.length} evidence file${processed.length===1?'':'s'} processed in your browser.`);}catch(error){toast.error(error instanceof Error?error.message:'Could not process the file.');}finally{setFileBusy(false);if(fileInput.current)fileInput.current.value='';}}
 function applyFileDetails(file:AIFileEvidence){
  if(!file.text){toast.error('No extractable text was found in this file.');return;}
  const d=parseListingDetails(titleFromFilename(file.name),file.text);
  setInput(current=>({...current,...(d.vin&&{vin:d.vin}),...(d.year&&{year:d.year}),...(d.make&&{make:d.make}),...(d.model&&{model:d.model}),...(d.trim&&{trim:d.trim}),...(d.mileage&&{mileage:d.mileage}),...(d.location&&{location:d.location})}));
  const price=extractPrice(file.text);if(price){setListingPrice(price);setInput(current=>({...current,purchasePrice:price}));}
  const found=[d.vin&&'VIN',d.year&&'Year',d.make&&'Make',d.model&&'Model',d.mileage&&'Mileage',d.location&&'Location',price&&'Price'].filter(Boolean);
  if(found.length)toast.success(`Loaded from ${file.name}: ${found.join(', ')}. Review and adjust as needed.`);
  else toast.message(`No vehicle details could be recognized in ${file.name}. Enter them manually.`);
 }
 async function call(path:string,body:unknown){if(!accessCode.trim())throw Error('Enter the private MOTOCRAFT AI access code.');const response=await fetch(endpoint(path),{method:'POST',headers:{'Content-Type':'application/json','X-Motocraft-Access-Code':accessCode},body:JSON.stringify(body)});const data=await response.json().catch(()=>({error:'Invalid server response.'}));if(!response.ok)throw Error(data.error||`Request failed (${response.status}).`);return data;}
 async function addListing(){if(!listingUrl.trim())return;const otherFiles=files.filter(file=>file.kind!=='link');if(otherFiles.length>=MAX_FILES){toast.error(`Upload up to ${MAX_FILES} evidence files.`);return;}setListingBusy(true);try{const data=await call('/api/fetch-listing',{url:listingUrl.trim()});const host=(()=>{try{return new URL(data.url).hostname;}catch{return listingUrl;}})();setFiles(current=>[...current.filter(file=>file.kind!=='link'),{id:crypto.randomUUID(),name:data.title||host,kind:'link',size:0,summary:`Listing text fetched from ${host}`,text:`Listing URL: ${data.url}\n${data.title}\n${data.text}`}]);
  const textDetails=parseListingDetails(data.title||'',data.text||'');const queryDetails=parseListingQueryParams(data.url||listingUrl);
  const vin=queryDetails.vin||textDetails.vin,year=queryDetails.year||textDetails.year,make=queryDetails.make||textDetails.make,model=queryDetails.model||textDetails.model,location=textDetails.location||queryDetails.location;
  setInput(current=>({...current,...(vin&&{vin}),...(year&&{year}),...(make&&{make}),...(model&&{model}),...(textDetails.trim&&{trim:textDetails.trim}),...(textDetails.mileage&&{mileage:textDetails.mileage}),...(location&&{location})}));
  const price=queryDetails.price||extractPrice(data.text||'');if(price){setListingPrice(price);setInput(current=>({...current,purchasePrice:price}));toast.success('Listing fetched. Vehicle details and the advertised price were added. Review and adjust as needed.');}else{toast.success('Listing fetched. Vehicle details were added where found. Review and adjust as needed.');}
  if(!textDetails.mileage)toast.message('Mileage was not found on this listing page. Some sites load it dynamically, so enter it manually or attach a screenshot/PDF as evidence.');
  setListingUrl('');}catch(error){toast.error(error instanceof Error?error.message:'Could not fetch that listing.');}finally{setListingBusy(false);}}
 function readyToAnalyze(){return input.purchasePrice.trim()!==''&&input.targetRetailPrice.trim()!=='';}
 function missingDetails(){const missing:string[]=[];const check=(value:string,label:string)=>{if(!value.trim())missing.push(label);};check(input.vin,'VIN');check(input.year,'Year');check(input.make,'Make');check(input.model,'Model');check(input.mileage,'Mileage');check(input.location,'Location');if(input.titleStatus==='Unknown')missing.push('Title status');check(input.maintenance,'Maintenance information');check(input.history,'Known history and condition');return missing;}
 async function analyze(){if(!input.purchasePrice.trim()){toast.error('Enter the final buying price before running the analysis.');return;}if(!input.targetRetailPrice.trim()){toast.error('Enter a target retail price before running the analysis.');return;}const missing=missingDetails();if(missing.length)toast.warning(`Missing details: ${missing.join(', ')}. Add them for a more accurate analysis.`);setBusy(true);setResult(null);try{const listingPriceNote=listingPrice?`Listing's advertised price: $${listingPrice}\n`:'';const documentText=(listingPriceNote+files.map(file=>file.text?`--- ${file.name} ---\n${file.text}`:'').filter(Boolean).join('\n')).slice(0,45000);const images=files.flatMap(file=>file.images||[]).slice(0,2);const analysis=await call('/api/analyze',{vehicle:input,documentText,evidenceNames:files.map(file=>file.name),images});setResult(analysis as VehicleAnalysisResult);toast.success('Vehicle analysis complete.');}catch(error){toast.error(error instanceof Error?error.message:'Analysis failed.');}finally{setBusy(false);}}
 async function startRecording(){try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';const media=new MediaRecorder(stream,{mimeType:mime});chunks.current=[];media.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};media.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());setRecording(false);const audio=new Blob(chunks.current,{type:media.mimeType});setTranscribing(true);try{const data=await call('/api/transcribe',{audioBase64:await blobToDataUrl(audio),mimeType:media.mimeType});set('spokenDetails',[input.spokenDetails,data.text].filter(Boolean).join('\n'));toast.success('Voice details transcribed.');}catch(error){toast.error(error instanceof Error?error.message:'Transcription failed.');}finally{setTranscribing(false);}};recorder.current=media;media.start();setRecording(true);}catch{toast.error('Microphone access was not available.');}}
 function stopRecording(){recorder.current?.stop();}
 function readResult(){if(!result||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const text=`${verdictLabel[result.verdict]}. ${result.executiveSummary}. Recommended maximum purchase ${aiCurrency(result.recommendedPurchase.max)}. Target retail ${aiCurrency(result.projectedRetail.target)}. Estimated repairs ${aiCurrency(result.repairEstimate.low)} to ${aiCurrency(result.repairEstimate.high)}.`;window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));}
 const verdictTone=result?.verdict==='worth_it'?'positive':result?.verdict==='pass'?'negative':'warning';
 return <div className="ai-page">
  <div className="ai-hero card"><div className="ai-hero-icon"><BrainCircuit size={27}/></div><div><span className="eyebrow">GROQ-POWERED ACQUISITION SUPPORT</span><h2>Turn evidence into a purchase decision.</h2><p>Combine vehicle facts, title and maintenance reports, photos, PDFs, and spoken notes to estimate risk, repairs, a maximum purchase price, and a retail target.</p></div><div className="ai-model-pills"><span><Sparkles size={12}/> Efficient model routing</span><span><ShieldCheck size={12}/> Server-protected key</span></div></div>
  {serviceUnavailable&&<div className="ai-config-warning"><CircleAlert size={18}/><div><strong>Secure AI service is unavailable</strong><p>The server health check failed. Confirm the backend deployment and its Groq environment variable, then refresh this page. The API key is never accepted by the browser.</p></div></div>}
  <div className="ai-workbench">
   <section className="card ai-input-card"><div className="card-heading"><div><h2>Vehicle and deal</h2><p>Start with an inventory record or enter a proposed purchase.</p></div><CarFront size={19}/></div><div className="ai-form">
    <label className="full-width">Load session vehicle<select aria-label="Load session vehicle" defaultValue="" onChange={e=>selectVehicle(e.target.value)}><option value="">Manual entry</option>{db.inventory.map((v:Row)=><option key={v.id} value={v.id}>{v.stock} · {labelVehicle(db,v.id)}</option>)}</select></label>
    <label>VIN<input value={input.vin} maxLength={17} onChange={e=>set('vin',e.target.value.toUpperCase())} placeholder="17-character VIN"/></label><label>Location<input value={input.location} onChange={e=>set('location',e.target.value)} placeholder="City, state"/></label>
    <label>Year<input value={input.year} inputMode="numeric" onChange={e=>set('year',e.target.value)} placeholder="4-digit year"/></label><label>Make<input value={input.make} onChange={e=>set('make',e.target.value)} placeholder="Vehicle make"/></label><label>Model<input value={input.model} onChange={e=>set('model',e.target.value)} placeholder="Vehicle model"/></label><label>Trim<input value={input.trim} onChange={e=>set('trim',e.target.value)} placeholder="Trim level"/></label>
    <label>Mileage<input value={input.mileage} inputMode="numeric" onChange={e=>set('mileage',e.target.value)} placeholder="Current odometer reading"/></label>
    <label>Final buying price<input value={input.purchasePrice} inputMode="decimal" onChange={e=>set('purchasePrice',e.target.value)} placeholder="Negotiated purchase price"/></label><label>Target retail price<input value={input.targetRetailPrice} inputMode="decimal" onChange={e=>set('targetRetailPrice',e.target.value)} placeholder="Your own resale estimate"/></label>
    <label className="full-width">Title status<select value={input.titleStatus} onChange={e=>set('titleStatus',e.target.value)}>{['Unknown','Clean','Pending','Rebuilt','Salvage','Flood','Lemon / buyback'].map(value=><option key={value}>{value}</option>)}</select></label>
    <label className="full-width">Maintenance information<textarea rows={3} value={input.maintenance} onChange={e=>set('maintenance',e.target.value)} placeholder="Service dates, mileage, work performed, missing intervals..."/></label>
    <label className="full-width">Known history and condition<textarea rows={3} value={input.history} onChange={e=>set('history',e.target.value)} placeholder="Accidents, warning lights, paintwork, rust, tire/brake condition, inspection notes..."/></label>
    <label className="full-width voice-field">Spoken details<div className="voice-box"><textarea rows={4} value={input.spokenDetails} onChange={e=>set('spokenDetails',e.target.value)} placeholder="Record or type additional details..."/><button type="button" className={`record-button ${recording?'recording':''}`} onClick={recording?stopRecording:startRecording} disabled={transcribing}>{transcribing?<LoaderCircle className="spin"/>:recording?<MicOff/>:<Mic/>}<span>{transcribing?'Transcribing':recording?'Stop':'Record'}</span></button></div></label>
   </div></section>
   <section className="card ai-evidence-card"><div className="card-heading"><div><h2>Evidence</h2><p>Documents stay in memory and are prepared in your browser.</p></div><Paperclip size={19}/></div>
    <label className="ai-listing-field">Paste a listing link<div className="ai-listing-row"><input type="url" value={listingUrl} onChange={e=>setListingUrl(e.target.value)} placeholder="https://example.com/listing/123" disabled={listingBusy}/><Button type="button" variant="outline" onClick={addListing} disabled={listingBusy||!listingUrl.trim()}>{listingBusy?<LoaderCircle className="spin"/>:<Link2 size={15}/>}<span>{listingBusy?'Reading…':'Fetch'}</span></Button></div></label>
    <p className="ai-listing-hint">Works best for plain dealer/listing pages. Sites that require a login or heavy JavaScript (e.g. Facebook Marketplace) often can't be read this way.</p>
    {listingPrice&&<div className="ai-listing-price-banner"><span>Listing price</span><strong>{aiCurrency(Number(listingPrice))}</strong><small>From the listing · not editable</small></div>}
    <button className="ai-dropzone" onClick={()=>fileInput.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void addFiles(e.dataTransfer.files)}} disabled={fileBusy}><input ref={fileInput} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,.docx,.txt,.csv,.json,.md" onChange={e=>void addFiles(e.target.files)}/>{fileBusy?<LoaderCircle className="spin"/>:<Upload/>}<strong>{fileBusy?'Processing evidence…':'Drop reports and photos here'}</strong><span>Images, PDF, DOCX, TXT, CSV, JSON, or MD · up to 8 files</span></button>
    <div className="ai-file-list">{files.map(file=><div key={file.id}><div className="ai-file-icon">{file.kind==='image'?<ImageIcon/>:file.kind==='link'?<Link2/>:<FileText/>}</div><div><strong>{file.name}</strong><span>{file.summary} · {file.kind==='link'?'Listing':fileSize(file.size)}</span></div><div className="ai-file-actions">{file.text&&<button className="ai-file-load" aria-label={`Load details from ${file.name} into the form`} title="Load details into the form" onClick={()=>applyFileDetails(file)}><FileInput size={13}/><span>Load</span></button>}<button aria-label={`Remove ${file.name}`} onClick={()=>setFiles(current=>current.filter(item=>item.id!==file.id))}><X size={15}/></button></div></div>)}{!files.length&&<div className="ai-empty-evidence"><FileSearch size={26}/><p>Add title reports, maintenance records, inspection PDFs, auction condition reports, damage photos, or a listing link.</p></div>}</div>
    <div className="ai-privacy-note"><ShieldCheck size={16}/><p>Uploaded content is sent to the configured server and Groq only when you select Analyze. MOTOCRAFT does not persist it in this demo.</p></div>
    <label className="ai-access-code">Private AI access code<input type="password" autoComplete="off" value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Team access code"/><small>This is your team access code, not the Groq API key.</small></label>
    <Button className="ai-analyze-button" onClick={analyze} disabled={busy||fileBusy}>{busy?<LoaderCircle className="spin"/>:<Sparkles/>}{busy?'Reviewing evidence…':'Analyze purchase'}</Button>
    {!readyToAnalyze()&&<p className="ai-listing-hint">Final buying price and target retail price are required to run the analysis.</p>}
   </section>
  </div>
  {result&&<section ref={resultsRef} className="card ai-results"><div className="ai-results-heading"><div><span className={`ai-verdict ${verdictTone}`}>{verdictLabel[result.verdict]}</span><h2>{result.vehicleIdentity.year} {result.vehicleIdentity.make} {result.vehicleIdentity.model}</h2><p>{result.executiveSummary}</p></div><div className="ai-confidence"><span>Confidence</span><strong>{Math.round(result.confidence)}%</strong><Button variant="outline" size="sm" onClick={readResult}><Volume2 size={14}/> Read aloud</Button></div></div>
   <div className="ai-price-grid"><div><span>Maximum purchase</span><strong>{aiCurrency(result.recommendedPurchase.max)}</strong><p>{result.recommendedPurchase.rationale}</p></div><div><span>Estimated repairs</span><strong>{aiCurrency(result.repairEstimate.low)}–{aiCurrency(result.repairEstimate.high)}</strong><p>{result.repairEstimate.basis}</p></div><div><span>Target retail</span><strong>{aiCurrency(result.projectedRetail.target)}</strong><p>{aiCurrency(result.projectedRetail.low)}–{aiCurrency(result.projectedRetail.high)}</p></div><div><span>Projected gross profit</span><strong className={result.projectedGrossProfit>=0?'positive':'negative'}>{aiCurrency(result.projectedGrossProfit)}</strong><p>Before taxes and unlisted costs</p></div></div>
   <div className="ai-results-grid"><article><h3>Risk flags</h3><ResultList items={result.riskFlags}/></article><article><h3>Document findings</h3><ResultList items={result.documentFindings}/></article><article><h3>Title assessment · {result.titleAssessment.rating.replaceAll('_',' ')}</h3><ResultList items={result.titleAssessment.findings}/></article><article><h3>Maintenance · {result.maintenanceAssessment.rating}</h3><ResultList items={result.maintenanceAssessment.findings}/></article></div>
   <div className="ai-repair-table"><h3>Repair estimate breakdown</h3>{result.repairEstimate.items?.length?<table><thead><tr><th>Item</th><th>Urgency</th><th>Low</th><th>High</th></tr></thead><tbody>{result.repairEstimate.items.map((item,i)=><tr key={`${item.item}-${i}`}><td>{item.item}</td><td><span className={`ai-urgency ${item.urgency}`}>{item.urgency}</span></td><td>{aiCurrency(item.low)}</td><td>{aiCurrency(item.high)}</td></tr>)}</tbody></table>:<p className="muted">No repair lines could be estimated from the supplied evidence.</p>}</div>
   <div className="ai-results-grid"><article><h3>Missing information</h3><ResultList items={result.missingInformation}/></article><article><h3>Recommended next steps</h3><ResultList items={result.nextSteps}/></article><article><h3>Assumptions</h3><ResultList items={result.assumptions}/></article><article><h3>Evidence reviewed</h3><ResultList items={result.evidenceReviewed}/></article></div>
   <div className="ai-disclaimer"><CircleAlert size={16}/><p>{result.disclaimer}</p><span>{result.model}</span></div>
  </section>}
 </div>;
}
