import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Row } from './demo';
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const safeCell=(v:string)=>/^[=+@\-\t\r]/.test(v)?`'${v}`:v;
export async function exportRows(format:'csv'|'xlsx'|'pdf',title:string,rows:Row[],company='MOTOCRAFT',details='') {
 if(!rows.length) throw Error('There are no records to export.');
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 if(format==='csv'){const q=(s:string)=>`"${safeCell(s).replaceAll('"','""')}"`;download(new Blob(['\uFEFF'+[keys.map(q).join(','),...rows.map(r=>keys.map(k=>q(r[k]||'')).join(','))].join('\r\n')],{type:'text/csv;charset=utf-8'}),`${title}.csv`);}
 if(format==='xlsx'){const ExcelJS=await import('exceljs');const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet(title.slice(0,31).replace(/[\\/?*\[\]:]/g,''));sheet.columns=keys.map(k=>({header:k,key:k,width:24}));rows.forEach(r=>sheet.addRow(r));sheet.getRow(1).font={bold:true};const buffer=await workbook.xlsx.writeBuffer();download(new Blob([new Uint8Array(buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`${title}.xlsx`);}
 if(format==='pdf'){
  const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);let page=doc.addPage([595,842]);let y=795;
  page.drawRectangle({x:490,y:766,width:64,height:61,color:rgb(.063,.11,.19)});
  page.drawCircle({x:508,y:785,size:8,color:rgb(1,1,1),opacity:.8});page.drawCircle({x:501,y:795,size:6,color:rgb(1,1,1),opacity:.4});
  page.drawCircle({x:528,y:799,size:21,color:rgb(.13,.18,.25),borderColor:rgb(.55,.63,.75),borderWidth:1});page.drawCircle({x:528,y:799,size:13,color:rgb(.08,.13,.21),borderColor:rgb(.8,.89,1),borderWidth:2});
  for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;page.drawLine({start:{x:528,y:799},end:{x:528+12*Math.cos(angle),y:799+12*Math.sin(angle)},thickness:2.5,color:rgb(.75,.85,1)});}page.drawCircle({x:528,y:799,size:4,color:rgb(.24,.5,.9)});
  const clean=(s:string)=>s.replace(/[^\x20-\x7E]/g,' ');
  const line=(s:string,size=10,strong=false)=>{if(y<55){page=doc.addPage([595,842]);y=790;}page.drawText(clean(s).slice(0,105),{x:42,y,size,font:strong?bold:font,color:rgb(.12,.17,.25)});y-=size+9;};
  line(company.toUpperCase(),20,true);line(title,15,true);line('DEMONSTRATION DOCUMENT - Not a legal or accounting record',9);if(details)line(details,9);line(`Generated ${new Date().toLocaleDateString()} | ${rows.length} record(s)`,9);y-=10;
  rows.forEach((r,index)=>{line(`Record ${index+1}`,11,true);Object.entries(r).filter(([k,v])=>k!=='id'&&v).forEach(([k,v])=>{const text=`${k}: ${v}`;for(let n=0;n<text.length;n+=95)line(text.slice(n,n+95));});y-=12;});
  line('Signature: _________________________   Date: ______________',10);
  download(new Blob([new Uint8Array(await doc.save())],{type:'application/pdf'}),`${title}.pdf`);
 }
}
