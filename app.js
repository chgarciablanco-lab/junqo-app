No cabe completo en un solo mensaje. Te lo dejo por partes para copiar desde el iPad.

## app.js — Parte 1

```js
/* JUNQO – Casa Junquillar | app.js */
const BUDGET_KEY = "junqo_presupuesto";
let PROJECT_BUDGET = 180000000;
const PROJECT_NAME = "Junquillar";
const BUCKET_NAME = "comprobantes-junquillar";
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_EXTENSIONS = ["jpg","jpeg","png","webp","heic","heif","pdf","xls","xlsx","csv"];
const REPORT_WIDGETS_KEY = "junqo_report_widgets";

let gastos = [];
let filteredDocs = [];
let currentView = "resumen";
let docsVisibleLimit = 10;
let editModalGasto = null;

const DEFAULT_WIDGETS = ["cat","mensual","proveedores","iva","avance","documentos"];
let activeWidgets = JSON.parse(localStorage.getItem(REPORT_WIDGETS_KEY) || JSON.stringify(DEFAULT_WIDGETS));

/* ── AUTH / LOGIN ─────────────────────────────────────────── */
let authSession = null;
let authUser = null;
let dashboardStarted = false;

const views = {
  resumen:     { title:"Resumen", subtitle:"Vista ejecutiva y control del proyecto", visible:["section-kpis","section-alerts","section-control"] },
  conciliacion:{ title:"Conciliación bancaria", subtitle:"Cruce automático entre cartola y gastos", visible:["section-conciliacion"] },
  gastos:      { title:"Gastos", subtitle:"Registro y control de egresos del proyecto", visible:["section-filtro-solo","section-docs"] },
  documentos:  { title:"Documentos", subtitle:"Carga de facturas, boletas y respaldo documental", visible:["section-upload-only"] },
  proveedores: { title:"Proveedores", subtitle:"Análisis por proveedor, documentos y concentración", visible:["section-proveedores"] },
  caja:        { title:"Caja e IVA", subtitle:"Crédito fiscal, documentos y detalle mensual", visible:["section-caja"] },
  "control-financiero":{ title:"Control Financiero", subtitle:"Flujo financiero mensual del proyecto — sin IVA", visible:["section-control-financiero"] },
  reportes:    { title:"Reportes", subtitle:"Análisis resumido por categoría y mes", visible:["section-reportes"] },
  ventas:      { title:"Ventas", subtitle:"Ingresos, cotizaciones y contactos del proyecto", visible:["section-ventas"] },
  insumos:     { title:"Insumos", subtitle:"Control de materiales y stock en obra", visible:["section-insumos"] },
  configuracion:{ title:"Configuración", subtitle:"Ajustes generales del proyecto y apariencia", visible:["section-config"] }
};

const $ = id => document.getElementById(id);

/* ── FORMATEO ─────────────────────────────────────────────── */
function numberValue(v){
  if(v===null||v===undefined||v==="") return 0;
  const n=Number(String(v).replace(/\./g,"").replace(",","."));
  return Number.isFinite(n)?n:0;
}

function formatoCLP(v){
  return numberValue(v).toLocaleString("es-CL",{
    style:"currency",
    currency:"CLP",
    maximumFractionDigits:0
  });
}

function formatoPct(v){
  return `${Number(v||0).toLocaleString("es-CL",{maximumFractionDigits:1})}%`;
}

function normalizarFecha(f){
  if(!f) return "—";
  const r=String(f).slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(r)){
    const[y,m,d]=r.split("-");
    return`${d}/${m}/${y}`;
  }
  return r;
}

function fechaOrdenable(f){
  if(!f) return "";
  if(/^\d{4}-\d{2}-\d{2}/.test(f)) return String(f).slice(0,10);
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(f)){
    const[d,m,y]=f.split("/");
    return`${y}-${m}-${d}`;
  }
  return String(f);
}

function mesLabel(f){
  const x=fechaOrdenable(f);
  if(!x||x.length<7) return "Sin fecha";
  const[y,m]=x.split("-");
  const ms=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return`${ms[Number(m)-1]||m} ${y}`;
}

function getCategoriaClass(c=""){
  const cat=String(c||"").toLowerCase();
  if(cat.includes("material")) return"cat-materiales";
  if(cat.includes("mano")) return"cat-mano";
  if(cat.includes("servicio")||cat.includes("aliment")) return"cat-servicios";
  if(cat.includes("herramienta")) return"cat-herramientas";
  if(cat.includes("transporte")) return"cat-transporte";
  return"cat-otros";
}

function sumBy(rows,f){
  return rows.reduce((a,i)=>a+numberValue(i[f]),0);
}

function uniqueCount(rows,f){
  return new Set(rows.map(i=>i[f]).filter(Boolean)).size;
}

function groupBy(rows,fn){
  return rows.reduce((a,r)=>{
    const k=fn(r)||"Sin clasificar";
    if(!a[k])a[k]=[];
    a[k].push(r);
    return a;
  },{});
}

function emptyState(t="Sin registros."){
  return`<div class="empty-state">${t}</div>`;
}

function getTotals(rows=gastos){
  const neto=sumBy(rows,"neto");
  const iva=sumBy(rows,"iva");
  const total=sumBy(rows,"total");
  const docs=rows.length;
  const proveedores=uniqueCount(rows,"proveedor");
  const pendientesOcr=rows.filter(g=>String(g.estado_ocr||"").toLowerCase()==="pendiente").length;
  const sinProveedor=rows.filter(g=>!g.proveedor).length;

  return{neto,iva,total,docs,proveedores,pendientesOcr,sinProveedor};
}

/* ── SUPABASE ROW MAP ─────────────────────────────────────── */
function mapSupabaseRow(r){
  return{
    id:r.id,
    fecha:r.fecha,
    proveedor:r.proveedor||"",
    rut:r.rut||"",
    tipo_documento:r.tipo_documento||"",
    numero_documento:r.numero_documento||"",
    iva:numberValue(r.iva),
    total:numberValue(r.total),
    metodo_pago:r.metodo_pago||"",
    proyecto:r.proyecto||PROJECT_NAME,
    observacion:r.observacion||"",
    foto_url:r.foto_url||"",
    estado_ocr:r.estado_ocr||"",
    created_at:r.created_at||"",
    neto:numberValue(r.neto),
    categoria:r.categoria||"",
    foto_path:r.foto_path||""
  };
}
 Perfecto. Sigue con esto.

---

## **app.js — Parte 2 (BANCO PARSER + EXCEL PARSER)**

```js
/* ── FILE UTILS ───────────────────────────────────────────── */
function getFileExtension(f){
  return String(f||"").split(".").pop().toLowerCase();
}

function sanitizeFileName(f){
  return String(f||"archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9._-]/g,"_");
}

function getFileGroup(ext){
  if(["jpg","jpeg","png"].includes(ext)) return"imagenes";
  if(["xls","xlsx","csv"].includes(ext)) return"planillas";
  return"pdf";
}

/* ── BANCO PARSER ─────────────────────────────────────────── */

function parseMontoBanco(v){
  if(v===null || v===undefined || v==="") return 0;
  if(typeof v==="number") return v;

  let s = String(v)
    .replace(/\$/g,"")
    .replace(/\s/g,"")
    .replace(/\(/g,"-")
    .replace(/\)/g,"");

  if(s.includes(",")){
    s = s.replace(/\./g,"").replace(",",".");
  }else{
    s = s.replace(/\./g,"");
  }

  const n = Number(s.replace(/[^0-9.-]/g,""));
  return Number.isFinite(n) ? n : 0;
}

function sheetToMovimientosBanco(rows){
  if(!rows || rows.length < 2) return [];

  const limpiar = v => String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .trim();

  let headerIndex = -1;

  for(let i=0; i<Math.min(20, rows.length); i++){
    const txt = rows[i].map(limpiar).join(" ");

    const tieneFecha =
      txt.includes("fecha") ||
      txt.includes("fec") ||
      txt.includes("f.") ||
      txt.includes("contable") ||
      txt.includes("operacion") ||
      txt.includes("transaccion");

    const tieneMonto =
      txt.includes("cargo") ||
      txt.includes("abono") ||
      txt.includes("monto") ||
      txt.includes("importe") ||
      txt.includes("valor") ||
      txt.includes("debe") ||
      txt.includes("haber") ||
      txt.includes("egreso") ||
      txt.includes("ingreso");

    if(tieneFecha && tieneMonto){
      headerIndex = i;
      break;
    }
  }

  const hi = headerIndex >= 0 ? headerIndex : 0;
  const headers = rows[hi].map(limpiar);

  console.log("[BancoParser] Headers:", headers);

  const colFecha = headers.findIndex(h =>
    h.includes("fecha") ||
    h.includes("fec") ||
    h.includes("f.") ||
    h.includes("contable") ||
    h.includes("operacion") ||
    h.includes("transaccion")
  );

  const colDesc = headers.findIndex(h =>
    h.includes("descripcion") ||
    h.includes("glosa") ||
    h.includes("detalle") ||
    h.includes("movimiento") ||
    h.includes("concepto") ||
    h.includes("referencia")
  );

  const colCargo = headers.findIndex(h =>
    h.includes("cargo") ||
    h.includes("egreso") ||
    h.includes("debe") ||
    h.includes("retiro")
  );

  const colAbono = headers.findIndex(h =>
    h.includes("abono") ||
    h.includes("ingreso") ||
    h.includes("haber") ||
    h.includes("deposito")
  );

  const colMonto = headers.findIndex(h =>
    (h.includes("monto") || h.includes("importe") || h.includes("valor")) &&
    !h.includes("cargo") &&
    !h.includes("abono")
  );

  if(colFecha < 0){
    console.error("No se detectó columna fecha");
    return [];
  }

  const movimientos = [];

  for(let i=hi+1; i<rows.length; i++){
    const row = rows[i];
    if(!row || !row.some(c => String(c || "").trim())) continue;

    const fecha = toDateISO(row[colFecha]);
    if(!fecha) continue;

    const descripcion = colDesc >= 0
      ? String(row[colDesc] || "Movimiento bancario").trim()
      : "Movimiento bancario";

    let monto = 0;
    let tipo = "cargo";

    const cargo = colCargo >= 0 ? parseMontoBanco(row[colCargo]) : 0;
    const abono = colAbono >= 0 ? parseMontoBanco(row[colAbono]) : 0;
    const montoUnico = colMonto >= 0 ? parseMontoBanco(row[colMonto]) : 0;

    if(Math.abs(cargo) > 0){
      monto = Math.abs(cargo);
      tipo = "cargo";
    } else if(Math.abs(abono) > 0){
      monto = Math.abs(abono);
      tipo = "abono";
    } else if(Math.abs(montoUnico) > 0){
      monto = Math.abs(montoUnico);
      tipo = montoUnico < 0 ? "cargo" : "abono";
    }

    if(!monto || isNaN(monto)) continue;

    movimientos.push({
      fecha,
      descripcion,
      monto,
      tipo,
      estado: "pendiente",
      proyecto: PROJECT_NAME
    });
  }

  console.log("[BancoParser] Movimientos:", movimientos.length);

  return movimientos;
}

async function parseSpreadsheetBanco(file){
  return new Promise(res=>{
    const r = new FileReader();
    r.onload = e => {
      try{
        const d = new Uint8Array(e.target.result);
        const wb = window.XLSX.read(d,{type:"array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws,{header:1});
        res(sheetToMovimientosBanco(rows));
      }catch(err){
        console.error(err);
        res([]);
      }
    };
    r.readAsArrayBuffer(file);
  });
}

async function parseCSVBanco(file){
  return new Promise(res=>{
    const r = new FileReader();
    r.onload = e => {
      const text = e.target.result;
      const sep = text.includes(";") ? ";" : ",";
      const rows = text
        .split("\n")
        .filter(l => l.trim())
        .map(l => l.split(sep));
      res(sheetToMovimientosBanco(rows));
    };
    r.readAsText(file);
  });
}
```
async function handleFileUpload(event){

  const tipoCarga = document.getElementById("upload-doc-type")?.value || "gasto";
  const file = event.target.files?.[0];
  if(!file) return;

  const ext = getFileExtension(file.name);

  if(!ALLOWED_FILE_EXTENSIONS.includes(ext)){
    alert("Formato no permitido.");
    event.target.value="";
    return;
  }

  if(file.size > MAX_FILE_SIZE_MB * 1024 * 1024){
    alert(`Máximo ${MAX_FILE_SIZE_MB} MB.`);
    event.target.value="";
    return;
  }

  if(typeof window.supabaseClient === "undefined"){
    alert("Supabase no está configurado.");
    event.target.value="";
    return;
  }

  const isSheet = ["xls","xlsx"].includes(ext);
  const isCSV = ext === "csv";

  // 🚫 PDF no sirve para cartola
  if(tipoCarga === "cartola" && !isSheet && !isCSV){
    alert("Para cartola bancaria debes subir Excel o CSV.");
    event.target.value="";
    return;
  }

  if((isSheet || isCSV) && typeof window.XLSX === "undefined"){
    alert("Librería Excel no cargada.");
    event.target.value="";
    return;
  }

  let rows = [];

  // 🔥 PARSER DIFERENCIADO
  if(isSheet || isCSV){

    if(tipoCarga === "cartola"){
      rows = isCSV
        ? await parseCSVBanco(file)
        : await parseSpreadsheetBanco(file);

      if(!rows.length){
        alert("No se pudieron leer movimientos.\nRevisa columnas de fecha y monto.");
        event.target.value="";
        return;
      }

    }else{
      rows = isCSV
        ? await parseCSV(file,null)
        : await parseSpreadsheet(file,null);

      if(!rows.length){
        alert("No se encontraron filas reconocibles.");
        event.target.value="";
        return;
      }
    }
  }

  // 📂 SUBIR ARCHIVO A STORAGE
  const safeName = sanitizeFileName(file.name);
  const group = getFileGroup(ext);
  const path = `junquillar/${group}/${Date.now()}-${safeName}`;

  const { data: up, error: ue } = await window.supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(path,file,{
      cacheControl:"3600",
      upsert:false,
      contentType:file.type || undefined
    });

  if(ue){
    alert(`Error subiendo: ${ue.message}`);
    event.target.value="";
    return;
  }

  const stored = up.path;

  // 🔥 PROCESAMIENTO PRINCIPAL
  if(isSheet || isCSV){

    // 🟢 CARTOLA
    if(tipoCarga === "cartola"){

      const movimientos = rows.map(r => ({
        ...r,
        observacion: stored
      }));

      let insertados = 0;

      for(let i=0; i<movimientos.length; i+=50){

        const batch = movimientos.slice(i,i+50);

        const { error } = await window.supabaseClient
          .from("movimientos_banco")
          .insert(batch);

        if(error){
          alert("Error cargando cartola: " + error.message);
          event.target.value="";
          return;
        }

        insertados += batch.length;
      }

      alert(`✅ ${insertados} movimientos bancarios cargados`);
      event.target.value="";

      await loadData();

      // 🔥 CAMBIAR A VISTA CONCILIACIÓN
      currentView = "conciliacion";

      document.querySelectorAll(".nav-btn")
        .forEach(b => b.classList.remove("active"));

      document.querySelector('[data-view="conciliacion"]')
        ?.classList.add("active");

      const view = views.conciliacion;

      document.getElementById("page-title").textContent = view.title;
      document.getElementById("page-subtitle").textContent = view.subtitle;

      updateVisibleSections(view.visible);

      await cargarConciliacion();

      return;
    }

    // 🔵 GASTOS (lo que ya tenías)
    rows.forEach(r => r.foto_path = stored);

    let ins = 0;

    for(let i=0;i<rows.length;i+=50){

      const b = rows.slice(i,i+50);

      const { error } = await window.supabaseClient
        .from("gastos_junquillar_app")
        .insert(b);

      if(error){
        alert(`Insertados ${ins}, luego error: ${error.message}`);
        event.target.value="";
        await loadData();
        return;
      }

      ins += b.length;
    }

    alert(`✅ ${ins} registros importados.`);
    event.target.value="";
    await loadData();
    return;
  }

  // 📸 OCR (sin cambios)
  const isImage =
    (file.type && file.type.startsWith("image/")) ||
    ["jpg","jpeg","png","webp","heic","heif"].includes(ext);

  const { data: inserted, error: ie } = await window.supabaseClient
    .from("gastos_junquillar_app")
    .insert({
      fecha:new Date().toISOString().slice(0,10),
      proyecto:PROJECT_NAME,
      observacion:`Archivo: ${file.name}`,
      estado_ocr:isImage ? "procesando" : "pendiente",
      foto_path:stored
    })
    .select("id")
    .single();

  if(ie){
    alert(`Archivo subido pero error al registrar: ${ie.message}`);
    event.target.value="";
    return;
  }

  alert("Archivo adjuntado.");
  event.target.value="";
  await loadData();
}
