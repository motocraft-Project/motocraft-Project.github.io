import { describe, expect, it } from 'vitest';
import { initialDatabase, vehicleCost, finances, paid, type Database, type Row } from '../src/lib/demo';
import { saveRecord, reverseRecord, canAccess } from '../src/lib/operations';
function empty():Database{return Object.fromEntries(Object.keys(initialDatabase()).map(k=>[k,[]]));}
function add(db:Database,key:string,r:Row){return saveRecord(db,key,r,'Administrator');}
function scenario(){
 let db=empty();
 db=add(db,'inventory',{id:'v1',stock:'DM-TEST',vin:'1HGCM82633A004352',year:'2022',make:'Honda',model:'Accord',purchase:'9000',asking:'14000',date:'2026-11-06',status:'Ready for sale'});
 db=add(db,'acquisitions',{id:'a1',vehicleId:'v1',date:'2026-11-06',category:'Auction fees',amount:'700'});
 db=add(db,'transportation',{id:'t1',vehicleId:'v1',pickup:'Auction',delivery:'Dealership',date:'2026-11-06',amount:'300',status:'Delivered'});
 // Receiving marks a vehicle Received; inspection releases it for sale.
 db=add(db,'inventory',{...db.inventory[0],status:'Ready for sale'});
 db=add(db,'repairs',{id:'r1',number:'RO-1',vehicleId:'v1',date:'2026-11-06',description:'Service',parts:'500',labor:'400',status:'Completed'});
 db=add(db,'customers',{id:'c1',name:'Test customer',phone:'555-0100',status:'Active'});
 return db;
}
describe('financial acceptance workflow',()=>{
 it('reconciles acquisition, repairs, partial mechanic payment, and sale',()=>{
  let db=scenario();
  expect(vehicleCost(db,'v1').acquisition.toFixed(2)).toBe('10000.00');
  expect(vehicleCost(db,'v1').total.toFixed(2)).toBe('10900.00');
  db=add(db,'payments',{id:'p1',number:'PAY-1',kind:'Repair payment',repairId:'r1',component:'Labor',date:'2026-11-06',amount:'250',method:'Cash'});
  expect(paid(db,'repairId','r1','Labor').toFixed(2)).toBe('250.00');
  expect(Number(db.repairs[0].labor)-paid(db,'repairId','r1','Labor').toNumber()).toBe(150);
  db=add(db,'sales',{id:'s1',number:'S-1',vehicleId:'v1',customerId:'c1',assigned:'Test salesperson',date:'2026-11-06',price:'13500',status:'Finalized',delivery:'Pending'});
  expect(finances(db).gross.toFixed(2)).toBe('2600.00');
  expect(finances(db).receivable.toFixed(2)).toBe('13500.00');
  expect(db.inventory[0].status).toBe('Sold');
  db=add(db,'payments',{id:'p2',number:'DEP-1',kind:'Customer receipt',saleId:'s1',date:'2026-11-06',amount:'1000',method:'Cash'});
  expect(finances(db).receivable.toFixed(2)).toBe('12500.00');
  expect(finances(db).revenue.toFixed(2)).toBe('13500.00');
  expect(finances(db).gross.toFixed(2)).toBe('2600.00');
  expect(()=>add(db,'sales',{...db.sales[0],id:'s2',number:'S-2'})).toThrow('already been sold');
  expect(()=>add(db,'payments',{...db.payments[0],id:'p3'})).toThrow('already exists');
 });
 it('caps labor payments at labor balance, not the entire repair amount',()=>{
  const db=scenario();
  expect(()=>add(db,'payments',{id:'p',number:'PAY',kind:'Repair payment',repairId:'r1',component:'Labor',date:'2026-11-06',amount:'401',method:'Cash'})).toThrow('exceeds');
 });
 it('retains financial history through reversals',()=>{
  let db=scenario();
  db=add(db,'payments',{id:'p1',number:'PAY-1',kind:'Repair payment',repairId:'r1',component:'Labor',date:'2026-11-06',amount:'250',method:'Cash'});
  expect(()=>reverseRecord(db,'repairs',db.repairs[0],'Administrator')).toThrow('payments first');
  db=reverseRecord(db,'payments',db.payments[0],'Administrator');
  expect(db.payments).toHaveLength(1); expect(db.payments[0].status).toBe('Reversed');
  db=reverseRecord(db,'repairs',db.repairs[0],'Administrator');
  expect(finances(db).repairPayable.toFixed(2)).toBe('0.00');
  expect(vehicleCost(db,'v1').total.toFixed(2)).toBe('10000.00');
 });
 it('uses exact decimal arithmetic',()=>{
  let db=scenario();db=add(db,'expenses',{id:'e1',description:'Tiny cost',date:'2026-11-06',category:'Office',amount:'0.10'});db=add(db,'expenses',{id:'e2',description:'Another',date:'2026-11-06',category:'Office',amount:'0.20'});expect(finances(db).expenses.toFixed(2)).toBe('0.30');
 });
 it('enforces the demo role rules in the state operation',()=>{
  expect(canAccess('Employee','profit')).toBe(false);expect(canAccess('Manager','users')).toBe(false);
  expect(()=>saveRecord(scenario(),'expenses',{id:'e'},'Employee')).toThrow('cannot modify');
 });
 it('rejects duplicate VINs, invalid money, and negative amounts',()=>{
  const db=scenario();expect(()=>add(db,'inventory',{...db.inventory[0],id:'v2',stock:'OTHER'})).toThrow('unique');
  expect(()=>add(db,'expenses',{id:'e',description:'Invalid',date:'2026-11-06',category:'Office',amount:'-1'})).toThrow();
  expect(()=>add(db,'expenses',{id:'e',description:'Invalid',date:'2026-11-06',category:'Office',amount:'0.001'})).toThrow();
 });
 it('protects sold vehicle costs until the sale is reversed',()=>{
  let db=scenario();db=add(db,'sales',{id:'s1',number:'S-1',vehicleId:'v1',customerId:'c1',assigned:'Test salesperson',date:'2026-11-06',price:'13500',status:'Finalized',delivery:'Pending'});
  expect(()=>add(db,'acquisitions',{id:'a2',vehicleId:'v1',date:'2026-11-06',category:'Other acquisition',amount:'100'})).toThrow('historical cost');
  expect(()=>reverseRecord(db,'repairs',db.repairs[0],'Administrator')).toThrow('historical cost');
  db=reverseRecord(db,'sales',db.sales[0],'Administrator');expect(finances(db).revenue.toFixed(2)).toBe('0.00');expect(finances(db).gross.toFixed(2)).toBe('0.00');expect(db.inventory[0].status).toBe('Ready for sale');expect(db.sales).toHaveLength(1);
 });
 it('starts the demo with unique VINs and stock numbers',()=>{
  const db=initialDatabase();expect(new Set(db.inventory.map(v=>v.vin)).size).toBe(db.inventory.length);expect(new Set(db.inventory.map(v=>v.stock)).size).toBe(db.inventory.length);
 });
});
