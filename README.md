# Maluxury Invoice & Receipt Generator

A single-page invoice/receipt generator with a live preview, PDF export, and
cloud-saved history — no backend server to run, no build step.

**Stack:** plain HTML/CSS/JS + [Supabase](https://supabase.com) (free Postgres
database) for storage + [html2pdf.js](https://github.com/eKoopmans/html2pdf.js)
for PDF export. Hosted as a static site (Netlify free tier).

Everything already works locally without any setup — line items, live totals,
Invoice/Receipt toggle, PDF download, and a "Save Draft" button. The only
thing you need to configure is the database, so history syncs across devices
instead of staying in one browser.

---

## 1. Run it locally right now

No install needed.

```
cd maluxury-invoice
python3 -m http.server 8080
```

Open `http://localhost:8080`. Everything works except cloud sync (it'll save
to your browser's local storage instead until you connect Supabase below).

---

## 2. Connect a free database (Supabase)

1. Go to [supabase.com](https://supabase.com) → sign up (free, no card
   required) → **New project**. Pick any name/region and a database
   password (you won't need the password again — the app doesn't use it).
2. Once the project finishes provisioning, open **SQL Editor** → **New
   query**, paste the contents of `supabase_schema.sql` (included in this
   folder), and click **Run**. This creates the `documents` table.
3. Go to **Project Settings → API**. Copy:
   - **Project URL**
   - **anon public** key
4. Open `script.js` in this folder and replace the top two lines:
   ```js
   const SUPABASE_URL = "YOUR_SUPABASE_URL";
   const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```
   with your real values.
5. Reload the page. Generate an invoice, click **History** — you should see
   it listed, and "Loading… → N saved (cloud database)" in the status line.

**Note on security:** the SQL script sets up open read/write access using
your public "anon" key, which is meant for a small internal tool (e.g. your
team generating invoices), not a public multi-tenant product. See
"Extend it further" below if you need per-user accounts.

---

## 3. Deploy it for free (Netlify)

1. Go to [app.netlify.com](https://app.netlify.com) → sign up free.
2. On the dashboard, find **"Add new site" → "Deploy manually"** (drag-and-drop).
3. Drag the whole `maluxury-invoice` folder (with your edited `script.js`,
   containing your real Supabase keys) onto the upload area.
4. Netlify gives you a live URL immediately (e.g.
   `https://maluxury-invoices.netlify.app`). That's it — no build command, no
   server.
5. Optional: in **Site settings → Domain management**, set a custom
   subdomain, or attach your own domain (Maluxury could use
   `invoices.maluxury.com` with a free Netlify SSL cert).

Every teammate you send that URL to can now generate invoices/receipts and
see the same shared history, since it all reads/writes the same Supabase
table.

*(Alternative to Netlify: GitHub Pages, Vercel, or Cloudflare Pages all work
the same way — this is a static site, so any static host is fine.)*

---

## 4. How to use it

- Toggle **Invoice / Receipt** at the top — labels, the due-date field, and
  the payment section all adapt (receipts show a "PAID" stamp and a payment
  method instead of a due date).
- Fill in the customer and item details — the preview on the right updates
  as you type.
- **Add Item** / the **×** button manage line items; Discount (₦) and Tax
  (%) feed into the totals automatically.
- **Generate Invoice/Receipt** assigns a document number, timestamps it, and
  saves a record (cloud if configured, local otherwise).
- **Download PDF** exports the live preview exactly as shown.
- **Save Draft** stores your in-progress form locally so you don't lose it
  on refresh (separate from the saved history).
- **History** opens a side panel of everything you've generated — **Load**
  brings it back into the editor, **PDF** re-downloads it, **Delete**
  removes it permanently.

---

## 5. What I'd extend first

Roughly in priority order:

1. **Per-user accounts (Supabase Auth).** Right now the `documents` table is
   open to anyone with the anon key. Add Supabase Auth (email/password or
   magic link), add a `user_id` column, and change the RLS policies to
   `using (auth.uid() = user_id)`. This is the main thing standing between
   "internal tool" and "safe to hand to individual customers directly."
2. **Sequential, gapless invoice numbers.** Current numbers are
   date+random (`INV-20260824-1320`) to avoid collisions without a backend.
   For accounting purposes you may want a real incrementing sequence — that
   needs a Postgres sequence or a Supabase Edge Function to assign numbers
   atomically.
3. **Email delivery.** Add a "Send to customer" button that emails the PDF
   directly (Supabase Edge Function + Resend/Postmark's free tier).
4. **Multi-currency support.** Right now amounts are hardcoded to ₦ (NGN).
   A currency selector that reformats `formatCurrency()` would make this
   reusable beyond Maluxury.
5. **Payment status tracking for invoices** (unpaid/partial/paid), so an
   invoice can later be "converted" into a receipt instead of creating one
   from scratch.
6. **Search/filter in the History panel** (by customer, date range, or
   doc type) once the list grows past a couple dozen records.

---

## File overview

```
index.html            Page structure (editor form + live preview)
Style.css              All styling (gold/black theme, responsive)
script.js               All app logic — read the numbered sections at the top
supabase_schema.sql     Database table + security policies
logo.png / sign.png     Your existing brand assets
```
