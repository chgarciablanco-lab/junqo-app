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
      estado:  "pendiente",
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
