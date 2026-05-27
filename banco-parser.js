/* ── JUNQO · BANCO PARSER ─────────────────────────────────────
   Parser robusto para cartolas bancarias chilenas.
   Soporta: Banco Chile, Santander, BCI, Estado, Scotiabank.
   Detecta columnas automáticamente aunque cambien de nombre.
   ─────────────────────────────────────────────────────────── */

/* ── Mapas de alias por campo ─────────────────────────────── */
const BANCO_ALIASES = {
  fecha:       ["fecha","fec","date","f.","fecha valor","fecha mov","fecha transaccion","fecha transacción"],
  descripcion: ["descripcion","descripción","glosa","detalle","movimiento","concepto","referencia","motivo","descripcion operacion","descripción operación","narrativa","texto"],
  cargo:       ["cargo","egreso","debe","retiro","débito","debito","monto egreso","importe debe","salida","gasto","out","debit"],
  abono:       ["abono","ingreso","haber","depósito","deposito","monto ingreso","importe haber","entrada","in","credit","crédito","credito"],
  monto:       ["monto","importe","valor","total","amount","saldo movimiento","mto.","mto"],
  saldo:       ["saldo","balance","saldo final","saldo disponible","saldo contable"],
};

/* ── Normalizar header: minúsculas, sin tildes, sin espacios extra ── */
function normBancoH(h) {
  return String(h || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Parsear número chileno: $1.234.567,89 → 1234567.89 ──── */
function parseCLP(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\$/g, "").replace(/\s/g, "");
  // Formato chileno: puntos = miles, coma = decimal
  const clean = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

/* ── Parsear fecha ────────────────────────────────────────── */
function parseBancoFecha(v) {
  if (!v && v !== 0) return null;
  // Excel serial number
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // DD/MM/YYYY o DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
    const [d, m, y] = s.split(/[\/\-]/);
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split(".");
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  return null;
}

/* ── Detectar mapa de columnas ────────────────────────────── */
function buildBancoColMap(headerRow) {
  const normed = headerRow.map(normBancoH);
  const map = {};

  for (const [field, aliases] of Object.entries(BANCO_ALIASES)) {
    for (let i = 0; i < normed.length; i++) {
      const h = normed[i];
      if (!h) continue;
      if (aliases.some(a => h === a || h.startsWith(a) || h.includes(a))) {
        if (map[field] === undefined) map[field] = i;
      }
    }
  }

  console.log("[Junqo BancoParser] Columnas detectadas:", map);
  return map;
}

/* ── Encontrar fila de encabezado ─────────────────────────── */
function findBancoHeaderRow(rows) {
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const normed = rows[i].map(normBancoH);
    const hasFecha = normed.some(h => h.includes("fecha") || h.includes("fec") || h === "date");
    const hasGlosa = normed.some(h =>
      ["glosa","descripcion","descripción","detalle","movimiento","concepto"].some(a => h.includes(a))
    );
    if (hasFecha && hasGlosa) return i;
  }
  return -1;
}

/* ── Convertir filas a movimientos_banco ─────────────────── */
function sheetToMovimientosBanco(rows, proyecto = "Junquillar") {
  if (!rows || rows.length < 2) return [];

  const hi = findBancoHeaderRow(rows);
  if (hi === -1) {
    console.warn("[Junqo BancoParser] No se encontró fila de encabezado.");
    return [];
  }

  const cm = buildBancoColMap(rows[hi]);

  // Necesitamos al menos fecha y algún campo de monto
  const tieneFecha  = cm.fecha !== undefined;
  const tieneMonto  = cm.cargo !== undefined || cm.abono !== undefined || cm.monto !== undefined;
  if (!tieneFecha || !tieneMonto) {
    console.warn("[Junqo BancoParser] Columnas insuficientes:", cm);
    return [];
  }

  const result = [];
  let skipped = 0;

  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];

    // Saltar filas vacías o de totales
    if (!row || !row.some(c => String(c || "").trim())) { skipped++; continue; }
    const primeraCelda = normBancoH(row[0]);
    if (["total","subtotal","totales","saldo","balance"].includes(primeraCelda)) { skipped++; continue; }

    const get = f => (cm[f] !== undefined ? row[cm[f]] : undefined);

    const fecha = parseBancoFecha(get("fecha"));
    if (!fecha) { skipped++; continue; }

    const descripcion = String(get("descripcion") || "Sin descripción").trim();

    // Determinar monto y tipo
    let monto = null;
    let tipo = null;

    const rawCargo = parseCLP(get("cargo"));
    const rawAbono = parseCLP(get("abono"));
    const rawMonto = parseCLP(get("monto"));

    if (cm.cargo !== undefined && cm.abono !== undefined) {
      // Dos columnas separadas cargo/abono
      if (rawCargo && rawCargo > 0) { monto = rawCargo; tipo = "cargo"; }
      else if (rawAbono && rawAbono > 0) { monto = rawAbono; tipo = "abono"; }
    } else if (cm.monto !== undefined) {
      // Una sola columna de monto: negativo = cargo, positivo = abono
      if (rawMonto !== null) {
        monto = Math.abs(rawMonto);
        tipo  = rawMonto < 0 ? "cargo" : "abono";
      }
    }

    if (!monto || monto === 0) { skipped++; continue; }

    result.push({
      fecha,
      descripcion,
      monto,
      tipo,
      estado:  tipo === "abono" ? "Recibido" : "Pagado",
      proyecto,
    });
  }

  console.log(`[Junqo BancoParser] ${result.length} movimientos parseados, ${skipped} filas omitidas.`);
  return result;
}

/* ── Parsear Excel de cartola ─────────────────────────────── */
async function parseSpreadsheetBanco(file, proyecto = "Junquillar") {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = window.XLSX.read(data, { type: "array", cellDates: false });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
        res(sheetToMovimientosBanco(rows, proyecto));
      } catch (err) {
        console.error("[Junqo BancoParser] Error Excel:", err);
        res([]);
      }
    };
    r.onerror = () => res([]);
    r.readAsArrayBuffer(file);
  });
}

/* ── Parsear CSV de cartola ───────────────────────────────── */
async function parseCSVBanco(file, proyecto = "Junquillar") {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => {
      try {
        const text = e.target.result;
        const sep  = text.includes(";") ? ";" : ",";
        const rows = text
          .split(/\r?\n/)
          .filter(l => l.trim())
          .map(l => l.split(sep).map(c => c.replace(/^"|"$/g, "").trim()));
        res(sheetToMovimientosBanco(rows, proyecto));
      } catch (err) {
        console.error("[Junqo BancoParser] Error CSV:", err);
        res([]);
      }
    };
    r.onerror = () => res([]);
    r.readAsText(file, "UTF-8");
  });
}

/* ── Exponer al scope global ──────────────────────────────── */
window.parseSpreadsheetBanco  = parseSpreadsheetBanco;
window.parseCSVBanco          = parseCSVBanco;
window.sheetToMovimientosBanco = sheetToMovimientosBanco;

/* ── PDF PARSER — Cartolas bancarias chilenas ─────────────────
   Especializado para Santander Officebanking y formatos similares.
   Usa posición X de cada celda para determinar CARGO vs ABONO.
   ─────────────────────────────────────────────────────────── */

/* Cargar pdf.js desde CDN de forma dinámica */
async function _loadPdfJs() {
  if (window._pdfjsLib) return window._pdfjsLib;
  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs");
    mod.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
    window._pdfjsLib = mod;
    return mod;
  } catch(e) {
    console.error("[BancoParser] pdf.js no disponible:", e);
    return null;
  }
}

/* Parsear número chileno: "$5.317.412" → 5317412 */
function _parseMontoCLP(str) {
  if (!str) return null;
  const clean = String(str)
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")    // miles
    .replace(/,(\d{1,2})$/, ".$1"); // decimal
  const n = parseFloat(clean);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Convertir fecha DD/MM/YYYY → YYYY-MM-DD */
function _parseFechaCL(str) {
  const m = String(str || "").match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  return `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

/* Normalizar texto para comparación */
function _norm(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim();
}

/*
 * Extraer items de texto de todas las páginas con sus coordenadas (x, y, text).
 * Agrupa por fila usando Y con tolerancia de 4px.
 */
async function _extractPageItems(pdf) {
  const allRows = []; // Array de { y, items: [{x, text}] }

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const height  = page.view[3]; // alto de página para invertir Y

    // Agrupar items por fila (Y redondeado a múltiplo de 4)
    const rowMap = {};
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const rawY = height - item.transform[5]; // invertir: 0 = arriba
      const key  = Math.round(rawY / 4) * 4;
      if (!rowMap[key]) rowMap[key] = { y: rawY, pageY: p * 10000 + key, items: [] };
      rowMap[key].items.push({ x: Math.round(item.transform[4]), text: item.str.trim() });
    }

    // Ordenar items dentro de cada fila por X
    for (const row of Object.values(rowMap)) {
      row.items.sort((a, b) => a.x - b.x);
      allRows.push(row);
    }
  }

  // Ordenar filas por posición vertical (pageY)
  allRows.sort((a, b) => a.pageY - b.pageY);
  return allRows;
}

/*
 * Detectar posición X de columnas CARGO y ABONO buscando la fila de encabezado.
 * Retorna { xCargo, xAbono } o null si no se encuentra.
 */
function _detectColumnPositions(rows) {
  const HEADERS = ["fecha", "cargo", "abono", "descripcion", "descripción", "saldo"];

  for (const row of rows) {
    const texts = row.items.map(i => _norm(i.text));
    const hasFecha  = texts.some(t => t === "fecha");
    const hasCargo  = texts.some(t => t === "cargo");
    const hasAbono  = texts.some(t => t === "abono");

    if (hasFecha && hasCargo && hasAbono) {
      const xCargo = row.items.find(i => _norm(i.text) === "cargo")?.x ?? null;
      const xAbono = row.items.find(i => _norm(i.text) === "abono")?.x ?? null;
      const xSaldo = row.items.find(i => _norm(i.text) === "saldo")?.x ?? null;
      console.log(`[BancoParser] Header encontrado → CARGO x=${xCargo}, ABONO x=${xAbono}, SALDO x=${xSaldo}`);
      return { xCargo, xAbono, xSaldo };
    }
  }
  return null;
}

/* Regex fecha DD/MM/YYYY al inicio de texto */
const R_FECHA = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
/* Regex para un monto chileno: $ 5.317.412 */
const R_MONTO = /^\$?\s*[\d\.]+(?:,\d{1,2})?$/;

/*
 * Parsear una fila de datos usando posiciones de columnas.
 * items: [{x, text}] ya ordenados por X.
 * cols: { xCargo, xAbono, xSaldo }
 */
function _parseDataRow(items, cols, proyecto) {
  if (!items.length) return null;

  // Primer item debe ser fecha
  const fechaStr = items[0].text;
  if (!R_FECHA.test(fechaStr)) return null;

  const fecha = _parseFechaCL(fechaStr);
  if (!fecha) return null;

  // Buscar montos: items con texto que parezca número $
  const montos = items.filter(i => R_MONTO.test(i.text.replace(/\s/g, "")));

  // Si tenemos posiciones de columna, usarlas para clasificar
  let monto = null, tipo = null;

  if (cols && cols.xCargo !== null && cols.xAbono !== null) {
    const tolerancia = 60; // px de tolerancia para asignar columna

    for (const m of montos) {
      const val = _parseMontoCLP(m.text);
      if (!val) continue;

      // Saltar si está en la columna SALDO (demasiado a la derecha)
      if (cols.xSaldo && m.x > cols.xSaldo - tolerancia) continue;

      const distCargo = Math.abs(m.x - cols.xCargo);
      const distAbono = Math.abs(m.x - cols.xAbono);

      if (distCargo < tolerancia || distAbono < tolerancia) {
        monto = val;
        tipo  = distCargo < distAbono ? "cargo" : "abono";
        break; // tomar el primero válido
      }
    }
  } else {
    // Sin posiciones de columna: usar el primer monto y heurística de texto
    const lower = items.map(i => i.text).join(" ").toLowerCase();
    const esCargo = /transf a|cargo|retiro|pago|egreso|débito|debito|comision/.test(lower);
    const esAbono = /transf de|abono|depósito|deposito|ingreso|crédito|credito/.test(lower);

    for (const m of montos) {
      const val = _parseMontoCLP(m.text);
      if (val) { monto = val; break; }
    }
    tipo = esCargo ? "cargo" : (esAbono ? "abono" : "cargo");
  }

  if (!monto) return null;

  // Descripción: texto que no sea fecha ni número
  const descripcion = items
    .filter(i => !R_FECHA.test(i.text) && !R_MONTO.test(i.text.replace(/\s/g, "")))
    .map(i => i.text)
    .join(" ")
    .trim() || "Movimiento bancario";

  return { fecha, descripcion, monto, tipo, estado: tipo === "abono" ? "Recibido" : "Pagado", proyecto };
}

/*
 * Función principal: parsear PDF de cartola bancaria.
 * Retorna array de { fecha, descripcion, monto, tipo, estado, proyecto }
 */
async function parsePDFBanco(file, proyecto = "Junquillar") {
  const pdfjs = await _loadPdfJs();
  if (!pdfjs) {
    console.error("[BancoParser] pdf.js no disponible.");
    return [];
  }

  let pdf;
  try {
    const buf = await file.arrayBuffer();
    pdf = await pdfjs.getDocument({ data: buf }).promise;
    console.log(`[BancoParser] PDF cargado: ${pdf.numPages} página(s)`);
  } catch(e) {
    console.error("[BancoParser] Error abriendo PDF:", e);
    return [];
  }

  const rows = await _extractPageItems(pdf);
  const cols = _detectColumnPositions(rows);

  if (!cols) {
    console.warn("[BancoParser] No se encontró encabezado FECHA/CARGO/ABONO. Usando heurística.");
  }

  const result = [];
  let inTable = false; // solo procesar filas después del header

  // Detectar qué filas de texto son "encabezado de tabla"
  const headerRowIdxs = new Set();
  for (let i = 0; i < rows.length; i++) {
    const texts = rows[i].items.map(t => _norm(t.text));
    if (texts.some(t => t === "fecha") && texts.some(t => t === "cargo")) {
      headerRowIdxs.add(i);
    }
  }

  // Bloques de secciones a ignorar (resumen, saldos diarios, etc.)
  const SKIP_SECTIONS = ["resumen comisiones","saldos diarios","sin comisiones","nota:","informese","infórmese"];

  let skip = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineText = row.items.map(t => t.text).join(" ");
    const lineNorm = _norm(lineText);

    // Detectar inicio de secciones a ignorar
    if (SKIP_SECTIONS.some(s => lineNorm.startsWith(s))) {
      skip = true;
      inTable = false;
      continue;
    }

    // Si encontramos un header, activar tabla y salir de skip
    if (headerRowIdxs.has(i)) {
      inTable = true;
      skip = false;
      continue;
    }

    if (!inTable || skip) continue;

    // Intentar parsear como fila de movimiento
    const mov = _parseDataRow(row.items, cols, proyecto);
    if (mov) result.push(mov);
  }

  console.log(`[BancoParser] ${result.length} movimientos extraídos del PDF.`);
  return result;
}

window.parsePDFBanco = parsePDFBanco;
