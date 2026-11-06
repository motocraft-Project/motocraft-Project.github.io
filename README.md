# MOTOCRAFT — Dealer Management Demo

An interactive, responsive dealership workspace with an original animated tire and white-smoke logo.

**Scope chosen by the user:** temporary demo, with no database and no saved business records. All records are fictional samples held in React memory. Reloading the page restores the samples. Each browser tab has its own state. Role selection previews interface permissions; it does not authenticate a user or secure business records. This is not the production system described in the original `PROJECT_BRIEF.txt`.

## Run locally

Requires Node.js 22 or later.

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. For the built static version:

```powershell
npm run build
npm start
```

No API keys, database, administrator password, or external accounts are needed to run locally.

## Explore the demo

- Dashboard: totals and charts calculated from session records; date range; inventory status breakdown; recent inventory; workshop and activity summaries.
- Operations: inventory profiles and tabs, acquisitions, auction fees, transport orders, repairs, parts, mechanics, and vendors.
- Business: customers, leads, sales, invoices, allocated payments, and document records.
- Finance: expenses, calculated receivables/payables, vehicle profitability, gross/net profit, reports, CSV/Excel/PDF downloads.
- Administration: demo users/roles, company settings, notifications with read status, and an activity trail.
- Interaction: responsive navigation, expandable sidebar groups, light/dark themes, search, status/date filters, sorting, pagination, validated modal forms, record details, and financial reversals.

To try a full flow: create a vehicle; post acquisition/transport/repair costs; change its inventory status to Ready for sale; create a customer; finalize a sale; create an invoice; record a customer receipt; inspect Profit & Loss. Deposit receipts are entered once as customer receipt payments.

Posted costs, payments, and finalized sales are immutable. Corrections use a reversal and a new record. Reverse allocated payments before their source transaction. A sold vehicle's costs cannot change until its sale is reversed. Duplicate VINs, stock/reference numbers, finalized vehicle sales, and overpayments are rejected.

The separate Parts screen records descriptions of parts already included in a repair's parts-cost total; it does not post additional costs. A batch payment must be split into separately referenced allocation records. Auction winning bids are the vehicle purchase price; the Auctions screen posts fees only. Transportation is entered separately to avoid double counting.

## GitHub Pages hosting

The Next.js app exports static files into `out/`. `.github/workflows/pages.yml` tests, builds, and deploys on pushes to `main`. It automatically uses the correct repository subpath, including user sites and custom-domain configuration returned by GitHub's Pages action.

1. Create an empty GitHub repository, for example `motocraft-demo`. Do not add an initial README if pushing this source with Git.
2. Upload the **contents of this project folder** to the repository root, including `.github/workflows/pages.yml`, `package.json`, and `package-lock.json`. Do not upload `node_modules`, `.next`, `.npm-cache`, or test results.
3. In the repository, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Push to `main`, or use **Actions → Test and deploy MOTOCRAFT to GitHub Pages → Run workflow** after enabling Pages.
5. The successful deployment provides the actual website URL. A URL cannot be verified before the repository is supplied and the workflow succeeds.

The source is ready for upload; no GitHub repository has been selected or pushed from this workspace. Local GitHub CLI authentication and repository access are not configured. Do not paste access tokens into chat; use GitHub sign-in or authorize the connector for the repository.

Reference: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports).

## Tests

```powershell
npm run build
npm run typecheck
npm test
npm run test:e2e
```

Browser tests use installed Microsoft Edge on Windows. On other systems, install Playwright Chromium (`npx playwright install chromium`) and set `PLAYWRIGHT_BROWSER=chromium` before running browser tests. The tests launch their own static server.

Financial tests cover $9,000 purchase + $700 auction fees + $300 transportation = $10,000 acquisition; $500 parts + $400 labor = $10,900 investment; a $250 labor payment leaves $150 labor payable; a $13,500 sale yields $2,600 gross profit. They also cover payment/deposit treatment, duplicate sales/references, overpayment, reversal history, precision, validation, and demo role checks.

Browser tests cover every navigation item, role preview, mobile overflow, creating/searching a vehicle, reload reset, and downloaded PDF/CSV/Excel file validity.

## Logo

`public/logo.svg` is the standalone animated logo. `src/components/brand.tsx` renders the app version. Both support reduced-motion preferences. The favicon and PDF header use static tire/smoke variants.

## Limits

- No persistence, real employee accounts, password reset/invitations, server authorization, multi-user synchronization, protected uploads, integrations, backups, or production accounting ledger.
- In-app roles are presentation and state-operation checks; all sample data remains in the client.
- Generic demo documents are generated locally. They are not jurisdiction-approved legal forms or real invoices.
- Vendor/acquisition settlement, trade-in asset accounting, tax remittance, multi-invoice batch payment orchestration, and a complete double-entry journal require the future backend implementation.
- No file upload or secure document storage is implemented. Document records store text and references during the session.
- Company timezone and terms are editable demonstration settings; comprehensive regional tax/document configuration is not implemented.

See `PROGRESS.md` for implementation and verification status.
