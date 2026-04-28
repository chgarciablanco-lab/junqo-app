/* JUNQO – Casa Junquillar | app.js */
const BUDGET_KEY = "junqo_presupuesto";
let PROJECT_BUDGET = 180000000;
const PROJECT_NAME = "Junquillar";
const BUCKET_NAME = "comprobantes-junquillar";
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_EXTENSIONS = ["jpg","jpeg","png","pdf","xls","xlsx","csv"];
const REPORT_WIDGETS_KEY = "junqo_report_widgets";

let gastos = [];
let filteredDocs = [];
let currentView = "resumen";
let docsVisibleLimit = 10;
let editModalGasto = null;

const DEFAULT_WIDGETS = ["cat","mensual","proveedores","iva","avance","documentos"];
let activeWidgets = JSON.parse(localStorage.getItem(REPORT_WIDGETS_KEY) || JSON.stringify(DEFAULT_WIDGETS));

const views = {
  resumen:     { title:"Resumen",            subtitle:"Vista ejecutiva y control del proyecto",               visible:["section-kpis","section-alerts","section-control"] },
  gastos:      { title:"Gastos",             subtitle:"Registro y control de egresos del proyecto",          visible:["section-filtro-solo","section-docs"] },
  documentos:  { title:"Documentos",         subtitle:"Carga de facturas, boletas y respaldo documental",    visible:["section-upload-only"] },
  proveedores: { title:"Proveedores",        subtitle:"Análisis por proveedor, documentos y concentración",  visible:["section-proveedores"] },
  caja:        { title:"Caja e IVA",         subtitle:"Crédito fiscal, documentos y detalle mensual",        visible:["section-caja"] },
  "control-financiero": { title:"Control Financiero",  subtitle:"Flujo financiero mensual del proyecto — sin IVA",            visible:["section-control-financiero"] },
  reportes:             { title:"Reportes",             subtitle:"Análisis resumido por categoría y mes",                     visible:["section-reportes"] },
  ventas:       { title:"Ventas",            subtitle:"Ingresos, cotizaciones y contactos del proyecto",     visible:["section-ventas"] },
  insumos:      { title:"Insumos",           subtitle:"Control de materiales y stock en obra",               visible:["section-insumos"] },
  configuracion:{ title:"Configuración",     subtitle:"Ajustes generales del proyecto y apariencia",         visible:["section-config"] }
};

const $ = id => document.getElementById(id);

/* ── FORMATEO ─────────────────────────────────────────────── */
function numberValue(v){ if(v===null||v===undefined||v==="") return 0; const n=Number(String(v).replace(/\./g,"").replace(",",".")); return Number.isFinite(n)?n:0; }
function formatoCLP(v){ return numberValue(v).toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}); }
function formatoPct(v){ return `${Number(v||0).toLocaleString("es-CL",{maximumFractionDigits:1})}%`; }
function normalizarFecha(f){ if(!f) return "—"; const r=String(f).slice(0,10); if(/^\d{4}-\d{2}-\d{2}$/.test(r)){const[y,m,d]=r.split("-");return`${d}/${m}/${y}`;}return r; }
function fechaOrdenable(f){ if(!f) return ""; if(/^\d{4}-\d{2}-\d{2}/.test(f)) return String(f).slice(0,10); if(/^\d{2}\/\d{2}\/\d{4}$/.test(f)){const[d,m,y]=f.split("/");return`${y}-${m}-${d}`;}return String(f); }
function mesLabel(f){ const x=fechaOrdenable(f); if(!x||x.length<7) return "Sin fecha"; const[y,m]=x.split("-"); const ms=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; return`${ms[Number(m)-1]||m} ${y}`; }
function getCategoriaClass(c=""){ const cat=String(c||"").toLowerCase(); if(cat.includes("material")) return"cat-materiales"; if(cat.includes("mano")) return"cat-mano"; if(cat.includes("servicio")||cat.includes("aliment")) return"cat-servicios"; if(cat.includes("herramienta")) return"cat-herramientas"; if(cat.includes("transporte")) return"cat-transporte"; return"cat-otros"; }
function sumBy(rows,f){ return rows.reduce((a,i)=>a+numberValue(i[f]),0); }
function uniqueCount(rows,f){ return new Set(rows.map(i=>i[f]).filter(Boolean)).size; }
function groupBy(rows,fn){ return rows.reduce((a,r)=>{ const k=fn(r)||"Sin clasificar"; if(!a[k])a[k]=[]; a[k].push(r); return a; },{}); }
function emptyState(t="Sin registros."){ return`<div class="empty-state">${t}</div>`; }

function getTotals(rows=gastos){
  const neto=sumBy(rows,"neto"),iva=sumBy(rows,"iva"),total=sumBy(rows,"total"),docs=rows.length;
  const proveedores=uniqueCount(rows,"proveedor");
  const pendientesOcr=rows.filter(g=>String(g.estado_ocr||"").toLowerCase()==="pendiente").length;
  const sinProveedor=rows.filter(g=>!g.proveedor).length;
  return{neto,iva,total,docs,proveedores,pendientesOcr,sinProveedor};
}

/* ── SUPABASE ROW MAP ─────────────────────────────────────── */
function mapSupabaseRow(r){
  return{ id:r.id, fecha:r.fecha, proveedor:r.proveedor||"", rut:r.rut||"", tipo_documento:r.tipo_documento||"", numero_documento:r.numero_documento||"", iva:numberValue(r.iva), total:numberValue(r.total), metodo_pago:r.metodo_pago||"", proyecto:r.proyecto||PROJECT_NAME, observacion:r.observacion||"", foto_url:r.foto_url||"", estado_ocr:r.estado_ocr||"", created_at:r.created_at||"", neto:numberValue(r.neto), categoria:r.categoria||"", foto_path:r.foto_path||"" };
}

/* ── FILE UTILS ───────────────────────────────────────────── */
function getFileExtension(f){ return String(f||"").split(".").pop().toLowerCase(); }
function sanitizeFileName(f){ return String(f||"archivo").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_"); }
function getFileGroup(ext){ if(["jpg","jpeg","png"].includes(ext)) return"imagenes"; if(["xls","xlsx","csv"].includes(ext)) return"planillas"; return"pdf"; }

/* ── EXCEL PARSER ─────────────────────────────────────────── */
const EXACT_HEADERS={0:"fecha",1:"proveedor",2:"rut",3:"tipo_documento",4:"numero_documento",5:"neto",6:"iva",7:"total",8:"categoria",9:"metodo_pago",10:"proyecto"};
const HEADER_ALIASES={fecha:["fecha","date"],proveedor:["proveedor","supplier","nombre","razón social","razon social"],rut:["rut","r.u.t","r.u.t."],tipo_documento:["tipo","tipo documento","tipo doc","type","documento"],numero_documento:["nº documento","n° documento","numero documento","folio","nro","n°","doc"],neto:["neto","monto neto","base neta","costo neto","net","base"],iva:["iva","i.v.a","i.v.a.","tax","impuesto"],total:["total","total doc","monto total","total bruto"],categoria:["categoría","categoria","category","partida","etapa"],metodo_pago:["método de pago","metodo de pago","método pago","forma pago","pago","payment"],proyecto:["proyecto","project"]};
function normH(h){ return String(h||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim(); }
function buildColMap(hr){ const known=["fecha","proveedor","rut","tipo","nº documento","neto","iva","total","categoría","método de pago","proyecto"],nr=hr.map(normH),exact=known.every((h,i)=>nr[i]&&nr[i].includes(normH(h))); if(exact){const m={};Object.entries(EXACT_HEADERS).forEach(([i,f])=>{m[f]=Number(i);});return m;} const m={};nr.forEach((n,i)=>{for(const[f,al]of Object.entries(HEADER_ALIASES)){if(m[f]!==undefined)continue;if(al.some(a=>n===normH(a)||n.includes(normH(a)))){m[f]=i;break;}}});return m; }
function toDateISO(v){ if(v===null||v===undefined||v==="") return null; if(typeof v==="number"){const d=new Date(Math.round((v-25569)*86400*1000));if(!isNaN(d))return d.toISOString().slice(0,10);}const s=String(v).trim();if(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(s)){const[d,m,y]=s.split(/[-\/]/);return`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;}if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);return null; }
function toNum(v){ if(v===null||v===undefined||v==="") return null; if(typeof v==="number") return v; const n=Number(String(v).replace(/\./g,"").replace(",",".").replace(/[^0-9.\-]/g,"")); return Number.isFinite(n)?n:null; }
function isSkipRow(row,cm){ const p=String(row[cm.proveedor??1]||"").trim().toLowerCase(),t=String(row[cm.total??7]||"").trim().toLowerCase(),n=String(row[cm.neto??5]||"").trim().toLowerCase(); if(!row.some(c=>String(c||"").trim()))return true; if(["total","subtotal","totales","sub total"].includes(p))return true; if(["total","subtotal","totales","sub total"].includes(n))return true; if(p==="proveedor"||p==="supplier")return true; return false; }
function sheetToGastos(rows,fp){ if(!rows||rows.length<2)return[]; let hi=-1; for(let i=0;i<Math.min(5,rows.length);i++){const r=rows[i],c0=normH(r[0]),c1=normH(r[1]);if(c0==="fecha"||c0.includes("fecha")||c1==="proveedor"||c1.includes("proveedor")){hi=i;break;}} if(hi===-1)hi=0; const hr=rows[hi],cm=buildColMap(hr); if(cm.fecha===undefined&&cm.proveedor===undefined)return[]; const res=[]; for(let i=hi+1;i<rows.length;i++){const row=rows[i];if(isSkipRow(row,cm))continue;const get=f=>cm[f]!==undefined?row[cm[f]]:undefined;const fv=toDateISO(get("fecha")),neto=toNum(get("neto")),iva=toNum(get("iva")),total=toNum(get("total"));if(!fv&&!get("proveedor")&&!neto)continue;const tr=String(get("tipo_documento")||"").toLowerCase(),esBoleta=tr.includes("boleta")||tr.includes("be");let nf,ivf,tf;if(esBoleta){nf=(total!==null)?total:(neto!==null?neto:0);ivf=0;tf=nf;}else if(neto===null&&iva===null&&total!==null){nf=total;ivf=0;tf=total;}else{nf=(neto!==null)?neto:0;ivf=(iva!==null)?iva:0;tf=(total!==null)?total:(nf+ivf);}res.push({fecha:fv||new Date().toISOString().slice(0,10),proveedor:String(get("proveedor")||"").trim()||null,rut:String(get("rut")||"").trim()||null,tipo_documento:String(get("tipo_documento")||"").trim()||null,numero_documento:String(get("numero_documento")||"").trim()||null,neto:nf,iva:ivf,total:tf,categoria:String(get("categoria")||"").trim()||null,metodo_pago:String(get("metodo_pago")||"").trim()||null,proyecto:PROJECT_NAME,foto_path:fp,estado_ocr:"importado"});}return res; }
async function parseSpreadsheet(file,fp){ return new Promise(res=>{ const r=new FileReader();r.onload=e=>{try{const d=new Uint8Array(e.target.result),wb=window.XLSX.read(d,{type:"array",cellDates:false}),ws=wb.Sheets[wb.SheetNames[0]],rows=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:true});res(sheetToGastos(rows,fp));}catch(err){console.error(err);res([]);}};r.onerror=()=>res([]);r.readAsArrayBuffer(file);}); }
async function parseCSV(file,fp){ return new Promise(res=>{ const r=new FileReader();r.onload=e=>{try{const text=e.target.result,sep=text.includes(";")?";":","  ,rows=text.split(/\r?\n/).filter(l=>l.trim()).map(l=>l.split(sep).map(c=>c.replace(/^"|"$/g,"").trim()));res(sheetToGastos(rows,fp));}catch(err){console.error(err);res([]);}};r.onerror=()=>res([]);r.readAsText(file,"UTF-8");}); }

/* ── FILE UPLOAD ──────────────────────────────────────────── */
async function handleFileUpload(event){
  const file=event.target.files?.[0]; if(!file)return;
  const ext=getFileExtension(file.name);
  if(!ALLOWED_FILE_EXTENSIONS.includes(ext)){alert("Formato no permitido.");event.target.value="";return;}
  if(file.size>MAX_FILE_SIZE_MB*1024*1024){alert(`Máximo ${MAX_FILE_SIZE_MB} MB.`);event.target.value="";return;}
  if(typeof window.supabaseClient==="undefined"){alert("Supabase no está configurado.");event.target.value="";return;}
  if(["xls","xlsx","csv"].includes(ext)&&typeof window.XLSX==="undefined"){alert("Librería Excel no cargada.");event.target.value="";return;}
  const isSheet=["xls","xlsx"].includes(ext),isCSV=ext==="csv";
  let rows=[];
  if(isSheet||isCSV){ rows=isCSV?await parseCSV(file,null):await parseSpreadsheet(file,null); if(!rows.length){alert("No se encontraron filas reconocibles.");event.target.value="";return;} }
  const safeName=sanitizeFileName(file.name),group=getFileGroup(ext),path=`junquillar/${group}/${Date.now()}-${safeName}`;
  const{data:up,error:ue}=await window.supabaseClient.storage.from(BUCKET_NAME).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type||undefined});
  if(ue){alert(`Error subiendo: ${ue.message}`);event.target.value="";return;}
  const stored=up.path;
  if(isSheet||isCSV){
    rows.forEach(r=>r.foto_path=stored);
    let ins=0;
    for(let i=0;i<rows.length;i+=50){const b=rows.slice(i,i+50);const{error}=await window.supabaseClient.from("gastos_junquillar_app").insert(b);if(error){alert(`Insertados ${ins}, luego error: ${error.message}`);event.target.value="";await loadData();return;}ins+=b.length;}
    alert(`✅ ${ins} registros importados.`);event.target.value="";await loadData();return;
  }
  const{error:ie}=await window.supabaseClient.from("gastos_junquillar_app").insert({fecha:new Date().toISOString().slice(0,10),proyecto:PROJECT_NAME,observacion:`Archivo: ${file.name}`,estado_ocr:"pendiente",foto_path:stored});
  if(ie){alert(`Archivo subido pero error al registrar: ${ie.message}`);event.target.value="";return;}
  alert("📎 Archivo adjuntado.");event.target.value="";await loadData();
}
function setupFileUpload(){
  const input=$("file-input");if(!input)return;
  input.addEventListener("change",handleFileUpload);
  $("select-file-link")?.addEventListener("click",()=>input.click());
  $("btn-adjuntar")?.addEventListener("click",()=>input.click());
  $("btn-foto")?.addEventListener("click",()=>input.click());
  const dz=$("dropzone");
  if(dz){
    dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("drag-over");});
    dz.addEventListener("dragleave",()=>dz.classList.remove("drag-over"));
    dz.addEventListener("drop",async e=>{e.preventDefault();dz.classList.remove("drag-over");const f=e.dataTransfer?.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;await handleFileUpload({target:input});});
  }
}

/* ── LOAD DATA ────────────────────────────────────────────── */
async function loadData(){
  if(typeof window.supabaseClient==="undefined"){gastos=[];filteredDocs=[];renderAll();return;}
  const{data,error}=await window.supabaseClient.from("gastos_junquillar_app").select("*").eq("proyecto",PROJECT_NAME).order("fecha",{ascending:false}).order("created_at",{ascending:false});
  if(error){console.error(error);gastos=[];filteredDocs=[];renderAll();return;}
  gastos=(data||[]).map(mapSupabaseRow);filteredDocs=[...gastos];
  await loadBudget();
  renderAll();
}

/* ── PRESUPUESTO EDITABLE (Supabase config table) ─────────── */
async function loadBudget(){
  if(typeof window.supabaseClient==="undefined") return;
  try{
    const{data}=await window.supabaseClient.from("junqo_config").select("value").eq("key",BUDGET_KEY).single();
    if(data?.value) PROJECT_BUDGET=Number(data.value)||180000000;
  }catch(e){}
}
async function saveBudget(val){
  if(typeof window.supabaseClient==="undefined"){PROJECT_BUDGET=val;renderAll();return;}
  await window.supabaseClient.from("junqo_config").upsert({key:BUDGET_KEY,value:String(val),proyecto:PROJECT_NAME},{onConflict:"key"});
  PROJECT_BUDGET=val;renderAll();
}
function renderBudgetEditor(){
  const el=$("budget-editor");if(!el)return;
  el.innerHTML=`
    <div class="budget-edit-row">
      <span class="budget-edit-label">Presupuesto del proyecto</span>
      <div class="budget-edit-controls">
        <input type="text" id="budget-input" class="budget-input" value="${PROJECT_BUDGET.toLocaleString("es-CL")}" placeholder="180.000.000"/>
        <button class="budget-save-btn" id="btn-save-budget">Guardar</button>
      </div>
    </div>`;
  $("btn-save-budget")?.addEventListener("click",async()=>{
    const raw=String($("budget-input")?.value||"").replace(/\./g,"").replace(",",".");
    const val=Number(raw);
    if(!val||val<1000){alert("Ingresa un presupuesto válido.");return;}
    await saveBudget(val);
    alert(`✅ Presupuesto actualizado a ${formatoCLP(val)}`);
  });
}

/* ── KPIs ─────────────────────────────────────────────────── */
function renderKPIs(){
  const el=$("section-kpis");if(!el)return;
  const t=getTotals(),avance=PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0;
  const saldo=Math.max(PROJECT_BUDGET-t.neto,0);
  const chipStyle=(bg,color)=>`background:${bg};color:${color};border:1px solid ${color}33`;
  el.innerHTML=[
    {title:"Avance financiero",    value:formatoPct(avance),      chip:["Ejecutado",chipStyle(avance>=90?"#fee2e2":avance>=70?"#fef3c7":"#d1fae5",avance>=90?"#dc2626":avance>=70?"#d97706":"#059669")], footer:`${formatoCLP(t.neto)} ejecutado de ${formatoCLP(PROJECT_BUDGET)}`},
    {title:"Inversión neta",       value:formatoCLP(t.neto),      chip:[`${t.docs} docs`,chipStyle("#eff6ff","#3b82f6")], footer:`${t.proveedores} proveedores · ${t.docs} documentos registrados`},
    {title:"Saldo disponible",     value:formatoCLP(saldo),        chip:[saldo>0?"Disponible":"Agotado",chipStyle(saldo>0?"#d1fae5":"#fee2e2",saldo>0?"#059669":"#dc2626")], footer:"Presupuesto referencial menos lo ejecutado"},
    {title:"IVA crédito fiscal",   value:formatoCLP(t.iva),       chip:["CF deducible",chipStyle("#f5f3ff","#7c3aed")], footer:`${t.pendientesOcr} documentos pendientes OCR`},
  ].map(k=>`<div class="kpi-card"><div class="kpi-top"><div><div class="kpi-title">${k.title}</div><div class="kpi-value">${k.value}</div></div><span class="kpi-chip" style="${k.chip[1]}">${k.chip[0]}</span></div><div class="kpi-footer">${k.footer}</div></div>`).join("");
  const sf=document.querySelector(".sidebar-card .progress-fill");
  const sb=document.querySelector(".sidebar-card .big");
  const ss=document.querySelector(".sidebar-card .sub");
  if(sf)sf.style.width=`${Math.min(avance,100)}%`;
  if(sb)sb.textContent=formatoPct(avance);
  if(ss)ss.textContent=`${formatoCLP(t.neto)} de ${formatoCLP(PROJECT_BUDGET)} ejecutado`;
}
function renderAlerts(){
  const el=$("alerts-list");if(!el)return;
  const t=getTotals(),avance=PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0;
  const saldo=Math.max(PROJECT_BUDGET-t.neto,0);
  const alertItems=[
    {icon:"📄",title:`${t.pendientesOcr} documentos pendientes OCR`,sub:"Requieren revisión documental",warn:t.pendientesOcr>0},
    {icon:"⚠️",title:`${t.sinProveedor} registros sin proveedor`,sub:"Datos de proveedor incompletos",warn:t.sinProveedor>0},
    {icon:"💵",title:`${formatoCLP(t.iva)} IVA crédito fiscal`,sub:"Monto deducible acumulado",warn:false},
    {icon:"📊",title:`${formatoPct(avance)} avance financiero`,sub:"Contra presupuesto referencial",warn:avance>=90},
  ].map(a=>`<div class="resumen-alert-item${a.warn?" resumen-alert-warn":""}"><span class="resumen-alert-icon">${a.icon}</span><div><div class="resumen-alert-title">${a.title}</div><div class="resumen-alert-sub">${a.sub}</div></div></div>`).join("");
  const hitos=[
    {icon:"📄",label:"Documentación",estado:t.pendientesOcr>0?"Pendiente":"Completo",   desc:`${t.pendientesOcr} docs pendientes OCR`,    ok:t.pendientesOcr===0},
    {icon:"💰",label:"Presupuesto",  estado:t.neto>PROJECT_BUDGET?"Sobre ppto":"En control",desc:`${formatoCLP(t.neto)} ejecutado`,         ok:t.neto<=PROJECT_BUDGET},
    {icon:"🏢",label:"Proveedores",  estado:t.proveedores>0?"Con actividad":"Sin actividad",desc:`${t.proveedores} proveedores`,             ok:t.proveedores>0},
    {icon:"📊",label:"Avance",       estado:t.neto>0?"En progreso":"Sin inicio",          desc:`${formatoPct(avance)} del presupuesto`,     ok:t.neto>0},
  ].map(h=>`<div class="hito-tile"><div class="hito-tile-top"><span class="hito-tile-icon">${h.icon}</span><span class="status ${h.ok?"s-green":"s-amber"}">${h.estado}</span></div><div class="hito-tile-label">${h.label}</div><div class="hito-tile-desc">${h.desc}</div></div>`).join("");
  el.innerHTML=`<div class="resumen-2col">
    <div class="resumen-left-col">
      <div class="resumen-avance-wrap">
        <div class="resumen-avance-pct">${formatoPct(avance)}</div>
        <div class="resumen-avance-label">de avance financiero</div>
        <div class="cat-track resumen-bar"><div class="cat-fill" style="width:${Math.min(avance,100)}%"></div></div>
        <div class="resumen-avance-detail"><span>${formatoCLP(t.neto)} ejecutado</span><span>${formatoCLP(saldo)} disponible</span></div>
      </div>
      <div class="resumen-alerts-list">${alertItems}</div>
    </div>
    <div class="resumen-right-col">
      <div class="resumen-hitos-title">Hitos del proyecto</div>
      <div class="hitos-2x2">${hitos}</div>
    </div>
  </div>`;
}
function renderBottomCards(){ /* section-bottom no longer shown in resumen */ }

/* ── GASTOS TABLE ─────────────────────────────────────────── */
let selectedIds = new Set();

function updateBulkBar(){
  const bar=$("bulk-bar"), count=$("bulk-count");
  if(!bar)return;
  if(selectedIds.size>0){
    bar.classList.remove("bulk-bar-hidden");
    if(count) count.textContent=`${selectedIds.size} seleccionado${selectedIds.size!==1?"s":""}`;
  } else {
    bar.classList.add("bulk-bar-hidden");
  }
  // Actualizar checkbox "seleccionar todo"
  const chkAll=$("chk-all");
  if(chkAll){
    const slice=filteredDocs.slice(0,docsVisibleLimit);
    chkAll.checked = slice.length>0 && slice.every(g=>selectedIds.has(String(g.id)));
    chkAll.indeterminate = !chkAll.checked && slice.some(g=>selectedIds.has(String(g.id)));
  }
}

function gastoRowHTML(g){
  const safeNombre=(g.proveedor||"").replace(/'/g,"\\'").replace(/"/g,"&quot;");
  const checked=selectedIds.has(String(g.id))?"checked":"";
  return`<div class="table-row gastos-row${checked?" row-selected":""}" data-id="${g.id}">
    <div><input type="checkbox" class="row-chk" data-id="${g.id}" ${checked} onclick="toggleRowSelect('${g.id}',this)"/></div>
    <div>${normalizarFecha(g.fecha)}</div>
    <div><div class="doc-name">${g.proveedor||"Pendiente OCR"}</div><div class="doc-amount">${g.observacion||""}</div></div>
    <div style="font-size:11px;color:#94a3b8">${g.rut||"—"}</div>
    <div style="font-size:12px;color:#64748b">${g.tipo_documento||"—"}</div>
    <div><span class="cat-badge ${getCategoriaClass(g.categoria)}">${g.categoria||"Sin categoría"}</span></div>
    <div>${formatoCLP(g.neto)}</div>
    <div>${g.iva?formatoCLP(g.iva):"—"}</div>
    <div>${g.total?formatoCLP(g.total):"—"}</div>
    <div style="text-align:center">${numberValue(g.iva)>0?"✔":"—"}</div>
    <div style="font-size:12px;color:#64748b">${g.metodo_pago||"—"}</div>
    <div class="doc-actions">
      <button class="action-btn foto-btn" data-path="${g.foto_path||""}" title="${g.foto_path?"Ver comprobante":"Sin comprobante"}" style="${g.foto_path?"":"opacity:.3;cursor:default"}">📎</button>
      <button class="action-btn" title="Editar" onclick="openEditModal('${g.id}')">✏️</button>
      <button class="action-btn" title="Eliminar" onclick="confirmDelete('${g.id}','${safeNombre}','${g.foto_path||""}')">🗑️</button>
    </div>
  </div>`;
}

async function renderDocs(limit=docsVisibleLimit){
  const el=$("docs-table"),sub=$("docs-subtitle"),btn=$("load-more-btn");if(!el)return;
  if(sub)sub.textContent=`${filteredDocs.length} registros · datos cargados desde Supabase`;
  if(!filteredDocs.length){el.innerHTML=emptyState("No hay gastos registrados.");if(btn)btn.style.display="none";updateBulkBar();return;}
  const slice=filteredDocs.slice(0,limit);
  el.innerHTML=slice.map(g=>gastoRowHTML(g)).join("");
  if(btn)btn.style.display=filteredDocs.length>limit?"inline-flex":"none";
  updateBulkBar();
  // Cargar URLs firmadas async
  el.querySelectorAll(".foto-btn").forEach(async b=>{
    const path=b.dataset.path;if(!path)return;
    const url=await getFotoUrl(path);
    if(url){b.style.opacity="1";b.style.cursor="pointer";b.onclick=()=>window.open(url,"_blank");}
  });
}

function toggleRowSelect(id, chk){
  if(chk.checked) selectedIds.add(String(id));
  else selectedIds.delete(String(id));
  // Actualizar clase visual de la fila
  const row=document.querySelector(`.gastos-row[data-id="${id}"]`);
  if(row) row.classList.toggle("row-selected", chk.checked);
  updateBulkBar();
}

function toggleSelectAll(chk){
  const slice=filteredDocs.slice(0,docsVisibleLimit);
  slice.forEach(g=>{
    if(chk.checked) selectedIds.add(String(g.id));
    else selectedIds.delete(String(g.id));
  });
  renderDocs(docsVisibleLimit);
}

function cancelBulkSelection(){
  selectedIds.clear();
  renderDocs(docsVisibleLimit);
}

async function bulkDelete(){
  if(selectedIds.size===0)return;
  if(!confirm(`¿Eliminar ${selectedIds.size} gasto${selectedIds.size!==1?"s":""}?\nEsta acción no se puede deshacer.`))return;
  if(typeof window.supabaseClient==="undefined"){alert("Sin conexión.");return;}
  const ids=[...selectedIds];
  // Obtener foto_paths de los registros seleccionados para borrar del storage
  const toDelete=gastos.filter(g=>ids.includes(String(g.id)));
  const fotoPaths=toDelete.map(g=>g.foto_path).filter(Boolean);
  // Borrar archivos del storage
  if(fotoPaths.length>0){
    const{error:se}=await window.supabaseClient.storage.from(BUCKET_NAME).remove(fotoPaths);
    if(se) console.warn("Error borrando archivos:",se.message);
  }
  // Borrar registros en lotes de 50
  for(let i=0;i<ids.length;i+=50){
    const batch=ids.slice(i,i+50);
    const{error}=await window.supabaseClient.from("gastos_junquillar_app").delete().in("id",batch);
    if(error){alert(`Error eliminando lote: ${error.message}`);break;}
  }
  selectedIds.clear();
  await loadData();
}

async function getFotoUrl(path){
  if(!path||typeof window.supabaseClient==="undefined") return null;
  try{
    const{data,error}=await window.supabaseClient.storage.from(BUCKET_NAME).createSignedUrl(path,300);
    if(error||!data?.signedUrl) return null;
    return data.signedUrl;
  }catch(e){return null;}
}

/* ── FILTROS (unificados, funcionan en Gastos) ────────────── */
function applyFilters(){
  const text=(($("filter-text-gastos")?.value||$("global-search")?.value||"")).toLowerCase().trim();
  const cat=$("filter-cat-gastos")?.value||"";
  const tipo=$("filter-tipo-gastos")?.value||"";
  const desde=$("filter-desde-gastos")?.value||"";
  const hasta=$("filter-hasta-gastos")?.value||"";
  const pago=$("filter-pago-gastos")?.value||"";
  filteredDocs=gastos.filter(g=>{
    const hay=[g.proveedor,g.rut,g.tipo_documento,g.numero_documento,g.categoria,g.metodo_pago,g.observacion].join(" ").toLowerCase();
    const f=fechaOrdenable(g.fecha);
    if(text&&!hay.includes(text))return false;
    if(cat&&g.categoria!==cat)return false;
    if(tipo&&g.tipo_documento!==tipo)return false;
    if(pago&&g.metodo_pago!==pago)return false;
    if(desde&&f<desde)return false;
    if(hasta&&f>hasta)return false;
    return true;
  });
  docsVisibleLimit=10;renderDocs();
}
function clearFilters(){
  ["filter-text-gastos","filter-cat-gastos","filter-tipo-gastos","filter-desde-gastos","filter-hasta-gastos","filter-pago-gastos","global-search"].forEach(id=>{const el=$(id);if(el)el.value="";});
  filteredDocs=[...gastos];docsVisibleLimit=10;renderDocs();
}

/* ── EDIT / DELETE MODAL ──────────────────────────────────── */
function openEditModal(id){
  const g=gastos.find(x=>String(x.id)===String(id));if(!g)return;
  editModalGasto=g;
  const m=$("modal-overlay");if(!m)return;
  $("em-fecha").value=g.fecha||"";
  $("em-proveedor").value=g.proveedor||"";
  $("em-rut").value=g.rut||"";
  $("em-tipo").value=g.tipo_documento||"";
  $("em-ndoc").value=g.numero_documento||"";
  $("em-neto").value=g.neto||"";
  $("em-iva").value=g.iva||"";
  $("em-total").value=g.total||"";
  $("em-cat").value=g.categoria||"";
  $("em-pago").value=g.metodo_pago||"";
  $("em-obs").value=g.observacion||"";
  m.classList.remove("modal-hidden");
}
function closeEditModal(){ $("modal-overlay")?.classList.add("modal-hidden"); editModalGasto=null; }
async function saveEditModal(){
  if(!editModalGasto)return;
  const updates={
    fecha:$("em-fecha")?.value||editModalGasto.fecha,
    proveedor:$("em-proveedor")?.value||null,
    rut:$("em-rut")?.value||null,
    tipo_documento:$("em-tipo")?.value||null,
    numero_documento:$("em-ndoc")?.value||null,
    neto:toNum($("em-neto")?.value)||0,
    iva:toNum($("em-iva")?.value)||0,
    total:toNum($("em-total")?.value)||0,
    categoria:$("em-cat")?.value||null,
    metodo_pago:$("em-pago")?.value||null,
    observacion:$("em-obs")?.value||null
  };
  if(typeof window.supabaseClient==="undefined"){alert("Sin conexión a Supabase.");return;}
  const{error}=await window.supabaseClient.from("gastos_junquillar_app").update(updates).eq("id",editModalGasto.id);
  if(error){alert(`Error guardando: ${error.message}`);return;}
  closeEditModal();await loadData();
}
async function confirmDelete(id,nombre,fotoPath){
  if(!confirm(`¿Eliminar el gasto de "${nombre}"?\nEsta acción no se puede deshacer.`))return;
  if(typeof window.supabaseClient==="undefined"){alert("Sin conexión.");return;}
  // Borrar archivo del storage si existe
  if(fotoPath){
    const{error:storageErr}=await window.supabaseClient.storage.from(BUCKET_NAME).remove([fotoPath]);
    if(storageErr) console.warn("No se pudo borrar el archivo del storage:",storageErr.message);
  }
  // Borrar registro de la tabla
  const{error}=await window.supabaseClient.from("gastos_junquillar_app").delete().eq("id",id);
  if(error){alert(`Error eliminando: ${error.message}`);return;}
  await loadData();
}

/* ── PROVEEDORES ──────────────────────────────────────────── */
function renderProveedores(){
  const el=$("proveedores-table");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin proveedores.");return;}
  const groups=groupBy(gastos,g=>g.proveedor||"Pendiente OCR"),totalNeto=sumBy(gastos,"neto");
  el.innerHTML=Object.entries(groups).map(([name,rows])=>({name,rut:rows.find(r=>r.rut)?.rut||"—",cat:rows.find(r=>r.categoria)?.categoria||"Sin categoría",docs:rows.length,costo:sumBy(rows,"neto"),iva:sumBy(rows,"iva")})).sort((a,b)=>b.costo-a.costo).slice(0,20).map((p,i)=>`<div class="table-row prov-row"><div>${i+1}</div><div class="doc-name">${p.name}</div><div>${p.rut}</div><div><span class="cat-badge ${getCategoriaClass(p.cat)}">${p.cat}</span></div><div>${p.docs}</div><div>${formatoCLP(p.costo)}</div><div>${formatoCLP(p.iva)}</div><div>${formatoPct(totalNeto?(p.costo/totalNeto)*100:0)}</div></div>`).join("");
}

/* ── CAJA ─────────────────────────────────────────────────── */
let cajaEstado = JSON.parse(localStorage.getItem("junqo_caja_estado") || "null") || null;
// cajaEstado: { abierta, fechaApertura, horaApertura, saldoInicial, responsable, obsApertura,
//               fechaCierre, horaCierre, saldoCierre, obsCierre, cuadro, diferencia }

function saveCajaEstado(){ localStorage.setItem("junqo_caja_estado", JSON.stringify(cajaEstado)); }

function renderCaja(){ renderCajaControl(); renderCajaKpis(); renderCajaTipos(); renderCajaMensual(); }

function renderCajaControl(){
  const el = $("caja-control");
  if(!el) return;
  const abierta = cajaEstado?.abierta === true;
  const cerrada = cajaEstado && !cajaEstado.abierta && cajaEstado.saldoCierre !== undefined;

  let statusHtml = "";
  if(!cajaEstado){
    statusHtml = `<div class="caja-status caja-sin-movimiento">
      <span class="caja-status-icon">🔒</span>
      <div><div class="caja-status-label">Caja cerrada</div><div class="caja-status-sub">No hay registro de apertura</div></div>
    </div>`;
  } else if(abierta){
    const ingresosDelDia = (typeof ventasIngresos!=="undefined"?ventasIngresos:[])
      .filter(v=>v.estado==="Recibido").reduce((a,v)=>a+numberValue(v.monto),0);
    const saldoEsperado = numberValue(cajaEstado.saldoInicial) + ingresosDelDia;
    statusHtml = `<div class="caja-status caja-abierta">
      <span class="caja-status-icon">🟢</span>
      <div><div class="caja-status-label">Caja abierta</div>
      <div class="caja-status-sub">Desde ${cajaEstado.fechaApertura||"—"} ${cajaEstado.horaApertura||""} · Responsable: ${cajaEstado.responsable||"—"}</div></div>
    </div>
    <div class="caja-detalle" style="margin-top:14px">
      <div class="caja-comp-row"><span>Saldo inicial</span><strong>${formatoCLP(cajaEstado.saldoInicial||0)}</strong></div>
      <div class="caja-comp-row"><span>Ingresos recibidos (Ventas)</span><strong style="color:var(--green)">${formatoCLP(ingresosDelDia)}</strong></div>
      <div class="caja-comp-row caja-comp-result"><span><strong>Saldo esperado al cierre</strong></span><strong>${formatoCLP(saldoEsperado)}</strong></div>
      ${cajaEstado.obsApertura?`<div class="caja-comp-row"><span>Observación</span><span style="color:var(--muted)">${cajaEstado.obsApertura}</span></div>`:""}
    </div>`;
  } else if(cerrada){
    const ok = cajaEstado.cuadro;
    statusHtml = `<div class="caja-status ${ok?"caja-cuadro":"caja-descuadro"}">
      <span class="caja-status-icon">${ok?"✅":"❌"}</span>
      <div><div class="caja-status-label">${ok?"Caja cerrada — Cuadró":"Caja cerrada — No cuadró"}</div>
      <div class="caja-status-sub">Cerrada el ${cajaEstado.fechaCierre||"—"} ${cajaEstado.horaCierre||""}</div></div>
    </div>
    <div class="caja-detalle" style="margin-top:14px">
      <div class="caja-comp-row"><span>Saldo inicial</span><strong>${formatoCLP(cajaEstado.saldoInicial||0)}</strong></div>
      <div class="caja-comp-row"><span>Saldo esperado</span><strong>${formatoCLP(cajaEstado.saldoEsperado||0)}</strong></div>
      <div class="caja-comp-row"><span>Saldo contado al cierre</span><strong>${formatoCLP(cajaEstado.saldoCierre||0)}</strong></div>
      <div class="caja-comp-row caja-comp-result">
        <span><strong>Diferencia</strong></span>
        <strong style="color:${ok?'var(--green)':'var(--red)'}">${formatoCLP(cajaEstado.diferencia||0)}</strong>
      </div>
      ${cajaEstado.obsCierre?`<div class="caja-comp-row"><span>Observación cierre</span><span style="color:var(--muted)">${cajaEstado.obsCierre}</span></div>`:""}
    </div>`;
  }

  el.innerHTML = `<div class="card" style="margin-bottom:16px">
    <div class="card-header-row">
      <div>
        <div class="card-title">🏦 Control de Caja</div>
        <div class="card-sub">Apertura, cierre y cuadre de caja diario</div>
      </div>
      <div style="display:flex;gap:8px">
        ${!abierta ? `<button class="jv-nuevo-btn" onclick="openModalAbrirCaja()">🔓 Abrir caja</button>` : ""}
        ${abierta ? `<button class="jv-nuevo-btn" style="background:var(--red)" onclick="openModalCerrarCaja()">🔒 Cerrar caja</button>` : ""}
        ${cerrada ? `<button class="filter-btn-clear" onclick="resetCaja()" style="margin:0">↺ Nueva apertura</button>` : ""}
      </div>
    </div>
    <div style="margin-top:16px">
      ${statusHtml}
    </div>
  </div>`;
}

function openModalAbrirCaja(){
  const now = new Date();
  $("ac-fecha").value = now.toISOString().slice(0,10);
  $("ac-hora").value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  $("ac-saldo").value = "";
  $("ac-responsable").value = "";
  $("ac-obs").value = "";
  $("modal-abrir-caja").classList.remove("modal-hidden");
}
function closeModalAbrirCaja(){ $("modal-abrir-caja").classList.add("modal-hidden"); }

function guardarAperturaCaja(){
  const saldo = Number($("ac-saldo").value);
  if(!$("ac-fecha").value){ showToast("⚠️ Ingresa la fecha de apertura."); return; }
  cajaEstado = {
    abierta: true,
    fechaApertura: $("ac-fecha").value,
    horaApertura: $("ac-hora").value,
    saldoInicial: saldo,
    responsable: ($("ac-responsable").value||"").trim(),
    obsApertura: ($("ac-obs").value||"").trim()
  };
  saveCajaEstado();
  closeModalAbrirCaja();
  renderCajaControl();
  showToast("✓ Caja abierta correctamente");
}

function openModalCerrarCaja(){
  if(!cajaEstado?.abierta){ showToast("⚠️ La caja no está abierta."); return; }
  const ingresosDelDia = (typeof ventasIngresos!=="undefined"?ventasIngresos:[])
    .filter(v=>v.estado==="Recibido").reduce((a,v)=>a+numberValue(v.monto),0);
  const saldoEsperado = numberValue(cajaEstado.saldoInicial) + ingresosDelDia;
  const now = new Date();
  $("cc-fecha").value = now.toISOString().slice(0,10);
  $("cc-hora").value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  $("cc-saldo-esperado").value = formatoCLP(saldoEsperado);
  $("cc-saldo").value = "";
  $("cc-obs").value = "";
  $("modal-cerrar-caja").classList.remove("modal-hidden");
}
function closeModalCerrarCaja(){ $("modal-cerrar-caja").classList.add("modal-hidden"); }

function guardarCierreCaja(){
  if(!$("cc-fecha").value){ showToast("⚠️ Ingresa la fecha de cierre."); return; }
  const ingresosDelDia = (typeof ventasIngresos!=="undefined"?ventasIngresos:[])
    .filter(v=>v.estado==="Recibido").reduce((a,v)=>a+numberValue(v.monto),0);
  const saldoEsperado = numberValue(cajaEstado.saldoInicial) + ingresosDelDia;
  const saldoCierre = Number($("cc-saldo").value) || 0;
  const diferencia = saldoCierre - saldoEsperado;
  const cuadro = Math.abs(diferencia) < 1;
  cajaEstado = {
    ...cajaEstado,
    abierta: false,
    fechaCierre: $("cc-fecha").value,
    horaCierre: $("cc-hora").value,
    saldoEsperado,
    saldoCierre,
    diferencia,
    cuadro,
    obsCierre: ($("cc-obs").value||"").trim()
  };
  saveCajaEstado();
  closeModalCerrarCaja();
  renderCajaControl();
  showToast(cuadro ? "✅ Caja cuadró correctamente" : `❌ Caja no cuadró. Diferencia: ${formatoCLP(diferencia)}`);
}

function resetCaja(){
  if(!confirm("¿Registrar una nueva apertura de caja? Se perderá el registro actual.")) return;
  cajaEstado = null;
  saveCajaEstado();
  renderCajaControl();
  showToast("↺ Registro de caja reiniciado");
}
function renderCajaKpis(){
  const el=$("caja-kpis");if(!el)return;
  const t=getTotals(),docsConIva=gastos.filter(g=>numberValue(g.iva)>0).length;
  el.innerHTML=[["Costo neto registrado",formatoCLP(t.neto),`${t.docs} documentos`],["IVA crédito fiscal",formatoCLP(t.iva),"Desde IVA registrado"],["Total documentos",formatoCLP(t.total),"Neto + IVA"],["Docs con IVA",docsConIva,"Con crédito fiscal"]].map(c=>`<div class="kpi-card"><div class="kpi-top"><div><div class="kpi-title">${c[0]}</div><div class="kpi-value">${c[1]}</div></div></div><div class="kpi-footer">${c[2]}</div></div>`).join("");
}
function renderCajaTipos(){
  const el=$("caja-tipos");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin información.");return;}
  const g=groupBy(gastos,x=>x.tipo_documento||"Sin tipo");
  el.innerHTML=Object.entries(g).map(([tipo,rows])=>`<div class="table-row caja-tipos-row"><div>${tipo}</div><div>${rows.length}</div><div>${formatoCLP(sumBy(rows,"neto"))}</div><div>${formatoCLP(sumBy(rows,"iva"))}</div><div>${sumBy(rows,"iva")>0?"✔":"—"}</div><div>${sumBy(rows,"iva")>0?"IVA CF":"Sin IVA"}</div></div>`).join("");
}
function renderCajaMensual(){
  const el=$("caja-mensual");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin detalle.");return;}
  const g=groupBy(gastos,x=>mesLabel(x.fecha));let acum=0;
  el.innerHTML=Object.entries(g).sort(([a],[b])=>a.localeCompare(b)).map(([mes,rows])=>{const iva=sumBy(rows,"iva");acum+=iva;return`<div class="table-row caja-mensual-row"><div>${mes}</div><div>${rows.filter(r=>numberValue(r.iva)>0).length}</div><div>${formatoCLP(sumBy(rows,"neto"))}</div><div>${formatoCLP(iva)}</div><div>${formatoCLP(acum)}</div></div>`;}).join("");
}

/* ── BALANCE ──────────────────────────────────────────────── */
function renderBalance(){
  const el = $("balance-table");
  if(!el) return;

  const rows = getBalanceRows();
  const hasMovements = gastos.length > 0 || getVentasTotals().totalIngresos > 0;

  if(!hasMovements){
    el.innerHTML = emptyState("Sin movimientos registrados.");
    return;
  }

  const clp = v => formatoCLP(v);
  const z = () => `<span style="color:#94a3b8">$0</span>`;
  const cell = (v, col) => (!v || v === 0) ? z() : (col ? `<span style="color:${col};font-weight:600">${clp(v)}</span>` : clp(v));
  const sec = l => `<div class="bal-section">${l}</div>`;

  const rowHtml = r => {
    const isTotal = String(r.Cuenta).toUpperCase() === "TOTAL";
    return `<div class="bal-row${isTotal ? " bal-total" : ""}">
      <div class="bal-n">${r["N°"] ?? ""}</div>
      <div class="bal-cuenta">${r.Cuenta}</div>
      <div class="bal-num">${cell(r.Debe)}</div>
      <div class="bal-num">${cell(r.Haber)}</div>
      <div class="bal-num">${cell(r.Deudor)}</div>
      <div class="bal-num">${cell(r.Acreedor)}</div>
      <div class="bal-num">${cell(r.Activo, "#059669")}</div>
      <div class="bal-num">${cell(r.Pasivo)}</div>
      <div class="bal-num">${cell(r.Pérdida, "#e11d48")}</div>
      <div class="bal-num">${cell(r.Ganancia, "#059669")}</div>
    </div>`;
  };

  const activos    = rows.filter(r => r._seccion === "activo");
  const pasivos    = rows.filter(r => r._seccion === "pasivo");
  const patrimonio = rows.filter(r => r._seccion === "patrimonio");
  const ajuste     = rows.filter(r => r._seccion === "ajuste");
  const resultados = rows.filter(r => r._seccion === "resultado");
  const total      = rows.find(r => r.Cuenta === "TOTAL");

  const v = getVentasTotals();
  const modoVendido = v.totalVentasPropiedad > 0;
  const TERRENO_VAL = 100000000;
  const t = getTotals();

  let modoBadge, resultNote;
  if (modoVendido) {
    const utilidad = v.totalVentasPropiedad - TERRENO_VAL - t.neto;
    const utilStr  = utilidad >= 0
      ? `Utilidad neta: <strong style="color:#059669">${formatoCLP(utilidad)}</strong>`
      : `Pérdida neta: <strong style="color:#e11d48">${formatoCLP(Math.abs(utilidad))}</strong>`;
    modoBadge = `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;margin-bottom:12px;border-radius:20px;font-size:12px;font-weight:700;background:#fef9c3;color:#854d0e;border:1px solid #fde047">🏠 PROYECTO VENDIDO</div>`;
    resultNote = `Terreno y Obra reclasificados como costo de venta en columna Pérdida. ${utilStr}. Utilidad cierra en Patrimonio (columna Pasivo) y equilibra la columna Pérdida. IVA CF permanece como activo tributario.`;
  } else {
    modoBadge = `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;margin-bottom:12px;border-radius:20px;font-size:12px;font-weight:700;background:#f0fdf4;color:#166534;border:1px solid #86efac">🏗️ EN EJECUCIÓN</div>`;
    resultNote = `Sin ventas de propiedad — Pérdida y Ganancia = $0. Gastos capitalizados como <em>Obra en Curso</em>. Aportes = Patrimonio; Anticipos = Pasivo. La brecha entre inversiones y fuentes conocidas se muestra como "Financiamiento a determinar".`;
  }

  el.innerHTML = `
    <div class="bal-wrap">
      ${modoBadge}
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
      ${sec("ACTIVOS")}
      ${activos.map(rowHtml).join("")}
      ${pasivos.length ? sec("PASIVOS") + pasivos.map(rowHtml).join("") : ""}
      ${sec("PATRIMONIO / FINANCIAMIENTO")}
      ${patrimonio.map(rowHtml).join("")}
      ${ajuste.map(rowHtml).join("")}
      ${resultados.length ? sec("RESULTADOS") + resultados.map(rowHtml).join("") : ""}
      ${total ? rowHtml(total) : ""}
      <div class="balance-note">ℹ️ ${resultNote}</div>
    </div>`;
}

/* ── CONTROL DE PROYECTO ──────────────────────────────────── */
function renderControlProyecto(){renderControlEtapas();renderControlCat();}
function renderControlKpis(){
  const el=$("control-kpis");if(!el)return;
  const t=getTotals(),av=PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0;
  el.innerHTML=[
    ["Avance financiero",formatoPct(av),`${formatoCLP(t.neto)} ejecutado`],
    ["Presupuesto referencial",formatoCLP(PROJECT_BUDGET),"Base de comparación"],
    ["Saldo estimado",formatoCLP(Math.max(PROJECT_BUDGET-t.neto,0)),"Presupuesto menos ejecutado"],
    ["Partidas con gasto",uniqueCount(gastos,"categoria"),"Categorías registradas"]
  ].map(c=>`<div class="kpi-card"><div class="kpi-title">${c[0]}</div><div class="kpi-value">${c[1]}</div><div class="kpi-footer">${c[2]}</div></div>`).join("");
}
function renderControlEtapas(){
  const el=$("control-etapas");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin avance registrado.");return;}
  const groups=groupBy(gastos,g=>g.categoria||"Sin categoría"),total=sumBy(gastos,"neto");
  const sorted=Object.entries(groups).map(([cat,rows])=>({cat,rows,monto:sumBy(rows,"neto")})).sort((a,b)=>b.monto-a.monto);
  el.innerHTML=`<div class="etapas-cards-grid">${sorted.map(({cat,rows,monto})=>{
    const pct=total?(monto/total)*100:0,avg=rows.length?monto/rows.length:0;
    return`<div class="etapa-card-item">
      <div class="etapa-card-top">
        <span class="cat-badge ${getCategoriaClass(cat)}">${cat}</span>
        <span class="etapa-card-pct">${formatoPct(pct)}</span>
      </div>
      <div class="etapa-card-monto">${formatoCLP(monto)}</div>
      <div class="cat-track" style="margin-top:10px">
        <div class="cat-fill" style="width:${Math.min(pct,100)}%"></div>
      </div>
      <div class="etapa-card-meta">
        <span>${rows.length} doc${rows.length!==1?"s":""}</span>
        <span>Prom. ${formatoCLP(avg)}</span>
      </div>
    </div>`;
  }).join("")}</div>`;
}
function renderControlHitos(){
  const el=$("control-hitos");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin hitos.");return;}
  const t=getTotals();
  const hitos=[
    {icon:"📄",label:"Documentación", estado:t.pendientesOcr>0?"Pendiente":"Completo",         desc:`${t.pendientesOcr} docs pendientes OCR`,                          ok:t.pendientesOcr===0},
    {icon:"💰",label:"Presupuesto",   estado:t.neto>PROJECT_BUDGET?"Sobre ppto":"En control",  desc:`${formatoCLP(t.neto)} ejecutado`,                                 ok:t.neto<=PROJECT_BUDGET},
    {icon:"🏢",label:"Proveedores",   estado:t.proveedores>0?"Con actividad":"Sin actividad",   desc:`${t.proveedores} proveedores registrados`,                        ok:t.proveedores>0},
    {icon:"📊",label:"Avance",        estado:t.neto>0?"En progreso":"Sin inicio",               desc:`${formatoPct(PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0)} del ppto`, ok:t.neto>0}
  ];
  el.innerHTML=`<div class="hitos-2x2">${hitos.map(h=>`
    <div class="hito-tile">
      <div class="hito-tile-top">
        <span class="hito-tile-icon">${h.icon}</span>
        <span class="status ${h.ok?"s-green":"s-amber"}">${h.estado}</span>
      </div>
      <div class="hito-tile-label">${h.label}</div>
      <div class="hito-tile-desc">${h.desc}</div>
    </div>`).join("")}</div>`;
}
function renderControlCat(){
  const el=$("control-cat");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin costos.");return;}
  const cg=groupBy(gastos,g=>g.categoria||"Sin categoría"),total=sumBy(gastos,"neto"),months=[...new Set(gastos.map(g=>mesLabel(g.fecha)))].sort().slice(0,5);
  const head=document.querySelector(".ctrl-cat-head");
  if(head) head.innerHTML=`<div>Categoría</div><div>Tipo</div>${months.map(m=>`<div>${m}</div>`).join("")}${Array.from({length:5-months.length}).map(()=>`<div></div>`).join("")}<div>Total</div><div>%</div>`;
  const sorted=Object.entries(cg).sort((a,b)=>sumBy(b[1],"neto")-sumBy(a[1],"neto"));
  el.innerHTML=sorted.map(([cat,rows])=>{
    const bm=groupBy(rows,r=>mesLabel(r.fecha)),ct=sumBy(rows,"neto");
    const vals=Array.from({length:5}).map((_,i)=>`<div>${months[i]?formatoCLP(sumBy(bm[months[i]]||[],"neto")):"—"}</div>`).join("");
    return`<div class="table-row ctrl-cat-row"><div><span class="cat-badge ${getCategoriaClass(cat)}">${cat}</span></div><div style="font-size:11px;color:var(--muted)">Gasto</div>${vals}<div style="font-weight:600">${formatoCLP(ct)}</div><div><span class="kpi-chip" style="background:#d1fae511;color:#059669;border:1px solid #05966933">${formatoPct(total?(ct/total)*100:0)}</span></div></div>`;
  }).join("");
}

/* ── EXPORT BAR ──────────────────────────────────────────── */
let exportFormat = "csv";

const EXPORT_REPORTS = [
  { key:"gastos",       label:"Gastos",       icon:"📋" },
  { key:"balance",      label:"Balance",      icon:"⚖️" },
  { key:"proveedores",  label:"Proveedores",  icon:"🏢" },
  { key:"ventas",       label:"Ventas",       icon:"💰" },
  { key:"cotizaciones", label:"Cotizaciones", icon:"📝" },
  { key:"contactos",    label:"Contactos",    icon:"👥" },
  { key:"insumos",      label:"Insumos",      icon:"🔧" },
  { key:"iva",          label:"IVA CF",       icon:"💵" },
];

function getExportData(key){
  if(key==="gastos"){
    return{ name:"Gastos", headers:["Fecha","Proveedor","RUT","Tipo Documento","N° Documento","Categoría","Neto","IVA","Total","Método Pago","Estado OCR"],
      rows:gastos.map(g=>[normalizarFecha(g.fecha),g.proveedor||"",g.rut||"",g.tipo_documento||"",g.numero_documento||"",g.categoria||"",g.neto,g.iva,g.total,g.metodo_pago||"",g.estado_ocr||""]) };
  }
  if(key==="balance"){
    const rows = getBalanceRows().map(r => [
      r["N°"],
      r.Cuenta,
      r.Debe,
      r.Haber,
      r.Deudor,
      r.Acreedor,
      r.Activo,
      r.Pasivo,
      r.Pérdida,
      r.Ganancia
    ]);
    return{ name:"Balance", headers:["N°","Cuenta","Debe","Haber","Deudor","Acreedor","Activo","Pasivo","Pérdida","Ganancia"], rows };
  }
  if(key==="proveedores"){
    const grps=groupBy(gastos,g=>g.proveedor||"Pendiente"),tot=sumBy(gastos,"neto");
    const rows=Object.entries(grps).map(([prov,rs])=>{
      const neto=sumBy(rs,"neto"),iva=sumBy(rs,"iva"),t=sumBy(rs,"total");
      return[prov,rs[0]?.rut||"",rs.length,neto,iva,t,tot?(neto/tot*100).toFixed(1)+"%":"0%"];
    }).sort((a,b)=>b[3]-a[3]);
    return{ name:"Proveedores", headers:["Proveedor","RUT","N° Docs","Neto","IVA","Total","% s/ Total"], rows };
  }
  if(key==="ventas"){
    return{ name:"Ventas", headers:["Fecha","Concepto","Tipo","Monto","Estado"],
      rows:ventasIngresos.map(v=>[v.fecha,v.concepto,v.tipo,v.monto,v.estado]) };
  }
  if(key==="cotizaciones"){
    return{ name:"Cotizaciones", headers:["Fecha","Proveedor","Descripción","Neto","IVA","Total","Estado"],
      rows:ventasCotizaciones.map(c=>[c.fecha,c.proveedor,c.descripcion,c.neto,c.iva,c.total,c.estado]) };
  }
  if(key==="contactos"){
    return{ name:"Contactos", headers:["Nombre","Rol","Teléfono","Correo","Estado"],
      rows:ventasContactos.map(c=>[c.nombre,c.rol,c.telefono,c.correo,c.estado]) };
  }
  if(key==="insumos"){
    return{ name:"Insumos", headers:["Nombre","Categoría","Cantidad","Stock Mínimo","Unidad","Precio Unit.","Estado"],
      rows:insumosData.map(i=>[i.nombre,i.categoria,i.cantidad,i.stock_min,i.unidad,i.precio_unit,i.estado]) };
  }
  if(key==="iva"){
    const grps=groupBy(gastos,g=>mesLabel(g.fecha));
    let acum=0;
    const rows=Object.entries(grps).sort(([a],[b])=>a.localeCompare(b)).map(([mes,rs])=>{
      const iva=sumBy(rs,"iva"),neto=sumBy(rs,"neto"),docs=rs.filter(g=>g.iva>0).length;
      acum+=iva; return[mes,docs,neto,iva,acum];
    });
    return{ name:"IVA CF", headers:["Mes","Docs con CF","Neto","IVA CF","Acumulado CF"], rows };
  }
  return null;
}

function exportReport(key){
  const d=getExportData(key);
  if(!d||!d.rows.length){showToast("Sin datos para exportar.");return;}
  if(exportFormat==="csv")   exportAsCSV(d.name,d.headers,d.rows);
  if(exportFormat==="excel") exportAsExcel(d.name,d.headers,d.rows);
  if(exportFormat==="pdf")   exportAsPDF(d.name,d.headers,d.rows);
}
function exportAsCSV(name,headers,rows){
  const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv=[headers.join(";"),...rows.map(r=>r.map(esc).join(";"))].join("\n");
  downloadText(`${name.toLowerCase().replace(/\s/g,"_")}_junqo.csv`,"﻿"+csv);
  showToast(`✅ ${name} exportado como CSV`);
}
function exportAsExcel(name,headers,rows){
  if(typeof window.XLSX==="undefined"){showToast("Librería Excel no disponible.");return;}
  const ws=window.XLSX.utils.aoa_to_sheet([headers,...rows]);
  const wb=window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
  window.XLSX.writeFile(wb,`${name.toLowerCase().replace(/\s/g,"_")}_junqo.xlsx`);
  showToast(`✅ ${name} exportado como Excel`);
}
function exportAsPDF(name,headers,rows){
  const trs=rows.map(r=>`<tr>${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name} — Junqo</title>
<style>body{font-family:system-ui,sans-serif;font-size:11px;padding:24px;color:#1e293b}
h2{font-size:15px;color:#059669;margin-bottom:4px}p{font-size:11px;color:#64748b;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
th{background:#f1f5f9;font-weight:600;padding:7px 9px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
td{padding:6px 9px;border-bottom:1px solid #f1f5f9;font-size:11px}
tr:last-child td{border-bottom:none}
.footer{margin-top:18px;font-size:9px;color:#94a3b8}
@media print{body{padding:0}}</style></head><body>
<h2>${name} — Junqo · Casa Junquillar</h2>
<p>Generado el ${new Date().toLocaleString("es-CL")}</p>
<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${trs}</tbody></table>
<div class="footer">Junqo App · Casa Junquillar · ${new Date().getFullYear()}</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;
  const w=window.open("","_blank","width=900,height=700");
  if(w){w.document.write(html);w.document.close();}
  showToast(`🖨️ ${name} listo para imprimir / guardar PDF`);
}
function setExportFormat(fmt){
  exportFormat=fmt;
  renderExportBar();
}
function renderExportBar(){
  const el=$("reportes-export");if(!el)return;
  const fmts=[{key:"csv",label:"CSV",icon:"📄"},{key:"excel",label:"Excel",icon:"📊"},{key:"pdf",label:"PDF / Imprimir",icon:"🖨️"}];
  el.innerHTML=`
    <div class="export-bar-top">
      <span class="export-bar-label">Formato:</span>
      <div class="export-fmt-row">
        ${fmts.map(f=>`<button class="export-fmt-btn${exportFormat===f.key?" export-fmt-active":""}" onclick="setExportFormat('${f.key}')">${f.icon} ${f.label}</button>`).join("")}
      </div>
    </div>
    <div class="export-chips-row">
      ${EXPORT_REPORTS.map(r=>`<button class="export-chip" onclick="exportReport('${r.key}')">${r.icon} ${r.label}</button>`).join("")}
    </div>`;
}
window.setExportFormat=setExportFormat;
window.exportReport=exportReport;

/* ── REPORTES ─────────────────────────────────────────────── */
const WIDGET_DEFS = {
  cat:         { label:"Por Categoría",         icon:"🏷️" },
  mensual:     { label:"Mensual",               icon:"📅" },
  proveedores: { label:"Top Proveedores",        icon:"🏢" },
  iva:         { label:"IVA Crédito Fiscal",     icon:"💵" },
  avance:      { label:"Avance Financiero",      icon:"📊" },
  documentos:  { label:"Documentos por Tipo",   icon:"📄" },
  metodo_pago: { label:"Método de Pago",         icon:"💳" },
  mensual_iva: { label:"IVA Mensual",            icon:"🧾" },
};

function renderReportes(){
  renderReportHeader();
  renderReportKPIs();
  renderReportDiagnostico();
  renderReportAlertas();
  renderReportCharts();
  renderResumenCategoria();
  renderResumenTributario();
  // Mantener la funcionalidad existente
  renderExportBar();
  renderReportConfig();
  renderReportWidgets();
}

/* ── REPORTE EJECUTIVO: Header ────────────────────────────── */
function renderReportHeader(){
  const now=new Date();
  const meses=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const periodo=`${meses[now.getMonth()]} ${now.getFullYear()}`;
  const actualizada=`Última actualización: ${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  
  const periodEl=$("report-period");
  const updatedEl=$("report-updated");
  if(periodEl)periodEl.textContent=periodo;
  if(updatedEl)updatedEl.textContent=actualizada;
}

/* ── REPORTE EJECUTIVO: KPIs ──────────────────────────────── */
function renderReportKPIs(){
  const t=getTotals();
  const avance=PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0;
  
  const kpiPresupuesto=$("kpi-presupuesto");
  const kpiEjecutado=$("kpi-ejecutado");
  const kpiAvance=$("kpi-avance");
  const kpiAvanceBar=$("kpi-avance-bar");
  const kpiIva=$("kpi-iva");
  
  if(kpiPresupuesto)kpiPresupuesto.textContent=formatoCLP(PROJECT_BUDGET);
  if(kpiEjecutado)kpiEjecutado.textContent=formatoCLP(t.neto);
  if(kpiAvance)kpiAvance.textContent=formatoPct(avance);
  if(kpiAvanceBar)kpiAvanceBar.style.width=`${Math.min(avance,100)}%`;
  if(kpiIva)kpiIva.textContent=formatoCLP(t.iva);
}

/* ── REPORTE EJECUTIVO: Diagnóstico ───────────────────────── */
function renderReportDiagnostico(){
  const t=getTotals();
  const avance=PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0;
  
  // Obtener categorías principales
  const groups=groupBy(gastos,g=>g.categoria||"Sin categoría");
  const catEntries=Object.entries(groups).map(([cat,rows])=>({cat,monto:sumBy(rows,"neto")})).sort((a,b)=>b.monto-a.monto);
  const principalCat=catEntries.length>0?catEntries[0].cat:"Sin datos";
  
  let diagnostico="";
  if(gastos.length===0){
    diagnostico="No hay datos de gastos registrados. La vista se mostrará con valores en cero hasta que se carguen documentos.";
  }else if(avance<30){
    diagnostico=`El proyecto se encuentra en etapa inicial con un ${formatoPct(avance)} de avance financiero. Los gastos registrados ascienden a ${formatoCLP(t.neto)} netos, concentrados principalmente en ${principalCat}. Se recomienda continuar con el registro de comprobantes para mantener el control del presupuesto.`;
  }else if(avance<70){
    diagnostico=`El proyecto mantiene un avance financiero controlado del ${formatoPct(avance)}. La mayor concentración de gasto está en ${principalCat}. El IVA crédito fiscal acumulado de ${formatoCLP(t.iva)} se mantiene disponible para compensación futura.`;
  }else{
    diagnostico=`El proyecto se encuentra en etapa avanzada con un ${formatoPct(avance)} de ejecución presupuestaria. Se han registrado ${gastos.length} documentos por un total neto de ${formatoCLP(t.neto)}. Se recomienda revisar las desviaciones por categoría para asegurar el cierre dentro del presupuesto.`;
  }
  
  const diagEl=$("diagnostico-text");
  if(diagEl)diagEl.textContent=diagnostico;
}

/* ── REPORTE EJECUTIVO: Alertas ───────────────────────────── */
function renderReportAlertas(){
  const t=getTotals();
  const avance=PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0;
  const alertas=[];
  
  // Verificar sobrecostos
  if(avance>100){
    alertas.push({tipo:"error",texto:"Sobrecosto detectado: el ejecutado supera el presupuesto total"});
  }else if(avance>85){
    alertas.push({tipo:"warning",texto:"Alerta: el proyecto está acercándose al presupuesto (85%+)"});  
  }

  // Verificar categorías con desviación
  const groups=groupBy(gastos,g=>g.categoria||"Sin categoría");
  const presupuestoPorCat=PROJECT_BUDGET/5; // Distribución aproximada
  for(const[cat,rows]of Object.entries(groups)){
    const monto=sumBy(rows,"neto");
    if(monto>presupuestoPorCat*1.2){
      alertas.push({tipo:"warning",texto:`Partida "${cat}" supera el 120% del umbral presupuestado`});
    }
  }
  
  // Verificar documentos pendientes
  const pendientes=gastos.filter(g=>String(g.estado_ocr||"").toLowerCase()==="pendiente").length;
  if(pendientes>0){
    alertas.push({tipo:"info",texto:`${pendientes} documento(s) pendiente(s) de procesamiento OCR`});
  }
  
  // Verificar documentación
  if(gastos.length>0){
    alertas.push({tipo:"success",texto:"Documentación tributaria al día"});
  }
  
  if(alertas.length===0){
    alertas.push({tipo:"success",texto:"Sin sobrecostos críticos. El proyecto se encuentra dentro de los parámetros esperados."});
  }
  
  const alertasEl=$("alertas-list");
  if(alertasEl){
    alertasEl.innerHTML=alertas.map(a=>`
      <div class="alerta-item alerta-${a.tipo}">
        ${a.tipo==="error"?"🔴":a.tipo==="warning"?"🟡":a.tipo==="success"?"🟢":"🔵"} ${a.texto}
      </div>
    `).join("");
  }
}

/* ── REPORTE EJECUTIVO: Gráficos ──────────────────────────── */
let chartPresupuesto=null;
let chartCategoria=null;
let chartMensual=null;

function renderReportCharts(){
  // Verificar si Chart.js está disponible
  if(typeof Chart==="undefined"){
    // Mostrar mensaje de fallback
    const containers=["chart-presupuesto","chart-categoria","chart-mensual"];
    containers.forEach(id=>{
      const el=$(id);
      if(el)el.innerHTML='<div class="chart-fallback">Gráfico no disponible (Chart.js no cargado)</div>';
    });
    return;
  }
  
  const t=getTotals();
  
  // Gráfico 1: Presupuesto vs Ejecutado (barras)
  const ctx1=$("chart-presupuesto-canvas");
  if(ctx1){
    if(chartPresupuesto)chartPresupuesto.destroy();
    chartPresupuesto=new Chart(ctx1,{
      type:"bar",
      data:{
        labels:["Presupuesto","Ejecutado"],
        datasets:[{
          label:"Monto",
          data:[PROJECT_BUDGET,t.neto],
          backgroundColor:["#3b82f6","#10b981"],
          borderRadius:4
        }]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true, ticks:{callback:v=>formatoCLP(v)}}}}
    });
  }
  
  // Gráfico 2: Distribución por categoría (doughnut)
  const ctx2=$("chart-categoria-canvas");
  if(ctx2){
    const groups=groupBy(gastos,g=>g.categoria||"Sin categoría");
    const catData=Object.entries(groups).map(([cat,rows])=>({cat,monto:sumBy(rows,"neto")})).sort((a,b)=>b.monto-a.monto);
    if(chartCategoria)chartCategoria.destroy();
    chartCategoria=new Chart(ctx2,{
      type:"doughnut",
      data:{
        labels:catData.map(c=>c.cat),
        datasets:[{data:catData.map(c=>c.monto),backgroundColor:["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"]}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"right"}}}
    });
  }
  
  // Gráfico 3: Evolución mensual (línea)
  const ctx3=$("chart-mensual-canvas");
  if(ctx3){
    const groups=groupBy(gastos,g=>mesLabel(g.fecha));
    const sortedMeses=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b));
    const labels=sortedMeses.map(([mes])=>mes);
    const data=sortedMeses.map(([,rows])=>sumBy(rows,"neto"));
    if(chartMensual)chartMensual.destroy();
    chartMensual=new Chart(ctx3,{
      type:"line",
      data:{
        labels:labels.length?labels:["Sin datos"],
        datasets:[{label:"Gasto neto",data:data.length?data:[0],borderColor:"#3b82f6",backgroundColor:"rgba(59,130,246,0.1)",fill:true,tension:0.3}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>formatoCLP(v)}}}}
    });
  }
}

/* ── REPORTE EJECUTIVO: Resumen por Categoría ─────────────── */
function renderResumenCategoria(){
  const categorias=["Materiales","Mano de obra","Servicios","Herramientas","Transporte"];
  const presupuestoPorCat=PROJECT_BUDGET/categorias.length;
  
  const groups=groupBy(gastos,g=>g.categoria||"Sin categoría");
  const rows=categorias.map(cat=>{
    const catGastos=groups[cat]||[];
    const ejecutado=sumBy(catGastos,"neto");
    const diferencia=presupuestoPorCat-ejecutado;
    const pctAvance=presupuestoPorCat>0?(ejecutado/presupuestoPorCat)*100:0;
    return{cat,presupuesto:presupuestoPorCat,ejecutado,diferencia,pctAvance};
  });
  
  const tbody=$("resumen-categoria-body");
  if(tbody){
    tbody.innerHTML=rows.map(r=>`
      <tr>
        <td><span class="cat-badge ${getCategoriaClass(r.cat)}">${r.cat}</span></td>
        <td class="money">${formatoCLP(r.presupuesto)}</td>
        <td class="money">${formatoCLP(r.ejecutado)}</td>
        <td class="money ${r.diferencia<0?'text-red':'text-green'}">${formatoCLP(r.diferencia)}</td>
        <td class="money">${formatoPct(r.pctAvance)}</td>
      </tr>
    `).join("");
  }
}

/* ── REPORTE EJECUTIVO: Resumen Tributario ───────────────── */
function renderResumenTributario(){
  const t=getTotals();
  const docsConCF=gastos.filter(g=>numberValue(g.iva)>0).length;
  const docsSinCF=gastos.filter(g=>numberValue(g.iva)===0).length;
  
  const baseNeta=$("trib-base-neta");
  const ivaCF=$("trib-iva-cf");
  const docsCF=$("trib-docs-cf");
  const docsSin=$("trib-docs-sin-cf");
  
  if(baseNeta)baseNeta.textContent=formatoCLP(t.neto);
  if(ivaCF)ivaCF.textContent=formatoCLP(t.iva);
  if(docsCF)docsCF.textContent=String(docsConCF);
  if(docsSin)docsSin.textContent=String(docsSinCF);
}

/* ── REPORTE EJECUTIVO: Funciones de exportación ─────────── */
function exportToPDF(){
  showToast("📄 Generando PDF... (funcionalidad en desarrollo)");
  // Implementación básica usando window.print
  window.print();
}

function exportToExcel(){
  if(!gastos.length){
    showToast("⚠️ No hay datos para exportar");
    return;
  }
  const data=gastos.map(r=>({
    Fecha:normalizarFecha(r.fecha),
    Proveedor:r.proveedor||"",
    RUT:r.rut||"",
    "Tipo documento":r.tipo_documento||"",
    "N° documento":r.numero_documento||"",
    Categoría:r.categoria||"",
    "Costo neto":r.neto,
    "IVA":r.iva,
    "Total":r.total,
    "Método pago":r.metodo_pago||""
  }));
  
  if(typeof XLSX==="undefined"){
    showToast("⚠️ Librería Excel no disponible");
    return;
  }
  
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Reporte Ejecutivo");
  XLSX.writeFile(wb,`Reporte_Ejecutivo_${new Date().toISOString().split("T")[0]}.xlsx`);
  showToast("✅ Reporte Excel descargado");
}

function toggleDetalle(){
  const extras=$("report-extras");
  if(extras){
    extras.style.display=extras.style.display==="none"?"block":"none";
  }
}

window.exportToPDF=exportToPDF;
window.exportToExcel=exportToExcel;
window.toggleDetalle=toggleDetalle;

/* ── REPORTES: Configuración existente ───────────────────── */
function renderReportConfig(){
  const el=$("reportes-config");if(!el)return;
  el.innerHTML=`
    <div class="report-config-title">⚙️ Configurar widgets visibles</div>
    <div class="report-config-chips">
      ${Object.entries(WIDGET_DEFS).map(([k,w])=>`
        <button class="report-chip ${activeWidgets.includes(k)?"chip-active":""}" data-widget="${k}">
          ${w.icon} ${w.label}
        </button>`).join("")}
    </div>`;
  el.querySelectorAll(".report-chip").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const k=btn.dataset.widget;
      if(activeWidgets.includes(k)){
        if(activeWidgets.length<=1)return;
        activeWidgets=activeWidgets.filter(x=>x!==k);
      }else{ activeWidgets.push(k); }
      localStorage.setItem(REPORT_WIDGETS_KEY,JSON.stringify(activeWidgets));
      renderReportes();
    });
  });
}

function renderReportWidgets(){
  const el=$("reportes-widgets");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin datos.");return;}
  el.innerHTML=activeWidgets.map(k=>renderWidget(k)).join("");
}

function renderWidget(k){
  const def=WIDGET_DEFS[k];if(!def)return"";
  const t=getTotals();
  const card=(title,sub,content)=>`
    <div class="report-widget-card">
      <div class="report-widget-title">${def.icon} ${title}</div>
      <div class="report-widget-sub">${sub}</div>
      <div class="report-widget-body">${content}</div>
    </div>`;

  if(k==="cat"){
    const groups=groupBy(gastos,g=>g.categoria||"Sin categoría"),total=sumBy(gastos,"neto");
    const items=Object.entries(groups).map(([cat,rows])=>({cat,monto:sumBy(rows,"neto"),docs:rows.length})).sort((a,b)=>b.monto-a.monto);
    return card("Por Categoría","Gasto neto por categoría",`<div class="rw-etapas-grid">${items.map(r=>{const pct=total?(r.monto/total)*100:0;return`<div class="etapa-card-item"><div class="etapa-card-top"><span class="cat-badge ${getCategoriaClass(r.cat)}">${r.cat}</span><span class="etapa-card-pct">${formatoPct(pct)}</span></div><div class="etapa-card-monto">${formatoCLP(r.monto)}</div><div class="cat-track" style="margin-top:8px"><div class="cat-fill" style="width:${Math.min(pct,100)}%"></div></div><div class="etapa-card-sub">${r.docs} docs</div></div>`;}).join("")}</div>`);
  }
  if(k==="mensual"){
    const groups=groupBy(gastos,g=>mesLabel(g.fecha)),totalG=sumBy(gastos,"neto");
    const sorted=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b));
    return card("Reporte Mensual","Evolución de gastos por mes",`<div class="rw-etapas-grid">${sorted.map(([mes,rows])=>{const neto=sumBy(rows,"neto"),iva=sumBy(rows,"iva"),pct=totalG?(neto/totalG)*100:0;return`<div class="etapa-card-item"><div class="etapa-card-top"><span style="font-weight:700;color:var(--text)">${mes}</span><span class="etapa-card-pct">${formatoPct(pct)}</span></div><div class="etapa-card-monto">${formatoCLP(neto)}</div><div class="cat-track" style="margin-top:8px"><div class="cat-fill" style="width:${Math.min(pct,100)}%"></div></div><div class="etapa-card-sub">${rows.length} docs · IVA ${formatoCLP(iva)}</div></div>`;}).join("")}</div>`);
  }
  if(k==="proveedores"){
    const groups=groupBy(gastos,g=>g.proveedor||"Pendiente"),totalN=sumBy(gastos,"neto");
    const top=Object.entries(groups).map(([n,rows])=>({n,monto:sumBy(rows,"neto"),docs:rows.length})).sort((a,b)=>b.monto-a.monto).slice(0,6);
    return card("Top Proveedores","Por monto neto registrado",`<div class="rw-etapas-grid">${top.map(p=>{const pct=totalN?(p.monto/totalN)*100:0;return`<div class="etapa-card-item"><div class="etapa-card-top"><span style="font-size:13px;font-weight:600;color:var(--text)">${p.n}</span><span class="etapa-card-pct">${formatoPct(pct)}</span></div><div class="etapa-card-monto">${formatoCLP(p.monto)}</div><div class="cat-track" style="margin-top:8px"><div class="cat-fill" style="width:${Math.min(pct,100)}%"></div></div><div class="etapa-card-sub">${p.docs} docs</div></div>`;}).join("")}</div>`);
  }
  if(k==="iva"){
    const docsConIva=gastos.filter(g=>numberValue(g.iva)>0).length;
    return card("IVA Crédito Fiscal","Resumen tributario",`<div class="rw-kpi-row"><div class="rw-kpi"><div class="rw-kpi-label">IVA Total CF</div><div class="rw-kpi-val">${formatoCLP(t.iva)}</div></div><div class="rw-kpi"><div class="rw-kpi-label">Docs con CF</div><div class="rw-kpi-val">${docsConIva}</div></div><div class="rw-kpi"><div class="rw-kpi-label">% sobre neto</div><div class="rw-kpi-val">${formatoPct(t.neto?(t.iva/t.neto)*100:0)}</div></div></div>`);
  }
  if(k==="avance"){
    const av=PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0;
    return card("Avance Financiero","Neto ejecutado vs presupuesto",`<div class="rw-avance"><div class="rw-avance-pct">${formatoPct(av)}</div><div class="cat-track rw-avance-bar"><div class="cat-fill" style="width:${Math.min(av,100)}%"></div></div><div class="rw-avance-detail"><span>${formatoCLP(t.neto)} ejecutado</span><span>de ${formatoCLP(PROJECT_BUDGET)}</span></div></div>`);
  }
  if(k==="documentos"){
    const groups=groupBy(gastos,g=>g.tipo_documento||"Sin tipo");
    const items=Object.entries(groups).map(([tipo,rows])=>({tipo,docs:rows.length,monto:sumBy(rows,"neto")})).sort((a,b)=>b.monto-a.monto);
    return card("Por Tipo de Documento","Clasificación documental",`<div class="rw-etapas-grid">${items.map(r=>{const pct=t.neto?(r.monto/t.neto)*100:0;return`<div class="etapa-card-item"><div class="etapa-card-top"><span style="font-size:12px;font-weight:600">${r.tipo}</span><span class="etapa-card-pct">${r.docs} docs</span></div><div class="etapa-card-monto">${formatoCLP(r.monto)}</div><div class="cat-track" style="margin-top:8px"><div class="cat-fill" style="width:${Math.min(pct,100)}%"></div></div><div class="etapa-card-sub">${formatoPct(pct)} del neto</div></div>`;}).join("")}</div>`);
  }
  if(k==="metodo_pago"){
    const groups=groupBy(gastos,g=>g.metodo_pago||"Sin registrar");
    const items=Object.entries(groups).map(([mp,rows])=>({mp,docs:rows.length,monto:sumBy(rows,"neto")})).sort((a,b)=>b.monto-a.monto);
    return card("Por Método de Pago","Distribución de pagos",`<div class="rw-etapas-grid">${items.map(r=>{const pct=t.neto?(r.monto/t.neto)*100:0;return`<div class="etapa-card-item"><div class="etapa-card-top"><span style="font-size:12px;font-weight:600">${r.mp}</span><span class="etapa-card-pct">${r.docs} docs</span></div><div class="etapa-card-monto">${formatoCLP(r.monto)}</div><div class="cat-track" style="margin-top:8px"><div class="cat-fill" style="width:${Math.min(pct,100)}%"></div></div><div class="etapa-card-sub">${formatoPct(pct)}</div></div>`;}).join("")}</div>`);
  }
  if(k==="mensual_iva"){
    const groups=groupBy(gastos,g=>mesLabel(g.fecha));
    const sorted=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b));
    let acum=0;
    return card("IVA Mensual","Crédito fiscal acumulado por mes",`<div class="rw-etapas-grid">${sorted.map(([mes,rows])=>{const iva=sumBy(rows,"iva");acum+=iva;return`<div class="etapa-card-item"><div class="etapa-card-top"><span style="font-weight:700">${mes}</span><span class="etapa-card-pct">${formatoCLP(iva)}</span></div><div class="etapa-card-monto">${formatoCLP(acum)}</div><div class="etapa-card-sub">Acumulado</div></div>`;}).join("")}</div>`);
  }
  return "";
}

/* ── NAVIGATION ───────────────────────────────────────────── */
function updateVisibleSections(ids=[]){
  document.querySelectorAll(".module-block").forEach(s=>s.classList.add("module-hidden"));
  ids.forEach(id=>$(id)?.classList.remove("module-hidden"));
}
function setupNavigation(){
  const buttons=document.querySelectorAll(".nav-btn"),title=$("page-title"),subtitle=$("page-subtitle");
  buttons.forEach(btn=>btn.addEventListener("click",()=>{
    buttons.forEach(b=>b.classList.remove("active"));btn.classList.add("active");
    currentView=btn.dataset.view;
    const view=views[currentView]||views.resumen;
    if(title)title.textContent=view.title;
    if(subtitle)subtitle.textContent=view.subtitle;
    updateVisibleSections(view.visible);
    docsVisibleLimit=(currentView==="gastos")?10:3;
    renderDocs(docsVisibleLimit);
    if(currentView==="control-financiero") renderControlFinanciero();
  }));
  $("btn-ver-reportes")?.addEventListener("click",()=>document.querySelector('[data-view="reportes"]')?.click());
}

/* ── DOCUMENTOS: LOG DE ARCHIVOS ─────────────────────────── */
function renderDocumentoLog(){
  const el = $("documento-log");
  if(!el) return;
  const docsConArchivo = gastos
    .filter(g => g.foto_path)
    .sort((a,b)=>{
      const da = new Date(b.created_at||b.fecha||"1970");
      const db = new Date(a.created_at||a.fecha||"1970");
      return da - db;
    })
    .slice(0, 30);
  if(!docsConArchivo.length){
    el.innerHTML = emptyState("No hay archivos subidos todavía.");
    return;
  }
  const iconExt = ext => {
    if(["jpg","jpeg","png"].includes(ext)) return "🖼️";
    if(ext === "pdf") return "📄";
    if(["xls","xlsx"].includes(ext)) return "📊";
    if(ext === "csv") return "📋";
    return "📎";
  };
  el.innerHTML = docsConArchivo.map(g => {
    const ext = getFileExtension(g.foto_path);
    const nombre = decodeURIComponent(g.foto_path.split("/").pop() || "archivo");
    return `<div class="table-row doc-log-row">
      <div style="font-size:18px;text-align:center">${iconExt(ext)}</div>
      <div class="doc-name" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${nombre}">${nombre}</div>
      <div><span class="cat-badge" style="background:#eff6ff;color:#3b82f6;font-size:10px">${ext.toUpperCase()}</span></div>
      <div>${normalizarFecha(g.fecha)}</div>
      <div style="font-size:12px;color:var(--muted)">${g.proveedor||"Sin proveedor"}</div>
      <div>
        <button class="action-btn foto-btn" data-path="${g.foto_path}" title="Ver archivo" style="opacity:.4;cursor:default">📎</button>
      </div>
    </div>`;
  }).join("");
  el.querySelectorAll(".foto-btn").forEach(async b => {
    const url = await getFotoUrl(b.dataset.path);
    if(url){ b.style.opacity="1"; b.style.cursor="pointer"; b.onclick=()=>window.open(url,"_blank"); }
  });
}

/* ── RENDER ALL ───────────────────────────────────────────── */
/* ── CONTROL FINANCIERO ───────────────────────────────────── */

const CF_MONTHS = ["M0","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const cfDemoData = {
  ventaCasa:     {M0:0,Ene:0,Feb:0,Mar:0,Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
  otrosIngresos: {M0:0,Ene:0,Feb:0,Mar:0,Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
  gastosOp: [
    {label:"Terreno",          M0:100000000,Ene:0,        Feb:0,        Mar:0,        Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
    {label:"Materiales",       M0:0,        Ene:18500000, Feb:22000000, Mar:12236637, Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
    {label:"Mano de obra",     M0:0,        Ene:4000000,  Feb:6000000,  Mar:5000000,  Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
    {label:"Subcontratos",     M0:0,        Ene:0,        Feb:3000000,  Mar:2000000,  Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
  ],
  gastosAdm: [
    {label:"Arquitecto / especialidades",    M0:2000000,Ene:0,     Feb:0,     Mar:0,     Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
    {label:"Contabilidad / legales / banco", M0:250000, Ene:250000,Feb:250000,Mar:250000,Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
    {label:"Permisos / trámites",            M0:500000, Ene:0,     Feb:0,     Mar:0,     Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
  ],
  impuesto:           {M0:0,Ene:0,Feb:0,Mar:0,Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
  aporteCapital:      {M0:40000000,Ene:0,Feb:0,Mar:0,Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
  creditoHipotecario: {M0:60000000,Ene:0,Feb:0,Mar:0,Abr:0,May:0,Jun:0,Jul:0,Ago:0,Sep:0,Oct:0,Nov:0,Dic:0},
};

function renderControlFinanciero() {
  const el = $("cf-root");
  if (!el) return;

  const d  = cfDemoData;
  const ms = CF_MONTHS;
  const mv = (obj, m) => numberValue(obj[m]);

  // ── Cálculos por mes ──
  let cajaAcum = 0;
  const C = {};
  for (const m of ms) {
    const ingresos  = mv(d.ventaCasa, m) + mv(d.otrosIngresos, m);
    const gastosOp  = d.gastosOp.reduce( (s, r) => s + mv(r, m), 0);
    const gastosAdm = d.gastosAdm.reduce((s, r) => s + mv(r, m), 0);
    const ebitda    = ingresos - gastosOp - gastosAdm;
    const impuesto  = mv(d.impuesto, m);
    const resultado = ebitda - impuesto;
    const financ    = mv(d.aporteCapital, m) + mv(d.creditoHipotecario, m);
    const cajaNeta  = resultado + financ;
    cajaAcum       += cajaNeta;
    C[m] = { ingresos, gastosOp, gastosAdm, ebitda, impuesto, resultado, financ, cajaNeta, cajaAcum };
  }

  // ── KPI acumulados ──
  const kpiResultado = ms.reduce((s, m) => s + C[m].resultado, 0);
  const kpiFinanc    = ms.reduce((s, m) => s + C[m].financ, 0);
  const kpiCaja      = C[ms[ms.length - 1]].cajaAcum;

  // ── Helpers de formato ──
  const fmt = v => {
    if (v === 0) return `<span class="cf-zero">$0</span>`;
    const s = Math.abs(v).toLocaleString("es-CL");
    return v < 0 ? `<span class="cf-neg">-$${s}</span>` : `<span class="cf-pos">$${s}</span>`;
  };
  const fmtKpi = v => { const s = Math.abs(v).toLocaleString("es-CL"); return v < 0 ? `-$${s}` : `$${s}`; };
  const kpiClr = v => v >= 0 ? "var(--brand)" : "var(--red)";

  // ── Constructores de filas ──
  const nCols = ms.length + 1;
  const secRow  = lbl => `<tr class="cf-sec-row"><td colspan="${nCols}">${lbl}</td></tr>`;
  const dataRow = (lbl, fn, cls = "") =>
    `<tr class="cf-data-row${cls ? " " + cls : ""}">` +
    `<td class="cf-lbl">${lbl}</td>` +
    ms.map(m => `<td class="cf-num">${fmt(fn(m))}</td>`).join("") + `</tr>`;
  const totRow = (lbl, key) =>
    `<tr class="cf-tot-row"><td class="cf-lbl">${lbl}</td>` +
    ms.map(m => `<td class="cf-num">${fmt(C[m][key])}</td>`).join("") + `</tr>`;
  const keyRow = (lbl, key, cls) =>
    `<tr class="${cls}"><td class="cf-lbl">${lbl}</td>` +
    ms.map(m => `<td class="cf-num">${fmt(C[m][key])}</td>`).join("") + `</tr>`;
  const spacerRow = () => `<tr class="cf-spacer-row"><td colspan="${nCols}"></td></tr>`;

  el.innerHTML = `
  <div class="card">
    <div class="card-header-row">
      <div>
        <div class="card-title">Control Financiero Mensual</div>
        <div class="card-sub">Flujo financiero mensual en pesos chilenos · sin IVA</div>
      </div>
    </div>

    <div class="cf-kpi-grid">
      <div class="cf-kpi-card">
        <div class="cf-kpi-lbl">Resultado acumulado</div>
        <div class="cf-kpi-val" style="color:${kpiClr(kpiResultado)}">${fmtKpi(kpiResultado)}</div>
        <div class="cf-kpi-sub">Resultado después de impuesto — suma del período</div>
      </div>
      <div class="cf-kpi-card">
        <div class="cf-kpi-lbl">Financiamiento total</div>
        <div class="cf-kpi-val" style="color:var(--brand)">${fmtKpi(kpiFinanc)}</div>
        <div class="cf-kpi-sub">Aportes de socios + crédito hipotecario acumulado</div>
      </div>
      <div class="cf-kpi-card">
        <div class="cf-kpi-lbl">Caja acumulada</div>
        <div class="cf-kpi-val" style="color:${kpiClr(kpiCaja)}">${fmtKpi(kpiCaja)}</div>
        <div class="cf-kpi-sub">Posición de caja al cierre del período registrado</div>
      </div>
    </div>

    <div class="cf-table-wrap">
      <table class="cf-table">
        <thead>
          <tr>
            <th class="cf-th-lbl">Concepto</th>
            ${ms.map(m => `<th class="cf-th-month">${m}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${secRow("INGRESOS")}
          ${dataRow("Venta casa",     m => mv(d.ventaCasa, m))}
          ${dataRow("Otros ingresos", m => mv(d.otrosIngresos, m))}
          ${totRow("Total ingresos", "ingresos")}

          ${secRow("GASTOS OPERACIONALES / OBRA")}
          ${d.gastosOp.map(r => dataRow(r.label, m => mv(r, m))).join("")}
          ${totRow("Total gastos operacionales", "gastosOp")}

          ${secRow("GASTOS ADMINISTRATIVOS")}
          ${d.gastosAdm.map(r => dataRow(r.label, m => mv(r, m))).join("")}
          ${totRow("Total gastos administrativos", "gastosAdm")}

          ${spacerRow()}
          ${keyRow("EBITDA / resultado antes de impuesto", "ebitda",    "cf-ebitda-row")}
          ${dataRow("Impuesto estimado", m => mv(d.impuesto, m))}
          ${keyRow("Resultado después de impuesto",        "resultado", "cf-result-row")}

          ${secRow("FINANCIAMIENTO SIMPLE")}
          ${dataRow("Aporte de capital socios",     m => mv(d.aporteCapital, m))}
          ${dataRow("Crédito hipotecario bancario", m => mv(d.creditoHipotecario, m))}
          ${totRow("Total financiamiento", "financ")}

          ${spacerRow()}
          ${dataRow("Financiamiento recibido", m => C[m].financ, "cf-financ-row")}
          ${keyRow("Caja neta del mes", "cajaNeta", "cf-cajaneta-row")}
          ${keyRow("Caja acumulada",   "cajaAcum", "cf-cajaacum-row")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderAll(){
  const safe = fn => { try{ fn(); }catch(e){ console.error(e); } };
  safe(renderKPIs);safe(renderAlerts);safe(renderBottomCards);
  safe(()=>renderDocs(docsVisibleLimit));safe(renderProveedores);
  safe(renderCaja);safe(renderControlProyecto);
  safe(renderReportes);safe(renderBudgetEditor);
  safe(renderVentas);safe(renderInsumos);safe(renderConfiguracion);
  safe(renderDocumentoLog);
  safe(renderControlFinanciero);
}

/* ── EXPORTACIONES ────────────────────────────────────────── */

function buildGastosExportRows(rows = filteredDocs) {
  return rows.map(g => ({
    Fecha: normalizarFecha(g.fecha),
    Proveedor: g.proveedor || "",
    RUT: g.rut || "",
    "Tipo documento": g.tipo_documento || "",
    "N° documento": g.numero_documento || "",
    Categoría: g.categoria || "",
    "Costo neto": numberValue(g.neto),
    "IVA crédito fiscal": numberValue(g.iva),
    "Total documento": numberValue(g.total),
    "Método de pago": g.metodo_pago || "",
    "Estado OCR": g.estado_ocr || "",
    Observación: g.observacion || ""
  }));
}

function buildBalanceExportRows() {
  return getBalanceRows();
}

/* ── VENTAS TOTALS ─────────────────────────────────────────── */

function getVentasTotals() {
  const recibidas = (typeof ventasIngresos !== "undefined" ? ventasIngresos : [])
    .filter(v => String(v.estado || "").toLowerCase() === "recibido");

  const clasificar = v => {
    const cat = String(v.categoria_contable || "").toLowerCase().trim();
    if (cat === "aporte") return "aporte";
    if (cat === "anticipo") return "anticipo";
    if (cat === "venta propiedad" || cat === "venta") return "venta";
    if (cat === "otro") return "otro";
    // fallback: inferir desde concepto
    const c = String(v.concepto || "").toLowerCase();
    if (c.includes("aporte")) return "aporte";
    if (c.includes("anticipo")) return "anticipo";
    if (c.includes("venta")) return "venta";
    return "otro";
  };

  const sum = arr => arr.reduce((a, v) => a + numberValue(v.monto), 0);
  const aportes  = recibidas.filter(v => clasificar(v) === "aporte");
  const anticipos = recibidas.filter(v => clasificar(v) === "anticipo");
  const ventas   = recibidas.filter(v => clasificar(v) === "venta");
  const otros    = recibidas.filter(v => clasificar(v) === "otro");

  const totalVentasPropiedad = sum(ventas);
  const totalAnticipos = sum(anticipos);

  // Si hay venta propiedad, los anticipos se consideran aplicados contra la venta
  // Si no hay venta, los anticipos quedan como no aplicados (pasivo)
  const anticiposAplicados = totalVentasPropiedad > 0 ? totalAnticipos : 0;
  const anticiposNoAplicados = totalVentasPropiedad > 0 ? 0 : totalAnticipos;

  return {
    totalIngresos:         sum(recibidas),
    totalAportes:          sum(aportes),
    totalAnticipos:        totalAnticipos,
    totalAnticiposAplicados: anticiposAplicados,
    totalAnticiposNoAplicados: anticiposNoAplicados,
    totalVentasPropiedad:  totalVentasPropiedad,
    totalOtros:            sum(otros),
    cantidad:              recibidas.length,
    cantidadAportes:       aportes.length,
    cantidadAnticipos:     anticipos.length,
    cantidadVentas:        ventas.length
  };
}

/* ── BALANCE ROWS ──────────────────────────────────────────── */

function getBalanceRows() {
  const t = getTotals();
  const v = getVentasTotals();

  const TERRENO       = 100000000;
  const CAPITAL_SOCIO = 60000000;
  const modoVendido   = v.totalVentasPropiedad > 0;

  let n = 1;
  const rows = [];

  const R = (n, sec, cuenta, debe, haber, activo, pasivo, perdida, ganancia) => ({
    "N°": n, _seccion: sec, Cuenta: cuenta,
    Debe: debe,   Haber: haber,
    Deudor: debe, Acreedor: haber,
    Activo: activo, Pasivo: pasivo,
    Pérdida: perdida, Ganancia: ganancia
  });

  if (!modoVendido) {
    // ── ACTIVOS — modo En ejecución ──
    // Terreno y Obra son activos capitalizados. IVA es crédito fiscal activo.
    rows.push(R(n++,"activo","Terreno",             TERRENO,   0, TERRENO,   0, 0, 0));
    if (t.neto > 0)
      rows.push(R(n++,"activo","Obra en Curso",     t.neto,    0, t.neto,    0, 0, 0));
    if (t.iva > 0)
      rows.push(R(n++,"activo","IVA Crédito Fiscal",t.iva,     0, t.iva,     0, 0, 0));

    // ── PASIVOS — anticipos no aplicados ──
    if (v.totalAnticiposNoAplicados > 0)
      rows.push(R(n++,"pasivo","Anticipos recibidos",0, v.totalAnticiposNoAplicados, 0, v.totalAnticiposNoAplicados, 0, 0));

    // ── PATRIMONIO / FINANCIAMIENTO ──
    rows.push(R(n++,"patrimonio","Capital aportado socio",0, CAPITAL_SOCIO,  0, CAPITAL_SOCIO,  0, 0));
    if (v.totalAportes > 0)
      rows.push(R(n++,"patrimonio","Aportes del período",  0, v.totalAportes, 0, v.totalAportes, 0, 0));
    if (v.totalOtros > 0)
      rows.push(R(n++,"patrimonio","Otros ingresos",        0, v.totalOtros,   0, v.totalOtros,   0, 0));

    // ── CIERRE — Financiamiento a determinar ──
    // Cubre la brecha entre inversiones registradas y fuentes de fondos conocidas.
    const totalInvertido = TERRENO + t.neto + t.iva;
    const totalFuentes   = v.totalAnticiposNoAplicados + CAPITAL_SOCIO + v.totalAportes + v.totalOtros;
    const gap = totalInvertido - totalFuentes;
    if (gap > 1)
      rows.push(R(n++,"ajuste","Financiamiento a determinar",0, gap, 0, gap, 0, 0));
    else if (gap < -1)
      rows.push(R(n++,"ajuste","Ajuste patrimonial",Math.abs(gap), 0, Math.abs(gap), 0, 0, 0));

  } else {
    // ── modo PROYECTO VENDIDO ──

    // Caja y bancos: saldo neto de efectivo después de todos los flujos conocidos.
    // Ingresos: Capital socio + Aportes + Venta propiedad (los anticipos ya son parte de la venta).
    // Egresos:  Terreno + Gastos totales (neto + IVA pagado).
    const caja = CAPITAL_SOCIO + v.totalAportes + v.totalVentasPropiedad - TERRENO - (t.neto + t.iva);
    if (caja > 0)
      rows.push(R(n++,"activo","Caja y bancos",    caja,   0, caja,   0, 0, 0));
    if (t.iva > 0)
      rows.push(R(n++,"activo","IVA Crédito Fiscal",t.iva, 0, t.iva,  0, 0, 0));

    // ── PATRIMONIO / FINANCIAMIENTO ──
    rows.push(R(n++,"patrimonio","Capital aportado socio",0, CAPITAL_SOCIO,  0, CAPITAL_SOCIO,  0, 0));
    if (v.totalAportes > 0)
      rows.push(R(n++,"patrimonio","Aportes del período",  0, v.totalAportes, 0, v.totalAportes, 0, 0));

    // Utilidad del proyecto: cierra el balance.
    // Aparece en columna Pasivo (equity) y en columna Pérdida (cierre del P&L).
    const utilidad = v.totalVentasPropiedad - TERRENO - t.neto;
    if (utilidad > 1)
      rows.push(R(n++,"patrimonio","Utilidad del proyecto",0, 0, 0, utilidad, utilidad, 0));
    else if (utilidad < -1)
      rows.push(R(n++,"patrimonio","Pérdida del proyecto", 0, 0, Math.abs(utilidad), 0, 0, Math.abs(utilidad)));

    // ── RESULTADOS — descomposición del P&L ──
    rows.push(R(n++,"resultado","Ingresos venta propiedad",  0,        v.totalVentasPropiedad, 0, 0, 0,       v.totalVentasPropiedad));
    rows.push(R(n++,"resultado","Costo terreno (reclasif.)", TERRENO,  0,                      0, 0, TERRENO, 0));
    if (t.neto > 0)
      rows.push(R(n++,"resultado","Costo obra vendida",      t.neto,   0,                      0, 0, t.neto,  0));
  }

  // ── TOTAL ──
  const totalDebe     = rows.reduce((a, r) => a + numberValue(r.Debe),     0);
  const totalHaber    = rows.reduce((a, r) => a + numberValue(r.Haber),    0);
  const totalActivo   = rows.reduce((a, r) => a + numberValue(r.Activo),   0);
  const totalPasivo   = rows.reduce((a, r) => a + numberValue(r.Pasivo),   0);
  const totalPerdida  = rows.reduce((a, r) => a + numberValue(r.Pérdida),  0);
  const totalGanancia = rows.reduce((a, r) => a + numberValue(r.Ganancia), 0);

  rows.push({
    "N°": "", _seccion:"total", Cuenta:"TOTAL",
    Debe: totalDebe,    Haber: totalHaber,
    Deudor: totalDebe,  Acreedor: totalHaber,
    Activo: totalActivo, Pasivo: totalPasivo,
    Pérdida: totalPerdida, Ganancia: totalGanancia
  });

  return rows;
}

function rowsToCSV(rows) {
  const h = [
    "fecha",
    "proveedor",
    "rut",
    "tipo_documento",
    "numero_documento",
    "categoria",
    "neto",
    "iva",
    "total",
    "metodo_pago",
    "estado_ocr"
  ];

  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;

  return [
    h.join(";"),
    ...rows.map(r => h.map(f => esc(r[f])).join(";"))
  ].join("\n");
}

function downloadText(name, text) {
  const b = new Blob([text], { type: "text/csv;charset=utf-8" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}

function downloadWorkbook(fileName, sheets) {
  if (typeof window.XLSX === "undefined") {
    alert("No se cargó la librería Excel.");
    return;
  }

  const wb = window.XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const ws = window.XLSX.utils.json_to_sheet(sheet.rows);
    window.XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  window.XLSX.writeFile(wb, fileName);
}

function exportCSV() {
  downloadText("gastos_junquillar.csv", rowsToCSV(filteredDocs));
}

function exportGastosExcel() {
  downloadWorkbook("gastos_junquillar.xlsx", [
    {
      name: "Gastos",
      rows: buildGastosExportRows(filteredDocs)
    }
  ]);
}

function exportBalanceExcel() {
  const sheets = [
    { name: "Balance",     rows: buildBalanceExportRows() },
    { name: "Gastos base", rows: buildGastosExportRows(gastos) }
  ];
  if (ventasIngresos.length > 0) {
    sheets.push({
      name: "Ventas base",
      rows: ventasIngresos.map(v => ({
        Fecha:            normalizarFecha(v.fecha),
        Concepto:         v.concepto || "",
        "Tipo pago":      v.tipo || "",
        "Tipo contable":  v.categoria_contable || "",
        Monto:            numberValue(v.monto),
        Estado:           v.estado || "",
        Referencia:       v.referencia || "",
        Banco:            v.banco || "",
        Emisor:           v.emisor || ""
      }))
    });
  }
  downloadWorkbook("balance_junquillar.xlsx", sheets);
}

function exportReporteExcel() {
  const t = getTotals();

  const resumen = [
    { Indicador: "Presupuesto proyecto", Valor: PROJECT_BUDGET },
    { Indicador: "Ejecutado neto", Valor: t.neto },
    { Indicador: "IVA crédito fiscal", Valor: t.iva },
    { Indicador: "Total documentos", Valor: t.total },
    { Indicador: "Cantidad documentos", Valor: t.docs },
    { Indicador: "Proveedores", Valor: t.proveedores },
    { Indicador: "Pendientes OCR", Valor: t.pendientesOcr }
  ];

  downloadWorkbook("reporte_ejecutivo_junquillar.xlsx", [
    {
      name: "Resumen",
      rows: resumen
    },
    {
      name: "Balance",
      rows: buildBalanceExportRows()
    },
    {
      name: "Gastos",
      rows: buildGastosExportRows(gastos)
    }
  ]);
}

/* ── SETUP ────────────────────────────────────────────────── */
function setupButtons(){
  $("load-more-btn")?.addEventListener("click",()=>{docsVisibleLimit+=20;renderDocs(docsVisibleLimit);});
  $("btn-aplicar-filtros-gastos")?.addEventListener("click",applyFilters);
  $("btn-limpiar-filtros-gastos")?.addEventListener("click",clearFilters);
  $("btn-export-csv")?.addEventListener("click",exportCSV);
  $("btn-export-excel")?.addEventListener("click",exportGastosExcel);
  ["filter-text-gastos","global-search"].forEach(id=>$(id)?.addEventListener("input",applyFilters));
  $("modal-overlay")?.addEventListener("click", e => { if(e.target===$("modal-overlay")) closeEditModal(); });
  $("btn-modal-cancel")?.addEventListener("click",closeEditModal);
  $("btn-modal-save")?.addEventListener("click",saveEditModal);
  $("chk-all")?.addEventListener("change", e=>toggleSelectAll(e.target));
  $("btn-bulk-delete")?.addEventListener("click",bulkDelete);
  $("btn-bulk-cancel")?.addEventListener("click",cancelBulkSelection);
}
/* ── VENTAS DATA ─────────────────────────────────────────── */
let ventasIngresos = [
  {id:1, fecha:"2024-05-23", concepto:"Aporte mensual — Mayo",          tipo:"Transferencia", monto:5000000,  estado:"Recibido", categoria_contable:"Aporte"},
  {id:2, fecha:"2024-05-10", concepto:"Anticipo Etapa 1 — Estructura",  tipo:"Cheque",        monto:15000000, estado:"Recibido", categoria_contable:"Anticipo"},
  {id:3, fecha:"2024-04-28", concepto:"Aporte mensual — Abril",         tipo:"Transferencia", monto:5000000,  estado:"Recibido", categoria_contable:"Aporte"},
  {id:4, fecha:"2024-04-05", concepto:"Anticipo inicial del proyecto",   tipo:"Transferencia", monto:20000000, estado:"Recibido", categoria_contable:"Anticipo"},
];
let ventasCotizaciones = [
  {id:1, fecha:"2024-05-20", proveedor:"Constructora XYZ",      descripcion:"Estructura metálica techumbre",  neto:8500000, iva:1615000, total:10115000, estado:"Pendiente"},
  {id:2, fecha:"2024-05-15", proveedor:"Electricistas Ramírez", descripcion:"Instalación eléctrica completa", neto:3200000, iva:608000,  total:3808000,  estado:"Aprobada"},
  {id:3, fecha:"2024-04-30", proveedor:"Gasfitería Central",    descripcion:"Red agua fría y caliente",       neto:2800000, iva:532000,  total:3332000,  estado:"Aprobada"},
  {id:4, fecha:"2024-04-22", proveedor:"Pinturas del Sur SA",   descripcion:"Pintura interior y exterior",    neto:1900000, iva:361000,  total:2261000,  estado:"Rechazada"},
];
let ventasContactos = [
  {id:1, nombre:"Christian García B.", rol:"Propietario", telefono:"+56 9 8765 4321", correo:"chgarciablanco@gmail.com", estado:"Activo"},
  {id:2, nombre:"Arq. Patricia López",  rol:"Arquitecto",  telefono:"+56 9 7654 3210", correo:"plopez@arq.cl",            estado:"Activo"},
  {id:3, nombre:"Constructora XYZ",     rol:"Contratista", telefono:"+56 2 2345 6789", correo:"contacto@xyz.cl",          estado:"Activo"},
  {id:4, nombre:"Inspector Municipal",  rol:"Inspector",   telefono:"+56 2 2234 5678", correo:"insp@municipio.cl",        estado:"Activo"},
];
let ventasTab = "ingresos";
let _editingIngresoId = null;
let _editingCotId = null;
let _editingContId = null;

/* ── CRUD INGRESOS ───────────────────────────────────────── */
function openModalIngreso(id = null) {
  _editingIngresoId = id;
  const r = id !== null ? ventasIngresos.find(x => x.id === id) : null;
  $("modal-ingreso-title").textContent = id !== null ? "✏️ Editar Ingreso" : "✏️ Nuevo Ingreso";
  $("ing-fecha").value              = r?.fecha              || new Date().toISOString().slice(0, 10);
  $("ing-concepto").value           = r?.concepto           || "";
  $("ing-tipo").value               = r?.tipo               || "Transferencia";
  $("ing-categoria").value          = r?.categoria_contable || "Aporte";
  $("ing-monto").value              = r?.monto              || "";
  $("ing-estado").value             = r?.estado             || "Recibido";
  $("ing-referencia").value         = r?.referencia         || "";
  $("ing-banco").value              = r?.banco              || "";
  $("ing-cuenta").value             = r?.cuenta             || "";
  $("ing-emisor").value             = r?.emisor             || "";
  $("ing-obs").value                = r?.obs                || "";
  $("modal-ingreso").classList.remove("modal-hidden");
}
function closeModalIngreso() {
  $("modal-ingreso").classList.add("modal-hidden");
  _editingIngresoId = null;
}
function saveIngreso() {
  const fecha    = $("ing-fecha").value;
  const concepto = ($("ing-concepto").value || "").trim();
  const monto    = Number($("ing-monto").value) || 0;
  if (!concepto || !fecha) { showToast("⚠️ Completa fecha y concepto."); return; }
  const entry = {
    fecha, concepto,
    tipo:               $("ing-tipo").value,
    categoria_contable: $("ing-categoria").value,
    monto,
    estado:     $("ing-estado").value,
    referencia: ($("ing-referencia").value || "").trim(),
    banco:      ($("ing-banco").value      || "").trim(),
    cuenta:     ($("ing-cuenta").value     || "").trim(),
    emisor:     ($("ing-emisor").value     || "").trim(),
    obs:        ($("ing-obs").value        || "").trim(),
  };
  if (_editingIngresoId !== null) {
    const idx = ventasIngresos.findIndex(x => x.id === _editingIngresoId);
    if (idx >= 0) ventasIngresos[idx] = { ...ventasIngresos[idx], ...entry };
    showToast("✓ Ingreso actualizado");
  } else {
    const newId = Math.max(0, ...ventasIngresos.map(x => x.id)) + 1;
    ventasIngresos.unshift({ id: newId, ...entry });
    showToast("✓ Ingreso agregado");
  }
  closeModalIngreso();
  renderVentas();
  renderKPIs();
}
function deleteIngreso(id) {
  const r = ventasIngresos.find(x => x.id === id);
  if (!r || !confirm(`¿Eliminar el ingreso "${r.concepto}"?\nEsta acción no se puede deshacer.`)) return;
  ventasIngresos = ventasIngresos.filter(x => x.id !== id);
  renderVentas(); renderKPIs();
  showToast("✓ Ingreso eliminado");
}

/* ── CRUD COTIZACIONES ───────────────────────────────────── */
function calcCotIva() {
  const neto = Number($("cot-neto").value) || 0;
  const iva = Math.round(neto * 0.19);
  $("cot-iva").value   = iva;
  $("cot-total").value = neto + iva;
}
function calcCotTotal() {
  const neto = Number($("cot-neto").value) || 0;
  const iva  = Number($("cot-iva").value)  || 0;
  $("cot-total").value = neto + iva;
}
function openModalCotizacion(id = null) {
  _editingCotId = id;
  const r = id !== null ? ventasCotizaciones.find(x => x.id === id) : null;
  $("modal-cot-title").textContent = id !== null ? "✏️ Editar Cotización" : "✏️ Nueva Cotización";
  $("cot-proveedor").value  = r?.proveedor  || "";
  $("cot-rut").value        = r?.rut        || "";
  $("cot-telefono").value   = r?.telefono   || "";
  $("cot-correo").value     = r?.correo     || "";
  $("cot-numero").value     = r?.numero     || "";
  $("cot-fecha").value      = r?.fecha      || new Date().toISOString().slice(0, 10);
  $("cot-vigencia").value   = r?.vigencia   || "";
  $("cot-categoria").value  = r?.categoria  || "";
  $("cot-descripcion").value= r?.descripcion|| "";
  $("cot-neto").value       = r?.neto       || "";
  $("cot-iva").value        = r?.iva        || "";
  $("cot-total").value      = r?.total      || "";
  $("cot-estado").value     = r?.estado     || "Pendiente";
  $("cot-obs").value        = r?.obs        || "";
  $("modal-cotizacion").classList.remove("modal-hidden");
}
function closeModalCotizacion() {
  $("modal-cotizacion").classList.add("modal-hidden");
  _editingCotId = null;
}
function saveCotizacion() {
  const proveedor = ($("cot-proveedor").value || "").trim();
  const fecha     = $("cot-fecha").value;
  if (!proveedor || !fecha) { showToast("⚠️ Completa fecha y proveedor."); return; }
  const neto  = Number($("cot-neto").value)  || 0;
  const iva   = Number($("cot-iva").value)   || 0;
  const total = Number($("cot-total").value) || neto + iva;
  const entry = {
    fecha, proveedor,
    rut:         ($("cot-rut").value         || "").trim(),
    telefono:    ($("cot-telefono").value    || "").trim(),
    correo:      ($("cot-correo").value      || "").trim(),
    numero:      ($("cot-numero").value      || "").trim(),
    vigencia:    $("cot-vigencia").value     || "",
    categoria:   $("cot-categoria").value    || "",
    descripcion: ($("cot-descripcion").value || "").trim(),
    neto, iva, total,
    estado:      $("cot-estado").value,
    obs:         ($("cot-obs").value         || "").trim(),
  };
  if (_editingCotId !== null) {
    const idx = ventasCotizaciones.findIndex(x => x.id === _editingCotId);
    if (idx >= 0) ventasCotizaciones[idx] = { ...ventasCotizaciones[idx], ...entry };
    showToast("✓ Cotización actualizada");
  } else {
    const newId = Math.max(0, ...ventasCotizaciones.map(x => x.id)) + 1;
    ventasCotizaciones.unshift({ id: newId, ...entry });
    showToast("✓ Cotización agregada");
  }
  closeModalCotizacion();
  renderVentas();
}
function deleteCotizacion(id) {
  const r = ventasCotizaciones.find(x => x.id === id);
  if (!r || !confirm(`¿Eliminar la cotización de "${r.proveedor}"?\nEsta acción no se puede deshacer.`)) return;
  ventasCotizaciones = ventasCotizaciones.filter(x => x.id !== id);
  renderVentas();
  showToast("✓ Cotización eliminada");
}

/* ── CRUD CONTACTOS ──────────────────────────────────────── */
function openModalContacto(id = null) {
  _editingContId = id;
  const r = id !== null ? ventasContactos.find(x => x.id === id) : null;
  $("modal-cont-title").textContent = id !== null ? "✏️ Editar Contacto" : "✏️ Nuevo Contacto";
  $("cont-nombre").value       = r?.nombre       || "";
  $("cont-rut").value          = r?.rut          || "";
  $("cont-empresa").value      = r?.empresa      || "";
  $("cont-rol").value          = r?.rol          || "";
  $("cont-especialidad").value = r?.especialidad || "";
  $("cont-estado").value       = r?.estado       || "Activo";
  $("cont-telefono").value     = r?.telefono     || "";
  $("cont-telefono2").value    = r?.telefono2    || "";
  $("cont-correo").value       = r?.correo       || "";
  $("cont-correo2").value      = r?.correo2      || "";
  $("cont-direccion").value    = r?.direccion    || "";
  $("cont-obs").value          = r?.obs          || "";
  $("modal-contacto").classList.remove("modal-hidden");
}
function closeModalContacto() {
  $("modal-contacto").classList.add("modal-hidden");
  _editingContId = null;
}
function saveContacto() {
  const nombre = ($("cont-nombre").value || "").trim();
  if (!nombre) { showToast("⚠️ Ingresa el nombre del contacto."); return; }
  const entry = {
    nombre,
    rut:          ($("cont-rut").value          || "").trim(),
    empresa:      ($("cont-empresa").value      || "").trim(),
    rol:          ($("cont-rol").value          || "").trim(),
    especialidad: ($("cont-especialidad").value || "").trim(),
    estado:       $("cont-estado").value,
    telefono:     ($("cont-telefono").value     || "").trim(),
    telefono2:    ($("cont-telefono2").value    || "").trim(),
    correo:       ($("cont-correo").value       || "").trim(),
    correo2:      ($("cont-correo2").value      || "").trim(),
    direccion:    ($("cont-direccion").value    || "").trim(),
    obs:          ($("cont-obs").value          || "").trim(),
  };
  if (_editingContId !== null) {
    const idx = ventasContactos.findIndex(x => x.id === _editingContId);
    if (idx >= 0) ventasContactos[idx] = { ...ventasContactos[idx], ...entry };
    showToast("✓ Contacto actualizado");
  } else {
    const newId = Math.max(0, ...ventasContactos.map(x => x.id)) + 1;
    ventasContactos.unshift({ id: newId, ...entry });
    showToast("✓ Contacto agregado");
  }
  closeModalContacto();
  renderVentas();
}
function deleteContacto(id) {
  const r = ventasContactos.find(x => x.id === id);
  if (!r || !confirm(`¿Eliminar el contacto "${r.nombre}"?\nEsta acción no se puede deshacer.`)) return;
  ventasContactos = ventasContactos.filter(x => x.id !== id);
  renderVentas();
  showToast("✓ Contacto eliminado");
}

/* ── INSUMOS DATA ────────────────────────────────────────── */
const insumosData = [
  {id:1,  nombre:"Cemento Portland",       categoria:"Materiales", unidad:"saco",   cantidad:45,  stock_min:10,  precio_unit:8500,  estado:"En stock"},
  {id:2,  nombre:"Fierro 10mm",            categoria:"Materiales", unidad:"barra",  cantidad:120, stock_min:20,  precio_unit:4200,  estado:"En stock"},
  {id:3,  nombre:"Madera pino 2x4",        categoria:"Materiales", unidad:"unidad", cantidad:8,   stock_min:15,  precio_unit:3800,  estado:"Bajo stock"},
  {id:4,  nombre:"Ladrillos cerámicos",    categoria:"Materiales", unidad:"unidad", cantidad:0,   stock_min:100, precio_unit:220,   estado:"Agotado"},
  {id:5,  nombre:"Esmalte blanco 1gl",     categoria:"Pinturas",   unidad:"galón",  cantidad:12,  stock_min:4,   precio_unit:18500, estado:"En stock"},
  {id:6,  nombre:"Cemento cola",           categoria:"Materiales", unidad:"saco",   cantidad:7,   stock_min:5,   precio_unit:9200,  estado:"En stock"},
  {id:7,  nombre:"Guantes de cuero",       categoria:"EPP",        unidad:"par",    cantidad:3,   stock_min:5,   precio_unit:4500,  estado:"Bajo stock"},
  {id:8,  nombre:"Casco de seguridad",     categoria:"EPP",        unidad:"unidad", cantidad:6,   stock_min:4,   precio_unit:12000, estado:"En stock"},
  {id:9,  nombre:"Cable eléctrico 2,5mm",  categoria:"Eléctrico",  unidad:"metro",  cantidad:180, stock_min:50,  precio_unit:850,   estado:"En stock"},
  {id:10, nombre:"Tubería PVC 4\"",         categoria:"Gasfitería", unidad:"metro",  cantidad:22,  stock_min:10,  precio_unit:3200,  estado:"En stock"},
];
let insumosQuery = "";
let insumosFilterCat = "";

/* ── VENTAS RENDER ───────────────────────────────────────── */
function renderVentas(){
  const el = $("ventas-root");
  if(!el) return;
  const badge = e => {
    const m = {Recibido:{bg:"var(--green-soft)",c:"var(--green)"},Pendiente:{bg:"var(--amber-soft)",c:"var(--amber)"},Aprobada:{bg:"var(--green-soft)",c:"var(--green)"},Rechazada:{bg:"var(--red-soft)",c:"var(--red)"},Activo:{bg:"var(--green-soft)",c:"var(--green)"},Inactivo:{bg:"#f8fafc",c:"var(--muted)"}};
    const s = m[e]||{bg:"#f8fafc",c:"var(--muted)"};
    return `<span class="jv-badge" style="background:${s.bg};color:${s.c}">${e}</span>`;
  };
  const tabBar = `<div class="jv-tabs">
    <button class="jv-tab${ventasTab==="ingresos"?" jv-tab-active":""}" onclick="setVentasTab('ingresos')">Ingresos</button>
    <button class="jv-tab${ventasTab==="cotizaciones"?" jv-tab-active":""}" onclick="setVentasTab('cotizaciones')">Cotizaciones</button>
    <button class="jv-tab${ventasTab==="contactos"?" jv-tab-active":""}" onclick="setVentasTab('contactos')">Contactos</button>
  </div>`;
  let content = "";
  if(ventasTab === "ingresos"){
    const total = ventasIngresos.reduce((a,r)=>a+r.monto,0);
    const recibidos = ventasIngresos.filter(r=>r.estado==="Recibido");
    const totalRec = recibidos.reduce((a,r)=>a+r.monto,0);
    content = `<div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi-card"><div class="kpi-title">Total ingresos</div><div class="kpi-value">${formatoCLP(total)}</div><div class="kpi-footer">${ventasIngresos.length} registro${ventasIngresos.length!==1?"s":""}</div></div>
      <div class="kpi-card"><div class="kpi-title">Monto recibido</div><div class="kpi-value">${formatoCLP(totalRec)}</div><div class="kpi-footer">${recibidos.length} confirmado${recibidos.length!==1?"s":""}</div></div>
      <div class="kpi-card"><div class="kpi-title">Último ingreso</div><div class="kpi-value">${normalizarFecha(ventasIngresos[0]?.fecha||"")}</div><div class="kpi-footer">Más reciente</div></div>
      <div class="kpi-card"><div class="kpi-title">Pendientes</div><div class="kpi-value">${ventasIngresos.filter(r=>r.estado==="Pendiente").length}</div><div class="kpi-footer">Por confirmar</div></div>
    </div>
    <div class="card">
      <div class="card-header-row">
        <div><div class="card-title">Registro de aportes e ingresos</div></div>
        <button class="jv-nuevo-btn" onclick="openModalIngreso()">+ Nuevo ingreso</button>
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <div class="table-head jv-ing-head"><div>Fecha</div><div>Concepto</div><div>Tipo</div><div style="text-align:right">Monto</div><div>Estado</div><div>Acc.</div></div>
        <div>${ventasIngresos.length ? ventasIngresos.map(r=>`<div class="table-row jv-ing-row">
          <div>${normalizarFecha(r.fecha)}</div>
          <div class="doc-name">${r.concepto}</div>
          <div style="font-size:12px;color:var(--muted)">${r.tipo}</div>
          <div style="text-align:right;font-weight:600">${formatoCLP(r.monto)}</div>
          <div>${badge(r.estado)}</div>
          <div class="doc-actions">
            <button class="action-btn" title="Editar" onclick="openModalIngreso(${r.id})">✏️</button>
            <button class="action-btn" title="Eliminar" onclick="deleteIngreso(${r.id})">🗑️</button>
          </div>
        </div>`).join("") : emptyState("Sin ingresos registrados.")}</div>
      </div>
    </div>`;
  }
  if(ventasTab === "cotizaciones"){
    const aprobadas = ventasCotizaciones.filter(c=>c.estado==="Aprobada");
    const tasa = ventasCotizaciones.length ? Math.round(aprobadas.length/ventasCotizaciones.length*100) : 0;
    content = `<div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi-card"><div class="kpi-title">Total cotizaciones</div><div class="kpi-value">${ventasCotizaciones.length}</div><div class="kpi-footer">Registradas</div></div>
      <div class="kpi-card"><div class="kpi-title">Aprobadas</div><div class="kpi-value">${aprobadas.length}</div><div class="kpi-footer">Tasa ${tasa}%</div></div>
      <div class="kpi-card"><div class="kpi-title">Monto aprobado</div><div class="kpi-value">${formatoCLP(aprobadas.reduce((a,c)=>a+c.total,0))}</div><div class="kpi-footer">Neto + IVA</div></div>
      <div class="kpi-card"><div class="kpi-title">Pendientes</div><div class="kpi-value">${ventasCotizaciones.filter(c=>c.estado==="Pendiente").length}</div><div class="kpi-footer">Por revisar</div></div>
    </div>
    <div class="card">
      <div class="card-header-row">
        <div><div class="card-title">Cotizaciones de contratistas</div></div>
        <button class="jv-nuevo-btn" onclick="openModalCotizacion()">+ Nueva cotización</button>
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <div class="table-head jv-cot-head"><div>Fecha</div><div>Proveedor</div><div>Descripción</div><div style="text-align:right">Neto</div><div style="text-align:right">IVA</div><div style="text-align:right">Total</div><div>Estado</div><div>Acc.</div></div>
        <div>${ventasCotizaciones.length ? ventasCotizaciones.map(c=>`<div class="table-row jv-cot-row">
          <div>${normalizarFecha(c.fecha)}</div>
          <div class="doc-name">${c.proveedor}</div>
          <div style="font-size:12px;color:var(--muted)">${c.descripcion}</div>
          <div style="text-align:right">${formatoCLP(c.neto)}</div>
          <div style="text-align:right">${formatoCLP(c.iva)}</div>
          <div style="text-align:right;font-weight:600">${formatoCLP(c.total)}</div>
          <div>${badge(c.estado)}</div>
          <div class="doc-actions">
            <button class="action-btn" title="Editar" onclick="openModalCotizacion(${c.id})">✏️</button>
            <button class="action-btn" title="Eliminar" onclick="deleteCotizacion(${c.id})">🗑️</button>
          </div>
        </div>`).join("") : emptyState("Sin cotizaciones registradas.")}</div>
      </div>
    </div>`;
  }
  if(ventasTab === "contactos"){
    content = `<div class="card">
      <div class="card-header-row">
        <div><div class="card-title">Contactos del proyecto</div><div class="card-sub">${ventasContactos.length} personas y organizaciones vinculadas</div></div>
        <button class="jv-nuevo-btn" onclick="openModalContacto()">+ Nuevo contacto</button>
      </div>
      <div class="table-wrap" style="margin-top:14px">
        <div class="table-head jv-cont-head"><div>Nombre</div><div>Rol</div><div>Teléfono</div><div>Correo</div><div>Estado</div><div>Acc.</div></div>
        <div>${ventasContactos.length ? ventasContactos.map(c=>`<div class="table-row jv-cont-row">
          <div class="doc-name">${c.nombre}</div>
          <div><span class="jv-badge" style="background:var(--sky-soft);color:var(--sky)">${c.rol}</span></div>
          <div style="font-size:12px">${c.telefono}</div>
          <div style="font-size:12px;color:var(--muted)">${c.correo}</div>
          <div>${badge(c.estado)}</div>
          <div class="doc-actions">
            <button class="action-btn" title="Editar" onclick="openModalContacto(${c.id})">✏️</button>
            <button class="action-btn" title="Eliminar" onclick="deleteContacto(${c.id})">🗑️</button>
          </div>
        </div>`).join("") : emptyState("Sin contactos registrados.")}</div>
      </div>
    </div>`;
  }
  el.innerHTML = tabBar + content;
}
function setVentasTab(tab){ ventasTab = tab; renderVentas(); }

/* ── INSUMOS RENDER ──────────────────────────────────────── */
function renderInsumos(){
  const el = $("insumos-root");
  if(!el) return;
  const filtered = insumosData.filter(i=>{
    const q = insumosQuery.toLowerCase();
    return (!q || i.nombre.toLowerCase().includes(q) || i.categoria.toLowerCase().includes(q))
        && (!insumosFilterCat || i.categoria === insumosFilterCat);
  });
  const ec = {"En stock":{bg:"var(--green-soft)",c:"var(--green)"},"Bajo stock":{bg:"var(--amber-soft)",c:"var(--amber)"},"Agotado":{bg:"var(--red-soft)",c:"var(--red)"}};
  const cats = [...new Set(insumosData.map(i=>i.categoria))];
  const totalValor = insumosData.reduce((a,i)=>a+i.cantidad*i.precio_unit,0);
  el.innerHTML = `
  <div class="kpi-grid" style="margin-bottom:20px">
    <div class="kpi-card"><div class="kpi-title">En stock</div><div class="kpi-value">${insumosData.filter(i=>i.estado==="En stock").length}</div><div class="kpi-footer">De ${insumosData.length} ítems</div></div>
    <div class="kpi-card"><div class="kpi-title">Bajo stock</div><div class="kpi-value">${insumosData.filter(i=>i.estado==="Bajo stock").length}</div><div class="kpi-footer">Requieren reposición</div></div>
    <div class="kpi-card"><div class="kpi-title">Agotados</div><div class="kpi-value">${insumosData.filter(i=>i.estado==="Agotado").length}</div><div class="kpi-footer">Sin unidades</div></div>
    <div class="kpi-card"><div class="kpi-title">Valor inventario</div><div class="kpi-value">${formatoCLP(totalValor)}</div><div class="kpi-footer">Cantidad × precio unit.</div></div>
  </div>
  <div class="card filter-card" style="margin-bottom:16px">
    <div class="filter-search-wrap"><span class="filter-search-icon">🔍</span>
      <input type="text" class="filter-search-input" placeholder="Buscar insumo o categoría…" value="${insumosQuery}" oninput="insumosQuery=this.value;renderInsumos()"/>
    </div>
    <div class="filter-row" style="margin-top:12px">
      <div class="filter-group"><label class="filter-label">Categoría</label>
        <select class="filter-select" onchange="insumosFilterCat=this.value;renderInsumos()">
          <option value="">Todas</option>
          ${cats.map(c=>`<option${insumosFilterCat===c?" selected":""}>${c}</option>`).join("")}
        </select>
      </div>
    </div>
  </div>
  <div class="card"><div class="card-title">Inventario de materiales e insumos</div>
    <div class="card-sub">${filtered.length} ítem${filtered.length!==1?"s":""} encontrado${filtered.length!==1?"s":""}</div>
    <div class="table-wrap"><div class="table-head ins-head">
      <div>Insumo</div><div>Categoría</div><div style="text-align:right">Cantidad</div>
      <div>Unidad</div><div style="text-align:right">Precio unit.</div>
      <div style="text-align:right">Valor total</div><div>Estado</div>
    </div>
    <div>${filtered.length ? filtered.map(i=>{
      const s = ec[i.estado]||{bg:"#f8fafc",c:"var(--muted)"};
      return`<div class="table-row ins-row"><div class="doc-name">${i.nombre}</div>
        <div><span class="cat-badge ${getCategoriaClass(i.categoria)}">${i.categoria}</span></div>
        <div style="text-align:right">${i.cantidad}</div><div style="font-size:12px;color:var(--muted)">${i.unidad}</div>
        <div style="text-align:right;font-size:12px">${formatoCLP(i.precio_unit)}</div>
        <div style="text-align:right;font-weight:600">${formatoCLP(i.cantidad*i.precio_unit)}</div>
        <div><span class="jv-badge" style="background:${s.bg};color:${s.c}">${i.estado}</span></div>
      </div>`;}).join("") : emptyState("Sin insumos que coincidan.")}</div>
  </div></div>`;
}

/* ── CONFIGURACIÓN RENDER ────────────────────────────────── */
const cfgUsers = [
  {nombre:"Christian García B.", cargo:"Administrador", rol:"Admin",    correo:"chgarciablanco@gmail.com", activo:true},
  {nombre:"Arq. Patricia López",  cargo:"Arquitecto",   rol:"Revisor",  correo:"plopez@arq.cl",            activo:true},
  {nombre:"Inspector Municipal",  cargo:"Fiscalizador", rol:"Inspector",correo:"insp@municipio.cl",        activo:true},
];
const cfgCategorias = {
  "Gastos":  ["Materiales","Mano de obra","Servicios","Herramientas","Transporte"],
  "Insumos": ["Materiales","Pinturas","EPP","Eléctrico","Gasfitería"],
};
const cfgAvBg = ["#059669","#0284c7","#d97706","#e11d48","#8b5cf6"];

function renderConfiguracion(){
  const el = $("config-root");
  if(!el) return;
  const av = (n,i) => `<div class="cfg2-avatar" style="background:${cfgAvBg[i%cfgAvBg.length]}">${n.split(" ").map(p=>p[0]).slice(0,2).join("")}</div>`;
  const rolBg = {Admin:{bg:"var(--green-soft)",c:"var(--green)"},Revisor:{bg:"var(--sky-soft)",c:"var(--sky)"},Inspector:{bg:"var(--amber-soft)",c:"var(--amber)"}};
  el.innerHTML = `
  <div class="cfg2-grid">
    <div class="card">
      <div class="cfg2-head"><div class="cfg2-icon">🏗️</div><div><div class="card-title">Datos del proyecto</div><div class="card-sub">Información general</div></div></div>
      <div class="cfg2-form">
        <label class="cfg2-label">Nombre del proyecto<input class="filter-select" value="${PROJECT_NAME}" style="height:38px;width:100%"></label>
        <label class="cfg2-label">Administrador<input class="filter-select" value="Christian García B." style="height:38px;width:100%"></label>
        <label class="cfg2-label">Presupuesto (CLP)<input class="filter-select" value="${PROJECT_BUDGET.toLocaleString("es-CL")}" style="height:38px;width:100%"></label>
        <label class="cfg2-label">Fecha de inicio<input type="date" class="filter-select" value="2024-01-15" style="height:38px;width:100%"></label>
        <label class="cfg2-label" style="grid-column:1/-1">Dirección<input class="filter-select" value="Sector Junquillar, Región Metropolitana" style="height:38px;width:100%"></label>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="filter-btn-apply" onclick="showToast('✓ Datos guardados correctamente')">Guardar cambios</button>
        <button class="filter-btn-clear" onclick="renderConfiguracion()">Cancelar</button>
      </div>
    </div>
    <div class="card">
      <div class="cfg2-head"><div class="cfg2-icon">👥</div><div><div class="card-title">Usuarios del proyecto</div><div class="card-sub">${cfgUsers.filter(u=>u.activo).length} activos</div></div></div>
      <div class="cfg2-users">
        ${cfgUsers.map((u,i)=>`<div class="cfg2-user-row">${av(u.nombre,i)}
          <div class="cfg2-user-info"><strong>${u.nombre}</strong><small>${u.cargo}</small></div>
          <small class="cfg2-email">${u.correo}</small>
          <span class="jv-badge" style="background:${rolBg[u.rol]?.bg||"#f8fafc"};color:${rolBg[u.rol]?.c||"var(--muted)"}">${u.rol}</span>
          <span class="jv-badge" style="background:var(--green-soft);color:var(--green)">● Activo</span>
        </div>`).join("")}
      </div>
      <button class="filter-btn-apply" style="margin-top:14px" onclick="showToast('✓ Función disponible próximamente')">+ Agregar usuario</button>
    </div>
  </div>
  <div class="cfg2-grid" style="margin-top:16px">
    <div class="card">
      <div class="cfg2-head"><div class="cfg2-icon">🏷️</div><div><div class="card-title">Categorías</div><div class="card-sub">Gastos e insumos</div></div></div>
      ${Object.entries(cfgCategorias).map(([grupo,cats])=>`
        <div style="margin-bottom:14px">
          <div class="cfg2-group-label">${grupo}</div>
          <div class="cfg2-tags">
            ${cats.map(c=>`<span class="cfg2-tag">${c}<button class="cfg2-tag-del" onclick="this.closest('.cfg2-tag').remove()">×</button></span>`).join("")}
            <button class="cfg2-tag-add" onclick="cfg2AddTag(this)">+ Agregar</button>
          </div>
        </div>`).join("")}
    </div>
    <div class="card">
      <div class="cfg2-head"><div class="cfg2-icon">🎨</div><div><div class="card-title">Apariencia</div><div class="card-sub">Tema y color de acento</div></div></div>
      <div class="cfg2-group-label">Tema de la interfaz</div>
      <div class="cfg2-theme-group">
        <button class="cfg2-theme-btn active" onclick="cfg2SetTheme(this)">☀️ Claro</button>
        <button class="cfg2-theme-btn" onclick="cfg2SetTheme(this)">🌙 Oscuro</button>
        <button class="cfg2-theme-btn" onclick="cfg2SetTheme(this)">💻 Sistema</button>
      </div>
      <div class="cfg2-group-label" style="margin-top:18px">Color de acento</div>
      <div class="cfg2-colors">
        <button class="cfg2-color active" style="background:#059669" onclick="cfg2SetColor(this,'#059669','#ecfdf5')" title="Verde (defecto)"></button>
        <button class="cfg2-color" style="background:#0b4f6c" onclick="cfg2SetColor(this,'#0b4f6c','#f0f9ff')" title="Azul marino"></button>
        <button class="cfg2-color" style="background:#0284c7" onclick="cfg2SetColor(this,'#0284c7','#e0f2fe')" title="Azul"></button>
        <button class="cfg2-color" style="background:#8b5cf6" onclick="cfg2SetColor(this,'#8b5cf6','#f5f3ff')" title="Violeta"></button>
        <button class="cfg2-color" style="background:#d97706" onclick="cfg2SetColor(this,'#d97706','#fffbeb')" title="Ámbar"></button>
        <button class="cfg2-color" style="background:#e11d48" onclick="cfg2SetColor(this,'#e11d48','#fff1f2')" title="Rojo"></button>
      </div>
      <button class="filter-btn-apply" style="margin-top:18px;width:100%" onclick="showToast('✓ Apariencia guardada')">Guardar apariencia</button>
    </div>
    <div class="card">
      <div class="cfg2-head"><div class="cfg2-icon">💰</div><div><div class="card-title">Presupuesto del proyecto</div><div class="card-sub">Se guarda en Supabase</div></div></div>
      <div id="cfg2-budget-editor"></div>
    </div>
  </div>`;
  renderCfgBudget();
}

function renderCfgBudget(){
  const el = $("cfg2-budget-editor");
  if(!el) return;
  el.innerHTML = `<div class="cfg2-label" style="margin-bottom:8px">Presupuesto referencial (CLP)</div>
    <div style="display:flex;gap:8px">
      <input type="text" id="cfg2-budget-input" class="filter-select" style="flex:1;height:38px" value="${PROJECT_BUDGET.toLocaleString("es-CL")}" placeholder="180.000.000">
      <button class="filter-btn-apply" id="cfg2-btn-save-budget">Guardar</button>
    </div>
    <div style="margin-top:10px;font-size:13px;color:var(--muted)">Actual: <strong>${formatoCLP(PROJECT_BUDGET)}</strong></div>`;
  $("cfg2-btn-save-budget")?.addEventListener("click", async()=>{
    const raw = String($("cfg2-budget-input")?.value||"").replace(/\./g,"").replace(",",".");
    const val = Number(raw);
    if(!val||val<1000){alert("Ingresa un presupuesto válido.");return;}
    await saveBudget(val);
    showToast("✓ Presupuesto actualizado");
    renderCfgBudget();
  });
}

function cfg2AddTag(btn){
  const nombre = prompt("Nueva categoría:");
  if(!nombre||!nombre.trim()) return;
  const tag = document.createElement("span");
  tag.className = "cfg2-tag";
  tag.innerHTML = nombre.trim() + `<button class="cfg2-tag-del" onclick="this.closest('.cfg2-tag').remove()">×</button>`;
  btn.before(tag);
}

function cfg2SetTheme(btn){
  btn.closest(".cfg2-theme-group").querySelectorAll(".cfg2-theme-btn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  const t = btn.textContent;
  if(t.includes("Oscuro")) document.documentElement.setAttribute("data-theme","dark");
  else if(t.includes("Sistema")) document.documentElement.setAttribute("data-theme", window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
  else document.documentElement.removeAttribute("data-theme");
}

function cfg2SetColor(btn, color, soft){
  btn.closest(".cfg2-colors").querySelectorAll(".cfg2-color").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  document.documentElement.style.setProperty("--green", color);
  document.documentElement.style.setProperty("--green-soft", soft);
}

function showToast(msg){
  document.querySelectorAll(".junqo-toast").forEach(t=>t.remove());
  const t = document.createElement("div");
  t.className = "junqo-toast"; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add("junqo-toast-show"));
  setTimeout(()=>{t.classList.remove("junqo-toast-show");setTimeout(()=>t.remove(),300);},2800);
}

function initDashboard(){setupNavigation();setupFileUpload();setupButtons();updateVisibleSections(views.resumen.visible);loadData();}
document.addEventListener("DOMContentLoaded",initDashboard);

/* ── Exponer funciones al scope global (necesario para onclick inline) ── */
window.openEditModal      = openEditModal;
window.closeEditModal     = closeEditModal;
window.confirmDelete      = confirmDelete;
window.setVentasTab       = setVentasTab;
window.showToast          = showToast;
window.cfg2AddTag         = cfg2AddTag;
window.cfg2SetTheme       = cfg2SetTheme;
window.cfg2SetColor       = cfg2SetColor;
window.toggleRowSelect    = toggleRowSelect;
// CRUD Ingresos
window.openModalIngreso   = openModalIngreso;
window.closeModalIngreso  = closeModalIngreso;
window.saveIngreso        = saveIngreso;
window.deleteIngreso      = deleteIngreso;
// CRUD Cotizaciones
window.openModalCotizacion  = openModalCotizacion;
window.closeModalCotizacion = closeModalCotizacion;
window.saveCotizacion       = saveCotizacion;
window.deleteCotizacion     = deleteCotizacion;
window.calcCotIva           = calcCotIva;
window.calcCotTotal         = calcCotTotal;
// CRUD Contactos
window.openModalContacto  = openModalContacto;
window.closeModalContacto = closeModalContacto;
window.saveContacto       = saveContacto;
window.deleteContacto     = deleteContacto;
// Control de Caja
window.openModalAbrirCaja  = openModalAbrirCaja;
window.closeModalAbrirCaja = closeModalAbrirCaja;
window.guardarAperturaCaja = guardarAperturaCaja;
window.openModalCerrarCaja  = openModalCerrarCaja;
window.closeModalCerrarCaja = closeModalCerrarCaja;
window.guardarCierreCaja    = guardarCierreCaja;
window.resetCaja            = resetCaja;

window.exportToExcel = exportReporteExcel;
window.exportBalanceExcel = exportBalanceExcel;

window.exportToPDF = function () {
  window.print();
};

window.toggleDetalle = function () {
  const el = document.getElementById("report-extras");
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
};





