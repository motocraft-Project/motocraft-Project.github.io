# MOTOCRAFT progress

## Accepted scope changes

- The initial request was a production Drixon Motors dealership system (preserved verbatim in `PROJECT_BRIEF.txt`).
- The user then selected **Temporary demo only—no saved business records**.
- The user renamed the company to **MOTOCRAFT**, requested a spinning-tire logo with white smoke, and selected GitHub hosting.
- The user will create and share a repository after implementation. No repository URL has been supplied.

## Implemented demo

- [x] Next.js, React, TypeScript, Tailwind, Radix/shadcn-style button, Lucide icons.
- [x] Responsive navy sidebar, navigation groups, mobile menu, profile menu, role preview, themes, empty states and toasts.
- [x] Original animated vector tire/smoke logo, standalone SVG, favicon, PDF header branding.
- [x] Memory-only fictional sample records and reset behavior.
- [x] Dashboard with calculated totals, monthly revenue/profit chart, inventory chart, recent vehicles, workshop activity and audit activity.
- [x] Inventory, acquisitions, auctions, transportation, repairs, parts, customers, leads, sales, invoices, payments, expenses, mechanics, vendors, documents, and demo-user forms/pages.
- [x] Record detail dialogs; vehicle tabs; read-only posted financial records; auditable reversal controls.
- [x] Decimal-safe acquisition, repair, sale, profit, receivable and repair/expense payable calculations.
- [x] Unique VIN/stock/reference validation, duplicate-sale prevention, payment allocation limits and sold-vehicle cost protection.
- [x] Derived payables, receivables, vehicle profitability, and reports pages.
- [x] CSV, Excel and PDF downloads, branded invoice amounts and transaction details.
- [x] Search, global search, status/date filtering, TanStack sorting and pagination.
- [x] Notifications/read status, session activity log, company settings.
- [x] GitHub Pages static export and deployment workflow, repository subpath configuration, setup documentation.

## Verification

- [x] Final TypeScript check and static production build passed with MOTOCRAFT branding.
- [x] Eight financial/domain test cases passed after final branding changes.
- [x] Browser navigation through all modules, role preview and mobile overflow passed.
- [x] Browser-verified PDF, CSV and Excel file downloads passed.
- [x] Vehicle form, duplicate-VIN rejection, search, details and reload-reset browser test passed.
- [x] All three browser tests passed for both root hosting and a simulated GitHub Pages repository subpath.
- [ ] GitHub deployment: waiting for repository URL and authenticated write access.

## Original production requirements

Database migrations, cloud storage, real authentication, organization isolation, secure multi-user operations, backend permissions, persistent audit history, production ledger, backup/recovery, live integrations and production security acceptance tests remain outside the revised demo scope. They have not been implemented or claimed complete. Expanding back to the original request requires a persistent backend.
