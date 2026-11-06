import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';

test('dashboard, every module, role preview, and mobile navigation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await expect(page.getByRole('heading',{name:'Let’s drive your business forward.'})).toBeVisible();
 await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true,animations:'disabled'});
 for(const name of ['Vehicle Inventory','Acquisitions','Auctions','Transportation','Repairs','Parts','Customers','Leads','Sales','Invoices','Payments','Expenses','Accounts Payable','Accounts Receivable','Profit & Loss','Reports','Mechanics','Vendors','Documents','Activity Logs','Users & Roles','Settings']){
  await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
  await expect(page.locator('main h1')).not.toBeEmpty();
 }
 await page.getByRole('button',{name:'Open profile menu'}).click();await page.getByRole('button',{name:'Employee',exact:true}).click();
 await expect(page.getByRole('navigation').getByRole('button',{name:'Profit & Loss',exact:true})).toHaveCount(0);
 await page.getByRole('navigation').getByRole('button',{name:'Dashboard',exact:true}).click();await expect(page.getByText('Restricted',{exact:true})).toHaveCount(2);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('navigation').getByRole('button',{name:'Vehicle Inventory',exact:true}).click();await expect(page.getByRole('heading',{name:'Vehicle Inventory',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/inventory-mobile.png',fullPage:true,animations:'disabled'});
 expect(errors).toEqual([]);
});

test('inventory form saves, search works, and reload resets the temporary session',async({page})=>{
 await page.goto('./');await page.getByRole('navigation').getByRole('button',{name:'Vehicle Inventory',exact:true}).click();await page.getByRole('button',{name:'Add vehicle',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Stock number').fill('DM-TEST');await dialog.getByLabel('VIN',{exact:true}).fill('1HGCM82633A004352');await dialog.getByLabel('Year',{exact:true}).fill('2022');await dialog.getByLabel('Make',{exact:true}).fill('Test Make');await dialog.getByLabel('Model',{exact:true}).fill('Test Model');await dialog.getByLabel('Purchase price').fill('9000');await dialog.getByLabel('Asking price').fill('13500');await dialog.getByLabel('Status',{exact:true}).selectOption('Ready for sale');
 // Sample v1 uses this VIN, so duplicate entry must be rejected.
 await dialog.getByRole('button',{name:'Create record'}).click();await expect(page.getByText('Stock number and VIN must be unique.')).toBeVisible();
 await dialog.getByLabel('VIN',{exact:true}).fill('1HGCM82633A004359');await dialog.getByRole('button',{name:'Create record'}).click();await expect(dialog).not.toBeVisible();
 await page.getByRole('textbox',{name:'Search Vehicle Inventory'}).fill('DM-TEST');await expect(page.getByRole('cell',{name:'DM-TEST',exact:true})).toBeVisible();
 await page.getByRole('cell',{name:'DM-TEST',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'2022 Test Make Test Model'})).toBeVisible();
 await page.reload();await page.getByRole('navigation').getByRole('button',{name:'Vehicle Inventory',exact:true}).click();await page.getByRole('textbox',{name:'Search Vehicle Inventory'}).fill('DM-TEST');await expect(page.getByText('No matching records')).toBeVisible();
});

test('PDF, CSV, and Excel exports are valid files',async({page},testInfo)=>{
 await page.goto('./');await page.getByRole('navigation').getByRole('button',{name:'Reports',exact:true}).click();
 for(const format of ['CSV','XLSX','PDF']){
  await page.getByRole('button',{name:'Export',exact:true}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:`Download ${format}`,exact:true}).click();const download=await event;const file=testInfo.outputPath(download.suggestedFilename());await download.saveAs(file);const bytes=await fs.readFile(file);
  if(format==='PDF'){const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThan(0);}
  if(format==='CSV')expect(bytes.toString('utf8')).toContain('DM-1024');
  if(format==='XLSX'){const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);expect(workbook.worksheets[0].rowCount).toBe(7);}
 }
});
