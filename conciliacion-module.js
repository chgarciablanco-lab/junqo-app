
/* ══════════════════════════════════════════════════════════════
   JUNQO · MÓDULO CONCILIACIÓN BANCARIA
   Carga cartolas → tabla movimientos_banco → cuadratura vs gastos
   ══════════════════════════════════════════════════════════════ */

let movBanco = [];          // movimientos cargados desde Supabase
let movBancoFiltroMes = ""; // mes seleccionado para cuadratura

/* ── Cargar movimientos desde Supabase ────────────────────── */
async function loadMovimientosBanco() {
  if (typeof window.supabaseClient === "undefined") { movBanco = []; return; }
  const { data, error } = await window.supabaseClient
    .from("movimientos_banco")
    .select("*")
    .eq("proyecto", PROJECT_NAME)
    .order("fecha", { ascending: false });
  if (error) { console.error("[Conciliación]", error); movBanco = []; return; }
  movBanco = data || [];
  console.log(`[Conciliación] ${movBanco.length} movimientos cargados.`);
}

/* ── Insertar movimientos en Supabase (batch de 50) ──────── */
async function insertMovimientosBanco(rows) {
  if (!rows.length) return { ok: 0, error: null };
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await window.supabaseClient
      .from("movimientos_banco")
      .insert(batch);
    if (error) return { ok: inserted, error };
    inserted += batch.length;
  }
  return { ok: inserted, error: null };
}

/* ── Meses únicos presentes en movimientos ────────────────── */
function getMesesBanco() {
  const set = new Set(movBanco.map(m => (m.fecha || "").slice(0, 7)).filter(Boolean));
  return [...set].sort().reverse(); // más reciente primero
}

/* ── Cuadratura mes: banco vs gastos ─────────────────────── */
function calcCuadratura(mes) {
  const movMes = movBanco.filter(m => (m.fecha || "").startsWith(mes));
  const gastosMes = gastos.filter(g => fechaOrdenable(g.fecha).startsWith(mes));

  const totalCargos  = movMes.filter(m => m.tipo === "cargo").reduce((a, m) => a + numberValue(m.monto), 0);
  const totalAbonos  = movMes.filter(m => m.tipo === "abono").reduce((a, m) => a + numberValue(m.monto), 0);
  const totalGastos  = sumBy(gastosMes, "total"); // total con IVA = lo que sale del banco
  const diferencia   = totalCargos - totalGastos;
  const pctCuadra    = totalCargos > 0 ? Math.abs(diferencia) / totalCargos : 0;
  const cuadra       = Math.abs(diferencia) < 1000; // tolerancia $1.000

  return {
    mes,
    movs: movMes.length,
    docs: gastosMes.length,
    totalCargos,
    totalAbonos,
    totalGastos,
    diferencia,
    pctCuadra,
    cuadra,
    movMes,
    gastosMes,
  };
}

/* ── Upload de cartola ────────────────────────────────────── */
async function handleCartolaUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const ext = getFileExtension(file.name);
  if (!["xls", "xlsx", "csv", "pdf"].includes(ext)) {
    showToast("⚠️ Solo se aceptan Excel, CSV o PDF para cartolas.");
    event.target.value = "";
    return;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    showToast(`⚠️ Máximo ${MAX_FILE_SIZE_MB} MB.`);
    event.target.value = "";
    return;
  }
  if (typeof window.XLSX === "undefined") {
    showToast("⚠️ Librería Excel no cargada.");
    event.target.value = "";
    return;
  }

  // Mostrar estado de carga
  const statusEl = $("cartola-upload-status");
  if (statusEl) { statusEl.textContent = "⏳ Procesando cartola..."; statusEl.style.display = "block"; }

  let rows = [];
  if (ext === "pdf")        rows = await parsePDFBanco(file, PROJECT_NAME);
  else if (ext === "csv")   rows = await parseCSVBanco(file, PROJECT_NAME);
  else                      rows = await parseSpreadsheetBanco(file, PROJECT_NAME);

  if (!rows.length) {
    showToast("❌ No se reconocieron movimientos. Verifica el formato del archivo.");
    if (statusEl) statusEl.style.display = "none";
    event.target.value = "";
    return;
  }

  // Insertar en Supabase
  const { ok, error } = await insertMovimientosBanco(rows);
  event.target.value = "";

  if (error) {
    showToast(`⚠️ Insertados ${ok}, luego error: ${error.message}`);
  } else {
    showToast(`✅ ${ok} movimientos bancarios importados.`);
  }

  if (statusEl) statusEl.style.display = "none";
  await loadMovimientosBanco();
  renderConciliacion();
}

/* ── Eliminar todos los movimientos del mes ──────────────── */
async function eliminarMovMes(mes) {
  if (!confirm(`¿Eliminar todos los movimientos bancarios de ${mes}?`)) return;
  const { error } = await window.supabaseClient
    .from("movimientos_banco")
    .delete()
    .eq("proyecto", PROJECT_NAME)
    .gte("fecha", `${mes}-01`)
    .lte("fecha", `${mes}-31`);
  if (error) { showToast(`Error: ${error.message}`); return; }
  showToast("✓ Movimientos eliminados.");
  await loadMovimientosBanco();
  renderConciliacion();
}

/* ── Render principal ─────────────────────────────────────── */
function renderConciliacion() {
  const el = $("conciliacion-root");
  if (!el) return;

  const meses = getMesesBanco();
  const mesSel = movBancoFiltroMes || meses[0] || "";
  const cuad = mesSel ? calcCuadratura(mesSel) : null;

  // KPIs globales de movimientos
  const totalMovs   = movBanco.length;
  const totalCargosGlobal = movBanco.filter(m => m.tipo === "cargo").reduce((a,m)=>a+numberValue(m.monto),0);
  const totalAbonosGlobal = movBanco.filter(m => m.tipo === "abono").reduce((a,m)=>a+numberValue(m.monto),0);
  const mesesCount  = meses.length;

  el.innerHTML = `
  <!-- KPIs -->
  <div class="kpi-grid" style="margin-bottom:20px">
    <div class="kpi-card">
      <div class="kpi-title">Movimientos cargados</div>
      <div class="kpi-value">${totalMovs}</div>
      <div class="kpi-footer">${mesesCount} mes${mesesCount!==1?"es":""} registrado${mesesCount!==1?"s":""}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total cargos banco</div>
      <div class="kpi-value">${formatoCLP(totalCargosGlobal)}</div>
      <div class="kpi-footer">Egresos acumulados</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Total abonos banco</div>
      <div class="kpi-value">${formatoCLP(totalAbonosGlobal)}</div>
      <div class="kpi-footer">Ingresos acumulados</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Gastos registrados</div>
      <div class="kpi-value">${formatoCLP(sumBy(gastos,"total"))}</div>
      <div class="kpi-footer">Total documentado en sistema</div>
    </div>
  </div>

  <!-- Upload de cartola -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-header-row">
      <div>
        <div class="card-title">🏦 Subir cartola bancaria</div>
        <div class="card-sub">Excel o CSV de Banco Chile, Santander, BCI, Estado, Scotiabank u otro</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="file" id="cartola-file-input" accept=".xls,.xlsx,.csv,.pdf" hidden/>
        <button class="jv-nuevo-btn" onclick="$('cartola-file-input').click()">📂 Subir cartola</button>
      </div>
    </div>
    <div id="cartola-upload-status" style="display:none;margin-top:10px;font-size:13px;color:var(--muted);padding:8px 0"></div>
    <div class="conc-hint">
      💡 La cartola debe tener columnas de <strong>Fecha</strong>, <strong>Descripción/Glosa</strong> y montos (<strong>Cargo/Abono</strong> o <strong>Monto</strong>).
      Formatos aceptados: <strong>PDF, Excel y CSV</strong> — Banco Chile, Santander, BCI, Estado, Scotiabank.
    </div>
  </div>

  <!-- Selector de mes + cuadratura -->
  ${meses.length === 0 ? `
    <div class="card"><div class="empty-state">📭 Aún no hay cartolas cargadas. Sube el Excel o CSV de tu banco para comenzar la cuadratura.</div></div>
  ` : `
  <div class="card" style="margin-bottom:20px">
    <div class="card-header-row">
      <div>
        <div class="card-title">📅 Cuadratura mensual</div>
        <div class="card-sub">Comparación banco vs gastos registrados en el sistema</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="filter-select" id="conc-mes-select" onchange="movBancoFiltroMes=this.value;renderConciliacion()" style="min-width:140px">
          ${meses.map(m=>`<option value="${m}"${m===mesSel?" selected":""}>${mesLabelFromYM(m)}</option>`).join("")}
        </select>
        <button class="filter-btn-clear" style="margin:0" onclick="eliminarMovMes('${mesSel}')">🗑️ Limpiar mes</button>
      </div>
    </div>

    ${cuad ? renderCuadraturaCard(cuad) : ""}
  </div>

  <!-- Resumen por mes (tabla) -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">📊 Resumen por mes</div>
    <div class="card-sub">Todos los meses con cartola cargada</div>
    <div class="table-wrap" style="margin-top:14px">
      <div class="table-head conc-resumen-head">
        <div>Mes</div>
        <div style="text-align:right">Movs banco</div>
        <div style="text-align:right">Cargos banco</div>
        <div style="text-align:right">Abonos banco</div>
        <div style="text-align:right">Gastos sistema</div>
        <div style="text-align:right">Diferencia</div>
        <div>Estado</div>
      </div>
      <div>
        ${meses.map(m => {
          const c = calcCuadratura(m);
          const ok = c.cuadra;
          const colorDif = c.diferencia === 0 ? "var(--muted)" : c.diferencia > 0 ? "var(--red)" : "var(--green)";
          return `<div class="table-row conc-resumen-row" style="cursor:pointer" onclick="movBancoFiltroMes='${m}';$('conc-mes-select').value='${m}';renderConciliacion()">
            <div style="font-weight:600">${mesLabelFromYM(m)}</div>
            <div style="text-align:right">${c.movs}</div>
            <div style="text-align:right">${formatoCLP(c.totalCargos)}</div>
            <div style="text-align:right;color:var(--green)">${formatoCLP(c.totalAbonos)}</div>
            <div style="text-align:right">${formatoCLP(c.totalGastos)}</div>
            <div style="text-align:right;color:${colorDif};font-weight:600">${formatoCLP(c.diferencia)}</div>
            <div>
              <span class="jv-badge" style="background:${ok?"var(--green-soft)":"var(--red-soft)"};color:${ok?"var(--green)":"var(--red)"}">
                ${ok?"✅ Cuadra":"⚠️ Brecha"}
              </span>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>

  <!-- Detalle movimientos del mes seleccionado -->
  ${cuad && cuad.movMes.length > 0 ? `
  <div class="card">
    <div class="card-title">🏦 Movimientos banco — ${mesLabelFromYM(mesSel)}</div>
    <div class="card-sub">${cuad.movMes.length} movimientos · ordenados por fecha</div>
    <div class="table-wrap" style="margin-top:14px">
      <div class="table-head conc-movs-head">
        <div>Fecha</div>
        <div>Descripción / Glosa</div>
        <div style="text-align:right">Monto</div>
        <div>Tipo</div>
        <div>Estado</div>
      </div>
      <div>
        ${[...cuad.movMes].sort((a,b)=>a.fecha>b.fecha?-1:1).map(m=>`
          <div class="table-row conc-mov-row">
            <div>${normalizarFecha(m.fecha)}</div>
            <div class="doc-name">${m.descripcion||"—"}</div>
            <div style="text-align:right;font-weight:600;color:${m.tipo==="cargo"?"var(--red)":"var(--green)"}">${m.tipo==="cargo"?"-":"+"} ${formatoCLP(m.monto)}</div>
            <div>
              <span class="jv-badge" style="background:${m.tipo==="cargo"?"var(--red-soft)":"var(--green-soft)"};color:${m.tipo==="cargo"?"var(--red)":"var(--green)"}">
                ${m.tipo==="cargo"?"Cargo":"Abono"}
              </span>
            </div>
            <div>
              <span class="jv-badge" style="background:var(--amber-soft);color:var(--amber)">${m.estado||"pendiente"}</span>
            </div>
          </div>`).join("")}
      </div>
    </div>
  </div>` : ""}
  `}
  `;

  // Vincular input de cartola
  const inp = $("cartola-file-input");
  if (inp) inp.addEventListener("change", handleCartolaUpload);
}

/* ── Card de cuadratura individual ───────────────────────── */
function renderCuadraturaCard(c) {
  const ok = c.cuadra;
  const colorDif = c.diferencia === 0 ? "var(--muted)" : c.diferencia > 0 ? "var(--red)" : "var(--green)";
  const pctStr = (c.pctCuadra * 100).toFixed(1) + "%";

  return `
  <div class="conc-cuad-card ${ok ? "conc-cuad-ok" : "conc-cuad-fail"}" style="margin-top:16px">
    <div class="conc-cuad-header">
      <span class="conc-cuad-icon">${ok ? "✅" : "⚠️"}</span>
      <div>
        <div class="conc-cuad-title">${ok ? "La caja cuadra" : "Hay una brecha"} en ${mesLabelFromYM(c.mes)}</div>
        <div class="conc-cuad-sub">${c.movs} movimientos banco · ${c.docs} documentos sistema</div>
      </div>
      <div class="conc-cuad-dif" style="color:${colorDif}">
        ${c.diferencia === 0 ? "$0" : (c.diferencia > 0 ? "+" : "") + formatoCLP(c.diferencia)}
      </div>
    </div>
    <div class="conc-cuad-grid">
      <div class="conc-cuad-item">
        <div class="conc-cuad-label">Cargos banco</div>
        <div class="conc-cuad-val" style="color:var(--red)">${formatoCLP(c.totalCargos)}</div>
      </div>
      <div class="conc-cuad-item">
        <div class="conc-cuad-label">Abonos banco</div>
        <div class="conc-cuad-val" style="color:var(--green)">${formatoCLP(c.totalAbonos)}</div>
      </div>
      <div class="conc-cuad-item">
        <div class="conc-cuad-label">Gastos sistema (total c/IVA)</div>
        <div class="conc-cuad-val">${formatoCLP(c.totalGastos)}</div>
      </div>
      <div class="conc-cuad-item">
        <div class="conc-cuad-label">Diferencia cargos vs sistema</div>
        <div class="conc-cuad-val" style="color:${colorDif};font-weight:700">${formatoCLP(Math.abs(c.diferencia))} ${ok?"✓":"⚠ "+pctStr+" brecha"}</div>
      </div>
    </div>
    ${!ok ? `<div class="conc-cuad-hint">
      💡 La diferencia de ${formatoCLP(Math.abs(c.diferencia))} puede deberse a gastos no registrados en el sistema, documentos con fechas distintas, o cargos bancarios sin comprobante (comisiones, intereses).
    </div>` : ""}
  </div>`;
}

/* ── Helper: "2026-04" → "Abr 2026" ──────────────────────── */
function mesLabelFromYM(ym) {
  if (!ym || ym.length < 7) return ym || "—";
  const [y, m] = ym.split("-");
  const ms = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${ms[Number(m)-1] || m} ${y}`;
}

/* ── Exponer globales ─────────────────────────────────────── */
window.renderConciliacion   = renderConciliacion;
window.eliminarMovMes       = eliminarMovMes;
window.mesLabelFromYM       = mesLabelFromYM;
