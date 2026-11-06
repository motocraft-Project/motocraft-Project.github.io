import Decimal from 'decimal.js';
import { z } from 'zod';
import { Database, Row, Module, modules, saleTotal, paid, repairCost, id } from './demo';
export type Role = 'Administrator'|'Manager'|'Employee';
export const sensitive = ['acquisitions','auctions','payments','expenses','payables','receivables','profit','reports','users','settings','audit'];
export function canAccess(role:Role,key:string) { return role==='Administrator'||(role==='Manager'?!['users','settings'].includes(key):!sensitive.includes(key)); }
export function canWrite(role:Role,key:string) { return canAccess(role,key)&&!(role==='Employee'&&['sales','invoices','documents','vendors','mechanics'].includes(key)); }
export function recordSchema(module:Module) {
 return z.object(Object.fromEntries(module.fields.map(f=>{
   let schema:z.ZodType<string,string>=z.string().trim();
   if(f.required) schema=z.string().trim().min(1,`${f.label} is required`);
   if(f.type==='number') schema=z.string().refine(v=>v===''&&!f.required||/^\d+(\.\d{1,2})?$/.test(v),`${f.label} must be a nonnegative number with up to 2 decimal places`);
   if(f.type==='email') schema=z.string().refine(v=>!v||z.email().safeParse(v).success,'Enter a valid email address');
   return [f.key,schema];
 })));
}
export function saveRecord(db:Database,key:string,input:Row,role:Role):Database {
 if(!canWrite(role,key)) throw Error('Your demo role cannot modify this module.');
 const module=modules.find(m=>m.key===key); if(!module) throw Error('Unknown module');
 const parsed=recordSchema(module).parse(Object.fromEntries(module.fields.map(f=>[f.key,input[f.key]||''])));
 const row={...input,...parsed}; const previous=db[key].find(r=>r.id===row.id);
 if(previous&&(key==='payments'||key==='sales'&&previous.status==='Finalized'||['invoices','acquisitions','auctions','transportation','repairs','expenses'].includes(key))) throw Error('Posted records are immutable. Reverse the record and create a correction.');
 for(const f of module.fields) {
   const target=({vehicle:'inventory',customer:'customers',vendor:'vendors',mechanic:'mechanics',sale:'sales',repair:'repairs'} as Record<string,string>)[f.type||''];
   if(target&&row[f.key]&&!db[target].some(r=>r.id===row[f.key])) throw Error(`${f.label} no longer exists.`);
   if(f.options&&row[f.key]&&!f.options.includes(row[f.key])) throw Error(`Invalid ${f.label}`);
 }
 if(key==='inventory') {
   if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(row.vin.toUpperCase())) throw Error('VIN must contain 17 letters and digits, excluding I, O, and Q.');
   if(!/^\d{4}$/.test(row.year)||+row.year<1886||+row.year>new Date().getFullYear()+2) throw Error('Enter a valid vehicle year.');
   row.vin=row.vin.toUpperCase();
   if(db.inventory.some(r=>r.id!==row.id&&(r.stock.toLowerCase()===row.stock.toLowerCase()||r.vin===row.vin))) throw Error('Stock number and VIN must be unique.');
   if(['Sold','Delivered'].includes(row.status)&&!db.sales.some(r=>r.vehicleId===row.id&&r.status==='Finalized')) throw Error('Finalize a sale to mark this vehicle sold.');
   if(previous&&db.sales.some(r=>r.vehicleId===row.id&&r.status==='Finalized')) throw Error('Reverse the finalized sale before changing its vehicle.');
 }
 if(row.number&&db[key].some(r=>r.number===row.number&&r.id!==row.id)) throw Error('Document/reference number already exists.');
 if(['acquisitions','auctions','transportation','repairs'].includes(key)&&db.sales.some(s=>s.vehicleId===row.vehicleId&&s.status==='Finalized')) throw Error('Reverse the finalized sale before changing this vehicle’s historical cost.');
 if(key==='auctions'&&db.auctions.some(r=>r.vehicleId===row.vehicleId&&r.status!=='Reversed'&&r.id!==row.id)) throw Error('This vehicle already has an auction cost posting.');
 if(key==='sales') {
   if(db.sales.some(r=>r.vehicleId===row.vehicleId&&r.status==='Finalized'&&r.id!==row.id)) throw Error('This vehicle has already been sold.');
   const v=db.inventory.find(r=>r.id===row.vehicleId);
   if(row.status==='Finalized'&&(!v||!['Ready for sale','Listed','Reserved','Wholesale'].includes(v.status))) throw Error('Vehicle must be ready for sale, listed, reserved, or wholesale.');
   if(saleTotal(row).lt(0)) throw Error('Sale total cannot be negative.');
   if(new Decimal(row.discount||0).plus(row.trade||0).gt(row.price||0)) throw Error('Discount and trade-in cannot exceed the selling price.');
 }
 if(key==='invoices'&&!db.sales.some(r=>r.id===row.saleId&&r.status==='Finalized')) throw Error('Select a finalized sale.');
 if(key==='payments') {
   if(new Decimal(row.amount||0).lte(0)) throw Error('Payment must be greater than zero.');
   const refs=[row.saleId,row.repairId,row.expenseId].filter(Boolean); if(refs.length!==1) throw Error('Allocate a payment to exactly one sale, repair, or expense. Split a batch into individually referenced allocations.');
   let due=new Decimal(0);
   if(row.kind==='Customer receipt') {const s=db.sales.find(r=>r.id===row.saleId&&r.status==='Finalized');if(!s)throw Error('Select a finalized sale.');due=saleTotal(s).minus(paid(db,'saleId',s.id));}
   else if(row.kind==='Repair payment') {const r=db.repairs.find(r=>r.id===row.repairId&&!['Cancelled','Reversed'].includes(r.status));if(!r)throw Error('Select an active repair.');const component=(row.component||'').toLowerCase();if(!['labor','parts','diagnostics','additional'].includes(component))throw Error('Choose a repair allocation.');due=new Decimal(r[component]||0).minus(paid(db,'repairId',r.id,row.component));}
   else {const e=db.expenses.find(r=>r.id===row.expenseId&&r.status!=='Reversed');if(!e)throw Error('Enter an active expense ID.');due=new Decimal(e.amount||0).minus(paid(db,'expenseId',e.id));}
   if(new Decimal(row.amount).gt(due)) throw Error(`Payment exceeds the remaining balance (${due.toFixed(2)}).`);
 }
 let next:Database={...db,[key]:previous?db[key].map(r=>r.id===row.id?row:r):[row,...db[key]]};
 if(key==='sales'&&row.status==='Finalized') next={...next,inventory:next.inventory.map(v=>v.id===row.vehicleId?{...v,status:row.delivery==='Delivered'?'Delivered':'Sold'}:v)};
 if(key==='transportation'&&row.status==='Delivered') next={...next,inventory:next.inventory.map(v=>v.id===row.vehicleId&&!['Sold','Delivered'].includes(v.status)?{...v,status:'Received'}:v)};
 return log(next,`${previous?'Updated':'Created'} ${module.singular}: ${row.number||row.name||row.stock||row.id}`,role);
}
export function log(db:Database,description:string,user:string):Database {const event={id:id(),description,user,date:new Date().toISOString()};return {...db,audit:[event,...db.audit],notifications:[{id:id(),name:description,description:`${user} · Just now`,read:'false'},...db.notifications]};}
export function reverseRecord(db:Database,key:string,row:Row,role:Role):Database {
 if(role==='Employee') throw Error('A manager or administrator must approve reversals.');
 if(!canWrite(role,key)) throw Error('Permission denied.');
 if(['Reversed','Cancelled','Archived'].includes(row.status)) throw Error('This record is already inactive.');
 const link=key==='sales'?'saleId':key==='repairs'?'repairId':key==='expenses'?'expenseId':'';
 if(link&&paid(db,link,row.id).gt(0)) throw Error('Reverse allocated payments first.');
 if(['acquisitions','auctions','transportation','repairs'].includes(key)&&db.sales.some(s=>s.vehicleId===row.vehicleId&&s.status==='Finalized')) throw Error('Reverse the finalized sale before changing this vehicle’s historical cost.');
 if(['inventory','customers','vendors','mechanics'].includes(key)) throw Error('Use Edit to archive or deactivate this profile.');
 let next={...db,[key]:db[key].map(r=>r.id===row.id?{...r,status:'Reversed'}:r)};
 if(key==='sales') next={...next,inventory:next.inventory.map(v=>v.id===row.vehicleId?{...v,status:'Ready for sale'}:v),invoices:next.invoices.map(i=>i.saleId===row.id?{...i,status:'Reversed'}:i)};
 return log(next,`Reversed ${key} record ${row.number||row.id}. Original retained.`,role);
}
