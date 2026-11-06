import { defineConfig } from '@playwright/test';
const baseURL=`http://127.0.0.1:3000${process.env.NEXT_PUBLIC_BASE_PATH||''}/`;
export default defineConfig({testDir:'./tests/e2e',fullyParallel:false,workers:1,retries:0,use:{baseURL,channel:process.env.PLAYWRIGHT_BROWSER==='chromium'?undefined:'msedge',headless:true,viewport:{width:1440,height:1100},screenshot:'only-on-failure'},webServer:{command:'node scripts/serve.mjs',url:baseURL,reuseExistingServer:true},reporter:'list'});
