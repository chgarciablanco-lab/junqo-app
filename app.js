/* ============================================================
   JUNQO – Casa Junquillar | app.js
   Fuente única de datos: Supabase
   Tabla: public.gastos_junquillar_app

   Regla:
   - No hay valores fijos de gastos, balance, caja, proveedores ni reportes.
   - Todo se calcula desde los registros de Supabase.
   - Si se eliminan los gastos en Supabase, el dashboard queda en cero / vacío.
   ============================================================ */

const PROJECT_NAME = "Junquillar";
const PROJECT_BUDGET = 180000000; // presupuesto referencial del proyecto. No es gasto ejecutado.

let gastos = [];
let filteredDocs = [];
let currentView = "resumen";
let docsVisibleLimit = 10;

const views = {
  resumen: {
    title: "Resumen",
    subtitle: "Vista ejecutiva del proyecto",
    visible: ["section-kpis", "section-alerts", "section-bottom"]
  },
  control: {
    title: "Control de Proyecto",
    subtitle: "Avance presupuestario, partidas e hitos",
    visible: ["section-control"]
  },
  gastos: {
    title: "Gastos",
    subtitle: "Registro y control de egresos del proyecto",
    visible: ["section-filtro-solo", "section-docs"]
  },
  documentos: {
    title: "Documentos",
    subtitle: "Carga de facturas, boletas y respaldo documental",
    visible: ["section-upload", "section-docs"]
  },
  proveedores: {
    title: "Proveedores",
    subtitle: "Análisis por proveedor, documentos y concentración de gasto",
    visible: ["section-proveedores"]
  },
  caja: {
    title: "Caja e IVA",
    subtitle: "Crédito fiscal, documentos y detalle mensual",
    visible: ["section-caja"]
  },
  balance: {
    title: "Balance",
    subtitle: "Vista contable calculada desde los gastos registrados",
    visible: ["section-balance"]
  },
  reportes: {
    title: "Reportes",
    subtitle: "Análisis resumido por categoría y etapa",
    visible: ["section-reportes"]
  }
};

/* ── HELPERS ──────────────────────────────────────────────── */

function $(id) {
  return document.getElementById(id);
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatoCLP(value) {
  const n = numberValue(value);
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  });
}

function formatoNumero(value) {
  const n = numberValue(value);
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

function formatoPct(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
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
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
    const [d, m, y] = fecha.split("/");
    return `${y}-${m}-${d}`;
  }
  return String(fecha);
}

function mesLabel(fecha) {
  const f = fechaOrdenable(fecha);
  if (!f || f.length < 7) return "Sin fecha";
  const [y, m] = f.split("-");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${meses[Number(m) - 1] || m} ${y}`;
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function getCategoriaClass(categoria = "") {
  const cat = String(categoria || "").toLowerCase();
  if (cat.includes("material")) return "cat-materiales";
  if (cat.includes("mano")) return "cat-mano";
  if (cat.includes("servicio")) return "cat-servicios";
  if (cat.includes("herramienta")) return "cat-herramientas";
  if (cat.includes("transporte")) return "cat-transporte";
  if (cat.includes("aliment")) return "cat-servicios";
  return "cat-otros";
}

function sumBy(rows, field) {
  return rows.reduce((acc, item) => acc + numberValue(item[field]), 0);
}

function uniqueCount(rows, field) {
  return new Set(rows.map(item => item[field]).filter(Boolean)).size;
}

function groupBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row) || "Sin clasificar";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

function getTotals(rows = gastos) {
  const neto = sumBy(rows, "neto");
  const iva = sumBy(rows, "iva");
  const total = sumBy(rows, "total");
  const docs = rows.length;
  const proveedores = uniqueCount(rows, "proveedor");
  const pendientesOcr = rows.filter(g => String(g.estado_ocr || "").toLowerCase() === "pendiente").length;
  const sinProveedor = rows.filter(g => !g.proveedor).length;

  return { neto, iva, total, docs, proveedores, pendientesOcr, sinProveedor };
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

function docRowFromGasto(gasto) {
  return {
    date: normalizarFecha(gasto.fecha),
    name: gasto.proveedor || "Pendiente OCR",
    rut: gasto.rut || "—",
    tipo: gasto.tipo_documento || "—",
    numero: gasto.numero_documento || "—",
    cat: gasto.categoria || "Sin categoría",
    catCls: getCategoriaClass(gasto.categoria),
    costo: formatoCLP(gasto.neto),
    iva: gasto.iva ? formatoCLP(gasto.iva) : "—",
    total: gasto.total ? formatoCLP(gasto.total) : "—",
    cf: numberValue(gasto.iva) > 0 ? "✔" : "—",
    pago: gasto.metodo_pago || "—",
    estadoOcr: gasto.estado_ocr || "—",
    fotoPath: gasto.foto_path || null,
    observacion: gasto.observacion || ""
  };
}

function emptyState(text = "Sin registros para mostrar.") {
  return `<div class="empty-state">${text}</div>`;
}

/* ── DATA LOAD ────────────────────────────────────────────── */

async function loadData() {
  if (typeof supabaseClient === "undefined") {
    console.warn("Supabase no está configurado. Dashboard vacío.");
    gastos = [];
    filteredDocs = [];
    renderAll();
    return;
  }

  const { data, error } = await supabaseClient
    .from("gastos_junquillar_app")
    .select("*")
    .eq("proyecto", PROJECT_NAME)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando gastos desde Supabase:", error);
    gastos = [];
    filteredDocs = [];
    renderAll();
    return;
  }

  gastos = (data || []).map(mapSupabaseRow);
  filteredDocs = [...gastos];
  renderAll();
}

/* ── RENDER: RESUMEN ─────────────────────────────────────── */

function renderKPIs() {
  const el = $("section-kpis");
  if (!el) return;

  const t = getTotals(gastos);
  const avance = PROJECT_BUDGET > 0 ? (t.neto / PROJECT_BUDGET) * 100 : 0;

  const kpis = [
    {
      title: "Inversión total neta",
      value: formatoCLP(t.neto),
      delta: formatoPct(avance),
      type: "up",
      footer: `${t.docs} documentos registrados`
    },
    {
      title: "IVA crédito fiscal",
      value: formatoCLP(t.iva),
      delta: t.iva > 0 ? "CF" : "0",
      type: "up",
      footer: "Calculado desde IVA registrado"
    },
    {
      title: "Total documentos",
      value: formatoCLP(t.total),
      delta: `${t.proveedores} prov.`,
      type: "up",
      footer: "Total bruto acumulado"
    },
    {
      title: "Pendientes OCR",
      value: `${t.pendientesOcr}`,
      delta: t.pendientesOcr > 0 ? "pend." : "ok",
      type: t.pendientesOcr > 0 ? "down" : "up",
      footer: `${t.sinProveedor} registros sin proveedor`
    }
  ];

  el.innerHTML = kpis.map(kpi => `
    <div class="kpi-card">
      <div class="kpi-top">
        <div>
          <div class="kpi-title">${kpi.title}</div>
          <div class="kpi-value">${kpi.value}</div>
        </div>
        <span class="badge ${kpi.type}">${kpi.delta}</span>
      </div>
      <div class="kpi-footer">${kpi.footer}</div>
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

  const t = getTotals(gastos);

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin alertas. No hay gastos registrados.");
    return;
  }

  const alerts = [
    {
      icon: "📄",
      title: `${t.pendientesOcr} documentos pendientes OCR`,
      sub: "Registros que aún requieren lectura o revisión documental."
    },
    {
      icon: "⚠️",
      title: `${t.sinProveedor} registros incompletos`,
      sub: "Gastos sin proveedor registrado o con datos pendientes."
    },
    {
      icon: "💵",
      title: `${formatoCLP(t.iva)} de IVA crédito fiscal`,
      sub: "Monto calculado desde los documentos registrados."
    },
    {
      icon: "📊",
      title: `${formatoPct(PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0)} de avance financiero`,
      sub: "Avance calculado contra presupuesto referencial."
    }
  ];

  el.innerHTML = alerts.map(alert => `
    <div class="alert-item">
      <div class="alert-icon">${alert.icon}</div>
      <div>
        <div class="alert-title">${alert.title}</div>
        <div class="alert-sub">${alert.sub}</div>
      </div>
    </div>
  `).join("");
}

function renderBottomCards() {
  const el = $("section-bottom");
  if (!el) return;

  const t = getTotals(gastos);
  const ultimaFecha = gastos.length ? normalizarFecha(gastos[0].fecha) : "—";

  const cards = [
    { label: "Proveedores", value: t.proveedores, sub: "Únicos registrados", icon: "🏢" },
    { label: "Último registro", value: ultimaFecha, sub: "Según fecha de gasto", icon: "📅" },
    { label: "Total bruto", value: formatoCLP(t.total), sub: "Neto + IVA", icon: "💼" },
    { label: "Avance presupuesto", value: formatoPct(PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0), sub: "Contra presupuesto referencial", icon: "📈" }
  ];

  el.innerHTML = cards.map(card => `
    <div class="bottom-card">
      <div class="bottom-top">
        <div class="bottom-label">${card.label}</div>
        <div class="bottom-icon">${card.icon}</div>
      </div>
      <div class="bottom-value">${card.value}</div>
      <div class="bottom-sub">${card.sub}</div>
    </div>
  `).join("");
}

/* ── RENDER: GASTOS / DOCUMENTOS ─────────────────────────── */

function renderDocs(limit = docsVisibleLimit) {
  const el = $("docs-table");
  const subtitle = $("docs-subtitle");
  const btn = $("load-more-btn");

  if (!el) return;

  if (subtitle) {
    subtitle.textContent = `${filteredDocs.length} registros · datos cargados desde Supabase · tabla gastos_junquillar_app`;
  }

  if (filteredDocs.length === 0) {
    el.innerHTML = emptyState("No hay gastos registrados en Supabase.");
    if (btn) btn.style.display = "none";
    return;
  }

  const rows = filteredDocs.slice(0, limit).map(docRowFromGasto);

  el.innerHTML = rows.map(doc => `
    <div class="table-row gastos-row">
      <div>${doc.date}</div>
      <div>
        <div class="doc-name">${doc.name}</div>
        <div class="doc-amount">${doc.observacion || ""}</div>
      </div>
      <div>${doc.rut}</div>
      <div>${doc.tipo}</div>
      <div><span class="cat-badge ${doc.catCls}">${doc.cat}</span></div>
      <div>${doc.costo}</div>
      <div>${doc.iva}</div>
      <div>${doc.total}</div>
      <div>${doc.cf}</div>
      <div>${doc.pago}</div>
      <div>${doc.fotoPath ? "📎" : "—"}</div>
    </div>
  `).join("");

  if (btn) {
    btn.style.display = filteredDocs.length > limit ? "inline-flex" : "none";
  }
}

function applyFilters() {
  const text = ($("filter-text")?.value || $("filter-text-gastos")?.value || "").toLowerCase().trim();
  const cat = $("filter-cat")?.value || $("filter-cat-gastos")?.value || "";
  const tipo = $("filter-tipo")?.value || $("filter-tipo-gastos")?.value || "";
  const desde = $("filter-desde")?.value || $("filter-desde-gastos")?.value || "";
  const hasta = $("filter-hasta")?.value || $("filter-hasta-gastos")?.value || "";
  const pago = $("filter-pago")?.value || "";

  filteredDocs = gastos.filter(g => {
    const hayTexto = [
      g.proveedor, g.rut, g.tipo_documento, g.numero_documento, g.categoria, g.metodo_pago, g.observacion
    ].join(" ").toLowerCase();

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
  renderDocs(docsVisibleLimit);
}

function clearFilters() {
  ["filter-text", "filter-text-gastos", "filter-cat", "filter-cat-gastos", "filter-tipo", "filter-tipo-gastos", "filter-desde", "filter-desde-gastos", "filter-hasta", "filter-hasta-gastos", "filter-pago"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });

  filteredDocs = [...gastos];
  docsVisibleLimit = 10;
  renderDocs(docsVisibleLimit);
}

/* ── RENDER: PROVEEDORES ─────────────────────────────────── */

function renderProveedores() {
  const el = $("proveedores-table");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin proveedores. No hay gastos registrados.");
    return;
  }

  const groups = groupBy(gastos, g => g.proveedor || "Pendiente OCR");
  const totalNeto = sumBy(gastos, "neto");

  const rows = Object.entries(groups)
    .map(([name, rows]) => ({
      name,
      rut: rows.find(r => r.rut)?.rut || "—",
      cat: rows.find(r => r.categoria)?.categoria || "Sin categoría",
      catCls: getCategoriaClass(rows.find(r => r.categoria)?.categoria),
      docs: rows.length,
      costo: sumBy(rows, "neto"),
      iva: sumBy(rows, "iva"),
      pct: totalNeto > 0 ? (sumBy(rows, "neto") / totalNeto) * 100 : 0
    }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 20);

  el.innerHTML = rows.map((p, index) => `
    <div class="table-row prov-row">
      <div>${index + 1}</div>
      <div class="doc-name">${p.name}</div>
      <div>${p.rut}</div>
      <div><span class="cat-badge ${p.catCls}">${p.cat}</span></div>
      <div>${p.docs}</div>
      <div>${formatoCLP(p.costo)}</div>
      <div>${formatoCLP(p.iva)}</div>
      <div>${formatoPct(p.pct)}</div>
    </div>
  `).join("");
}

/* ── RENDER: CAJA / IVA ──────────────────────────────────── */

function renderCaja() {
  renderCajaTipos();
  renderCajaMensual();
}

function renderCajaTipos() {
  const el = $("caja-tipos");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin información tributaria. No hay gastos registrados.");
    return;
  }

  const groups = groupBy(gastos, g => g.tipo_documento || "Sin tipo");

  el.innerHTML = Object.entries(groups).map(([tipo, rows]) => {
    const iva = sumBy(rows, "iva");
    return `
      <div class="table-row caja-tipos-row">
        <div>${tipo}</div>
        <div>${rows.length}</div>
        <div>${formatoCLP(sumBy(rows, "neto"))}</div>
        <div>${formatoCLP(iva)}</div>
        <div>${iva > 0 ? "✔" : "—"}</div>
        <div>${iva > 0 ? "IVA Crédito Fiscal registrado" : "Sin IVA registrado"}</div>
      </div>
    `;
  }).join("");
}

function renderCajaMensual() {
  const el = $("caja-mensual");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin detalle mensual.");
    return;
  }

  const groups = groupBy(gastos, g => mesLabel(g.fecha));
  let acumulado = 0;

  const rows = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, rows]) => {
      const iva = sumBy(rows, "iva");
      acumulado += iva;
      return { mes, rows, iva, acumulado };
    });

  el.innerHTML = rows.map(item => `
    <div class="table-row caja-mensual-row">
      <div>${item.mes}</div>
      <div>${item.rows.filter(r => numberValue(r.iva) > 0).length}</div>
      <div>${formatoCLP(sumBy(item.rows, "neto"))}</div>
      <div>${formatoCLP(item.iva)}</div>
      <div>${formatoCLP(item.acumulado)}</div>
    </div>
  `).join("");
}

/* ── RENDER: BALANCE ─────────────────────────────────────── */

function renderBalance() {
  const el = $("balance-table");
  if (!el) return;

  const t = getTotals(gastos);

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Balance sin movimientos. No hay gastos registrados.");
    return;
  }

  const rows = [
    {
      n: "1",
      cuenta: "Obra en Curso",
      debe: t.neto,
      haber: 0,
      deudor: t.neto,
      acreedor: 0,
      activo: t.neto,
      pasivo: 0,
      perdida: 0,
      ganancia: 0
    },
    {
      n: "2",
      cuenta: "IVA Crédito Fiscal",
      debe: t.iva,
      haber: 0,
      deudor: t.iva,
      acreedor: 0,
      activo: t.iva,
      pasivo: 0,
      perdida: 0,
      ganancia: 0
    },
    {
      n: "3",
      cuenta: "Financiamiento / Caja / Cuentas por pagar",
      debe: 0,
      haber: t.total,
      deudor: 0,
      acreedor: t.total,
      activo: 0,
      pasivo: t.total,
      perdida: 0,
      ganancia: 0
    }
  ];

  el.innerHTML = rows.map(r => `
    <div class="table-row balance-row">
      <div>${r.n}</div>
      <div class="doc-name">${r.cuenta}</div>
      <div>${formatoCLP(r.debe)}</div>
      <div>${formatoCLP(r.haber)}</div>
      <div>${formatoCLP(r.deudor)}</div>
      <div>${formatoCLP(r.acreedor)}</div>
      <div>${formatoCLP(r.activo)}</div>
      <div>${formatoCLP(r.pasivo)}</div>
      <div>${formatoCLP(r.perdida)}</div>
      <div>${formatoCLP(r.ganancia)}</div>
    </div>
  `).join("");
}

/* ── RENDER: CONTROL DE PROYECTO ─────────────────────────── */

function renderControlProyecto() {
  renderControlKpis();
  renderControlEtapas();
  renderControlHitos();
  renderControlCat();
}

function renderControlKpis() {
  const el = $("control-kpis");
  if (!el) return;

  const t = getTotals(gastos);
  const avance = PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0;

  const cards = [
    { title: "Avance financiero", value: formatoPct(avance), footer: `${formatoCLP(t.neto)} ejecutado` },
    { title: "Presupuesto referencial", value: formatoCLP(PROJECT_BUDGET), footer: "Base de comparación" },
    { title: "Saldo estimado", value: formatoCLP(Math.max(PROJECT_BUDGET - t.neto, 0)), footer: "Presupuesto menos neto ejecutado" },
    { title: "Partidas con gasto", value: uniqueCount(gastos, "categoria"), footer: "Categorías registradas" }
  ];

  el.innerHTML = cards.map(card => `
    <div class="kpi-card">
      <div class="kpi-top">
        <div>
          <div class="kpi-title">${card.title}</div>
          <div class="kpi-value">${card.value}</div>
        </div>
      </div>
      <div class="kpi-footer">${card.footer}</div>
    </div>
  `).join("");
}

function renderControlEtapas() {
  const el = $("control-etapas");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin avance registrado. No hay gastos para calcular etapas.");
    return;
  }

  const groups = groupBy(gastos, g => g.categoria || "Sin categoría");
  const total = sumBy(gastos, "neto");

  el.innerHTML = Object.entries(groups).map(([cat, rows]) => {
    const monto = sumBy(rows, "neto");
    const pct = total > 0 ? (monto / total) * 100 : 0;
    return `
      <div class="etapa-card">
        <div class="etapa-title">${cat}</div>
        <div class="etapa-value">${formatoCLP(monto)}</div>
        <div class="cat-track"><div class="cat-fill" style="width:${Math.min(pct, 100)}%"></div></div>
        <div class="etapa-sub">${formatoPct(pct)} del gasto registrado</div>
      </div>
    `;
  }).join("");
}

function renderControlHitos() {
  const el = $("control-hitos");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin hitos calculados. No hay gastos registrados.");
    return;
  }

  const t = getTotals(gastos);

  const hitos = [
    { area: "Documentación", estado: t.pendientesOcr > 0 ? "Pendiente" : "Completo", detalle: `${t.pendientesOcr} documentos pendientes OCR` },
    { area: "Presupuesto", estado: t.neto > PROJECT_BUDGET ? "Sobre presupuesto" : "En control", detalle: `${formatoCLP(t.neto)} ejecutado` },
    { area: "Proveedores", estado: t.proveedores > 0 ? "Con actividad" : "Sin actividad", detalle: `${t.proveedores} proveedores registrados` }
  ];

  el.innerHTML = hitos.map(h => `
    <div class="hito-row">
      <div class="doc-name">${h.area}</div>
      <div><span class="status ${h.estado === "En control" || h.estado === "Completo" || h.estado === "Con actividad" ? "s-green" : "s-amber"}">${h.estado}</span></div>
      <div>${h.detalle}</div>
    </div>
  `).join("");
}

function renderControlCat() {
  const el = $("control-cat");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin costos por categoría.");
    return;
  }

  const catGroups = groupBy(gastos, g => g.categoria || "Sin categoría");
  const total = sumBy(gastos, "neto");
  const months = [...new Set(gastos.map(g => mesLabel(g.fecha)))].sort();

  el.innerHTML = Object.entries(catGroups).map(([cat, rows]) => {
    const byMonth = groupBy(rows, r => mesLabel(r.fecha));
    const catTotal = sumBy(rows, "neto");
    const monthValues = months.slice(0, 5).map(m => `<div>${formatoCLP(sumBy(byMonth[m] || [], "neto"))}</div>`).join("");
    return `
      <div class="table-row ctrl-cat-row">
        <div><span class="cat-badge ${getCategoriaClass(cat)}">${cat}</span></div>
        <div>Gasto</div>
        ${monthValues}
        <div>${formatoCLP(catTotal)}</div>
        <div>${formatoPct(total ? (catTotal / total) * 100 : 0)}</div>
      </div>
    `;
  }).join("");
}

/* ── RENDER: REPORTES ────────────────────────────────────── */

function renderReportes() {
  renderReportesCat();
  renderReportesEtapas();
}

function renderReportesCat() {
  const el = $("reportes-cat");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin reporte por categoría.");
    return;
  }

  const groups = groupBy(gastos, g => g.categoria || "Sin categoría");
  const total = sumBy(gastos, "neto");

  el.innerHTML = Object.entries(groups)
    .map(([cat, rows]) => {
      const monto = sumBy(rows, "neto");
      return { cat, monto, pct: total ? (monto / total) * 100 : 0, docs: rows.length };
    })
    .sort((a, b) => b.monto - a.monto)
    .map(r => `
      <div class="report-row">
        <div class="report-label">${r.cat}</div>
        <div class="report-value">${formatoCLP(r.monto)}</div>
        <div class="cat-track"><div class="cat-fill" style="width:${Math.min(r.pct, 100)}%"></div></div>
        <div class="report-sub">${r.docs} docs · ${formatoPct(r.pct)}</div>
      </div>
    `).join("");
}

function renderReportesEtapas() {
  const el = $("reportes-etapas");
  if (!el) return;

  if (gastos.length === 0) {
    el.innerHTML = emptyState("Sin reporte mensual.");
    return;
  }

  const groups = groupBy(gastos, g => mesLabel(g.fecha));

  el.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, rows]) => `
      <div class="report-row">
        <div class="report-label">${mes}</div>
        <div class="report-value">${formatoCLP(sumBy(rows, "neto"))}</div>
        <div class="report-sub">${rows.length} documentos · IVA ${formatoCLP(sumBy(rows, "iva"))}</div>
      </div>
    `).join("");
}

/* ── NAVIGATION ───────────────────────────────────────────── */

function updateVisibleSections(sectionIds = []) {
  document.querySelectorAll(".module-block").forEach(section => {
    section.classList.add("module-hidden");
  });

  sectionIds.forEach(id => {
    const el = $(id);
    if (el) el.classList.remove("module-hidden");
  });
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const title = $("page-title");
  const subtitle = $("page-subtitle");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      currentView = button.dataset.view;
      const view = views[currentView] || views.resumen;

      if (title) title.textContent = view.title;
      if (subtitle) subtitle.textContent = view.subtitle;

      updateVisibleSections(view.visible);

      docsVisibleLimit = currentView === "gastos" || currentView === "documentos" ? 10 : 3;
      renderDocs(docsVisibleLimit);
    });
  });

  const reportBtn = $("btn-ver-reportes");
  if (reportBtn) {
    reportBtn.addEventListener("click", () => {
      const btn = document.querySelector('[data-view="reportes"]');
      if (btn) btn.click();
    });
  }
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
}

/* ── EXPORTS ──────────────────────────────────────────────── */

function rowsToCSV(rows) {
  const headers = ["fecha", "proveedor", "rut", "tipo_documento", "numero_documento", "categoria", "neto", "iva", "total", "metodo_pago", "estado_ocr", "foto_path"];
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(";"),
    ...rows.map(row => headers.map(h => escape(row[h])).join(";"))
  ].join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  downloadText("gastos_junquillar.csv", rowsToCSV(filteredDocs));
}

function exportExcel() {
  exportCSV();
}

function exportProvCSV() {
  exportCSV();
}

function exportProvExcel() {
  exportCSV();
}

/* ── INIT ─────────────────────────────────────────────────── */

function initDashboard() {
  setupNavigation();
  updateVisibleSections(views.resumen.visible);
  loadData();

  const btn = $("load-more-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      docsVisibleLimit += 20;
      renderDocs(docsVisibleLimit);
    });
  }
}

document.addEventListener("DOMContentLoaded", initDashboard);
