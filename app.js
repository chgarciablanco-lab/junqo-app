/* JUNQO – Casa Junquillar | app.js limpio */
const PROJECT_NAME = "Junquillar";
const PROJECT_BUDGET = 180000000;
const BUCKET_NAME = "comprobantes-junquillar";
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_EXTENSIONS = ["jpg", "jpeg", "png", "pdf", "xls", "xlsx", "csv"];

let gastos = [];
let filteredDocs = [];
let currentView = "resumen";
let docsVisibleLimit = 10;

const views = {
  resumen: { title: "Resumen", subtitle: "Vista ejecutiva del proyecto", visible: ["section-kpis", "section-alerts", "section-bottom"] },
  control: { title: "Control de Proyecto", subtitle: "Avance presupuestario, partidas e hitos", visible: ["section-control"] },
  gastos: { title: "Gastos", subtitle: "Registro y control de egresos del proyecto", visible: ["section-filtro-solo", "section-docs"] },
  documentos: { title: "Documentos", subtitle: "Carga de facturas, boletas y respaldo documental", visible: ["section-upload"] },
  proveedores: { title: "Proveedores", subtitle: "Análisis por proveedor, documentos y concentración de gasto", visible: ["section-proveedores"] },
  caja: { title: "Caja e IVA", subtitle: "Crédito fiscal, documentos y detalle mensual", visible: ["section-caja"] },
  balance: { title: "Balance", subtitle: "Vista contable calculada desde los gastos registrados", visible: ["section-balance"] },
  reportes: { title: "Reportes", subtitle: "Análisis resumido por categoría y mes", visible: ["section-reportes"] }
};

const $ = (id) => document.getElementById(id);

function numberValue(value){
  if(value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function formatoCLP(value){
  return numberValue(value).toLocaleString("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 });
}
function formatoPct(value){
  return `${Number(value || 0).toLocaleString("es-CL", { maximumFractionDigits:1 })}%`;
}
function normalizarFecha(fecha){
  if(!fecha) return "—";
  const raw = String(fecha).slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
    const [y,m,d] = raw.split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}
function fechaOrdenable(fecha){
  if(!fecha) return "";
  if(/^\d{4}-\d{2}-\d{2}/.test(fecha)) return String(fecha).slice(0,10);
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)){
    const [d,m,y] = fecha.split("/");
    return `${y}-${m}-${d}`;
  }
  return String(fecha);
}
function mesLabel(fecha){
  const f = fechaOrdenable(fecha);
  if(!f || f.length < 7) return "Sin fecha";
  const [y,m] = f.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${meses[Number(m)-1] || m} ${y}`;
}
function getCategoriaClass(categoria=""){
  const cat = String(categoria || "").toLowerCase();
  if(cat.includes("material")) return "cat-materiales";
  if(cat.includes("mano")) return "cat-mano";
  if(cat.includes("servicio") || cat.includes("aliment")) return "cat-servicios";
  if(cat.includes("herramienta")) return "cat-herramientas";
  if(cat.includes("transporte")) return "cat-transporte";
  return "cat-otros";
}
function sumBy(rows, field){ return rows.reduce((acc, item) => acc + numberValue(item[field]), 0); }
function uniqueCount(rows, field){ return new Set(rows.map(i => i[field]).filter(Boolean)).size; }
function groupBy(rows, keyFn){
  return rows.reduce((acc, row) => {
    const key = keyFn(row) || "Sin clasificar";
    if(!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}
function getTotals(rows = gastos){
  const neto = sumBy(rows, "neto");
  const iva = sumBy(rows, "iva");
  const total = sumBy(rows, "total");
  const docs = rows.length;
  const proveedores = uniqueCount(rows, "proveedor");
  const pendientesOcr = rows.filter(g => String(g.estado_ocr || "").toLowerCase() === "pendiente").length;
  const sinProveedor = rows.filter(g => !g.proveedor).length;
  return { neto, iva, total, docs, proveedores, pendientesOcr, sinProveedor };
}
function emptyState(text="Sin registros para mostrar."){
  return `<div class="empty-state">${text}</div>`;
}

function mapSupabaseRow(row){
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
function docRowFromGasto(gasto){
  return {
    date: normalizarFecha(gasto.fecha),
    name: gasto.proveedor || "Pendiente OCR",
    rut: gasto.rut || "—",
    tipo: gasto.tipo_documento || "—",
    cat: gasto.categoria || "Sin categoría",
    catCls: getCategoriaClass(gasto.categoria),
    costo: formatoCLP(gasto.neto),
    iva: gasto.iva ? formatoCLP(gasto.iva) : "—",
    total: gasto.total ? formatoCLP(gasto.total) : "—",
    cf: numberValue(gasto.iva) > 0 ? "✔" : "—",
    pago: gasto.metodo_pago || "—",
    fotoPath: gasto.foto_path || null,
    observacion: gasto.observacion || ""
  };
}

function getFileExtension(filename){ return String(filename || "").split(".").pop().toLowerCase(); }
function sanitizeFileName(filename){
  return String(filename || "archivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}
function getFileGroup(extension){
  if(["jpg","jpeg","png"].includes(extension)) return "imagenes";
  if(["xls","xlsx","csv"].includes(extension)) return "planillas";
  return "pdf";
}
// ── Column name aliases: maps Excel headers → DB field names ──────────────────
// ── PARSER EXCEL / CSV ────────────────────────────────────────────────────────
// Estructura esperada del Excel:
//   Fila 1: título (se ignora)
//   Fila 2: encabezados  →  Fecha | Proveedor | RUT | Tipo | Nº Documento | Neto | IVA | Total | Categoría | Método de Pago | Proyecto
//   Fila 3+: datos
//   Última fila: puede ser fila de TOTAL (se ignora)

// Mapeo exacto de encabezados del Excel → campos Supabase
const EXACT_HEADERS = {
  0:  "fecha",
  1:  "proveedor",
  2:  "rut",
  3:  "tipo_documento",
  4:  "numero_documento",
  5:  "neto",
  6:  "iva",
  7:  "total",
  8:  "categoria",
  9:  "metodo_pago",
  10: "proyecto"
};

// Aliases flexibles para otros Excel con encabezados distintos
const HEADER_ALIASES = {
  fecha:            ["fecha","date"],
  proveedor:        ["proveedor","supplier","nombre","razón social","razon social","nombre proveedor"],
  rut:              ["rut","r.u.t","r.u.t.","rut proveedor"],
  tipo_documento:   ["tipo","tipo documento","tipo doc","tipo doc.","type","documento","nº documento"],
  numero_documento: ["nº documento","n° documento","numero documento","número documento","folio","nro","n°","doc"],
  neto:             ["neto","monto neto","base neta","costo neto","net","base"],
  iva:              ["iva","i.v.a","i.v.a.","tax","impuesto"],
  total:            ["total","total doc","total documento","monto total","total bruto"],
  categoria:        ["categoría","categoria","category","partida","etapa"],
  metodo_pago:      ["método de pago","metodo de pago","método pago","metodo pago","forma pago","forma de pago","pago","payment"],
  proyecto:         ["proyecto","project"]
};

function normH(h){ return String(h||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(); }

function buildColMap(headerRow){
  // 1. Try exact positional match (our Excel format)
  const knownHeaders = ["fecha","proveedor","rut","tipo","nº documento","neto","iva","total","categoría","método de pago","proyecto"];
  const normalizedRow = headerRow.map(normH);
  const exactMatch = knownHeaders.every((h,i) => normalizedRow[i] && normalizedRow[i].includes(normH(h)));
  if(exactMatch){
    // Use positional map directly
    const map = {};
    Object.entries(EXACT_HEADERS).forEach(([idx, field]) => { map[field] = Number(idx); });
    return map;
  }
  // 2. Fallback: alias matching
  const map = {};
  normalizedRow.forEach((norm, idx) => {
    for(const [field, aliases] of Object.entries(HEADER_ALIASES)){
      if(map[field] !== undefined) continue;
      if(aliases.some(a => norm === normH(a) || norm.includes(normH(a)))){
        map[field] = idx;
        break;
      }
    }
  });
  return map;
}

function toDateISO(val){
  if(val === null || val === undefined || val === "") return null;
  // Excel serial number
  if(typeof val === "number"){
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if(!isNaN(d)) return d.toISOString().slice(0,10);
  }
  const s = String(val).trim();
  if(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(s)){
    const [d,m,y] = s.split(/[-\/]/);
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  return null;
}

function toNum(val){
  if(val === null || val === undefined || val === "") return null;
  if(typeof val === "number") return val;
  const n = Number(String(val).replace(/\./g,"").replace(",",".").replace(/[^0-9.\-]/g,""));
  return Number.isFinite(n) ? n : null;
}

function isSkipRow(row, colMap){
  const proveedor = String(row[colMap.proveedor ?? 1] || "").trim().toLowerCase();
  const total     = String(row[colMap.total     ?? 7] || "").trim().toLowerCase();
  const neto      = String(row[colMap.neto      ?? 5] || "").trim().toLowerCase();
  // Skip title rows, header rows, total rows, empty rows
  if(!row.some(c => String(c||"").trim())) return true;
  if(["total","subtotal","totales","sub total"].includes(proveedor)) return true;
  if(["total","subtotal","totales","sub total"].includes(neto))      return true;
  if(proveedor === "proveedor" || proveedor === "supplier")          return true;
  return false;
}

function sheetToGastos(allRows, fotoPath){
  if(!allRows || allRows.length < 2) return [];

  // Find header row: first row where col 0 looks like "fecha" or col 1 like "proveedor"
  let headerRowIdx = -1;
  for(let i = 0; i < Math.min(5, allRows.length); i++){
    const r = allRows[i];
    const c0 = normH(r[0]);
    const c1 = normH(r[1]);
    if(c0 === "fecha" || c0.includes("fecha") || c1 === "proveedor" || c1.includes("proveedor")){
      headerRowIdx = i;
      break;
    }
  }
  if(headerRowIdx === -1){
    // No header found, try row 0 anyway
    headerRowIdx = 0;
  }

  const headerRow = allRows[headerRowIdx];
  const colMap = buildColMap(headerRow);

  // Need at minimum fecha or proveedor mapped
  if(colMap.fecha === undefined && colMap.proveedor === undefined){
    console.warn("No se encontraron columnas reconocibles en el Excel.");
    return [];
  }

  const results = [];
  for(let i = headerRowIdx + 1; i < allRows.length; i++){
    const row = allRows[i];
    if(isSkipRow(row, colMap)) continue;
    const get = field => colMap[field] !== undefined ? row[colMap[field]] : undefined;

    const fechaVal = toDateISO(get("fecha"));
    const neto     = toNum(get("neto"));
    const iva      = toNum(get("iva"));
    const total    = toNum(get("total"));

    // Skip rows with no usable data
    if(!fechaVal && !get("proveedor") && !neto) continue;

    // Detectar si es boleta por tipo_documento o por ausencia de neto/iva
    const tipoRaw = String(get("tipo_documento") || "").toLowerCase();
    const esBoleta = tipoRaw.includes("boleta") || tipoRaw.includes("be");

    let netoFinal, ivaFinal, totalFinal;
    if(esBoleta){
      // Boleta: IVA no recuperable → neto = total, iva = 0
      netoFinal  = (total !== null) ? total : (neto !== null ? neto : 0);
      ivaFinal   = 0;
      totalFinal = netoFinal;
    } else if(neto === null && iva === null && total !== null){
      // Sin neto ni IVA pero con total → asumir boleta exenta
      netoFinal  = total;
      ivaFinal   = 0;
      totalFinal = total;
    } else {
      netoFinal  = (neto  !== null) ? neto  : 0;
      ivaFinal   = (iva   !== null) ? iva   : 0;
      totalFinal = (total !== null) ? total : (netoFinal + ivaFinal);
    }

    results.push({
      fecha:            fechaVal || new Date().toISOString().slice(0,10),
      proveedor:        String(get("proveedor") || "").trim() || null,
      rut:              String(get("rut")        || "").trim() || null,
      tipo_documento:   String(get("tipo_documento")   || "").trim() || null,
      numero_documento: String(get("numero_documento") || "").trim() || null,
      neto:             netoFinal,
      iva:              ivaFinal,
      total:            totalFinal,
      categoria:        String(get("categoria")   || "").trim() || null,
      metodo_pago:      String(get("metodo_pago") || "").trim() || null,
      proyecto:         PROJECT_NAME,
      foto_path:        fotoPath,
      estado_ocr:       "importado"
    });
  }
  return results;
}

async function parseSpreadsheet(file, fotoPath){
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = window.XLSX.read(data, { type:"array", cellDates:false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Get raw values (not formatted strings) so numbers stay as numbers
        const allRows = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:"", raw:true });
        resolve(sheetToGastos(allRows, fotoPath));
      } catch(err){
        console.error("Error parseando Excel:", err);
        resolve([]);
      }
    };
    reader.onerror = () => resolve([]);
    reader.readAsArrayBuffer(file);
  });
}

async function parseCSV(file, fotoPath){
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const sep = text.includes(";") ? ";" : ",";
        const allRows = text.split(/\r?\n/)
          .filter(l => l.trim())
          .map(l => l.split(sep).map(c => c.replace(/^"|"$/g,"").trim()));
        resolve(sheetToGastos(allRows, fotoPath));
      } catch(err){
        console.error("Error parseando CSV:", err);
        resolve([]);
      }
    };
    reader.onerror = () => resolve([]);
    reader.readAsText(file, "UTF-8");
  });
}

async function handleFileUpload(event){
  const file = event.target.files?.[0];
  if(!file) return;

  const extension = getFileExtension(file.name);
  if(!ALLOWED_FILE_EXTENSIONS.includes(extension)){
    alert("Formato no permitido. Usa JPG, PNG, PDF, Excel o CSV.");
    event.target.value = ""; return;
  }
  if(file.size > MAX_FILE_SIZE_MB * 1024 * 1024){
    alert(`El archivo supera el máximo permitido de ${MAX_FILE_SIZE_MB} MB.`);
    event.target.value = ""; return;
  }
  if(typeof window.supabaseClient === "undefined"){
    alert("Supabase no está configurado.");
    event.target.value = ""; return;
  }
  if((["xls","xlsx","csv"].includes(extension)) && typeof window.XLSX === "undefined"){
    alert("La librería para leer Excel no está cargada. Verifica tu conexión a internet.");
    event.target.value = ""; return;
  }

  // ── Paso 1: parsear ANTES de subir (si es planilla) ──────────────────────
  const isSpreadsheet = ["xls","xlsx"].includes(extension);
  const isCSV = extension === "csv";

  let gastoRows = [];
  if(isSpreadsheet || isCSV){
    gastoRows = isCSV
      ? await parseCSV(file, null)   // fotoPath = null por ahora
      : await parseSpreadsheet(file, null);

    if(!gastoRows.length){
      alert("No se encontraron filas con datos reconocibles en el archivo.\n\nAsegúrate de que el Excel tenga encabezados en la fila 2:\nFecha | Proveedor | RUT | Tipo | Nº Documento | Neto | IVA | Total | Categoría | Método de Pago");
      event.target.value = ""; return;
    }
  }

  // ── Paso 2: subir archivo a Storage ──────────────────────────────────────
  const safeName  = sanitizeFileName(file.name);
  const fileGroup = getFileGroup(extension);
  const filePath  = `junquillar/${fileGroup}/${Date.now()}-${safeName}`;

  const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { cacheControl:"3600", upsert:false, contentType: file.type || undefined });

  if(uploadError){
    console.error("Error subiendo archivo:", uploadError);
    alert(`No se pudo subir el archivo: ${uploadError.message}`);
    event.target.value = ""; return;
  }

  const storedPath = uploadData.path;

  // ── Paso 3a: si es planilla → insertar filas en Supabase ─────────────────
  if(isSpreadsheet || isCSV){
    // Actualizar foto_path con el path real
    gastoRows.forEach(r => r.foto_path = storedPath);

    const BATCH = 50;
    let inserted = 0;
    for(let i = 0; i < gastoRows.length; i += BATCH){
      const batch = gastoRows.slice(i, i + BATCH);
      const { error } = await window.supabaseClient
        .from("gastos_junquillar_app")
        .insert(batch);
      if(error){
        console.error("Error insertando lote:", error);
        alert(`Se insertaron ${inserted} filas, luego error: ${error.message}`);
        event.target.value = "";
        await loadData(); return;
      }
      inserted += batch.length;
    }
    alert(`✅ ${inserted} registros importados desde "${file.name}".`);
    event.target.value = "";
    await loadData(); return;
  }

  // ── Paso 3b: imagen o PDF → registro pendiente OCR ───────────────────────
  const { error: insertError } = await window.supabaseClient
    .from("gastos_junquillar_app")
    .insert({
      fecha:       new Date().toISOString().slice(0,10),
      proyecto:    PROJECT_NAME,
      observacion: `Archivo adjunto: ${file.name}`,
      estado_ocr:  "pendiente",
      foto_path:   storedPath
    });

  if(insertError){
    console.error("Error creando registro:", insertError);
    alert(`Archivo subido pero no se pudo crear el registro: ${insertError.message}`);
    event.target.value = ""; return;
  }

  alert("📎 Archivo adjuntado correctamente.");
  event.target.value = "";
  await loadData();
}
function setupFileUpload(){
  const input = $("file-input");
  const selectLink = $("select-file-link");
  const btnAdjuntar = $("btn-adjuntar");
  const btnFoto = $("btn-foto");
  const dropzone = $("dropzone");
  if(!input) return;
  input.addEventListener("change", handleFileUpload);
  if(selectLink) selectLink.addEventListener("click", () => input.click());
  if(btnAdjuntar) btnAdjuntar.addEventListener("click", () => input.click());
  if(btnFoto) btnFoto.addEventListener("click", () => input.click());
  if(dropzone){
    dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", async e => {
      e.preventDefault(); dropzone.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if(!file) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      await handleFileUpload({ target: input });
    });
  }
}

async function loadData(){
  if(typeof window.supabaseClient === "undefined"){
    console.warn("Supabase no está configurado. Dashboard vacío.");
    gastos = []; filteredDocs = []; renderAll(); return;
  }
  const { data, error } = await window.supabaseClient
    .from("gastos_junquillar_app")
    .select("*")
    .eq("proyecto", PROJECT_NAME)
    .order("fecha", { ascending:false })
    .order("created_at", { ascending:false });
  if(error){ console.error("Error cargando gastos:", error); gastos=[]; filteredDocs=[]; renderAll(); return; }
  gastos = (data || []).map(mapSupabaseRow);
  filteredDocs = [...gastos];
  renderAll();
}

function renderKPIs(){
  const el = $("section-kpis"); if(!el) return;
  const t = getTotals(); const avance = PROJECT_BUDGET ? (t.neto / PROJECT_BUDGET) * 100 : 0;
  const kpis = [
    ["Inversión total neta", formatoCLP(t.neto), formatoPct(avance), `${t.docs} documentos registrados`],
    ["IVA crédito fiscal", formatoCLP(t.iva), t.iva > 0 ? "CF" : "0", "Calculado desde IVA registrado"],
    ["Total documentos", formatoCLP(t.total), `${t.proveedores} prov.`, "Total bruto acumulado"],
    ["Pendientes OCR", String(t.pendientesOcr), t.pendientesOcr > 0 ? "pend." : "ok", `${t.sinProveedor} registros sin proveedor`]
  ];
  el.innerHTML = kpis.map(k => `<div class="kpi-card"><div class="kpi-top"><div><div class="kpi-title">${k[0]}</div><div class="kpi-value">${k[1]}</div></div><span class="badge up">${k[2]}</span></div><div class="kpi-footer">${k[3]}</div></div>`).join("");
  const sidebarBig = document.querySelector(".sidebar-card .big");
  const sidebarSub = document.querySelector(".sidebar-card .sub");
  const sidebarFill = document.querySelector(".sidebar-card .progress-fill");
  if(sidebarBig) sidebarBig.textContent = formatoPct(avance);
  if(sidebarSub) sidebarSub.textContent = `${formatoCLP(t.neto)} de ${formatoCLP(PROJECT_BUDGET)} ejecutado`;
  if(sidebarFill) sidebarFill.style.width = `${Math.min(avance,100)}%`;
}
function renderAlerts(){
  const el = $("alerts-list"); if(!el) return;
  if(!gastos.length){ el.innerHTML = emptyState("Sin alertas. No hay gastos registrados."); return; }
  const t = getTotals();
  const alerts = [
    ["📄", `${t.pendientesOcr} documentos pendientes OCR`, "Registros que aún requieren lectura o revisión documental."],
    ["⚠️", `${t.sinProveedor} registros incompletos`, "Gastos sin proveedor registrado o con datos pendientes."],
    ["💵", `${formatoCLP(t.iva)} de IVA crédito fiscal`, "Monto calculado desde los documentos registrados."],
    ["📊", `${formatoPct(PROJECT_BUDGET ? (t.neto/PROJECT_BUDGET)*100 : 0)} de avance financiero`, "Avance calculado contra presupuesto referencial."]
  ];
  el.innerHTML = alerts.map(a => `<div class="alert-item"><div class="alert-icon">${a[0]}</div><div><div class="alert-title">${a[1]}</div><div class="alert-sub">${a[2]}</div></div></div>`).join("");
}
function renderBottomCards(){
  const el = $("section-bottom"); if(!el) return;
  const t = getTotals(); const ultima = gastos.length ? normalizarFecha(gastos[0].fecha) : "—";
  const cards = [["Proveedores",t.proveedores,"Únicos registrados","🏢"],["Último registro",ultima,"Según fecha de gasto","📅"],["Total bruto",formatoCLP(t.total),"Neto + IVA","💼"],["Avance presupuesto",formatoPct(PROJECT_BUDGET ? (t.neto/PROJECT_BUDGET)*100 : 0),"Contra presupuesto referencial","📈"]];
  el.innerHTML = cards.map(c => `<div class="bottom-card"><div class="bottom-top"><div class="bottom-label">${c[0]}</div><div class="bottom-icon">${c[3]}</div></div><div class="bottom-value">${c[1]}</div><div class="bottom-sub">${c[2]}</div></div>`).join("");
}
function renderDocs(limit = docsVisibleLimit){
  const el=$("docs-table"), subtitle=$("docs-subtitle"), btn=$("load-more-btn"); if(!el) return;
  if(subtitle) subtitle.textContent = `${filteredDocs.length} registros · datos cargados desde Supabase`;
  if(!filteredDocs.length){ el.innerHTML = emptyState("No hay gastos registrados en Supabase."); if(btn) btn.style.display="none"; return; }
  el.innerHTML = filteredDocs.slice(0, limit).map(docRowFromGasto).map(d => `<div class="table-row gastos-row"><div>${d.date}</div><div><div class="doc-name">${d.name}</div><div class="doc-amount">${d.observacion || ""}</div></div><div>${d.rut}</div><div>${d.tipo}</div><div><span class="cat-badge ${d.catCls}">${d.cat}</span></div><div>${d.costo}</div><div>${d.iva}</div><div>${d.total}</div><div>${d.cf}</div><div>${d.pago}</div><div>${d.fotoPath ? "📎" : "—"}</div></div>`).join("");
  if(btn) btn.style.display = filteredDocs.length > limit ? "inline-flex" : "none";
}
function applyFilters(){
  const text = (($("filter-text")?.value || $("filter-text-gastos")?.value || $("global-search")?.value || "")).toLowerCase().trim();
  const cat = $("filter-cat")?.value || ""; const tipo=$("filter-tipo")?.value || ""; const desde=$("filter-desde")?.value || ""; const hasta=$("filter-hasta")?.value || ""; const pago=$("filter-pago")?.value || "";
  filteredDocs = gastos.filter(g => {
    const hayTexto = [g.proveedor,g.rut,g.tipo_documento,g.numero_documento,g.categoria,g.metodo_pago,g.observacion].join(" ").toLowerCase(); const f = fechaOrdenable(g.fecha);
    if(text && !hayTexto.includes(text)) return false; if(cat && g.categoria !== cat) return false; if(tipo && g.tipo_documento !== tipo) return false; if(pago && g.metodo_pago !== pago) return false; if(desde && f < desde) return false; if(hasta && f > hasta) return false; return true;
  });
  docsVisibleLimit=10; renderDocs();
}
function clearFilters(){
  ["filter-text","filter-text-gastos","global-search","filter-cat","filter-tipo","filter-desde","filter-hasta","filter-pago"].forEach(id => { const el=$(id); if(el) el.value=""; });
  filteredDocs=[...gastos]; docsVisibleLimit=10; renderDocs();
}
function renderProveedores(){
  const el=$("proveedores-table"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin proveedores. No hay gastos registrados."); return; }
  const groups=groupBy(gastos,g=>g.proveedor||"Pendiente OCR"), totalNeto=sumBy(gastos,"neto");
  el.innerHTML = Object.entries(groups).map(([name,rows]) => ({name, rut:rows.find(r=>r.rut)?.rut||"—", cat:rows.find(r=>r.categoria)?.categoria||"Sin categoría", docs:rows.length, costo:sumBy(rows,"neto"), iva:sumBy(rows,"iva")})).sort((a,b)=>b.costo-a.costo).slice(0,20).map((p,i)=>`<div class="table-row prov-row"><div>${i+1}</div><div class="doc-name">${p.name}</div><div>${p.rut}</div><div><span class="cat-badge ${getCategoriaClass(p.cat)}">${p.cat}</span></div><div>${p.docs}</div><div>${formatoCLP(p.costo)}</div><div>${formatoCLP(p.iva)}</div><div>${formatoPct(totalNeto ? (p.costo/totalNeto)*100 : 0)}</div></div>`).join("");
}
function renderCaja(){ renderCajaKpis(); renderCajaTipos(); renderCajaMensual(); }
function renderCajaKpis(){
  const el=$("caja-kpis"); if(!el) return; const t=getTotals(); const docsConIva = gastos.filter(g=>numberValue(g.iva)>0).length;
  const cards = [["Costo neto registrado",formatoCLP(t.neto),`${t.docs} documentos registrados`],["IVA crédito fiscal",formatoCLP(t.iva),"Calculado desde IVA registrado"],["Total documentos",formatoCLP(t.total),"Neto + IVA"],["Docs con IVA",docsConIva,"Documentos con crédito fiscal"]];
  el.innerHTML = cards.map(c=>`<div class="kpi-card"><div class="kpi-top"><div><div class="kpi-title">${c[0]}</div><div class="kpi-value">${c[1]}</div></div></div><div class="kpi-footer">${c[2]}</div></div>`).join("");
}
function renderCajaTipos(){
  const el=$("caja-tipos"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin información tributaria. No hay gastos registrados."); return; }
  const groups=groupBy(gastos,g=>g.tipo_documento||"Sin tipo");
  el.innerHTML=Object.entries(groups).map(([tipo,rows])=>`<div class="table-row caja-tipos-row"><div>${tipo}</div><div>${rows.length}</div><div>${formatoCLP(sumBy(rows,"neto"))}</div><div>${formatoCLP(sumBy(rows,"iva"))}</div><div>${sumBy(rows,"iva")>0?"✔":"—"}</div><div>${sumBy(rows,"iva")>0?"IVA Crédito Fiscal registrado":"Sin IVA registrado"}</div></div>`).join("");
}
function renderCajaMensual(){
  const el=$("caja-mensual"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin detalle mensual."); return; }
  const groups=groupBy(gastos,g=>mesLabel(g.fecha)); let acum=0;
  el.innerHTML=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([mes,rows])=>{ const iva=sumBy(rows,"iva"); acum+=iva; return `<div class="table-row caja-mensual-row"><div>${mes}</div><div>${rows.filter(r=>numberValue(r.iva)>0).length}</div><div>${formatoCLP(sumBy(rows,"neto"))}</div><div>${formatoCLP(iva)}</div><div>${formatoCLP(acum)}</div></div>`; }).join("");
}
function renderBalance(){
  const el = $("balance-table");
  if(!el) return;
  const t = getTotals();
  if(!gastos.length){
    el.innerHTML = emptyState("Balance sin movimientos. No hay gastos registrados.");
    return;
  }

  // ── Constantes fijas ────────────────────────────────────────
  const TERRENO      = 100000000;
  const APORTE_SOCIO =  60000000;

  // ── Cálculos contables ──────────────────────────────────────
  // ACTIVOS
  const activoTerreno = TERRENO;
  const activoObra    = t.neto;
  const activoIvaCF   = t.iva;
  const totalActivo   = activoTerreno + activoObra + activoIvaCF;

  // PASIVOS
  // La cuenta por pagar al socio financia el terreno ($100M) y parte de la obra.
  // Gastos por pagar = total bruto de documentos (neto + IVA).
  // Para cuadrar: total DEBE = total HABER
  //   DEBE  = Terreno + Obra + IVA CF = totalActivo
  //   HABER = Aporte Socio + Gastos por pagar
  // Gastos por pagar = totalActivo - APORTE_SOCIO
  const pasivoSocio   = APORTE_SOCIO;
  const pasivoGastos  = t.total;   // documentos registrados
  const totalPasivo   = pasivoSocio + pasivoGastos;

  // Para cuadre perfecto el DEBE total debe ser igual al HABER total
  // DEBE: Terreno + Obra + IVA = totalActivo
  // HABER: Socio + Gastos = totalPasivo
  // Diferencia → va a "Patrimonio / Capital pendiente" si existe
  const diferencia = totalActivo - totalPasivo;

  const clp = v => formatoCLP(v);
  const z   = () => `<span style="color:#94a3b8">$0</span>`;

  const cell = (v, color) => {
    if(!v || v === 0) return z();
    const s = clp(v);
    return color ? `<span style="color:${color};font-weight:600">${s}</span>` : s;
  };

  // ── Fila normal ──────────────────────────────────────────────
  // cols: N° | Cuenta | DEBE | HABER | DEUDOR | ACREEDOR | ACTIVO | PASIVO | PÉRDIDA | GANANCIA
  const row = (n, cuenta, debe, haber, deudor, acreedor, activo, pasivo, perdida, ganancia, extra="") =>
    `<div class="bal-row${extra}">
      <div class="bal-n">${n}</div>
      <div class="bal-cuenta">${cuenta}</div>
      <div class="bal-num">${cell(debe)}</div>
      <div class="bal-num">${cell(haber)}</div>
      <div class="bal-num">${cell(deudor)}</div>
      <div class="bal-num">${cell(acreedor)}</div>
      <div class="bal-num">${cell(activo, "#059669")}</div>
      <div class="bal-num">${cell(pasivo)}</div>
      <div class="bal-num">${cell(perdida, "#e11d48")}</div>
      <div class="bal-num">${cell(ganancia, "#059669")}</div>
    </div>`;

  const secHead = label =>
    `<div class="bal-section">${label}</div>`;

  el.innerHTML = `
    <div class="bal-wrap">

      <div class="bal-group-head">
        <div class="bal-gh-spacer"></div>
        <div class="bal-gh-group">MOVIMIENTOS</div>
        <div class="bal-gh-group">SALDOS</div>
        <div class="bal-gh-group">BALANCE</div>
        <div class="bal-gh-group">RESULTADOS</div>
      </div>

      <div class="bal-col-head">
        <div class="bal-n">N°</div>
        <div class="bal-cuenta">Cuenta</div>
        <div class="bal-num">DEBE</div>
        <div class="bal-num">HABER</div>
        <div class="bal-num">DEUDOR</div>
        <div class="bal-num">ACREEDOR</div>
        <div class="bal-num">ACTIVO</div>
        <div class="bal-num">PASIVO</div>
        <div class="bal-num">PÉRDIDA</div>
        <div class="bal-num">GANANCIA</div>
      </div>

      ${secHead("ACTIVOS")}
      ${row("1", "Terreno (Valor de adquisición)",
          activoTerreno, 0, activoTerreno, 0, activoTerreno, 0, 0, 0)}
      ${row("2", "Obra en Curso (Costos netos)",
          activoObra, 0, activoObra, 0, activoObra, 0, 0, 0)}
      ${row("3", "IVA Crédito Fiscal",
          activoIvaCF, 0, activoIvaCF, 0, activoIvaCF, 0, 0, 0)}

      ${secHead("PASIVOS")}
      ${row("4", "Cuenta por pagar al Socio",
          0, pasivoSocio, 0, pasivoSocio, 0, pasivoSocio, 0, 0)}
      ${row("5", "Gastos por pagar / Cuentas por pagar",
          0, pasivoGastos, 0, pasivoGastos, 0, pasivoGastos, 0, 0)}
      ${diferencia !== 0 ? row("6",
          diferencia > 0 ? "Capital / Patrimonio pendiente" : "Ajuste por diferencia",
          diferencia > 0 ? diferencia : 0,
          diferencia < 0 ? Math.abs(diferencia) : 0,
          diferencia > 0 ? diferencia : 0,
          diferencia < 0 ? Math.abs(diferencia) : 0,
          0, 0,
          diferencia < 0 ? Math.abs(diferencia) : 0,
          diferencia > 0 ? diferencia : 0) : ""}

      <div class="bal-row bal-total">
        <div class="bal-n"></div>
        <div class="bal-cuenta">TOTAL</div>
        <div class="bal-num">${clp(totalActivo)}</div>
        <div class="bal-num">${clp(totalPasivo + (diferencia > 0 ? diferencia : 0))}</div>
        <div class="bal-num">${clp(totalActivo)}</div>
        <div class="bal-num">${clp(totalPasivo + (diferencia > 0 ? diferencia : 0))}</div>
        <div class="bal-num">${clp(totalActivo)}</div>
        <div class="bal-num">${clp(totalPasivo)}</div>
        <div class="bal-num">$0</div>
        <div class="bal-num">$0</div>
      </div>

    </div>
  `;

  const prevNote = el.parentElement.querySelector(".balance-note");
  if(prevNote) prevNote.remove();
  el.insertAdjacentHTML("afterend",
    `<div class="balance-note">⚠️ Valores calculados automáticamente desde documentos registrados. No reemplaza revisión contable formal.</div>`
  );
}

function renderControlProyecto(){ renderControlKpis(); renderControlEtapas(); renderControlHitos(); renderControlCat(); }
function renderControlKpis(){
  const el=$("control-kpis"); if(!el) return; const t=getTotals(); const avance = PROJECT_BUDGET ? (t.neto/PROJECT_BUDGET)*100 : 0;
  const cards = [["Avance financiero",formatoPct(avance),`${formatoCLP(t.neto)} ejecutado`],["Presupuesto referencial",formatoCLP(PROJECT_BUDGET),"Base de comparación"],["Saldo estimado",formatoCLP(Math.max(PROJECT_BUDGET-t.neto,0)),"Presupuesto menos neto ejecutado"],["Partidas con gasto",uniqueCount(gastos,"categoria"),"Categorías registradas"]];
  el.innerHTML = cards.map(c=>`<div class="kpi-card"><div class="kpi-title">${c[0]}</div><div class="kpi-value">${c[1]}</div><div class="kpi-footer">${c[2]}</div></div>`).join("");
}
function renderControlEtapas(){
  const el=$("control-etapas"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin avance registrado. No hay gastos para calcular etapas."); return; }
  const groups=groupBy(gastos,g=>g.categoria||"Sin categoría"), total=sumBy(gastos,"neto");
  el.innerHTML=Object.entries(groups).map(([cat,rows])=>{ const monto=sumBy(rows,"neto"), pct=total?(monto/total)*100:0; return `<div class="etapa-card"><div class="etapa-title">${cat}</div><div class="etapa-value">${formatoCLP(monto)}</div><div class="cat-track"><div class="cat-fill" style="width:${Math.min(pct,100)}%"></div></div><div class="etapa-sub">${formatoPct(pct)} del gasto registrado</div></div>`; }).join("");
}
function renderControlHitos(){
  const el=$("control-hitos"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin hitos calculados. No hay gastos registrados."); return; }
  const t=getTotals(); const hitos = [["Documentación", t.pendientesOcr>0?"Pendiente":"Completo", `${t.pendientesOcr} documentos pendientes OCR`],["Presupuesto", t.neto>PROJECT_BUDGET?"Sobre presupuesto":"En control", `${formatoCLP(t.neto)} ejecutado`],["Proveedores", t.proveedores>0?"Con actividad":"Sin actividad", `${t.proveedores} proveedores registrados`]];
  el.innerHTML=hitos.map(h=>`<div class="hito-row"><div class="doc-name">${h[0]}</div><div><span class="status ${h[1]==="En control"||h[1]==="Completo"||h[1]==="Con actividad"?"s-green":"s-amber"}">${h[1]}</span></div><div>${h[2]}</div></div>`).join("");
}
function renderControlCat(){
  const el=$("control-cat"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin costos por categoría."); return; }
  const catGroups=groupBy(gastos,g=>g.categoria||"Sin categoría"), total=sumBy(gastos,"neto"), months=[...new Set(gastos.map(g=>mesLabel(g.fecha)))].sort();
  el.innerHTML=Object.entries(catGroups).map(([cat,rows])=>{ const byMonth=groupBy(rows,r=>mesLabel(r.fecha)), catTotal=sumBy(rows,"neto"); const vals=Array.from({length:5}).map((_,i)=>`<div>${months[i]?formatoCLP(sumBy(byMonth[months[i]]||[],"neto")):"—"}</div>`).join(""); return `<div class="table-row ctrl-cat-row"><div><span class="cat-badge ${getCategoriaClass(cat)}">${cat}</span></div><div>Gasto</div>${vals}<div>${formatoCLP(catTotal)}</div><div>${formatoPct(total?(catTotal/total)*100:0)}</div></div>`; }).join("");
}
function renderReportes(){ renderReportesCat(); renderReportesEtapas(); }
function renderReportesCat(){
  const el=$("reportes-cat"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin reporte por categoría."); return; }
  const groups=groupBy(gastos,g=>g.categoria||"Sin categoría"), total=sumBy(gastos,"neto");
  el.innerHTML=Object.entries(groups).map(([cat,rows])=>({cat,monto:sumBy(rows,"neto"),docs:rows.length})).sort((a,b)=>b.monto-a.monto).map(r=>`<div class="report-row"><div class="report-label">${r.cat}</div><div class="report-value">${formatoCLP(r.monto)}</div><div class="cat-track"><div class="cat-fill" style="width:${Math.min(total?(r.monto/total)*100:0,100)}%"></div></div><div class="report-sub">${r.docs} docs · ${formatoPct(total?(r.monto/total)*100:0)}</div></div>`).join("");
}
function renderReportesEtapas(){
  const el=$("reportes-etapas"); if(!el) return; if(!gastos.length){ el.innerHTML=emptyState("Sin reporte mensual."); return; }
  const groups=groupBy(gastos,g=>mesLabel(g.fecha));
  el.innerHTML=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([mes,rows])=>`<div class="report-row"><div class="report-label">${mes}</div><div class="report-value">${formatoCLP(sumBy(rows,"neto"))}</div><div class="report-sub">${rows.length} documentos · IVA ${formatoCLP(sumBy(rows,"iva"))}</div></div>`).join("");
}
function updateVisibleSections(ids=[]){ document.querySelectorAll(".module-block").forEach(s=>s.classList.add("module-hidden")); ids.forEach(id=>$(id)?.classList.remove("module-hidden")); }
function setupNavigation(){
  const buttons=document.querySelectorAll(".nav-btn"), title=$("page-title"), subtitle=$("page-subtitle");
  buttons.forEach(button=>button.addEventListener("click",()=>{ buttons.forEach(btn=>btn.classList.remove("active")); button.classList.add("active"); currentView=button.dataset.view; const view=views[currentView]||views.resumen; if(title) title.textContent=view.title; if(subtitle) subtitle.textContent=view.subtitle; updateVisibleSections(view.visible); docsVisibleLimit=(currentView==="gastos"||currentView==="documentos")?10:3; renderDocs(docsVisibleLimit); }));
  $("btn-ver-reportes")?.addEventListener("click",()=>document.querySelector('[data-view="reportes"]')?.click());
}
function renderAll(){ renderKPIs(); renderAlerts(); renderBottomCards(); renderDocs(docsVisibleLimit); renderProveedores(); renderCaja(); renderBalance(); renderControlProyecto(); renderReportes(); }
function rowsToCSV(rows){
  const headers=["fecha","proveedor","rut","tipo_documento","numero_documento","categoria","neto","iva","total","metodo_pago","estado_ocr","foto_path"];
  const esc = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  return [headers.join(";"), ...rows.map(r=>headers.map(h=>esc(r[h])).join(";"))].join("\n");
}
function downloadText(filename,text){ const blob=new Blob([text],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }
function exportCSV(){ downloadText("gastos_junquillar.csv", rowsToCSV(filteredDocs)); }
function setupButtons(){
  $("load-more-btn")?.addEventListener("click",()=>{ docsVisibleLimit += 20; renderDocs(docsVisibleLimit); });
  $("btn-aplicar-filtros")?.addEventListener("click",applyFilters);
  $("btn-limpiar-filtros")?.addEventListener("click",clearFilters);
  $("btn-export-csv")?.addEventListener("click",exportCSV);
  $("btn-export-excel")?.addEventListener("click",exportCSV);
  ["filter-text","filter-text-gastos","global-search"].forEach(id => $(id)?.addEventListener("input", applyFilters));
}
function initDashboard(){ setupNavigation(); setupFileUpload(); setupButtons(); updateVisibleSections(views.resumen.visible); loadData(); }
document.addEventListener("DOMContentLoaded", initDashboard);
