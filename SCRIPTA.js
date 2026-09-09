/* =====================================================================
   MALUXURY INVOICE / RECEIPT GENERATOR
   ---------------------------------------------------------------------
   1. CONFIG          - fill in your Supabase project details
   2. STATE           - business info + current document type
   3. HELPERS         - formatting, DOM shortcuts
   4. ITEMS           - add/remove/recalculate line items
   5. PREVIEW         - sync editor -> live preview
   6. DOC TYPE TOGGLE - Invoice <-> Receipt
   7. GENERATE / SAVE - build a record + persist it
   8. PDF EXPORT       - html2pdf on the preview node
   9. HISTORY PANEL   - list / load / delete saved documents
   10. INIT            - wire everything up on page load
   ===================================================================== */

/* =========================================
   1. CONFIG
   Replace these with your own Supabase project
   values (Project Settings -> API). Leaving them
   as-is is fine: the app still works fully using
   the browser's local storage instead of the cloud.
========================================= */
const SUPABASE_URL = "https://iyvtxfqhpvyzyoxtfrsp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fFGLXiC_uf-9mGOty3blTg_XQWCprxX";

let supabase = null;

if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_URL.startsWith("https") &&
    SUPABASE_ANON_KEY
) {
    supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
}

/* -----------------------------------------
   EmailJS config (for the "Email to Client" button)
   Get these from your EmailJS dashboard:
   Service ID  -> Email Services
   Template ID -> Email Templates
   Public Key  -> Account > General
   Leaving these blank is fine: the Email button
   will just show a setup reminder instead of sending.
------------------------------------------ */
const EMAILJS_PUBLIC_KEY = "";
const EMAILJS_SERVICE_ID = "";
const EMAILJS_TEMPLATE_ID = "";

const emailReady = Boolean(
    window.emailjs && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY
);

if (emailReady) {
    window.emailjs.init(EMAILJS_PUBLIC_KEY);
}



/* =========================================
   2. STATE
========================================= */
const BUSINESS = {
    name: "M.A Luxury Apartments",
    email: "maluxuryapartment@gmail.com",
    phone: "+234 816 129 8750",
    address: "11, Asenuga Street Opebi Ikeja, Lagos, Nigeria."
};

let currentDocType = "invoice"; // "invoice" | "receipt"

/* =========================================
   3. HELPERS
========================================= */
const $ = (id) => document.getElementById(id);
const val = (id) => ($(id) ? $(id).value.trim() : "");

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function nl2br(str) {
    return escapeHtml(str).replace(/\n/g, "<br>");
}

function formatCurrency(n) {
    const num = Number(n) || 0;
    return "₦" + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDatePretty(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso, days) {
    const d = iso ? new Date(iso + "T00:00:00") : new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function randomSuffix() {
    return Math.floor(1000 + Math.random() * 9000);
}

function generateDocNumber(type) {
    const prefix = type === "receipt" ? "RCT" : "INV";
    const stamp = todayISO().replace(/-/g, "");
    return `${prefix}-${stamp}-${randomSuffix()}`;
}

function flashButton(btn, text, revertText) {
    if (!btn) return;
    const original = revertText || btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
    }, 1400);
}

/* =========================================
   4. ITEMS (editor line items)
========================================= */
function createItemRow(item) {
    item = item || {};
    const tr = document.createElement("tr");
    tr.className = "item-row";
    tr.innerHTML = `
        <td data-label="Description">
            <input type="text" placeholder="Room name" class="item-desc" value="${escapeHtml(item.description || "")}">
        </td>
        <td data-label="Days">
            <input type="number" min="1" class="item-days" value="${item.days || 1}">
        </td>
        <td data-label="Unit Price">
            <input type="number" min="0" placeholder="0.00" class="item-price" value="${item.price != null ? item.price : ""}">
        </td>
        <td data-label="Amount" class="amount">₦0.00</td>
        <td>
            <button type="button" class="delete-btn">&times;</button>
        </td>
    `;
    return tr;
}

function getItemsFromDOM() {
    const rows = document.querySelectorAll("#itemsContainer .item-row");
    const items = [];
    rows.forEach((row) => {
        const desc = row.querySelector(".item-desc").value.trim();
        const days = Number(row.querySelector(".item-days").value) || 0;
        const price = Number(row.querySelector(".item-price").value) || 0;
        const amount = days * price;
        if (desc || price) {
            items.push({ description: desc, days, price, amount });
        }
    });
    return items;
}

function recalcRow(row) {
    const days = Number(row.querySelector(".item-days").value) || 0;
    const price = Number(row.querySelector(".item-price").value) || 0;
    row.querySelector(".amount").textContent = formatCurrency(days * price);
}

function computeTotals(items) {
    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    const discount = Number(val("discountInput")) || 0;
    const caution = Number(val("cautionInput")) || 0;
    const taxRate = Number(val("taxInput")) || 0;
    const taxable = Math.max(subtotal - discount, 0);
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax + caution;
    return { subtotal, caution, discount, taxRate, tax, total };
}

/* =========================================
   5. PREVIEW
========================================= */
function updatePreview() {
    const items = getItemsFromDOM();
    const totals = computeTotals(items);
    const isReceipt = currentDocType === "receipt";

    // Doc label / number / paid stamp
    $("previewDocLabel").textContent = isReceipt ? "RECEIPT" : "INVOICE";
    $("previewDocNumber").textContent = "#" + (val("invoiceNumber") || "—");
    $("previewPaidStamp").style.display = isReceipt ? "inline-block" : "none";

    // Dates
    $("previewIssuedLabel").textContent = isReceipt ? "DATE PAID" : "ISSUED";
    $("previewIssuedDate").textContent = formatDatePretty(val("invoiceDate"));
    $("previewDueLabel").textContent = isReceipt ? "PAYMENT METHOD" : "DUE DATE";
    $("previewDueDate").textContent = isReceipt
        ? (val("paymentMethod") || "—")
        : formatDatePretty(val("dueDate"));

    // Business / customer
    $("previewBusinessName").textContent = val("businessName") || BUSINESS.name;
    $("previewBusinessDetails").innerHTML =
        `${escapeHtml(val("businessEmail"))}<br>${escapeHtml(val("businessPhone"))}<br>${nl2br(val("businessAddress"))}`;

    $("previewCustomerName").textContent = val("customerName") || "Customer Name";
    $("previewCustomerDetails").innerHTML =
        `${escapeHtml(val("customerEmail"))}<br>${escapeHtml(val("customerPhone"))}<br>${nl2br(val("customerAddress"))}`;

    // Items
    const body = $("previewItemsBody");
    body.innerHTML = "";
    if (items.length === 0) {
        body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#999;">No items added</td></tr>`;
    } else {
        items.forEach((i) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(i.description || "—")}</td>
                <td>${i.days}</td>
                <td>${formatCurrency(i.price)}</td>
                <td>${formatCurrency(i.amount)}</td>
            `;
            body.appendChild(tr);
        });
    }

    // Summary
    $("previewSubtotal").textContent = formatCurrency(totals.subtotal);
     $("previewCaution").textContent = formatCurrency(totals.caution);
    $("previewDiscount").textContent = formatCurrency(totals.discount);
    $("previewTax").textContent = formatCurrency(totals.tax) + (totals.taxRate ? ` (${totals.taxRate}%)` : "");
    $("previewTotal").textContent = formatCurrency(totals.total);

    // Notes
    const notes = val("notes");
    $("previewNotesBlock").style.display = notes ? "block" : "none";
    $("previewNotes").innerHTML = nl2br(notes);

    // Payment section
    $("previewPaymentLabel").textContent = isReceipt ? "PAYMENT RECEIVED VIA" : "PAYMENT DETAILS";
    if (isReceipt) {
        $("previewPaymentDetails").innerHTML =
            `${escapeHtml(val("paymentMethod") || "—")}<br>${escapeHtml(val("bankName"))}<br>${escapeHtml(val("accountNumber"))}`;
    } else {
        $("previewPaymentDetails").innerHTML =
            `${escapeHtml(val("bankName") || "Bank Name")}<br>${escapeHtml(val("accountName") || BUSINESS.name)}<br>${escapeHtml(val("accountNumber") || "6569494092")}`;
    }

    return { items, totals };
}

/* =========================================
   6. DOC TYPE TOGGLE
========================================= */
function setDocType(type) {
    currentDocType = type;
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.doctype === type);
    });

    const isReceipt = type === "receipt";
    $("dueDateLabel").textContent = isReceipt ? "Date Paid" : "Due Date";
    $("paymentMethodGroup").style.display = isReceipt ? "block" : "none";
    $("generateBtn").textContent = isReceipt ? "Generate Receipt" : "Generate Invoice";

    // Clear the readonly generated number so it's regenerated for the new type
    $("invoiceNumber").value = "";
    updatePreview();
}

/* =========================================
   7. GENERATE / SAVE
========================================= */
function gatherRecord(items, totals) {
    return {
        doc_type: currentDocType,
        doc_number: val("invoiceNumber"),
        issue_date: val("invoiceDate") || null,
        due_date: val("dueDate") || null,
        business_name: val("businessName") || BUSINESS.name,
        business_email: val("businessEmail") || BUSINESS.email,
        business_phone: val("businessPhone") || BUSINESS.phone,
        business_address: val("businessAddress") || BUSINESS.address,
        customer_name: val("customerName"),
        customer_email: val("customerEmail"),
        customer_phone: val("customerPhone"),
        customer_address: val("customerAddress"),
        items,
        subtotal: totals.subtotal,
        caution: totals.caution,
        discount: totals.discount,
        tax_rate: totals.taxRate,
        tax: totals.tax,
        total: totals.total,
        notes: val("notes"),
        bank_name: val("bankName"),
        account_name: val("accountName"),
        account_number: val("accountNumber"),
        payment_method: val("paymentMethod")
    };
}

async function saveRecord(record) {
    if (supabase) {
        const { data, error } = await supabase.from("documents").insert([record]).select();
        if (error) {
            console.error(error);
            setHistoryStatus("Cloud save failed — saved locally instead.");
            saveLocal(record);
            return;
        }
        setHistoryStatus("Saved to database.");
        return data && data[0];
    }
    saveLocal(record);
    setHistoryStatus("Saved locally (connect Supabase to sync to the cloud — see README).");
}

function saveLocal(record) {
    const list = JSON.parse(localStorage.getItem("maluxury_history") || "[]");
    record = { ...record, id: "local-" + Date.now(), created_at: new Date().toISOString() };
    list.unshift(record);
    localStorage.setItem("maluxury_history", JSON.stringify(list.slice(0, 300)));
}

function handleGenerate() {
    if (!val("invoiceNumber")) {
        $("invoiceNumber").value = generateDocNumber(currentDocType);
    }
    if (!val("invoiceDate")) {
        $("invoiceDate").value = todayISO();
    }
    if (currentDocType === "invoice" && !val("dueDate")) {
        $("dueDate").value = addDaysISO(val("invoiceDate"), 7);
    }

    const { items, totals } = updatePreview();

    if (items.length === 0) {
        alert("Add at least one item before generating.");
        return;
    }

    const record = gatherRecord(items, totals);
    saveRecord(record).then(() => {
        if (document.getElementById("historyPanel").classList.contains("open")) {
            loadHistory();
        }
    });
}

/* =========================================
   8. PDF EXPORT
========================================= */
function downloadPDF() {
    updatePreview();
    const node = document.querySelector(".invoice-paper");
    const filename = `${(val("invoiceNumber") || generateDocNumber(currentDocType))}.pdf`;

    if (!window.html2pdf) {
        alert("PDF library failed to load — check your internet connection and try again.");
        return;
    }

    html2pdf()
        .set({
            margin: 0,
            filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
        })
        .from(node)
        .save();
}

/* =========================================
   8b. EMAIL TO CLIENT
   Sends the invoice/receipt details straight to
   the customer's inbox via EmailJS. The free
   EmailJS tier can't attach the actual PDF file,
   so the email body includes the full itemized
   breakdown instead — the customer still sees
   everything, they just don't get a file attachment.
========================================= */
function buildItemsPlainText(items) {
    return items
        .map((i) => `- ${i.description || "Item"} (x${i.days}): ${formatCurrency(i.amount)}`)
        .join("\n");
}

async function emailToClient() {
    const emailBtn = $("emailBtn");
    const toEmail = val("customerEmail");

    if (!toEmail) {
        alert("Add the customer's email address in the 'Bill To' section first.");
        return;
    }

    if (!emailReady) {
        alert("Email isn't set up yet. See the README's 'Email invoices to clients' section to connect EmailJS (takes about 5 minutes, free).");
        return;
    }

    const { items, totals } = updatePreview();
    if (items.length === 0) {
        alert("Add at least one item before emailing.");
        return;
    }
    if (!val("invoiceNumber")) {
        handleGenerate();
    }

    const isReceipt = currentDocType === "receipt";
    const params = {
        to_email: toEmail,
        to_name: val("customerName") || "Customer",
        from_name: val("businessName") || BUSINESS.name,
        doc_type: isReceipt ? "Receipt" : "Invoice",
        doc_number: val("invoiceNumber"),
        issue_date: formatDatePretty(val("invoiceDate")),
        due_date: isReceipt ? (val("paymentMethod") || "—") : formatDatePretty(val("dueDate")),
        items_list: buildItemsPlainText(items),
        subtotal: formatCurrency(totals.subtotal),
        caution: formatCurrency(totals.caution),
        discount: formatCurrency(totals.discount),
        tax: formatCurrency(totals.tax),
        total: formatCurrency(totals.total),
        notes: val("notes") || "—",
        bank_name: val("bankName") || "—",
        account_name: val("accountName") || "—",
        account_number: val("accountNumber") || "—"
    };

    flashButton(emailBtn, "Sending…", "Email to Client");

    try {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
        emailBtn.textContent = "Sent!";
        setTimeout(() => (emailBtn.textContent = "Email to Client"), 1800);
    } catch (err) {
        console.error(err);
        emailBtn.textContent = "Email to Client";
        alert("Couldn't send the email. Check your EmailJS Service/Template IDs in script.js and your connection.");
    }
}

/* =========================================
   9. HISTORY PANEL
========================================= */
function setHistoryStatus(msg) {
    const el = $("historyStatus");
    if (el) el.textContent = msg;
}

async function fetchHistory() {
    if (supabase) {
        const { data, error } = await supabase
            .from("documents")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
        if (!error) return data;
        console.error(error);
    }
    return JSON.parse(localStorage.getItem("maluxury_history") || "[]");
}

async function deleteRecord(record) {
    if (supabase && record.id && !String(record.id).startsWith("local-")) {
        await supabase.from("documents").delete().eq("id", record.id);
    } else {
        const list = JSON.parse(localStorage.getItem("maluxury_history") || "[]").filter((r) => r.id !== record.id);
        localStorage.setItem("maluxury_history", JSON.stringify(list));
    }
}

function renderHistoryList(records) {
    const container = $("historyList");
    container.innerHTML = "";

    if (!records || records.length === 0) {
        container.innerHTML = `<p style="color:#777;font-size:13px;">No saved documents yet. Generate an invoice or receipt to see it here.</p>`;
        return;
    }

    records.forEach((record) => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
            <div class="history-item-top">
                <strong>${escapeHtml(record.doc_number || "—")}</strong>
                <span class="history-item-tag">${escapeHtml(record.doc_type || "")}</span>
            </div>
            <p>${escapeHtml(record.customer_name || "No customer name")} &middot; ${formatCurrency(record.total)}</p>
            <div class="history-item-actions">
                <button type="button" data-action="load">Load</button>
                <button type="button" data-action="pdf">PDF</button>
                <button type="button" data-action="delete" class="danger">Delete</button>
            </div>
        `;
        div.querySelector('[data-action="load"]').addEventListener("click", () => loadRecordIntoForm(record));
        div.querySelector('[data-action="pdf"]').addEventListener("click", () => {
            loadRecordIntoForm(record);
            setTimeout(downloadPDF, 150);
        });
        div.querySelector('[data-action="delete"]').addEventListener("click", async () => {
            if (!confirm(`Delete ${record.doc_number}? This cannot be undone.`)) return;
            await deleteRecord(record);
            loadHistory();
        });
        container.appendChild(div);
    });
}

async function loadHistory() {
    setHistoryStatus("Loading…");
    const records = await fetchHistory();
    setHistoryStatus(supabase ? `${records.length} saved (cloud database)` : `${records.length} saved (this browser only — connect Supabase to sync)`);
    renderHistoryList(records);
}

function loadRecordIntoForm(record) {
    setDocType(record.doc_type === "receipt" ? "receipt" : "invoice");

    $("invoiceNumber").value = record.doc_number || "";
    $("invoiceDate").value = record.issue_date || "";
    $("dueDate").value = record.due_date || "";

    $("businessName").value = record.business_name || BUSINESS.name;
    $("businessEmail").value = record.business_email || BUSINESS.email;
    $("businessPhone").value = record.business_phone || BUSINESS.phone;
    $("businessAddress").value = record.business_address || BUSINESS.address;

    $("customerName").value = record.customer_name || "";
    $("customerEmail").value = record.customer_email || "";
    $("customerPhone").value = record.customer_phone || "";
    $("customerAddress").value = record.customer_address || "";

    const container = $("itemsContainer");
    container.innerHTML = "";
    const items = Array.isArray(record.items) ? record.items : (typeof record.items === "string" ? JSON.parse(record.items) : []);
    (items.length ? items : [{}]).forEach((item) => {
        const row = createItemRow(item);
        container.appendChild(row);
        recalcRow(row);
    });

    $("discountInput").value = record.discount || 0;
    $("taxInput").value = record.tax_rate || 0;
    $("notes").value = record.notes || "";
    $("bankName").value = record.bank_name || "";
    $("accountName").value = record.account_name || "";
    $("accountNumber").value = record.account_number || "";
    if ($("paymentMethod")) $("paymentMethod").value = record.payment_method || "Bank Transfer";

    updatePreview();
    closeHistory();
}

function openHistory() {
    $("historyPanel").classList.add("open");
    $("historyOverlay").classList.add("open");
    loadHistory();
}

function closeHistory() {
    $("historyPanel").classList.remove("open");
    $("historyOverlay").classList.remove("open");
}

/* =========================================
   10. INIT
========================================= */
function bindLiveInputs() {
    const ids = [
        "invoiceDate", "dueDate", "businessEmail", "customerName", "customerEmail",
        "customerPhone", "customerAddress", "notes", "bankName", "accountName",
        "accountNumber", "discountInput", "taxInput", "paymentMethod", "cautionInput"
    ];
    ids.forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener("input", updatePreview);
    });
}

function bindItemEvents() {
    const container = $("itemsContainer");

    container.addEventListener("input", (e) => {
        const row = e.target.closest(".item-row");
        if (!row) return;
        recalcRow(row);
        updatePreview();
    });

    container.addEventListener("click", (e) => {
        if (!e.target.classList.contains("delete-btn")) return;
        const row = e.target.closest(".item-row");
        const rows = container.querySelectorAll(".item-row");
        if (rows.length > 1) {
            row.remove();
        } else {
            row.querySelectorAll("input").forEach((input) => (input.value = input.type === "number" ? (input.classList.contains("item-days") ? 1 : "") : ""));
            recalcRow(row);
        }
        updatePreview();
    });

    $("addItemBtn").addEventListener("click", () => {
        const row = createItemRow();
        container.appendChild(row);
        recalcRow(row);
        row.querySelector(".item-desc").focus();
        updatePreview();
    });
}

function bindHeaderEvents() {
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
        btn.addEventListener("click", () => setDocType(btn.dataset.doctype));
    });

    $("generateBtn").addEventListener("click", handleGenerate);
    $("downloadPdfBtn").addEventListener("click", downloadPDF);
    $("emailBtn").addEventListener("click", emailToClient);

    $("saveDraftBtn").addEventListener("click", () => {
        const { items, totals } = updatePreview();
        const draft = gatherRecord(items, totals);
        localStorage.setItem("maluxury_draft", JSON.stringify(draft));
        flashButton($("saveDraftBtn"), "Saved!", "Save Draft");
    });

    $("historyBtn").addEventListener("click", openHistory);
    $("historyClose").addEventListener("click", closeHistory);
    $("historyOverlay").addEventListener("click", closeHistory);
}

function restoreDraftIfAny() {
    const raw = localStorage.getItem("maluxury_draft");
    if (!raw) return;
    try {
        const draft = JSON.parse(raw);
        if (draft && (draft.customer_name || (draft.items && draft.items.length))) {
            loadRecordIntoForm(draft);
        }
    } catch (e) {
        console.warn("Could not restore draft", e);
    }
}

function init() {
    // Business fields (kept editable but pre-filled)
    $("businessName").value = BUSINESS.name;
    $("businessEmail").value = BUSINESS.email;
    $("businessPhone").value = BUSINESS.phone;
    $("businessAddress").value = BUSINESS.address;

    $("invoiceDate").value = todayISO();
    $("dueDate").value = addDaysISO(todayISO(), 7);
    $("invoiceNumber").value = generateDocNumber(currentDocType);

    // Replace the static placeholder row with a properly-wired one
    const itemsContainer = $("itemsContainer");
    itemsContainer.innerHTML = "";
    const firstRow = createItemRow();
    itemsContainer.appendChild(firstRow);
    recalcRow(firstRow);

    bindLiveInputs();
    bindItemEvents();
    bindHeaderEvents();

    restoreDraftIfAny();
    updatePreview();

    if (!supabase) {
        console.info(
            "Supabase is not configured yet — the app is running in local-only mode.\n" +
            "See README.md to connect a free database so invoices/receipts sync across devices."
        );
    }
}

document.addEventListener("DOMContentLoaded", init);
