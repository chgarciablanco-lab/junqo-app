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
  resumen:     { title:"Resumen",            subtitle:"Vista ejecutiva del proyecto",                        visible:["section-kpis","section-alerts","section-bottom"] },
  control:     { title:"Control de Proyecto",subtitle:"Avance presupuestario, partidas e hitos",             visible:["section-control"] },
  gastos:      { title:"Gastos",             subtitle:"Registro y control de egresos del proyecto",          visible:["section-filtro-solo","section-docs"] },
  documentos:  { title:"Documentos",         subtitle:"Carga de facturas, boletas y respaldo documental",    visible:["section-upload-only"] },
  proveedores: { title:"Proveedores",        subtitle:"Análisis por proveedor, documentos y concentración",  visible:["section-proveedores"] },
  caja:        { title:"Caja e IVA",         subtitle:"Crédito fiscal, documentos y detalle mensual",        visible:["section-caja"] },
  balance:     { title:"Balance",            subtitle:"Vista contable calculada desde los gastos registrados",visible:["section-balance"] },
  reportes:    { title:"Reportes",           subtitle:"Análisis resumido por categoría y mes",               visible:["section-reportes"] }
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
  el.innerHTML=[
    ["Inversión total neta",formatoCLP(t.neto),formatoPct(avance),`${t.docs} documentos registrados`],
    ["IVA crédito fiscal",formatoCLP(t.iva),t.iva>0?"CF":"0","Calculado desde IVA registrado"],
    ["Total documentos",formatoCLP(t.total),`${t.proveedores} prov.`,"Total bruto acumulado"],
    ["Pendientes OCR",String(t.pendientesOcr),t.pendientesOcr>0?"pend.":"ok",`${t.sinProveedor} sin proveedor`]
  ].map(k=>`<div class="kpi-card"><div class="kpi-top"><div><div class="kpi-title">${k[0]}</div><div class="kpi-value">${k[1]}</div></div><span class="badge up">${k[2]}</span></div><div class="kpi-footer">${k[3]}</div></div>`).join("");
  const sf=document.querySelector(".sidebar-card .progress-fill");
  const sb=document.querySelector(".sidebar-card .big");
  const ss=document.querySelector(".sidebar-card .sub");
  if(sf)sf.style.width=`${Math.min(avance,100)}%`;
  if(sb)sb.textContent=formatoPct(avance);
  if(ss)ss.textContent=`${formatoCLP(t.neto)} de ${formatoCLP(PROJECT_BUDGET)} ejecutado`;
}
function renderAlerts(){
  const el=$("alerts-list");if(!el)return;
  if(!gastos.length){el.innerHTML=emptyState("Sin alertas.");return;}
  const t=getTotals();
  el.innerHTML=[
    ["📄",`${t.pendientesOcr} documentos pendientes OCR`,"Registros que requieren revisión documental."],
    ["⚠️",`${t.sinProveedor} registros incompletos`,"Gastos sin proveedor registrado."],
    ["💵",`${formatoCLP(t.iva)} de IVA crédito fiscal`,"Monto calculado desde los documentos."],
    ["📊",`${formatoPct(PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0)} de avance financiero`,"Avance calculado contra presupuesto."]
  ].map(a=>`<div class="alert-item"><div class="alert-icon">${a[0]}</div><div><div class="alert-title">${a[1]}</div><div class="alert-sub">${a[2]}</div></div></div>`).join("");
}
function renderBottomCards(){
  const el=$("section-bottom");if(!el)return;
  const t=getTotals(),ultima=gastos.length?normalizarFecha(gastos[0].fecha):"—";
  el.innerHTML=[
    ["Proveedores",t.proveedores,"Únicos registrados","🏢"],
    ["Último registro",ultima,"Según fecha de gasto","📅"],
    ["Total bruto",formatoCLP(t.total),"Neto + IVA","💼"],
    ["Avance presupuesto",formatoPct(PROJECT_BUDGET?(t.neto/PROJECT_BUDGET)*100:0),"Contra presupuesto","📈"]
  ].map(c=>`<div class="bottom-card"><div class="bottom-top"><div class="bottom-label">${c[0]}</div><div class="bottom-icon">${c[3]}</div></div><div class="bottom-value">${c[1]}</div><div class="bottom-sub">${c[2]}</div></div>`).join("");
}

/* ── GASTOS TABLE ─────────────────────────────────────────── */
function gastoRowHTML(g, fotoUrl){
  const safeNombre=(g.proveedor||"").replace(/'/g,"\\'").replace(/"/g,"&quot;");
  return`<div class="table-row gastos-row">
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
  if(!filteredDocs.length){el.innerHTML=emptyState("No hay gastos registrados.");if(btn)btn.style.display="none";return;}
  const slice=filteredDocs.slice(0,limit);
  el.innerHTML=slice.map(g=>gastoRowHTML(g,null)).join("");
  if(btn)btn.style.display=filteredDocs.length>limit?"inline-flex":"none";
  // Cargar URLs firmadas de forma asíncrona para cada fila con foto
  el.querySelectorAll(".foto-btn").forEach(async btn2=>{
    const path=btn2.dataset.path;if(!path)return;
    const url=await getFotoUrl(path);
    if(url){ btn2.style.opacity="1"; btn2.style.cursor="pointer"; btn2.onclick=()=>window.open(url,"_blank"); }
  });
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
function renderCaja(){renderCajaKpis();renderCajaTipos();renderCajaMensual();}
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
  const el=$("balance-table");if(!el)return;
  const t=getTotals();
  if(!gastos.length){el.innerHTML=emptyState("Sin movimientos.");return;}
  const TERRENO=100000000,APORTE=60000000;
  const aT=TERRENO,aO=t.neto,aI=t.iva,totA=aT+aO+aI;
  const pS=APORTE,pG=t.total,totP=pS+pG;
  const diff=totA-totP;
  const clp=v=>formatoCLP(v),z=()=>`<span style="color:#94a3b8">$0</span>`;
  const cell=(v,col)=>(!v||v===0)?z():(col?`<span style="color:${col};font-weight:600">${clp(v)}</span>`:clp(v));
  const row=(n,c,d,h,de,ac,a,p,pe,g,x="")=>`<div class="bal-row${x}"><div class="bal-n">${n}</div><div class="bal-cuenta">${c}</div><div class="bal-num">${cell(d)}</div><div class="bal-num">${cell(h)}</div><div class="bal-num">${cell(de)}</div><div class="bal-num">${cell(ac)}</div><div class="bal-num">${cell(a,"#059669")}</div><div class="bal-num">${cell(p)}</div><div class="bal-num">${cell(pe,"#e11d48")}</div><div class="bal-num">${cell(g,"#059669")}</div></div>`;
  const sec=l=>`<div class="bal-section">${l}</div>`;
  el.innerHTML=`<div class="bal-wrap"><div class="bal-group-head"><div class="bal-gh-spacer"></div><div class="bal-gh-group">MOVIMIENTOS</div><div class="bal-gh-group">SALDOS</div><div class="bal-gh-group">BALANCE</div><div class="bal-gh-group">RESULTADOS</div></div><div class="bal-col-head"><div class="bal-n">N°</div><div class="bal-cuenta">Cuenta</div><div class="bal-num">DEBE</div><div class="bal-num">HABER</div><div class="bal-num">DEUDOR</div><div class="bal-num">ACREEDOR</div><div class="bal-num">ACTIVO</div><div class="bal-num">PASIVO</div><div class="bal-num">PÉRDIDA</div><div class="bal-num">GANANCIA</div></div>${sec("ACTIVOS")}${row("1","Terreno",aT,0,aT,0,aT,0,0,0)}${row("2","Obra en Curso",aO,0,aO,0,aO,0,0,0)}${row("3","IVA Crédito Fiscal",aI,0,aI,0,aI,0,0,0)}${sec("PASIVOS")}${row("4","Cuenta por pagar al Socio",0,pS,0,pS,0,pS,0,0)}${row("5","Gastos por pagar",0,pG,0,pG,0,pG,0,0)}${diff!==0?row("6",diff>0?"Capital pendiente":"Ajuste",diff>0?diff:0,diff<0?Math.abs(diff):0,diff>0?diff:0,diff<0?Math.abs(diff):0,0,0,diff<0?Math.abs(diff):0,diff>0?diff:0):""}<div class="bal-row bal-total"><div class="bal-n"></div><div class="bal-cuenta">TOTAL</div><div class="bal-num">${clp(totA)}</div><div class="bal-num">${clp(totP+(diff>0?diff:0))}</div><div class="bal-num">${clp(totA)}</div><div class="bal-num">${clp(totP+(diff>0?diff:0))}</div><div class="bal-num">${clp(totA)}</div><div class="bal-num">${clp(totP)}</div><div class="bal-num">$0</div><div class="bal-num">$0</div></div></div>`;
  el.parentElement.querySelector(".balance-note")?.remove();
  el.insertAdjacentHTML("afterend",`<div class="balance-note">⚠️ Valores calculados automáticamente. No reemplaza revisión contable formal.</div>`);
}

/* ── CONTROL DE PROYECTO ──────────────────────────────────── */
function renderControlProyecto(){renderControlKpis();renderControlEtapas();renderControlHitos();renderControlCat();}
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
  el.innerHTML=`<div class="etapas-cards-grid">${Object.entries(groups).map(([cat,rows])=>{
    const monto=sumBy(rows,"neto"),pct=total?(monto/total)*100:0;
    return`<div class="etapa-card-item">
      <div class="etapa-card-top">
        <span class="cat-badge ${getCategoriaClass(cat)}">${cat}</span>
        <span class="etapa-card-pct">${formatoPct(pct)}</span>
      </div>
      <div class="etapa-card-monto">${formatoCLP(monto)}</div>
      <div class="cat-track" style="margin-top:10px">
        <div class="cat-fill" style="width:${Math.min(pct,100)}%"></div>
      </div>
      <div class="etapa-card-sub">${rows.length} documentos</div>
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
  const cg=groupBy(gastos,g=>g.categoria||"Sin categoría"),total=sumBy(gastos,"neto"),months=[...new Set(gastos.map(g=>mesLabel(g.fecha)))].sort();
  el.innerHTML=Object.entries(cg).map(([cat,rows])=>{const bm=groupBy(rows,r=>mesLabel(r.fecha)),ct=sumBy(rows,"neto");const vals=Array.from({length:5}).map((_,i)=>`<div>${months[i]?formatoCLP(sumBy(bm[months[i]]||[],"neto")):"—"}</div>`).join("");return`<div class="table-row ctrl-cat-row"><div><span class="cat-badge ${getCategoriaClass(cat)}">${cat}</span></div><div>Gasto</div>${vals}<div>${formatoCLP(ct)}</div><div>${formatoPct(total?(ct/total)*100:0)}</div></div>`;}).join("");
}

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
  renderReportConfig();
  renderReportWidgets();
}

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
  }));
  $("btn-ver-reportes")?.addEventListener("click",()=>document.querySelector('[data-view="reportes"]')?.click());
}

/* ── RENDER ALL ───────────────────────────────────────────── */
function renderAll(){
  renderKPIs();renderAlerts();renderBottomCards();
  renderDocs(docsVisibleLimit);renderProveedores();
  renderCaja();renderBalance();renderControlProyecto();
  renderReportes();renderBudgetEditor();
}

/* ── CSV EXPORT ───────────────────────────────────────────── */
function rowsToCSV(rows){
  const h=["fecha","proveedor","rut","tipo_documento","numero_documento","categoria","neto","iva","total","metodo_pago","estado_ocr"];
  const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  return[h.join(";"),...rows.map(r=>h.map(f=>esc(r[f])).join(";"))].join("\n");
}
function downloadText(name,text){const b=new Blob([text],{type:"text/csv;charset=utf-8"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
function exportCSV(){downloadText("gastos_junquillar.csv",rowsToCSV(filteredDocs));}

/* ── SETUP ────────────────────────────────────────────────── */
function setupButtons(){
  $("load-more-btn")?.addEventListener("click",()=>{docsVisibleLimit+=20;renderDocs(docsVisibleLimit);});
  $("btn-aplicar-filtros-gastos")?.addEventListener("click",applyFilters);
  $("btn-limpiar-filtros-gastos")?.addEventListener("click",clearFilters);
  $("btn-export-csv")?.addEventListener("click",exportCSV);
  $("btn-export-excel")?.addEventListener("click",exportCSV);
  ["filter-text-gastos","global-search"].forEach(id=>$(id)?.addEventListener("input",applyFilters));
  $("modal-overlay")?.addEventListener("click",closeEditModal);
  $("btn-modal-cancel")?.addEventListener("click",closeEditModal);
  $("btn-modal-save")?.addEventListener("click",saveEditModal);
}
function initDashboard(){setupNavigation();setupFileUpload();setupButtons();updateVisibleSections(views.resumen.visible);loadData();}
document.addEventListener("DOMContentLoaded",initDashboard);

window.openEditModal  = openEditModal;
window.closeEditModal = closeEditModal;
window.confirmDelete  = confirmDelete;