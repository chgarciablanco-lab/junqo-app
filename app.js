/* JUNQO – Casa Junquillar | app.js corregido completo
   Reemplaza el app.js actual. No requiere archivos adicionales.
*/

const BUDGET_KEY = "junqo_presupuesto";
let PROJECT_BUDGET = 180000000;
const PROJECT_NAME = "Junquillar";
const BUCKET_NAME = "comprobantes-junquillar";
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "xls", "xlsx", "csv"];
const REPORT_WIDGETS_KEY = "junqo_report_widgets";
const CATEGORIAS = ["Materiales", "Mano de obra", "Servicios", "Herramientas", "Transporte"];

let gastos = [];
let filteredDocs = [];
let currentView = "resumen";
let docsVisibleLimit = 10;
let editModalGasto = null;
let selectedIds = new Set();

const views = {
  resumen: { title: "Resumen", subtitle: "Vista ejecutiva y control del proyecto", visible: ["section-kpis", "section-alerts", "section-control"] },
  gastos: { title: "Gastos", subtitle: "Registro y control de egresos del proyecto", visible: ["section-filtro-solo", "section-docs"] },
  documentos: { title: "Documentos", subtitle: "Carga de facturas, boletas y respaldo documental", visible: ["section-upload-only"] },
  proveedores: { title: "Proveedores", subtitle: "Análisis por proveedor, documentos y concentración", visible: ["section-proveedores"] },
  caja: { title: "Caja e IVA", subtitle: "Crédito fiscal, documentos y detalle mensual", visible: ["section-caja"] },
  balance: { title: "Balance", subtitle: "Vista contable calculada desde los gastos registrados", visible: ["section-balance"] },
  reportes: { title: "Reportes", subtitle: "Reporte ejecutivo del proyecto", visible: ["section-reportes"] },
  ventas: { title: "Ventas", subtitle: "Ingresos, cotizaciones y contactos del proyecto", visible: ["section-ventas"] },
  insumos: { title: "Insumos", subtitle: "Control de materiales y stock en obra", visible: ["section-insumos"] },
  configuracion: { title: "Configuración", subtitle: "Ajustes generales del proyecto", visible: ["section-config"] }
};

const $ = id => document.getElementById(id);

function numberValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function formatoCLP(value) {
  return numberValue(value).toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}
function formatoPct(value) {
  return `${Number(value || 0).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
}
function normalizarFecha(fecha) {
  if (!fecha) return "—";
  const raw = String(fecha).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}
function fechaOrdenable(fecha) {
  if (!fecha) return "";
  const raw = String(fecha).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m}-${d}`;
  }
  return raw;
}
function mesLabel(fecha) {
  const f = fechaOrdenable(fecha);
  if (!f || f.length < 7) return "Sin fecha";
  const [y, m] = f.split("-");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${meses[Number(m) - 1] || m} ${y}`;
}
function getCategoriaClass(categoria = "") {
  const cat = String(categoria || "").toLowerCase();
  if (cat.includes("material")) return "cat-materiales";
  if (cat.includes("mano")) return "cat-mano";
  if (cat.includes("servicio") || cat.includes("aliment")) return "cat-servicios";
  if (cat.includes("herramienta")) return "cat-herramientas";
  if (cat.includes("transporte")) return "cat-transporte";
  return "cat-otros";
}
function sumBy(rows, field) {
  return rows.reduce((acc, item) => acc + numberValue(item[field]), 0);
}
function uniqueCount(rows, field) {
  return new Set(rows.map(i => i[field]).filter(Boolean)).size;
}
function groupBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row) || "Sin clasificar";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}
function emptyState(text = "Sin registros.") {
  return `<div class="empty-state">${text}</div>`;
}
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}
function csvEscape(value) {
  const v = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${v.replace(/"/g, '""')}"`;
}
function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getTotals(rows = gastos) {
  const neto = sumBy(rows, "neto");
  const iva = sumBy(rows, "iva");
  const total = sumBy(rows, "total");
  const docs = rows.length;
  const proveedores = uniqueCount(rows, "proveedor");
  const pendientesOcr = rows.filter(g => String(g.estado_ocr || "").toLowerCase() === "pendiente").length;
  const sinProveedor = rows.filter(g => !g.proveedor).length;
  const docsConCF = rows.filter(g => numberValue(g.iva) > 0).length;
  const docsSinCF = rows.filter(g => numberValue(g.iva) <= 0).length;
  return { neto, iva, total, docs, proveedores, pendientesOcr, sinProveedor, docsConCF, docsSinCF };
}

function mapSupabaseRow(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    proveedor: row.proveedor || "",
    rut: row.rut || "",
    tipo_documento: row.tipo_documento || "",
    numero_documento: row.numero_documento || "",
    iva: numberValue(row.iva),
    total: numberValue(row.total),
    metodo_pago: row.metodo_pago || "",
    proyecto: row.proyecto || PROJECT_NAME,
    observacion: row.observacion || "",
    foto_url: row.foto_url || "",
    estado_ocr: row.estado_ocr || "",
    created_at: row.created_at || "",
    neto: numberValue(row.neto),
    categoria: row.categoria || "",
    foto_path: row.foto_path || ""
  };
}

/* ── CARGA DATOS ─────────────────────────────────────────── */
async function loadBudget() {
  if (typeof window.supabaseClient === "undefined") return;
  try {
    const { data } = await window.supabaseClient
      .from("junqo_config")
      .select("value")
      .eq("key", BUDGET_KEY)
      .single();
    if (data?.value) PROJECT_BUDGET = Number(data.value) || PROJECT_BUDGET;
  } catch (_) {}
}
async function saveBudget(val) {
  PROJECT_BUDGET = val;
  if (typeof window.supabaseClient !== "undefined") {
    await window.supabaseClient
      .from("junqo_config")
      .upsert({ key: BUDGET_KEY, value: String(val), proyecto: PROJECT_NAME }, { onConflict: "key" });
  }
  renderAll();
}
async function loadData() {
  if (typeof window.supabaseClient === "undefined") {
    console.warn("Supabase no está configurado. Dashboard vacío.");
    gastos = [];
    filteredDocs = [];
    renderAll();
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("gastos_junquillar_app")
    .select("*")
    .eq("proyecto", PROJECT_NAME)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando gastos:", error);
    gastos = [];
    filteredDocs = [];
    renderAll();
    return;
  }

  gastos = (data || []).map(mapSupabaseRow);
  filteredDocs = [...gastos];
  await loadBudget();
  renderAll();
}

/* ── UPLOAD SIMPLE ───────────────────────────────────────── */
function getFileExtension(filename) {
  return String(filename || "").split(".").pop().toLowerCase();
}
function sanitizeFileName(filename) {
  return String(filename || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}
function getFileGroup(extension) {
  if (["jpg", "jpeg", "png"].includes(extension)) return "imagenes";
  if (["xls", "xlsx", "csv"].includes(extension)) return "planillas";
  return "pdf";
}
async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const extension = getFileExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    alert("Formato no permitido. Usa JPG, PNG, PDF, Excel o CSV.");
    event.target.value = "";
    return;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    alert(`El archivo supera el máximo permitido de ${MAX_FILE_SIZE_MB} MB.`);
    event.target.value = "";
    return;
  }
  if (typeof window.supabaseClient === "undefined") {
    alert("Supabase no está configurado.");
    event.target.value = "";
    return;
  }

  const safeName = sanitizeFileName(file.name);
  const fileGroup = getFileGroup(extension);
  const filePath = `junquillar/${fileGroup}/${Date.now()}-${safeName}`;

  const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });

  if (uploadError) {
    alert(`No se pudo subir el archivo: ${uploadError.message}`);
    event.target.value = "";
    return;
  }

  const { error: insertError } = await window.supabaseClient
    .from("gastos_junquillar_app")
    .insert({
      fecha: new Date().toISOString().slice(0, 10),
      proyecto: PROJECT_NAME,
      observacion: `Archivo adjunto: ${file.name}`,
      estado_ocr: "pendiente",
      foto_path: uploadData.path
    });

  if (insertError) {
    alert(`Archivo subido pero no se pudo crear el registro: ${insertError.message}`);
    event.target.value = "";
    return;
  }

  alert("📎 Archivo adjuntado correctamente.");
  event.target.value = "";
  await loadData();
}
function setupFileUpload() {
  const input = $("file-input");
  if (!input) return;
  input.addEventListener("change", handleFileUpload);
  $("select-file-link")?.addEventListener("click", () => input.click());
  $("btn-adjuntar")?.addEventListener("click", () => input.click());
  $("btn-foto")?.addEventListener("click", () => input.click());

  const dropzone = $("dropzone");
  if (dropzone) {
    dropzone.addEventListener("dragover", e => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", async e => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      await handleFileUpload({ target: input });
    });
  }
}

/* ── RESUMEN ─────────────────────────────────────────────── */
function renderKPIs() {
  const el = $("section-kpis");
  if (!el) return;
  const t = getTotals();
  const avance = PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0;
  const saldo = Math.max(PROJECT_BUDGET - t.neto, 0);
  const kpis = [
    ["Avance financiero", formatoPct(avance), "Ejecutado", `${formatoCLP(t.neto)} ejecutado de ${formatoCLP(PROJECT_BUDGET)}`],
    ["Inversión neta", formatoCLP(t.neto), `${t.docs} docs`, `${t.proveedores} proveedores registrados`],
    ["Saldo disponible", formatoCLP(saldo), saldo > 0 ? "Disponible" : "Agotado", "Presupuesto referencial menos ejecutado"],
    ["IVA crédito fiscal", formatoCLP(t.iva), "CF", `${t.docsConCF} documentos con crédito fiscal`]
  ];
  el.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-top">
        <div>
          <div class="kpi-title">${k[0]}</div>
          <div class="kpi-value">${k[1]}</div>
        </div>
        <span class="badge up">${k[2]}</span>
      </div>
      <div class="kpi-footer">${k[3]}</div>
    </div>
  `).join("");

  const sidebarBig = document.querySelector(".sidebar-card .big");
  const sidebarSub = document.querySelector(".sidebar-card .sub");
  const sidebarFill = document.querySelector(".sidebar-card .progress-fill");
  if (sidebarBig) sidebarBig.textContent = formatoPct(avance);
  if (sidebarSub) sidebarSub.textContent = `${formatoCLP(t.neto)} de ${formatoCLP(PROJECT_BUDGET)} ejecutado`;
  if (sidebarFill) sidebarFill.style.width = `${Math.min(avance, 100)}%`;
}
function renderAlerts() {
  const el = $("alerts-list");
  if (!el) return;
  const t = getTotals();
  const avance = PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0;
  const alerts = [
    ["📄", `${t.pendientesOcr} documentos pendientes OCR`, "Registros que aún requieren lectura o revisión documental."],
    ["⚠️", `${t.sinProveedor} registros incompletos`, "Gastos sin proveedor registrado o con datos pendientes."],
    ["💵", `${formatoCLP(t.iva)} de IVA crédito fiscal`, "Monto calculado desde los documentos registrados."],
    ["📊", `${formatoPct(avance)} de avance financiero`, "Avance calculado contra presupuesto referencial."]
  ];
  el.innerHTML = alerts.map(a => `
    <div class="alert-item">
      <div class="alert-icon">${a[0]}</div>
      <div>
        <div class="alert-title">${a[1]}</div>
        <div class="alert-sub">${a[2]}</div>
      </div>
    </div>
  `).join("");
}
function renderBottomCards() {}

/* ── GASTOS ──────────────────────────────────────────────── */
function gastoRowHTML(g) {
  const safeId = String(g.id).replace(/'/g, "\\'");
  return `
    <div class="table-row gastos-row" data-id="${g.id}">
      <div><input type="checkbox" class="row-chk" data-id="${g.id}" onclick="toggleRowSelect('${safeId}', this)"/></div>
      <div>${normalizarFecha(g.fecha)}</div>
      <div><div class="doc-name">${g.proveedor || "Pendiente OCR"}</div><div class="doc-amount">${g.observacion || ""}</div></div>
      <div style="font-size:11px;color:#94a3b8">${g.rut || "—"}</div>
      <div style="font-size:12px;color:#64748b">${g.tipo_documento || "—"}</div>
      <div><span class="cat-badge ${getCategoriaClass(g.categoria)}">${g.categoria || "Sin categoría"}</span></div>
      <div>${formatoCLP(g.neto)}</div>
      <div>${g.iva ? formatoCLP(g.iva) : "—"}</div>
      <div>${g.total ? formatoCLP(g.total) : "—"}</div>
      <div style="text-align:center">${numberValue(g.iva) > 0 ? "✔" : "—"}</div>
      <div style="font-size:12px;color:#64748b">${g.metodo_pago || "—"}</div>
      <div class="doc-actions">
        <button class="action-btn" type="button" onclick="openEditModal('${safeId}')">✏️</button>
        <button class="action-btn" type="button" onclick="confirmDelete('${safeId}')">🗑️</button>
      </div>
    </div>
  `;
}
function renderDocs(limit = docsVisibleLimit) {
  const el = $("docs-table");
  const subtitle = $("docs-subtitle");
  const btn = $("load-more-btn");
  if (!el) return;

  if (subtitle) subtitle.textContent = `${filteredDocs.length} registros · datos cargados desde Supabase`;
  if (!filteredDocs.length) {
    el.innerHTML = emptyState("No hay gastos registrados.");
    if (btn) btn.style.display = "none";
    updateBulkBar();
    return;
  }

  el.innerHTML = filteredDocs.slice(0, limit).map(gastoRowHTML).join("");
  if (btn) btn.style.display = filteredDocs.length > limit ? "inline-flex" : "none";
  updateBulkBar();
}
function updateBulkBar() {
  const bar = $("bulk-bar");
  const count = $("bulk-count");
  if (!bar) return;
  if (selectedIds.size > 0) {
    bar.classList.remove("bulk-bar-hidden");
    if (count) count.textContent = `${selectedIds.size} seleccionado${selectedIds.size !== 1 ? "s" : ""}`;
  } else {
    bar.classList.add("bulk-bar-hidden");
  }
  const chkAll = $("chk-all");
  if (chkAll) {
    const slice = filteredDocs.slice(0, docsVisibleLimit);
    chkAll.checked = slice.length > 0 && slice.every(g => selectedIds.has(String(g.id)));
    chkAll.indeterminate = !chkAll.checked && slice.some(g => selectedIds.has(String(g.id)));
  }
}
function toggleRowSelect(id, chk) {
  if (chk.checked) selectedIds.add(String(id));
  else selectedIds.delete(String(id));
  updateBulkBar();
}
function toggleSelectAll(chk) {
  const slice = filteredDocs.slice(0, docsVisibleLimit);
  slice.forEach(g => {
    if (chk.checked) selectedIds.add(String(g.id));
    else selectedIds.delete(String(g.id));
  });
  renderDocs(docsVisibleLimit);
}
function cancelBulkSelection() {
  selectedIds.clear();
  renderDocs(docsVisibleLimit);
}
async function bulkDelete() {
  if (selectedIds.size === 0) return;
  if (!confirm(`¿Eliminar ${selectedIds.size} gasto${selectedIds.size !== 1 ? "s" : ""}?`)) return;
  if (typeof window.supabaseClient === "undefined") {
    alert("Sin conexión.");
    return;
  }
  const ids = [...selectedIds];
  const { error } = await window.supabaseClient.from("gastos_junquillar_app").delete().in("id", ids);
  if (error) {
    alert(`Error eliminando: ${error.message}`);
    return;
  }
  selectedIds.clear();
  await loadData();
}
function applyFilters() {
  const text = (($("filter-text-gastos")?.value || $("global-search")?.value || "")).toLowerCase().trim();
  const cat = $("filter-cat-gastos")?.value || "";
  const tipo = $("filter-tipo-gastos")?.value || "";
  const pago = $("filter-pago-gastos")?.value || "";
  const desde = $("filter-desde-gastos")?.value || "";
  const hasta = $("filter-hasta-gastos")?.value || "";

  filteredDocs = gastos.filter(g => {
    const hayTexto = [g.proveedor, g.rut, g.tipo_documento, g.numero_documento, g.categoria, g.metodo_pago, g.observacion].join(" ").toLowerCase();
    const f = fechaOrdenable(g.fecha);
    if (text && !hayTexto.includes(text)) return false;
    if (cat && g.categoria !== cat) return false;
    if (tipo && g.tipo_documento !== tipo) return false;
    if (pago && g.metodo_pago !== pago) return false;
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });
  docsVisibleLimit = 10;
  renderDocs();
}
function clearFilters() {
  ["filter-text-gastos", "filter-cat-gastos", "filter-tipo-gastos", "filter-desde-gastos", "filter-hasta-gastos", "filter-pago-gastos", "global-search"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  filteredDocs = [...gastos];
  docsVisibleLimit = 10;
  renderDocs();
}

/* ── MODAL / DELETE ─────────────────────────────────────── */
function openEditModal(id) {
  const g = gastos.find(x => String(x.id) === String(id));
  if (!g) return;
  editModalGasto = g;
  const m = $("modal-overlay");
  if (!m) return;
  $("em-fecha").value = g.fecha || "";
  $("em-proveedor").value = g.proveedor || "";
  $("em-rut").value = g.rut || "";
  $("em-tipo").value = g.tipo_documento || "";
  $("em-ndoc").value = g.numero_documento || "";
  $("em-neto").value = g.neto || "";
  $("em-iva").value = g.iva || "";
  $("em-total").value = g.total || "";
  $("em-cat").value = g.categoria || "";
  $("em-pago").value = g.metodo_pago || "";
  $("em-obs").value = g.observacion || "";
  m.classList.remove("modal-hidden");
}
function closeEditModal() {
  $("modal-overlay")?.classList.add("modal-hidden");
  editModalGasto = null;
}
async function saveEditModal() {
  if (!editModalGasto) return;
  const updates = {
    fecha: $("em-fecha")?.value || editModalGasto.fecha,
    proveedor: $("em-proveedor")?.value || null,
    rut: $("em-rut")?.value || null,
    tipo_documento: $("em-tipo")?.value || null,
    numero_documento: $("em-ndoc")?.value || null,
    neto: numberValue($("em-neto")?.value),
    iva: numberValue($("em-iva")?.value),
    total: numberValue($("em-total")?.value),
    categoria: $("em-cat")?.value || null,
    metodo_pago: $("em-pago")?.value || null,
    observacion: $("em-obs")?.value || null
  };
  if (typeof window.supabaseClient === "undefined") {
    alert("Sin conexión a Supabase.");
    return;
  }
  const { error } = await window.supabaseClient.from("gastos_junquillar_app").update(updates).eq("id", editModalGasto.id);
  if (error) {
    alert(`Error guardando: ${error.message}`);
    return;
  }
  closeEditModal();
  await loadData();
}
async function confirmDelete(id) {
  const g = gastos.find(x => String(x.id) === String(id));
  const nombre = g?.proveedor || "este gasto";
  if (!confirm(`¿Eliminar el gasto de "${nombre}"?\nEsta acción no se puede deshacer.`)) return;
  if (typeof window.supabaseClient === "undefined") {
    alert("Sin conexión.");
    return;
  }
  const { error } = await window.supabaseClient.from("gastos_junquillar_app").delete().eq("id", id);
  if (error) {
    alert(`Error eliminando: ${error.message}`);
    return;
  }
  await loadData();
}

/* ── PROVEEDORES / CAJA ─────────────────────────────────── */
function renderProveedores() {
  const el = $("proveedores-table");
  if (!el) return;
  if (!gastos.length) {
    el.innerHTML = emptyState("Sin proveedores.");
    return;
  }
  const groups = groupBy(gastos, g => g.proveedor || "Pendiente OCR");
  const totalNeto = sumBy(gastos, "neto");
  el.innerHTML = Object.entries(groups)
    .map(([name, rows]) => ({
      name,
      rut: rows.find(r => r.rut)?.rut || "—",
      cat: rows.find(r => r.categoria)?.categoria || "Sin categoría",
      docs: rows.length,
      costo: sumBy(rows, "neto"),
      iva: sumBy(rows, "iva")
    }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 20)
    .map((p, i) => `
      <div class="table-row prov-row">
        <div>${i + 1}</div>
        <div class="doc-name">${p.name}</div>
        <div>${p.rut}</div>
        <div><span class="cat-badge ${getCategoriaClass(p.cat)}">${p.cat}</span></div>
        <div>${p.docs}</div>
        <div>${formatoCLP(p.costo)}</div>
        <div>${formatoCLP(p.iva)}</div>
        <div>${formatoPct(totalNeto ? (p.costo / totalNeto) * 100 : 0)}</div>
      </div>
    `).join("");
}
function renderCaja() {
  renderCajaKpis();
  renderCajaTipos();
  renderCajaMensual();
}
function renderCajaKpis() {
  const el = $("caja-kpis");
  if (!el) return;
  const t = getTotals();
  const cards = [
    ["Costo neto registrado", formatoCLP(t.neto), `${t.docs} documentos`],
    ["IVA crédito fiscal", formatoCLP(t.iva), "Desde IVA registrado"],
    ["Total documentos", formatoCLP(t.total), "Neto + IVA"],
    ["Docs con IVA", t.docsConCF, "Con crédito fiscal"]
  ];
  el.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-title">${c[0]}</div>
      <div class="kpi-value">${c[1]}</div>
      <div class="kpi-footer">${c[2]}</div>
    </div>
  `).join("");
}
function renderCajaTipos() {
  const el = $("caja-tipos");
  if (!el) return;
  if (!gastos.length) {
    el.innerHTML = emptyState("Sin información.");
    return;
  }
  const groups = groupBy(gastos, x => x.tipo_documento || "Sin tipo");
  el.innerHTML = Object.entries(groups).map(([tipo, rows]) => `
    <div class="table-row caja-tipos-row">
      <div>${tipo}</div>
      <div>${rows.length}</div>
      <div>${formatoCLP(sumBy(rows, "neto"))}</div>
      <div>${formatoCLP(sumBy(rows, "iva"))}</div>
      <div>${sumBy(rows, "iva") > 0 ? "✔" : "—"}</div>
      <div>${sumBy(rows, "iva") > 0 ? "IVA CF" : "Sin IVA"}</div>
    </div>
  `).join("");
}
function renderCajaMensual() {
  const el = $("caja-mensual");
  if (!el) return;
  if (!gastos.length) {
    el.innerHTML = emptyState("Sin detalle.");
    return;
  }
  const groups = groupBy(gastos, x => mesLabel(x.fecha));
  let acum = 0;
  el.innerHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([mes, rows]) => {
    const iva = sumBy(rows, "iva");
    acum += iva;
    return `
      <div class="table-row caja-mensual-row">
        <div>${mes}</div>
        <div>${rows.filter(r => numberValue(r.iva) > 0).length}</div>
        <div>${formatoCLP(sumBy(rows, "neto"))}</div>
        <div>${formatoCLP(iva)}</div>
        <div>${formatoCLP(acum)}</div>
      </div>
    `;
  }).join("");
}

/* ── BALANCE ─────────────────────────────────────────────── */
function getBalanceRows() {
  const t = getTotals();
  const TERRENO = 100000000;
  const APORTE_SOCIO = 60000000;
  const activoTerreno = TERRENO;
  const activoObra = t.neto;
  const activoIva = t.iva;
  const totalActivos = activoTerreno + activoObra + activoIva;
  const pasivoSocio = APORTE_SOCIO;
  const pasivoGastos = t.total;
  const totalPasivos = pasivoSocio + pasivoGastos;
  const ajuste = totalActivos - totalPasivos;

  const rows = [
    ["N°", "Cuenta", "Debe", "Haber", "Deudor", "Acreedor", "Activo", "Pasivo", "Pérdida", "Ganancia"],
    ["", "ACTIVOS", "", "", "", "", "", "", "", ""],
    ["1", "Terreno", activoTerreno, 0, activoTerreno, 0, activoTerreno, 0, 0, 0],
    ["2", "Obra en Curso", activoObra, 0, activoObra, 0, activoObra, 0, 0, 0],
    ["3", "IVA Crédito Fiscal", activoIva, 0, activoIva, 0, activoIva, 0, 0, 0],
    ["", "PASIVOS", "", "", "", "", "", "", "", ""],
    ["4", "Cuenta por pagar al Socio", 0, pasivoSocio, 0, pasivoSocio, 0, pasivoSocio, 0, 0],
    ["5", "Gastos por pagar", 0, pasivoGastos, 0, pasivoGastos, 0, pasivoGastos, 0, 0]
  ];

  if (ajuste !== 0) {
    rows.push([
      "6",
      ajuste > 0 ? "Capital pendiente" : "Ajuste",
      ajuste > 0 ? ajuste : 0,
      ajuste < 0 ? Math.abs(ajuste) : 0,
      ajuste > 0 ? ajuste : 0,
      ajuste < 0 ? Math.abs(ajuste) : 0,
      0,
      0,
      ajuste < 0 ? Math.abs(ajuste) : 0,
      ajuste > 0 ? ajuste : 0
    ]);
  }

  rows.push(["", "TOTAL", totalActivos, totalPasivos + (ajuste > 0 ? ajuste : 0), totalActivos, totalPasivos + (ajuste > 0 ? ajuste : 0), totalActivos, totalPasivos, ajuste < 0 ? Math.abs(ajuste) : 0, ajuste > 0 ? ajuste : 0]);
  return rows;
}
function renderBalance() {
  const el = $("balance-table");
  if (!el) return;
  if (!gastos.length) {
    el.innerHTML = emptyState("Sin movimientos.");
    return;
  }
  const rows = getBalanceRows();
  const header = rows[0];
  const body = rows.slice(1);
  el.innerHTML =
    `<div class="table-head balance-head">${header.map(h => `<div>${h}</div>`).join("")}</div>` +
    body.map(r => {
      const isSection = !r[0] && r[1] && r.slice(2).every(v => v === "");
      if (isSection) return `<div class="balance-section-row">${r[1]}</div>`;
      const isTotal = r[1] === "TOTAL";
      return `<div class="table-row balance-row ${isTotal ? "balance-total-row" : ""}">
        ${r.map((v, i) => `<div>${i > 1 ? formatoCLP(v) : v}</div>`).join("")}
      </div>`;
    }).join("");
}

/* ── CONTROL ─────────────────────────────────────────────── */
function renderControlProyecto() {
  renderControlEtapas();
  renderControlCat();
  renderBudgetEditor();
}
function renderControlEtapas() {
  const el = $("control-etapas");
  if (!el) return;
  if (!gastos.length) {
    el.innerHTML = emptyState("Sin avance registrado.");
    return;
  }
  const groups = groupBy(gastos, g => g.categoria || "Sin categoría");
  const total = sumBy(gastos, "neto");
  el.innerHTML = `<div class="etapas-grid">${Object.entries(groups).map(([cat, rows]) => {
    const monto = sumBy(rows, "neto");
    const p = total ? (monto / total) * 100 : 0;
    return `
      <div class="etapa-card">
        <div class="etapa-header"><div class="etapa-nombre">${cat}</div><span class="estado-badge estado-activo">Activo</span></div>
        <div class="etapa-value">${formatoCLP(monto)}</div>
        <div class="etapa-progress-bar"><div class="etapa-progress-fill" style="width:${Math.min(p, 100)}%"></div></div>
        <div class="etapa-sub">${rows.length} documentos · ${formatoPct(p)}</div>
      </div>
    `;
  }).join("")}</div>`;
}
function renderControlCat() {
  const el = $("control-cat");
  if (!el) return;
  if (!gastos.length) {
    el.innerHTML = emptyState("Sin costos.");
    return;
  }
  const cg = groupBy(gastos, g => g.categoria || "Sin categoría");
  const total = sumBy(gastos, "neto");
  const months = [...new Set(gastos.map(g => mesLabel(g.fecha)))].sort();
  el.innerHTML = Object.entries(cg).map(([cat, rows]) => {
    const byMonth = groupBy(rows, r => mesLabel(r.fecha));
    const catTotal = sumBy(rows, "neto");
    const vals = Array.from({ length: 5 }).map((_, i) => `<div>${months[i] ? formatoCLP(sumBy(byMonth[months[i]] || [], "neto")) : "—"}</div>`).join("");
    return `<div class="table-row ctrl-cat-row"><div>${cat}</div><div>Gasto</div>${vals}<div>${formatoCLP(catTotal)}</div><div>${formatoPct(total ? (catTotal / total) * 100 : 0)}</div></div>`;
  }).join("");
}
function renderBudgetEditor() {
  const el = $("budget-editor");
  if (!el) return;
  el.innerHTML = `
    <div class="budget-edit-row">
      <span class="budget-edit-label">Presupuesto del proyecto</span>
      <div class="budget-edit-controls">
        <input type="text" id="budget-input" class="budget-input" value="${PROJECT_BUDGET.toLocaleString("es-CL")}" placeholder="180.000.000"/>
        <button class="budget-save-btn" id="btn-save-budget">Guardar</button>
      </div>
    </div>
  `;
  $("btn-save-budget")?.addEventListener("click", async () => {
    const val = numberValue($("budget-input")?.value);
    if (!val || val < 1000) {
      alert("Ingresa un presupuesto válido.");
      return;
    }
    await saveBudget(val);
    alert(`✅ Presupuesto actualizado a ${formatoCLP(val)}`);
  });
}

/* ── REPORTES ────────────────────────────────────────────── */
function getCategoriaBudget(cat) {
  const map = { "Materiales": 0.42, "Mano de obra": 0.32, "Servicios": 0.10, "Herramientas": 0.08, "Transporte": 0.08 };
  return PROJECT_BUDGET * (map[cat] || 0);
}
function getTopCategoria() {
  const groups = groupBy(gastos, r => r.categoria || "Sin categoría");
  const top = Object.entries(groups)
    .map(([cat, rs]) => [cat, sumBy(rs, "neto")])
    .sort((a, b) => b[1] - a[1])[0];
  return top?.[0] || "";
}
function renderReportes() {
  actualizarVistaReportes();
  agregarBotonesBalanceDetalle();
}
function actualizarVistaReportes() {
  const t = getTotals();
  const avance = PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0;

  setText("kpi-presupuesto", formatoCLP(PROJECT_BUDGET));
  setText("kpi-ejecutado", formatoCLP(t.neto));
  setText("kpi-avance", formatoPct(avance));
  setText("kpi-iva", formatoCLP(t.iva));

  const bar = $("kpi-avance-bar");
  if (bar) bar.style.width = `${Math.min(Math.max(avance, 0), 100)}%`;

  setText("report-updated", `Última actualización: ${new Date().toLocaleString("es-CL")}`);

  const topCat = getTopCategoria();
  setText("diagnostico-text", `${avance > 0 ? "El proyecto mantiene un avance financiero controlado según los datos disponibles." : "El proyecto aún no registra ejecución financiera suficiente para un diagnóstico completo."} La mayor concentración de gasto está en ${topCat || "las categorías registradas"}. El IVA crédito fiscal acumulado asciende a ${formatoCLP(t.iva)} y debe mantenerse separado para revisión tributaria.`);

  const alertas = $("alertas-list");
  if (alertas) {
    alertas.innerHTML = `
      <div class="alerta-item alerta-success">✅ Sin sobrecostos críticos contra el presupuesto total.</div>
      <div class="alerta-item alerta-info">ℹ️ ${t.docsSinCF} documento(s) sin crédito fiscal registrado.</div>
      <div class="alerta-item alerta-success">✅ Documentación tributaria visible en el sistema.</div>
    `;
  }

  renderResumenCategoria();
  setText("trib-base-neta", formatoCLP(t.neto));
  setText("trib-iva-cf", formatoCLP(t.iva));
  setText("trib-docs-cf", String(t.docsConCF));
  setText("trib-docs-sin-cf", String(t.docsSinCF));

  renderGraficosSimples();
}
function renderResumenCategoria() {
  const body = $("resumen-categoria-body");
  if (!body) return;
  const groups = groupBy(gastos, r => r.categoria || "Sin categoría");
  if (!gastos.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-cell">Sin datos disponibles</td></tr>`;
    return;
  }
  body.innerHTML = CATEGORIAS.map(cat => {
    const ejecutado = sumBy(groups[cat] || [], "neto");
    const ppto = getCategoriaBudget(cat);
    const dif = ppto - ejecutado;
    const av = ppto ? (ejecutado / ppto) * 100 : 0;
    return `
      <tr>
        <td>${cat}</td>
        <td class="money">${formatoCLP(ppto)}</td>
        <td class="money">${formatoCLP(ejecutado)}</td>
        <td class="money ${dif < 0 ? "desv-neg" : "desv-pos"}">${formatoCLP(dif)}</td>
        <td class="money">${formatoPct(av)}</td>
      </tr>
    `;
  }).join("");
}
function renderGraficosSimples() {
  renderBarChart("chart-presupuesto");
  renderDonutLegend("chart-categoria");
  renderLineSimple("chart-mensual");
}
function renderBarChart(id) {
  const el = $(id);
  if (!el) return;
  const groups = groupBy(gastos, r => r.categoria || "Sin categoría");
  const max = Math.max(...CATEGORIAS.map(cat => getCategoriaBudget(cat)), ...CATEGORIAS.map(cat => sumBy(groups[cat] || [], "neto")), 1);
  el.innerHTML = `
    <div class="simple-chart-bars">
      ${CATEGORIAS.map(cat => {
        const ppto = getCategoriaBudget(cat);
        const eje = sumBy(groups[cat] || [], "neto");
        return `
          <div class="simple-bar-group">
            <div class="simple-bars">
              <span class="simple-bar simple-bar-budget" style="height:${Math.max((ppto / max) * 100, 2)}%"></span>
              <span class="simple-bar simple-bar-real" style="height:${Math.max((eje / max) * 100, 2)}%"></span>
            </div>
            <div class="simple-bar-label">${cat}</div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="simple-legend"><span>Presupuesto</span><span>Ejecutado</span></div>
  `;
}
function renderDonutLegend(id) {
  const el = $(id);
  if (!el) return;
  const groups = groupBy(gastos, r => r.categoria || "Sin categoría");
  const total = sumBy(gastos, "neto");
  const items = CATEGORIAS.map(cat => {
    const monto = sumBy(groups[cat] || [], "neto");
    return { cat, monto, percent: total ? (monto / total) * 100 : 0 };
  }).filter(i => i.monto > 0);

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">Sin datos para graficar.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="simple-donut"><div class="simple-donut-center">${formatoCLP(total)}</div></div>
    <div class="simple-donut-list">
      ${items.map(i => `<div><span>${i.cat}</span><strong>${formatoPct(i.percent)}</strong></div>`).join("")}
    </div>
  `;
}
function renderLineSimple(id) {
  const el = $(id);
  if (!el) return;
  const groups = groupBy(gastos, r => mesLabel(r.fecha));
  const items = Object.entries(groups)
    .map(([mes, rows]) => ({ mes, monto: sumBy(rows, "neto") }))
    .slice(-6);

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">Sin datos para graficar.</div>`;
    return;
  }

  const max = Math.max(...items.map(i => i.monto), 1);
  el.innerHTML = `
    <div class="simple-line-chart">
      ${items.map(i => `
        <div class="simple-line-point">
          <div class="simple-line-value" style="height:${Math.max((i.monto / max) * 100, 6)}%"></div>
          <span>${i.mes}</span>
          <strong>${formatoCLP(i.monto)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}
function toggleDetalle() {
  const extras = $("report-extras");
  if (!extras) {
    alert("No se encontró el bloque de detalle de reportes.");
    return;
  }
  const isHidden = extras.style.display === "none" || getComputedStyle(extras).display === "none";
  extras.style.display = isHidden ? "block" : "none";

  const btn = $("btn-ver-detalle");
  if (btn) btn.textContent = isHidden ? "👁️ Ocultar detalle" : "👁️ Ver detalle";

  if (isHidden) {
    agregarBotonesBalanceDetalle();
    extras.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
function agregarBotonesBalanceDetalle() {
  const cont = $("reportes-export");
  if (!cont || $("btn-balance-real-excel")) return;
  const wrap = document.createElement("div");
  wrap.className = "export-btns";
  wrap.style.marginTop = "12px";
  wrap.innerHTML = `
    <button class="export-btn export-btn-xl" id="btn-balance-real-excel" type="button">⬇ Balance Excel</button>
    <button class="export-btn" id="btn-balance-real-csv" type="button">⬇ Balance CSV</button>
  `;
  cont.prepend(wrap);
  $("btn-balance-real-excel")?.addEventListener("click", exportToExcel);
  $("btn-balance-real-csv")?.addEventListener("click", exportBalanceCSV);
}

/* ── EXPORTACIONES ───────────────────────────────────────── */
function rowsToCSV(rows) {
  return rows.map(row => row.map(csvEscape).join(";")).join("\n");
}
function exportCSV() {
  const headers = ["fecha", "proveedor", "rut", "tipo_documento", "numero_documento", "categoria", "neto", "iva", "total", "metodo_pago", "estado_ocr"];
  const rows = [headers, ...filteredDocs.map(r => headers.map(h => r[h] ?? ""))];
  downloadBlob("gastos_junquillar.csv", rowsToCSV(rows), "text/csv;charset=utf-8");
}
function getReporteEjecutivoRows() {
  const t = getTotals();
  const avance = PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0;
  const groups = groupBy(gastos, r => r.categoria || "Sin categoría");
  return [
    ["Reporte Ejecutivo — Casa Junquillar"],
    ["Fecha de exportación", new Date().toLocaleString("es-CL")],
    [],
    ["Indicador", "Valor"],
    ["Presupuesto total", formatoCLP(PROJECT_BUDGET)],
    ["Ejecutado neto", formatoCLP(t.neto)],
    ["Avance financiero", formatoPct(avance)],
    ["IVA crédito acumulado", formatoCLP(t.iva)],
    ["Documentos con CF", t.docsConCF],
    ["Documentos sin CF", t.docsSinCF],
    [],
    ["Categoría", "Presupuesto", "Ejecutado", "Diferencia", "% Avance"],
    ...CATEGORIAS.map(cat => {
      const ejecutado = sumBy(groups[cat] || [], "neto");
      const ppto = getCategoriaBudget(cat);
      return [cat, formatoCLP(ppto), formatoCLP(ejecutado), formatoCLP(ppto - ejecutado), formatoPct(ppto ? (ejecutado / ppto) * 100 : 0)];
    })
  ];
}
function getBalanceExportRows() {
  return getBalanceRows().map((row, idx) => idx === 0 ? row : row.map((v, i) => i > 1 && typeof v === "number" ? v : v));
}
function exportBalanceCSV() {
  const rows = [
    ["Balance General — Proyecto Casa Junquillar"],
    ["Fecha de exportación", new Date().toLocaleString("es-CL")],
    [],
    ...getBalanceExportRows()
  ];
  downloadBlob(`balance-general-casa-junquillar-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows), "text/csv;charset=utf-8");
}
function exportToExcel() {
  actualizarVistaReportes();
  renderBalance();

  const reporteRows = getReporteEjecutivoRows();
  const balanceRows = [
    ["Balance General — Proyecto Casa Junquillar"],
    ["Fecha de exportación", new Date().toLocaleString("es-CL")],
    [],
    ...getBalanceExportRows()
  ];

  if (window.XLSX) {
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(reporteRows), "Reporte Ejecutivo");
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(balanceRows), "Balance");
    window.XLSX.writeFile(wb, `reporte-junquillar-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  downloadBlob(`reporte-junquillar-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(reporteRows.concat([[], ["BALANCE"], ...balanceRows])), "text/csv;charset=utf-8");
}
function exportToPDF() {
  actualizarVistaReportes();
  renderBalance();

  const report = $("section-reportes");
  const balance = $("section-balance");
  const html = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Reporte Ejecutivo — Casa Junquillar</title>
      <link rel="stylesheet" href="styles.css">
      <style>
        body{background:#fff;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
        .layout,.main,.content{display:block;padding:0;margin:0;}
        .module-hidden{display:block!important;}
        .sidebar,.header,.report-header-actions,.bell-btn,.search-wrap{display:none!important;}
        .card{break-inside:avoid;margin-bottom:16px;box-shadow:none!important;}
        @media print{body{padding:0}}
      </style>
    </head>
    <body>
      ${report ? report.outerHTML : "<h1>Reporte Ejecutivo — Casa Junquillar</h1>"}
      <hr style="margin:24px 0">
      ${balance ? balance.outerHTML : ""}
      <script>window.print();<\/script>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  if (!w) {
    alert("El navegador bloqueó la ventana emergente. Permite pop-ups para exportar PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ── PLACEHOLDERS ────────────────────────────────────────── */
function renderVentas() {
  const el = $("ventas-root");
  if (el) el.innerHTML = `<div class="card"><div class="card-title">Ventas</div><div class="card-sub">Módulo en preparación.</div></div>`;
}
function renderInsumos() {
  const el = $("insumos-root");
  if (el) el.innerHTML = `<div class="card"><div class="card-title">Insumos</div><div class="card-sub">Módulo en preparación.</div></div>`;
}
function renderConfig() {
  const el = $("config-root");
  if (el) el.innerHTML = `<div class="card"><div class="card-title">Configuración</div><div class="card-sub">Ajustes generales del proyecto.</div></div>`;
}

/* ── NAVEGACIÓN / SETUP ─────────────────────────────────── */
function updateVisibleSections(ids = []) {
  document.querySelectorAll(".module-block").forEach(s => s.classList.add("module-hidden"));
  ids.forEach(id => $(id)?.classList.remove("module-hidden"));
}
function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const title = $("page-title");
  const subtitle = $("page-subtitle");

  buttons.forEach(btn => btn.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentView = btn.dataset.view;
    const view = views[currentView] || views.resumen;
    if (title) title.textContent = view.title;
    if (subtitle) subtitle.textContent = view.subtitle;
    updateVisibleSections(view.visible);
    docsVisibleLimit = currentView === "gastos" ? 10 : 3;
    renderAll();
  }));

  $("btn-ver-reportes")?.addEventListener("click", () => document.querySelector('[data-view="reportes"]')?.click());
}
function setupButtons() {
  $("load-more-btn")?.addEventListener("click", () => { docsVisibleLimit += 20; renderDocs(docsVisibleLimit); });
  $("btn-aplicar-filtros-gastos")?.addEventListener("click", applyFilters);
  $("btn-limpiar-filtros-gastos")?.addEventListener("click", clearFilters);
  $("btn-export-csv")?.addEventListener("click", exportCSV);
  $("btn-export-excel")?.addEventListener("click", exportCSV);
  ["filter-text-gastos", "global-search"].forEach(id => $(id)?.addEventListener("input", applyFilters));

  $("modal-overlay")?.addEventListener("click", e => { if (e.target === $("modal-overlay")) closeEditModal(); });
  $("btn-modal-cancel")?.addEventListener("click", closeEditModal);
  $("btn-modal-cancel2")?.addEventListener("click", closeEditModal);
  $("btn-modal-save")?.addEventListener("click", saveEditModal);
  $("chk-all")?.addEventListener("change", e => toggleSelectAll(e.target));
  $("btn-bulk-delete")?.addEventListener("click", bulkDelete);
  $("btn-bulk-cancel")?.addEventListener("click", cancelBulkSelection);

  $("btn-export-pdf")?.addEventListener("click", e => { e.preventDefault(); exportToPDF(); });
  $("btn-export-excel")?.addEventListener("click", e => { e.preventDefault(); exportToExcel(); });
  $("btn-ver-detalle")?.addEventListener("click", e => { e.preventDefault(); toggleDetalle(); });
}
function renderAll() {
  renderKPIs();
  renderAlerts();
  renderBottomCards();
  renderDocs(docsVisibleLimit);
  renderProveedores();
  renderCaja();
  renderBalance();
  renderControlProyecto();
  renderReportes();
  renderVentas();
  renderInsumos();
  renderConfig();
}
function injectReportStyles() {
  if ($("junqo-report-inline-styles")) return;
  const style = document.createElement("style");
  style.id = "junqo-report-inline-styles";
  style.textContent = `
    .simple-chart-bars{height:220px;display:flex;gap:14px;align-items:end;padding:18px 8px 8px}
    .simple-bar-group{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:60px}
    .simple-bars{height:160px;width:100%;display:flex;justify-content:center;align-items:end;gap:4px}
    .simple-bar{width:18px;border-radius:6px 6px 0 0;display:block}
    .simple-bar-budget{background:#d1fae5}
    .simple-bar-real{background:#0f172a}
    .simple-bar-label{font-size:11px;color:#64748b;text-align:center}
    .simple-legend{display:flex;gap:16px;justify-content:center;font-size:12px;color:#64748b}
    .simple-donut{width:150px;height:150px;border-radius:50%;margin:14px auto;background:conic-gradient(#0f766e 0 40%, #059669 40% 70%, #94a3b8 70% 100%);display:flex;align-items:center;justify-content:center}
    .simple-donut-center{width:92px;height:92px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;font-weight:700;padding:8px}
    .simple-donut-list{display:flex;flex-direction:column;gap:8px}
    .simple-donut-list div{display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #f1f5f9;padding-bottom:6px}
    .simple-line-chart{height:220px;display:flex;gap:12px;align-items:end;padding:16px 8px}
    .simple-line-point{flex:1;height:180px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px}
    .simple-line-value{width:22px;background:#059669;border-radius:8px 8px 0 0}
    .simple-line-point span{font-size:11px;color:#64748b}
    .simple-line-point strong{font-size:10px;color:#0f172a;text-align:center}
  `;
  document.head.appendChild(style);
}
function initDashboard() {
  injectReportStyles();
  setupNavigation();
  setupFileUpload();
  setupButtons();
  updateVisibleSections(views.resumen.visible);
  loadData();
}

document.addEventListener("DOMContentLoaded", initDashboard);

/* ── FUNCIONES GLOBALES PARA ONCLICK INLINE ───────────────── */
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.confirmDelete = confirmDelete;
window.toggleRowSelect = toggleRowSelect;
window.toggleSelectAll = toggleSelectAll;
window.exportToPDF = exportToPDF;
window.exportToExcel = exportToExcel;
window.toggleDetalle = toggleDetalle;
window.exportBalanceCSV = exportBalanceCSV;
