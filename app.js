/* ============================================================
   JUNQO – Casa Junquillar  |  app.js
   ============================================================ */

/* ── KPIs ─────────────────────────────────────────────────── */
const kpis = [
  {title:"Inversión total (Costo Neto)", value:"$ 80.209.999", delta:"↑ 44,6%", type:"up",   footer:"Dic 2025 – Abr 2026 · 99 documentos"},
  {title:"IVA Crédito Fiscal",           value:"$ 15.198.267", delta:"↑ 19,0%", type:"up",   footer:"86 docs CF · Art. 23 D.L. 825 recuperable"},
  {title:"Total Activo Contable",        value:"$ 95.408.266", delta:"↑ 0,0%",  type:"up",   footer:"Obra en Curso + IVA CF"},
  {title:"Documentos registrados",       value:"99 docs",      delta:"↑ 34",    type:"up",   footer:"84 FA · 2 GD · 13 BE"}
];

/* ── GASTOS (99 registros) ────────────────────────────────── */
const docs = [
  {date:"04/12/2025",name:"Easy Retail S.A.",rut:"76.568.660-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 19.247",iva:"$ 3.657",total:"$ 22.904",cf:"✔",pago:"Tarjeta débito"},
  {date:"04/12/2025",name:"Ebema S.A.",rut:"83.585.400-0",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 1.840.923",iva:"$ 349.775",total:"$ 2.190.698",cf:"✔",pago:"Contado"},
  {date:"04/12/2025",name:"Energyfusion SPA",rut:"77.514.352-5",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 175.000",iva:"$ 33.250",total:"$ 208.250",cf:"✔",pago:"Contado"},
  {date:"04/12/2025",name:"Ferretería Santander",rut:"77.860.066-8",tipo:"BE",cat:"Materiales",catCls:"cat-materiales",costo:"$ 19.800",iva:"—",total:"$ 19.800",cf:"—",pago:"Tarjeta débito"},
  {date:"04/12/2025",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 222.206",iva:"$ 42.219",total:"$ 264.425",cf:"✔",pago:"—"},
  {date:"05/12/2025",name:"Easy Retail S.A.",rut:"76.568.660-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 19.247",iva:"$ 3.657",total:"$ 22.904",cf:"✔",pago:"Tarjeta débito"},
  {date:"09/12/2025",name:"Ferretería Las Rastras SPA",rut:"76.861.313-9",tipo:"BE",cat:"Materiales",catCls:"cat-materiales",costo:"$ 2.500",iva:"—",total:"$ 2.500",cf:"—",pago:"Tarjeta débito"},
  {date:"09/12/2025",name:"Milan Fabjanovic SPA",rut:"81.548.400-2",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 49.520",iva:"$ 9.409",total:"$ 58.929",cf:"✔",pago:"Tarjeta débito"},
  {date:"09/12/2025",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 41.146",iva:"$ 7.818",total:"$ 48.964",cf:"✔",pago:"Tarjeta débito"},
  {date:"10/12/2025",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 58.174",iva:"$ 11.053",total:"$ 69.227",cf:"✔",pago:"Tarjeta débito"},
  {date:"16/12/2025",name:"Ebema S.A.",rut:"83.585.400-0",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 2.550.169",iva:"$ 484.532",total:"$ 3.034.701",cf:"✔",pago:"Contado"},
  {date:"17/12/2025",name:"Guillermo Eliseo Díaz Olave",rut:"10.789.987-1",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 1.287.500",iva:"$ 244.625",total:"$ 1.532.125",cf:"✔",pago:"Crédito"},
  {date:"18/12/2025",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 31.924",iva:"$ 6.066",total:"$ 37.990",cf:"✔",pago:"Tarjeta débito"},
  {date:"20/12/2025",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 10.000",iva:"—",total:"$ 10.000",cf:"—",pago:"Tarjeta débito"},
  {date:"22/12/2025",name:"Solusip SPA",rut:"76.874.595-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 4.924.370",iva:"$ 935.630",total:"$ 5.860.000",cf:"✔",pago:"Contado"},
  {date:"23/12/2025",name:"Ferrital Ltda",rut:"78.045.980-8",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 17.342",iva:"$ 3.295",total:"$ 20.637",cf:"✔",pago:"Tarjeta débito"},
  {date:"23/12/2025",name:"Hormigones Polpaico S.A.",rut:"76.084.154-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 2.678.760",iva:"$ 508.964",total:"$ 3.187.724",cf:"✔",pago:"Contado"},
  {date:"23/12/2025",name:"Mi Viejo Roble SPA",rut:"76.893.512-2",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 8.235",iva:"$ 1.565",total:"$ 9.800",cf:"✔",pago:"Contado"},
  {date:"23/12/2025",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 12.098",iva:"—",total:"$ 12.098",cf:"—",pago:"Tarjeta débito"},
  {date:"25/12/2025",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 18.150",iva:"—",total:"$ 18.150",cf:"—",pago:"Tarjeta débito"},
  {date:"26/12/2025",name:"Bosamaq SPA",rut:"77.073.449-5",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 60.000",iva:"$ 11.400",total:"$ 71.400",cf:"✔",pago:"Contado"},
  {date:"26/12/2025",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 90.342",iva:"$ 17.165",total:"$ 107.507",cf:"✔",pago:"Tarjeta débito"},
  {date:"29/12/2025",name:"CSS Asesorías y Construcción Limitada",rut:"77.340.307-4",tipo:"FA",cat:"Mano de obra",catCls:"cat-mano",costo:"$ 10.714.034",iva:"$ 2.035.666",total:"$ 12.749.700",cf:"✔",pago:"Crédito"},
  {date:"30/12/2025",name:"Ebema S.A.",rut:"83.585.400-0",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 3.065.981",iva:"$ 582.536",total:"$ 3.648.517",cf:"✔",pago:"Contado"},
  {date:"30/12/2025",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 153.863",iva:"$ 29.234",total:"$ 183.097",cf:"✔",pago:"Tarjeta débito"},
  {date:"30/12/2025",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 11.329",iva:"$ 2.153",total:"$ 13.482",cf:"✔",pago:"Tarjeta débito"},
  {date:"30/12/2025",name:"Hormigones La Promesa SPA",rut:"77.539.021-2",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 185.546",iva:"$ 35.254",total:"$ 220.800",cf:"✔",pago:"Contado"},
  {date:"30/12/2025",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 64.300",iva:"$ 12.217",total:"$ 76.517",cf:"✔",pago:"Crédito"},
  {date:"31/12/2025",name:"Hormigones Polpaico S.A.",rut:"76.084.154-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 1.436.160",iva:"$ 272.870",total:"$ 1.709.030",cf:"✔",pago:"Contado"},
  {date:"05/01/2026",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 25.460",iva:"—",total:"$ 25.460",cf:"—",pago:"Efectivo"},
  {date:"05/01/2026",name:"Walmart Chile (Lider)",rut:"76.134.946-5",tipo:"BE",cat:"Materiales",catCls:"cat-materiales",costo:"$ 7.190",iva:"—",total:"$ 7.190",cf:"—",pago:"Tarjeta débito"},
  {date:"06/01/2026",name:"Ebema S.A.",rut:"83.585.400-0",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 181.930",iva:"$ 34.567",total:"$ 216.497",cf:"✔",pago:"Contado"},
  {date:"06/01/2026",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 536.417",iva:"$ 101.919",total:"$ 638.336",cf:"✔",pago:"Tarjeta débito"},
  {date:"07/01/2026",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 25.395",iva:"—",total:"$ 25.395",cf:"—",pago:"Tarjeta débito"},
  {date:"08/01/2026",name:"Ferretería Las Rastras SPA",rut:"76.861.313-9",tipo:"BE",cat:"Materiales",catCls:"cat-materiales",costo:"$ 27.903",iva:"—",total:"$ 27.903",cf:"—",pago:"Red Compra débito"},
  {date:"09/01/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 38.000",iva:"$ 7.220",total:"$ 45.220",cf:"✔",pago:"Tarjeta débito"},
  {date:"14/01/2026",name:"Mauricio Eugenio Nuñez Moreno",rut:"16.002.577-8",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 150.000",iva:"$ 28.500",total:"$ 178.500",cf:"✔",pago:"Contado"},
  {date:"14/01/2026",name:"Oscar Atala y Ernesto Contreras Ltda (Ingethe",rut:"78.792.230-9",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 3.014.650",iva:"$ 572.784",total:"$ 3.587.434",cf:"✔",pago:"Contado"},
  {date:"14/01/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 19.000",iva:"$ 3.610",total:"$ 22.610",cf:"✔",pago:"Tarjeta débito"},
  {date:"15/01/2026",name:"Aceros Talca S.A.",rut:"96.978.630-3",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 133.160",iva:"$ 25.300",total:"$ 158.460",cf:"✔",pago:"Contado"},
  {date:"16/01/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 19.000",iva:"$ 3.610",total:"$ 22.610",cf:"✔",pago:"Tarjeta débito"},
  {date:"16/01/2026",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 23.685",iva:"—",total:"$ 23.685",cf:"—",pago:"Tarjeta débito"},
  {date:"17/01/2026",name:"Mauricio Eugenio Nuñez Moreno",rut:"16.002.577-8",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 45.000",iva:"$ 8.550",total:"$ 53.550",cf:"✔",pago:"Contado"},
  {date:"19/01/2026",name:"Easy Retail S.A.",rut:"76.568.660-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 51.806",iva:"$ 9.843",total:"$ 61.649",cf:"✔",pago:"Tarjeta débito"},
  {date:"19/01/2026",name:"Formación de Aceros S.A.",rut:"95.672.000-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 4.204.131",iva:"$ 798.785",total:"$ 5.002.916",cf:"✔",pago:"Abono Cta. Corriente"},
  {date:"20/01/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 7.731",iva:"$ 1.469",total:"$ 9.200",cf:"✔",pago:"Tarjeta débito"},
  {date:"20/01/2026",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 17.841",iva:"—",total:"$ 17.841",cf:"—",pago:"Tarjeta débito"},
  {date:"20/01/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 34.034",iva:"$ 6.466",total:"$ 40.500",cf:"✔",pago:"Red Compra débito"},
  {date:"20/01/2026",name:"Hormigones Polpaico S.A.",rut:"76.084.154-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 1.616.382",iva:"$ 307.113",total:"$ 1.923.495",cf:"✔",pago:"Contado"},
  {date:"21/01/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 9.411",iva:"$ 1.788",total:"$ 11.199",cf:"✔",pago:"Red Compra débito"},
  {date:"21/01/2026",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 8.249",iva:"$ 1.567",total:"$ 9.816",cf:"✔",pago:"Tarjeta débito"},
  {date:"23/01/2026",name:"Solusip SPA",rut:"76.874.595-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 4.924.370",iva:"$ 935.630",total:"$ 5.860.000",cf:"✔",pago:"Contado"},
  {date:"26/01/2026",name:"Soc. Comercial Cabo de Hornos Ltda (Copec)",rut:"76.416.244-7",tipo:"BE",cat:"Transporte",catCls:"cat-transporte",costo:"$ 18.601",iva:"—",total:"$ 18.601",cf:"—",pago:"Tarjeta débito"},
  {date:"27/01/2026",name:"Oscar Atala y Ernesto Contreras Ltda (Ingethe",rut:"78.792.230-9",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 63.025",iva:"$ 11.975",total:"$ 75.000",cf:"✔",pago:"Contado"},
  {date:"27/01/2026",name:"Easy Retail S.A.",rut:"76.568.660-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 7.578",iva:"$ 1.440",total:"$ 9.018",cf:"✔",pago:"Tarjeta débito"},
  {date:"27/01/2026",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 37.624",iva:"$ 7.149",total:"$ 44.773",cf:"✔",pago:"Tarjeta débito"},
  {date:"27/01/2026",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 7.165",iva:"$ 1.361",total:"$ 8.526",cf:"✔",pago:"Tarjeta débito"},
  {date:"28/01/2026",name:"Acenor Aceros del Norte S.A.",rut:"77.660.960-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 367.772",iva:"$ 69.877",total:"$ 437.649",cf:"✔",pago:"Contado"},
  {date:"28/01/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 32.269",iva:"$ 6.131",total:"$ 38.400",cf:"✔",pago:"Tarjeta débito"},
  {date:"29/01/2026",name:"Milan Fabjanovic SPA",rut:"81.548.400-2",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 6.202",iva:"$ 1.178",total:"$ 7.380",cf:"✔",pago:"Tarjeta débito"},
  {date:"30/01/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 8.655",iva:"$ 1.644",total:"$ 10.299",cf:"✔",pago:"Red Compra débito"},
  {date:"30/01/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 3.866",iva:"$ 735",total:"$ 4.601",cf:"✔",pago:"Red Compra débito"},
  {date:"30/01/2026",name:"Terraquímica SPA",rut:"77.604.953-0",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 33.529",iva:"$ 6.371",total:"$ 39.900",cf:"✔",pago:"Mercado Pago"},
  {date:"30/01/2026",name:"CSS Asesorías y Construcción Limitada",rut:"77.340.307-4",tipo:"FA",cat:"Mano de obra",catCls:"cat-mano",costo:"$ 7.679.691",iva:"$ 1.459.141",total:"$ 9.138.832",cf:"✔",pago:"Crédito"},
  {date:"31/01/2026",name:"Mauricio Eugenio Nuñez Moreno",rut:"16.002.577-8",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 150.000",iva:"$ 28.500",total:"$ 178.500",cf:"✔",pago:"Contado"},
  {date:"02/02/2026",name:"Guillermo Eliseo Díaz Olave",rut:"10.789.987-1",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 1.937.500",iva:"$ 368.125",total:"$ 2.305.625",cf:"✔",pago:"Crédito"},
  {date:"09/02/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 20.588",iva:"$ 3.912",total:"$ 24.500",cf:"✔",pago:"Red Compra débito"},
  {date:"09/02/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 16.471",iva:"$ 3.129",total:"$ 19.600",cf:"✔",pago:"Red Compra débito"},
  {date:"09/02/2026",name:"Ferretería Talca SPA",rut:"76.390.027-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 21.765",iva:"$ 4.135",total:"$ 25.900",cf:"✔",pago:"Tarjeta débito"},
  {date:"11/02/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 11.429",iva:"$ 2.172",total:"$ 13.601",cf:"✔",pago:"Red Compra débito"},
  {date:"11/02/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 8.824",iva:"$ 1.677",total:"$ 10.501",cf:"✔",pago:"Red Compra débito"},
  {date:"12/02/2026",name:"Easy Retail S.A.",rut:"76.568.660-1",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 24.246",iva:"$ 4.607",total:"$ 28.853",cf:"✔",pago:"Tarjeta débito"},
  {date:"13/02/2026",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 207.338",iva:"$ 39.394",total:"$ 246.732",cf:"✔",pago:"Tarjeta débito"},
  {date:"16/02/2026",name:"Soc. Comercial Betrental Ltda",rut:"77.040.509-2",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 300.000",iva:"$ 57.000",total:"$ 357.000",cf:"✔",pago:"Contado"},
  {date:"17/02/2026",name:"Ebema S.A.",rut:"83.585.400-0",tipo:"GD",cat:"Materiales",catCls:"cat-materiales",costo:"$ 2.244.712",iva:"$ 426.495",total:"$ 2.671.207",cf:"✔",pago:"—"},
  {date:"17/02/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 10.000",iva:"$ 1.900",total:"$ 11.900",cf:"✔",pago:"Tarjeta débito"},
  {date:"17/02/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"GD",cat:"Materiales",catCls:"cat-materiales",costo:"$ 1.600",iva:"$ 304",total:"$ 1.904",cf:"✔",pago:"Tarjeta débito"},
  {date:"18/02/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 4.800",iva:"$ 912",total:"$ 5.712",cf:"✔",pago:"Tarjeta débito"},
  {date:"18/02/2026",name:"Easy Retail S.A.",rut:"76.134.946-5",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 5.193",iva:"$ 987",total:"$ 6.180",cf:"✔",pago:"Tarjeta débito"},
  {date:"19/02/2026",name:"Ebema S.A.",rut:"83.585.400-0",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 485.230",iva:"$ 92.194",total:"$ 577.424",cf:"✔",pago:"Contado"},
  {date:"19/02/2026",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 38.400",iva:"$ 7.296",total:"$ 45.696",cf:"✔",pago:"Tarjeta débito"},
  {date:"20/02/2026",name:"Ebema S.A.",rut:"83.585.400-0",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 22.100",iva:"$ 4.199",total:"$ 26.299",cf:"✔",pago:"Contado"},
  {date:"20/02/2026",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 3.840",iva:"$ 730",total:"$ 4.570",cf:"✔",pago:"Tarjeta débito"},
  {date:"20/02/2026",name:"Comercial Electricidad Talca Limitada",rut:"78.012.167-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 12.306",iva:"$ 2.338",total:"$ 14.644",cf:"✔",pago:"Tarjeta débito"},
  {date:"20/02/2026",name:"Easy Retail S.A.",rut:"76.134.946-5",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 46.618",iva:"$ 8.857",total:"$ 55.475",cf:"✔",pago:"Tarjeta débito"},
  {date:"20/02/2026",name:"RLB Construcciones SPA (Letmaq)",rut:"77.331.893-K",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 2.933",iva:"$ 557",total:"$ 3.490",cf:"✔",pago:"Tarjeta débito"},
  {date:"20/02/2026",name:"Claudio Alberto Jara Caceres",rut:"12.691.163-3",tipo:"BE",cat:"Materiales",catCls:"cat-materiales",costo:"$ 10.500",iva:"—",total:"$ 10.500",cf:"—",pago:"Tarjeta débito"},
  {date:"23/02/2026",name:"Sodimac S.A.",rut:"96.792.430-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 38.787",iva:"$ 7.369",total:"$ 46.156",cf:"✔",pago:"Tarjeta débito"},
  {date:"23/02/2026",name:"Ferretería Las Rastras SPA",rut:"76.851.313-9",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 3.866",iva:"$ 735",total:"$ 4.601",cf:"✔",pago:"Red Compra débito"},
  {date:"23/02/2026",name:"Comercial Electricidad Talca Limitada",rut:"78.012.167-K",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 24.000",iva:"$ 4.560",total:"$ 28.560",cf:"✔",pago:"Tarjeta débito"},
  {date:"24/02/2026",name:"Facava Electricidad (Juan Cancino Garrido)",rut:"9.633.707-8",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 91.000",iva:"$ 17.290",total:"$ 108.290",cf:"✔",pago:"Tarjeta débito"},
  {date:"24/02/2026",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Herramientas",catCls:"cat-herramientas",costo:"$ 3.798",iva:"$ 722",total:"$ 4.520",cf:"✔",pago:"Tarjeta débito"},
  {date:"26/02/2026",name:"Comercializadora Johann Hans Schwaner Pino EI",rut:"76.579.971-6",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 6.034",iva:"$ 1.146",total:"$ 7.180",cf:"✔",pago:"Tarjeta débito"},
  {date:"27/02/2026",name:"CSS Asesorías y Construcción Limitada",rut:"77.340.307-4",tipo:"FA",cat:"Mano de obra",catCls:"cat-mano",costo:"$ 16.809.086",iva:"$ 3.193.726",total:"$ 20.002.812",cf:"✔",pago:"Crédito"},
  {date:"27/02/2026",name:"Ferretería Industrial SyC Limitada",rut:"76.884.923-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 69.750",iva:"$ 13.253",total:"$ 83.003",cf:"✔",pago:"Tarjeta débito"},
  {date:"16/03/2026",name:"Hojalatería Talk-Tec SPA",rut:"77.570.212-5",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 453.782",iva:"$ 86.219",total:"$ 540.001",cf:"✔",pago:"Contado"},
  {date:"25/03/2026",name:"Bosamaq SPA",rut:"77.073.449-5",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 460.000",iva:"$ 87.400",total:"$ 547.400",cf:"✔",pago:"Crédito"},
  {date:"31/03/2026",name:"Hormigones Polpaico S.A.",rut:"76.084.154-4",tipo:"FA",cat:"Materiales",catCls:"cat-materiales",costo:"$ 1.733.915",iva:"$ 329.444",total:"$ 2.063.359",cf:"✔",pago:"Contado"},
  {date:"01/04/2026",name:"Guillermo Eliseo Díaz Olave",rut:"10.789.987-1",tipo:"FA",cat:"Servicios",catCls:"cat-servicios",costo:"$ 1.775.000",iva:"$ 337.250",total:"$ 2.112.250",cf:"✔",pago:"Crédito"}
];

/* ── PROVEEDORES ──────────────────────────────────────────── */
const proveedores = [
  {n:1,  name:"CSS Asesorías y Construcción Ltda.", rut:"77.340.307-4", cat:"Mano de obra",  catCls:"cat-mano",        docs:3,  costo:"$ 35.202.811", iva:"$ 6.688.533", pct:"43,9%"},
  {n:2,  name:"Ebema S.A.",                         rut:"83.585.400-0", cat:"Materiales",    catCls:"cat-materiales",  docs:7,  costo:"$ 10.391.045", iva:"$ 1.974.298", pct:"13,0%"},
  {n:3,  name:"Solusip SPA",                        rut:"76.874.595-1", cat:"Materiales",    catCls:"cat-materiales",  docs:2,  costo:"$ 9.848.740",  iva:"$ 1.871.260", pct:"12,3%"},
  {n:4,  name:"Hormigones Polpaico S.A.",            rut:"76.084.154-4", cat:"Materiales",    catCls:"cat-materiales",  docs:4,  costo:"$ 7.465.217",  iva:"$ 1.418.391", pct:"9,3%"},
  {n:5,  name:"Guillermo Eliseo Díaz Olave",         rut:"10.789.987-1", cat:"Servicios",     catCls:"cat-servicios",   docs:3,  costo:"$ 5.000.000",  iva:"$ 950.000",   pct:"6,2%"},
  {n:6,  name:"Formación de Aceros S.A.",            rut:"95.672.000-1", cat:"Materiales",    catCls:"cat-materiales",  docs:1,  costo:"$ 4.204.131",  iva:"$ 798.785",   pct:"5,2%"},
  {n:7,  name:"Oscar Atala y Ernesto Contreras Ltda.",rut:"78.792.230-9",cat:"Servicios",     catCls:"cat-servicios",   docs:2,  costo:"$ 3.077.675",  iva:"$ 584.759",   pct:"3,8%"},
  {n:8,  name:"Sodimac S.A.",                        rut:"96.792.430-K", cat:"Materiales",    catCls:"cat-materiales",  docs:8,  costo:"$ 1.022.836",  iva:"$ 194.339",   pct:"1,3%"},
  {n:9,  name:"Ferretería Industrial SyC Ltda.",     rut:"76.884.923-4", cat:"Materiales",    catCls:"cat-materiales",  docs:9,  costo:"$ 537.516",    iva:"$ 102.129",   pct:"0,7%"},
  {n:10, name:"Bosamaq SPA",                         rut:"77.073.449-5", cat:"Servicios",     catCls:"cat-servicios",   docs:2,  costo:"$ 520.000",    iva:"$ 98.800",    pct:"0,6%"},
  {n:11, name:"Hojalatería Talk-Tec SPA",            rut:"77.570.212-5", cat:"Servicios",     catCls:"cat-servicios",   docs:1,  costo:"$ 453.782",    iva:"$ 86.219",    pct:"0,6%"},
  {n:12, name:"Acenor Aceros del Norte S.A.",        rut:"77.660.960-9", cat:"Materiales",    catCls:"cat-materiales",  docs:1,  costo:"$ 367.772",    iva:"$ 69.877",    pct:"0,5%"},
  {n:13, name:"Mauricio Eugenio Nuñez Moreno",       rut:"16.002.577-8", cat:"Servicios",     catCls:"cat-servicios",   docs:3,  costo:"$ 345.000",    iva:"$ 65.550",    pct:"0,4%"},
  {n:14, name:"Soc. Comercial Betrental Ltda.",      rut:"77.040.509-2", cat:"Servicios",     catCls:"cat-servicios",   docs:1,  costo:"$ 300.000",    iva:"$ 57.000",    pct:"0,4%"},
  {n:15, name:"RLB Construcciones SPA",              rut:"77.331.893-K", cat:"Herramientas",  catCls:"cat-herramientas", docs:10, costo:"$ 199.633",   iva:"$ 37.930",    pct:"0,2%"},
  {n:16, name:"Hormigones La Promesa SPA",           rut:"77.539.021-2", cat:"Materiales",    catCls:"cat-materiales",  docs:1,  costo:"$ 185.546",    iva:"$ 35.254",    pct:"0,2%"},
  {n:17, name:"Energyfusion SPA",                    rut:"77.514.352-5", cat:"Materiales",    catCls:"cat-materiales",  docs:1,  costo:"$ 175.000",    iva:"$ 33.250",    pct:"0,2%"},
  {n:18, name:"Copec (Cabo de Hornos Ltda.)",        rut:"76.416.244-7", cat:"Transporte",    catCls:"cat-transporte",  docs:8,  costo:"$ 151.230",    iva:"—",           pct:"0,2%"},
  {n:19, name:"Aceros Talca S.A.",                   rut:"96.978.630-3", cat:"Materiales",    catCls:"cat-materiales",  docs:1,  costo:"$ 133.160",    iva:"$ 25.300",    pct:"0,2%"},
  {n:20, name:"Easy Retail S.A.",                    rut:"76.568.660-1", cat:"Materiales",    catCls:"cat-materiales",  docs:5,  costo:"$ 122.124",    iva:"$ 23.204",    pct:"0,2%"}
];

/* ── CONTROL DE COSTOS ────────────────────────────────────── */
const costosCat = [
  {cat:"Materiales",   tipo:"Directo",   dic:"$ 17.544.029", ene:"$ 12.180.784", feb:"$ 3.419.397",  mar:"$ 1.733.915", abr:"—",           total:"$ 34.878.125", pct:43.5},
  {cat:"Mano de obra", tipo:"Directo",   dic:"$ 10.714.034", ene:"$ 7.679.691",  feb:"$ 16.809.086", mar:"—",           abr:"—",           total:"$ 35.202.811", pct:43.9},
  {cat:"Servicios",    tipo:"Indirecto", dic:"$ 1.420.035",  ene:"$ 3.479.675",  feb:"$ 2.237.500",  mar:"$ 913.782",   abr:"$ 1.775.000", total:"$ 9.825.992",  pct:12.3},
  {cat:"Herramientas", tipo:"Indirecto", dic:"$ 49.520",     ene:"$ 85.590",     feb:"$ 16.731",     mar:"—",           abr:"—",           total:"$ 151.841",    pct:0.2},
  {cat:"Transporte",   tipo:"Indirecto", dic:"$ 40.248",     ene:"$ 110.982",    feb:"—",            mar:"—",           abr:"—",           total:"$ 151.230",    pct:0.2}
];

const etapas = [
  {etapa:"Movimiento de tierra", partidas:"Trabajos previos · Trazados y niveles",                                                           real:"$ 2.597.330",  presup:"$ 9.000.000",  pct:28.9,  estado:"en-curso"},
  {etapa:"Obra gruesa",          partidas:"Fundaciones · Hormigones · Pavimentos · Estructura tabiques · Acero estructural",                  real:"$ 25.684.710", presup:"$ 72.000.000", pct:35.7,  estado:"en-curso"},
  {etapa:"Techumbre",            partidas:"Estructura techumbre · Aislación · Cubierta · Impermeabilización",                                 real:"$ 17.284.115", presup:"$ 27.000.000", pct:64.0,  estado:"en-curso"},
  {etapa:"Terminaciones",        partidas:"Revestimientos · Porcelanatos · Cielos · Puertas · Molduras · Pinturas",                           real:"$ 16.517.507", presup:"$ 45.000.000", pct:36.7,  estado:"pendiente"},
  {etapa:"Instalaciones",        partidas:"Instalaciones eléctricas, sanitarias y gas",                                                       real:"$ 18.126.337", presup:"$ 27.000.000", pct:67.1,  estado:"en-curso"}
];

const hitos = [
  {area:"Obra gruesa",      estado:"en-curso",   desc:"Hormigones y estructura avanzados",          responsable:"CSS Asesorías y Construcción Ltda.",   fecha:"En ejecución"},
  {area:"Techumbre",        estado:"en-curso",   desc:"Cubierta e impermeabilización en proceso",    responsable:"Solusip SPA",                          fecha:"En ejecución"},
  {area:"Instalaciones",    estado:"en-curso",   desc:"Eléctrica y sanitaria en ejecución",          responsable:"Oscar Atala y Ernesto Contreras Ltda.", fecha:"Esta semana"},
  {area:"Terminaciones",    estado:"pendiente",  desc:"Revestimientos y pinturas pendientes",        responsable:"Por asignar",                          fecha:"Próxima etapa"},
  {area:"Permisos",         estado:"pendiente",  desc:"Recepción municipal pendiente",               responsable:"Administrador del proyecto",            fecha:"Al término obra"},
  {area:"Documentación",    estado:"observado",  desc:"4 documentos sin imputar",                    responsable:"Christian García Blanco",              fecha:"Urgente"}
];

/* ── IVA / CAJA ───────────────────────────────────────────── */
const ivaMes = [
  {mes:"Dic 2025", docs:24, base:"$ 29.705.318", cf:"$ 5.644.010",  acum:"$ 5.644.010"},
  {mes:"Ene 2026", docs:29, base:"$ 23.390.647", cf:"$ 4.444.223",  acum:"$ 10.088.233"},
  {mes:"Feb 2026", docs:29, base:"$ 22.472.214", cf:"$ 4.269.721",  acum:"$ 14.357.954"},
  {mes:"Mar 2026", docs:3,  base:"$ 2.647.697",  cf:"$ 503.063",    acum:"$ 14.861.017"},
  {mes:"Abr 2026", docs:1,  base:"$ 1.775.000",  cf:"$ 337.250",    acum:"$ 15.198.267"}
];

const ivaTipos = [
  {tipo:"Factura afecta",   docs:84, base:"$ 78.130.623", iva:"$ 14.771.468", cf:"✔", criterio:"Costo=Neto, IVA=CF"},
  {tipo:"Guía de Despacho", docs:2,  base:"$ 1.860.253",  iva:"$ 426.799",    cf:"✔", criterio:"Costo=Neto, IVA=CF"},
  {tipo:"Boleta exenta",    docs:13, base:"$ 219.123",    iva:"—",            cf:"✘", criterio:"Costo=Total (sin IVA)"}
];

/* ── ALERTAS ──────────────────────────────────────────────── */
const alerts = [
  {icon:"📄", title:"4 documentos sin imputar",        sub:"Faltan categoría contable y forma de pago"},
  {icon:"⚠️", title:"Terminaciones sobre presupuesto", sub:"Costo real supera estimado en 6,3%"},
  {icon:"💵", title:"IVA CF $ 15.198.267 acumulado",   sub:"Recuperar en F29 SII próximo período"},
  {icon:"📅", title:"Hito crítico: Instalaciones",     sub:"Eléctrica y sanitaria pendiente esta semana"}
];

/* ── PAGINACIÓN ───────────────────────────────────────────── */
let docsVisible = 3;
const DOCS_PAGE = 5;
let filteredDocs = [...docs];

/* ── VIEWS ────────────────────────────────────────────────── */
const views = {
  resumen:     {title:"Resumen",             subtitle:"Vista ejecutiva del proyecto · Dic 2025 – Abr 2026",    visible:["section-kpis","section-upload","section-docs","section-alerts","section-bottom"]},
  control:     {title:"Control de Proyecto", subtitle:"Avance físico, presupuesto y hitos · Casa Junquillar",  visible:["section-control"]},
  gastos:      {title:"Gastos",              subtitle:"Libro de gastos completo · 99 registros",               visible:["section-filtro-solo","section-docs","section-alerts"]},
  documentos:  {title:"Documentos",          subtitle:"Adjuntar y buscar documentos del proyecto",             visible:["section-upload"]},
  proveedores: {title:"Proveedores",         subtitle:"Análisis de proveedores · 34 proveedores",             visible:["section-proveedores"]},
  caja:        {title:"Caja e IVA",          subtitle:"Liquidez e IVA Crédito Fiscal · D.L. 825",             visible:["section-caja"]},
  balance:     {title:"Balance",             subtitle:"Balance general formato contable · Al 01/04/2026",      visible:["section-balance"]},
  reportes:    {title:"Reportes",            subtitle:"Exportar para contador, socio o banco",                 visible:["section-reportes"]}
};

const ALL_SECTION_IDS = [
  "section-kpis","section-upload","section-docs","section-alerts","section-bottom",
  "section-control","section-proveedores","section-caja","section-balance","section-reportes","section-filtro-solo"
];

/* ── RENDER KPIs ──────────────────────────────────────────── */
function renderKPIs() {
  const el = document.getElementById("section-kpis");
  if (!el) return;
  el.innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-top">
        <div><div class="kpi-title">${k.title}</div><div class="kpi-value">${k.value}</div></div>
        <span class="badge ${k.type}">${k.delta}</span>
      </div>
      <div class="kpi-footer">${k.footer}</div>
    </div>`).join("");
}

/* ── RENDER ALERTAS ───────────────────────────────────────── */
function renderAlerts() {
  const el = document.getElementById("alerts-list");
  if (!el) return;
  el.innerHTML = alerts.map(a => `
    <div class="alert-item">
      <div class="alert-icon">${a.icon}</div>
      <div><div class="alert-title">${a.title}</div><div class="alert-sub">${a.sub}</div></div>
    </div>`).join("");
}

/* ── RENDER GASTOS ────────────────────────────────────────── */
function renderDocsRows() {
  const el  = document.getElementById("docs-table");
  const btn = document.getElementById("load-more-btn");
  const sub = document.getElementById("docs-subtitle");
  if (!el) return;
  const visible = filteredDocs.slice(0, docsVisible);
  el.innerHTML = visible.map(d => `
    <div class="table-row gastos-row">
      <div class="doc-date">${d.date}</div>
      <div class="doc-name">${d.name}</div>
      <div class="doc-rut">${d.rut}</div>
      <div class="doc-tipo">${d.tipo}</div>
      <div><span class="cat-badge ${d.catCls}">${d.cat}</span></div>
      <div class="doc-amount">${d.costo}</div>
      <div class="doc-amount">${d.iva}</div>
      <div class="doc-amount">${d.total}</div>
      <div class="doc-cf">${d.cf}</div>
      <div class="doc-pago">${d.pago}</div>
      <div class="doc-actions">
        <button class="action-btn" title="Editar">✏️</button>
        <button class="action-btn" title="Eliminar">🗑️</button>
      </div>
    </div>`).join("");
  if (sub) sub.textContent = `${filteredDocs.length} registros · FA = Factura Afecta · GD = Guía de Despacho · BE = Boleta Exenta`;
  if (btn) btn.style.display = docsVisible >= filteredDocs.length ? "none" : "inline-flex";
}

function renderDocs(initialCount) {
  docsVisible = initialCount || 3;
  filteredDocs = [...docs];
  renderDocsRows();
  const btn = document.getElementById("load-more-btn");
  if (btn) {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.textContent = "Ver más";
    newBtn.addEventListener("click", () => {
      docsVisible = Math.min(docsVisible + DOCS_PAGE, filteredDocs.length);
      renderDocsRows();
    });
  }
}

function applyFilters() {
  const txt   = (document.getElementById("filter-text")?.value || "").toLowerCase();
  const cat   = document.getElementById("filter-cat")?.value  || "";
  const tipo  = document.getElementById("filter-tipo")?.value || "";
  const pago  = document.getElementById("filter-pago")?.value || "";
  const desde = document.getElementById("filter-desde")?.value || "";
  const hasta = document.getElementById("filter-hasta")?.value || "";
  filteredDocs = docs.filter(d => {
    if (txt  && !d.name.toLowerCase().includes(txt) && !d.rut.includes(txt)) return false;
    if (cat  && d.cat  !== cat)  return false;
    if (tipo && d.tipo !== tipo) return false;
    if (pago && d.pago !== pago) return false;
    if (desde && d.date < desde.split("-").reverse().join("/")) return false;
    if (hasta && d.date > hasta.split("-").reverse().join("/")) return false;
    return true;
  });
  docsVisible = 10;
  renderDocsRows();
}

function clearFilters() {
  ["filter-text","filter-cat","filter-tipo","filter-pago","filter-desde","filter-hasta"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  filteredDocs = [...docs];
  docsVisible = 3;
  renderDocsRows();
}


/* ── SUPABASE: GASTOS REALES ──────────────────────────────── */
function formatoCLP(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "—";
  return numero.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  });
}

function formatFechaSupabase(fecha) {
  if (!fecha) return "—";
  const partes = String(fecha).split("-");
  if (partes.length === 3) return partes[2] + "/" + partes[1] + "/" + partes[0];
  return fecha;
}

function getCategoriaClass(categoria = "") {
  const cat = String(categoria || "").toLowerCase();
  if (cat.includes("material")) return "cat-materiales";
  if (cat.includes("mano")) return "cat-mano";
  if (cat.includes("servicio")) return "cat-servicios";
  if (cat.includes("herramienta")) return "cat-herramientas";
  if (cat.includes("transporte")) return "cat-transporte";
  return "cat-otros";
}

function mapSupabaseGastoToDoc(gasto) {
  return {
    id: gasto.id,
    date: formatFechaSupabase(gasto.fecha),
    name: gasto.proveedor || "Pendiente OCR",
    rut: gasto.rut || "—",
    tipo: gasto.tipo_documento || "—",
    numero: gasto.numero_documento || "—",
    cat: gasto.categoria || "Sin categoría",
    catCls: getCategoriaClass(gasto.categoria),
    costo: formatoCLP(gasto.neto),
    iva: formatoCLP(gasto.iva),
    total: formatoCLP(gasto.total),
    cf: Number(gasto.iva || 0) > 0 ? "✔" : "—",
    pago: gasto.metodo_pago || "—",
    estadoOcr: gasto.estado_ocr || "pendiente",
    fotoPath: gasto.foto_path || null,
    observacion: gasto.observacion || ""
  };
}

function getActiveView() {
  return document.querySelector(".nav-btn.active")?.dataset?.view || "resumen";
}

async function cargarGastosDesdeSupabase() {
  if (typeof supabaseClient === "undefined") {
    console.warn("Supabase no está configurado. Usando datos locales.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("gastos_junquillar_app")
    .select("*")
    .eq("proyecto", "Junquillar")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando gastos desde Supabase:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.warn("Supabase no devolvió registros. Se mantienen datos locales.");
    return;
  }

  docs.length = 0;
  docs.push(...data.map(mapSupabaseGastoToDoc));
  filteredDocs = [...docs];

  const activeView = getActiveView();
  renderDocs(activeView === "gastos" ? 10 : 3);
}

/* ── RENDER CONTROL DE PROYECTO ───────────────────────────── */
function renderControl() {
  /* KPIs de control */
  const kpiEl = document.getElementById("control-kpis");
  if (kpiEl) {
    const ctrlKpis = [
      {label:"Costo ejecutado",     value:"$ 80.209.999", sub:"de $ 180.000.000 presupuestado", pct:44.6, color:"up"},
      {label:"Costo por m²",        value:"$ 948.474",    sub:"sobre 190 m² útiles",            pct:null, color:"up"},
      {label:"Desviación",          value:"-$ 99.790.001",sub:"vs presupuesto construcción",    pct:null, color:"down"},
      {label:"Avance presupuesto",  value:"44,6%",        sub:"5 etapas activas",               pct:44.6, color:"up"}
    ];
    kpiEl.innerHTML = ctrlKpis.map(k => `
      <div class="kpi-card">
        <div class="kpi-top">
          <div><div class="kpi-title">${k.label}</div><div class="kpi-value">${k.value}</div></div>
          <span class="badge ${k.color}">${k.color === "up" ? "↑" : "↓"}</span>
        </div>
        <div class="kpi-footer">${k.sub}</div>
      </div>`).join("");
  }

  /* Etapas */
  const etEl = document.getElementById("control-etapas");
  if (etEl) {
    etEl.innerHTML = etapas.map(e => {
      const desv = parseInt(e.real.replace(/\D/g,"")) - parseInt(e.presup.replace(/\D/g,""));
      const desvFmt = desv < 0 ? `-$ ${Math.abs(desv).toLocaleString("es-CL")}` : `+$ ${desv.toLocaleString("es-CL")}`;
      const estadoCls = {pendiente:"estado-pendiente","en-curso":"estado-activo",terminado:"estado-ok"}[e.estado] || "";
      return `<div class="etapa-card">
        <div class="etapa-header">
          <div class="etapa-nombre">${e.etapa}</div>
          <span class="estado-badge ${estadoCls}">${e.estado === "en-curso" ? "En curso" : e.estado === "pendiente" ? "Pendiente" : "Terminado"}</span>
        </div>
        <div class="etapa-partidas">${e.partidas}</div>
        <div class="etapa-progress-wrap">
          <div class="etapa-progress-bar">
            <div class="etapa-progress-fill" style="width:${e.pct}%"></div>
          </div>
          <span class="etapa-pct">${e.pct}%</span>
        </div>
        <div class="etapa-nums">
          <div class="etapa-num"><span class="etapa-lbl">Real</span><span class="etapa-val">${e.real}</span></div>
          <div class="etapa-num"><span class="etapa-lbl">Presupuesto</span><span class="etapa-val">${e.presup}</span></div>
          <div class="etapa-num"><span class="etapa-lbl">Desviación</span><span class="etapa-val ${desv < 0 ? "desv-neg" : "desv-pos"}">${desvFmt}</span></div>
        </div>
      </div>`;
    }).join("");
  }

  /* Hitos */
  const hitosEl = document.getElementById("control-hitos");
  if (hitosEl) {
    hitosEl.innerHTML = hitos.map(h => {
      const cls = {pendiente:"estado-pendiente","en-curso":"estado-activo",observado:"estado-obs"}[h.estado] || "";
      const icon = {pendiente:"⏳","en-curso":"🔨",observado:"⚠️"}[h.estado] || "•";
      return `<div class="hito-card">
        <div class="hito-icon">${icon}</div>
        <div class="hito-body">
          <div class="hito-area">${h.area}</div>
          <div class="hito-desc">${h.desc}</div>
          <div class="hito-meta"><span class="hito-resp">👤 ${h.responsable}</span><span class="hito-fecha">📅 ${h.fecha}</span></div>
        </div>
        <span class="estado-badge ${cls}">${h.estado === "en-curso" ? "En curso" : h.estado === "pendiente" ? "Pendiente" : "Observado"}</span>
      </div>`;
    }).join("");
  }

  /* Costos por categoría */
  const catEl = document.getElementById("control-cat");
  if (catEl) {
    catEl.innerHTML = costosCat.map(c => `
      <div class="table-row ctrl-cat-row">
        <div class="doc-name">${c.cat}</div>
        <div><span class="tipo-badge ${c.tipo === "Directo" ? "tipo-directo" : "tipo-indirecto"}">${c.tipo}</span></div>
        <div class="doc-amount">${c.dic}</div>
        <div class="doc-amount">${c.ene}</div>
        <div class="doc-amount">${c.feb}</div>
        <div class="doc-amount">${c.mar}</div>
        <div class="doc-amount">${c.abr}</div>
        <div class="doc-amount"><strong>${c.total}</strong></div>
        <div class="prov-pct">
          <div class="prov-bar-wrap"><div class="prov-bar" style="width:${c.pct}%"></div></div>
          <span>${c.pct}%</span>
        </div>
      </div>`).join("");
  }
}

/* ── RENDER PROVEEDORES ───────────────────────────────────── */
function renderProveedores() {
  const el = document.getElementById("proveedores-table");
  if (!el) return;
  el.innerHTML = proveedores.map(p => `
    <div class="table-row prov-row">
      <div class="prov-n">${p.n}</div>
      <div class="doc-name">${p.name}</div>
      <div class="doc-rut">${p.rut}</div>
      <div><span class="cat-badge ${p.catCls}">${p.cat}</span></div>
      <div class="doc-amount">${p.docs}</div>
      <div class="doc-amount">${p.costo}</div>
      <div class="doc-amount">${p.iva}</div>
      <div class="prov-pct">
        <div class="prov-bar-wrap"><div class="prov-bar" style="width:${parseFloat(p.pct)}%"></div></div>
        <span>${p.pct}</span>
      </div>
    </div>`).join("");
}

/* ── RENDER CAJA ──────────────────────────────────────────── */
function renderCaja() {
  const tipos   = document.getElementById("caja-tipos");
  const mensual = document.getElementById("caja-mensual");
  if (tipos) tipos.innerHTML = ivaTipos.map(t => `
    <div class="caja-tipos-row">
      <div class="doc-name">${t.tipo}</div>
      <div class="doc-amount">${t.docs}</div>
      <div class="doc-amount">${t.base}</div>
      <div class="doc-amount">${t.iva}</div>
      <div><span class="cf-badge ${t.cf === "✔" ? "cf-ok" : "cf-no"}">${t.cf} ${t.cf === "✔" ? "Recuperable" : "Sin IVA"}</span></div>
      <div class="doc-tipo">${t.criterio}</div>
    </div>`).join("");
  if (mensual) mensual.innerHTML = ivaMes.map(m => `
    <div class="caja-mensual-row">
      <div class="doc-name">${m.mes}</div>
      <div class="doc-amount">${m.docs}</div>
      <div class="doc-amount">${m.base}</div>
      <div class="doc-amount iva-cf">${m.cf}</div>
      <div class="doc-amount">${m.acum}</div>
    </div>`).join("");
}

/* ── RENDER BALANCE ───────────────────────────────────────── */
function renderBalance() {
  const el = document.getElementById("balance-table");
  if (!el) return;
  const secciones = [
    {
      label:"1. ACTIVO CORRIENTE",
      rows:[
        {n:"1",cuenta:"11100 · IVA Crédito Fiscal (FA + GD)",debe:"$ 15.198.267",haber:"—",deudor:"$ 15.198.267",acreedor:"—",activo:"$ 15.198.267",pasivo:"—",perdida:"—",ganancia:"—"}
      ],
      sub:{debe:"$ 15.198.267",haber:"—",deudor:"$ 15.198.267",acreedor:"—",activo:"$ 15.198.267",pasivo:"—",perdida:"—",ganancia:"—"}
    },
    {
      label:"2. ACTIVO NO CORRIENTE — OBRA EN CURSO",
      rows:[
        {n:"2",cuenta:"12100 · Obra en Curso — Materiales",          debe:"$ 34.878.125",haber:"—",deudor:"$ 34.878.125",acreedor:"—",activo:"$ 34.878.125",pasivo:"—",perdida:"—",ganancia:"—"},
        {n:"3",cuenta:"12200 · Obra en Curso — Mano de Obra Directa", debe:"$ 35.202.811",haber:"—",deudor:"$ 35.202.811",acreedor:"—",activo:"$ 35.202.811",pasivo:"—",perdida:"—",ganancia:"—"},
        {n:"4",cuenta:"12300 · Obra en Curso — Servicios y Subcontratos",debe:"$ 9.825.992",haber:"—",deudor:"$ 9.825.992",acreedor:"—",activo:"$ 9.825.992",pasivo:"—",perdida:"—",ganancia:"—"},
        {n:"5",cuenta:"12400 · Obra en Curso — Herramientas y Equipos", debe:"$ 151.841",  haber:"—",deudor:"$ 151.841",  acreedor:"—",activo:"$ 151.841",  pasivo:"—",perdida:"—",ganancia:"—"},
        {n:"6",cuenta:"12500 · Obra en Curso — Transporte y Logística", debe:"$ 151.230",  haber:"—",deudor:"$ 151.230",  acreedor:"—",activo:"$ 151.230",  pasivo:"—",perdida:"—",ganancia:"—"}
      ],
      sub:{debe:"$ 80.209.999",haber:"—",deudor:"$ 80.209.999",acreedor:"—",activo:"$ 80.209.999",pasivo:"—",perdida:"—",ganancia:"—"}
    },
    {
      label:"3. PASIVO",
      rows:[{n:"7",cuenta:"31000 · Pasivos (No informado)",debe:"—",haber:"—",deudor:"—",acreedor:"—",activo:"—",pasivo:"—",perdida:"—",ganancia:"—"}],
      sub:{debe:"—",haber:"—",deudor:"—",acreedor:"—",activo:"—",pasivo:"—",perdida:"—",ganancia:"—"}
    },
    {
      label:"4. PATRIMONIO",
      rows:[{n:"8",cuenta:"41000 · Capital Proyecto (No determinado)",debe:"—",haber:"—",deudor:"—",acreedor:"—",activo:"—",pasivo:"—",perdida:"—",ganancia:"—"}],
      sub:{debe:"—",haber:"—",deudor:"—",acreedor:"—",activo:"—",pasivo:"—",perdida:"—",ganancia:"—"}
    },
    {
      label:"5. RESULTADOS DEL EJERCICIO",
      rows:[
        {n:"",cuenta:"51000 · Ingresos  ← No registrados (proyecto en construcción)",debe:"—",haber:"—",deudor:"—",acreedor:"—",activo:"—",pasivo:"—",perdida:"—",ganancia:"—"},
        {n:"",cuenta:"52000 · Costos ← Activados como Obra en Curso (no como gasto)",debe:"—",haber:"—",deudor:"—",acreedor:"—",activo:"—",pasivo:"—",perdida:"—",ganancia:"—"},
        {n:"",cuenta:"RESULTADO DEL EJERCICIO ← Indeterminado (sin ingresos realizados)",debe:"—",haber:"—",deudor:"—",acreedor:"—",activo:"—",pasivo:"—",perdida:"—",ganancia:"—"}
      ],
      sub:null
    }
  ];
  let html = "";
  secciones.forEach(s => {
    html += `<div class="balance-section-header">${s.label}</div>`;
    s.rows.forEach(r => {
      html += `<div class="table-row balance-row">
        <div class="balance-n">${r.n}</div><div class="balance-cuenta">${r.cuenta}</div>
        <div class="doc-amount">${r.debe}</div><div class="doc-amount">${r.haber}</div>
        <div class="doc-amount">${r.deudor}</div><div class="doc-amount">${r.acreedor}</div>
        <div class="doc-amount balance-activo">${r.activo}</div><div class="doc-amount">${r.pasivo}</div>
        <div class="doc-amount">${r.perdida}</div><div class="doc-amount">${r.ganancia}</div>
      </div>`;
    });
    if (s.sub) html += `<div class="table-row balance-subtotal">
      <div></div><div>SUBTOTAL</div>
      <div class="doc-amount">${s.sub.debe}</div><div class="doc-amount">${s.sub.haber}</div>
      <div class="doc-amount">${s.sub.deudor}</div><div class="doc-amount">${s.sub.acreedor}</div>
      <div class="doc-amount balance-activo">${s.sub.activo}</div><div class="doc-amount">${s.sub.pasivo}</div>
      <div class="doc-amount">${s.sub.perdida}</div><div class="doc-amount">${s.sub.ganancia}</div>
    </div>`;
  });
  html += `<div class="table-row balance-total">
    <div></div><div>TOTALES GENERALES</div>
    <div class="doc-amount">$ 95.408.266</div><div class="doc-amount">—</div>
    <div class="doc-amount">$ 95.408.266</div><div class="doc-amount">—</div>
    <div class="doc-amount balance-activo">$ 95.408.266</div><div class="doc-amount">—</div>
    <div class="doc-amount">—</div><div class="doc-amount">—</div>
  </div>`;
  el.innerHTML = html;
}

/* ── RENDER REPORTES ──────────────────────────────────────── */
function renderReportes() {
  const catEl   = document.getElementById("reportes-cat");
  const etapaEl = document.getElementById("reportes-etapas");
  if (catEl) catEl.innerHTML = costosCat.map(c => `
    <div class="table-row ctrl-cat-row">
      <div class="doc-name">${c.cat}</div>
      <div><span class="tipo-badge ${c.tipo === "Directo" ? "tipo-directo" : "tipo-indirecto"}">${c.tipo}</span></div>
      <div class="doc-amount">${c.dic}</div><div class="doc-amount">${c.ene}</div>
      <div class="doc-amount">${c.feb}</div><div class="doc-amount">${c.mar}</div>
      <div class="doc-amount">${c.abr}</div>
      <div class="doc-amount"><strong>${c.total}</strong></div>
      <div class="prov-pct">
        <div class="prov-bar-wrap"><div class="prov-bar" style="width:${c.pct}%"></div></div>
        <span>${c.pct}%</span>
      </div>
    </div>`).join("");
  if (etapaEl) etapaEl.innerHTML = etapas.map(e => {
    const desv = parseInt(e.real.replace(/\D/g,"")) - parseInt(e.presup.replace(/\D/g,""));
    const desvFmt = `-$ ${Math.abs(desv).toLocaleString("es-CL")}`;
    return `<div class="etapa-reporte-row">
      <div class="doc-name">${e.etapa}</div>
      <div class="doc-amount">${e.real}</div>
      <div class="doc-amount">${e.presup}</div>
      <div class="doc-amount desv-neg">${desvFmt}</div>
      <div class="prov-pct">
        <div class="prov-bar-wrap"><div class="prov-bar prov-bar-etapa" style="width:${e.pct}%"></div></div>
        <span>${e.pct}%</span>
      </div>
    </div>`;
  }).join("");
}

/* ── RENDER BOTTOM CARDS ──────────────────────────────────── */
function renderBottomCards() {
  const el = document.getElementById("section-bottom");
  if (!el) return;
  const cards = [
    {label:"Terreno aportado",    value:"$ 100.000.000", sub:"Base de activo del proyecto",                       icon:"🏢"},
    {label:"Etapas activas",      value:"5",             sub:"Mov. tierra · Obra gruesa · Techumbre · Term. · Inst.", icon:"📋"},
    {label:"Respaldo tributario", value:"87%",           sub:"86 de 99 docs con IVA CF recuperable",              icon:"🛡️"},
    {label:"Avance presupuesto",  value:"44,6%",         sub:"$ 80,2M de $ 180M presupuestado",                   icon:"🏗️"}
  ];
  el.innerHTML = cards.map(c => `
    <div class="bottom-card">
      <div class="bottom-top"><div class="bottom-label">${c.label}</div><div>${c.icon}</div></div>
      <div class="bottom-value">${c.value}</div>
      <div class="bottom-sub">${c.sub}</div>
    </div>`).join("");
}

/* ── EXPORT HELPERS ───────────────────────────────────────── */
function toCSV(rows, headers) {
  const escape = v => `"${String(v).replace(/"/g,'""')}"`;
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}
function downloadFile(content, filename, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], {type}));
  a.download = filename;
  a.click();
}
function exportCSV() {
  const headers = ["Fecha","Proveedor","RUT","Tipo","Categoría","Costo Neto","IVA CF","Total Doc.","CF?","Método Pago"];
  const rows = filteredDocs.map(d => [d.date,d.name,d.rut,d.tipo,d.cat,d.costo,d.iva,d.total,d.cf,d.pago]);
  downloadFile(toCSV(rows, headers), "gastos_junquillar.csv", "text/csv");
}
function exportExcel() {
  const headers = ["Fecha","Proveedor","RUT","Tipo","Categoría","Costo Neto","IVA CF","Total Doc.","CF?","Método Pago"];
  const rows = filteredDocs.map(d => [d.date,d.name,d.rut,d.tipo,d.cat,d.costo,d.iva,d.total,d.cf,d.pago]);
  // Simple TSV that Excel opens natively
  const tsv = [headers, ...rows].map(r => r.join("\t")).join("\n");
  downloadFile(tsv, "gastos_junquillar.xls", "application/vnd.ms-excel");
}
function exportProvCSV() {
  const headers = ["#","Proveedor","RUT","Categoría","N° Docs","Costo Neto","IVA CF","% Total"];
  const rows = proveedores.map(p => [p.n,p.name,p.rut,p.cat,p.docs,p.costo,p.iva,p.pct]);
  downloadFile(toCSV(rows, headers), "proveedores_junquillar.csv", "text/csv");
}
function exportProvExcel() {
  const headers = ["#","Proveedor","RUT","Categoría","N° Docs","Costo Neto","IVA CF","% Total"];
  const rows = proveedores.map(p => [p.n,p.name,p.rut,p.cat,p.docs,p.costo,p.iva,p.pct]);
  downloadFile([headers,...rows].map(r=>r.join("\t")).join("\n"), "proveedores_junquillar.xls", "application/vnd.ms-excel");
}
function exportReporteCSV() { exportCSV(); }
function exportReporteExcel() { exportExcel(); }
function exportReportePDF() {
  window.print();
}

/* ── VISIBILITY ───────────────────────────────────────────── */
function updateVisibleSections(ids = []) {
  ALL_SECTION_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("module-hidden", !ids.includes(id));
  });
}

/* ── NAVIGATION ───────────────────────────────────────────── */
function setupNavigation() {
  const btns    = document.querySelectorAll(".nav-btn[data-view]");
  const titleEl = document.getElementById("page-title");
  const subEl   = document.getElementById("page-subtitle");
  if (!btns.length) return;
  btns.forEach(btn => btn.addEventListener("click", () => {
    btns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const cfg = views[btn.dataset.view];
    if (!cfg) return;
    titleEl.textContent = cfg.title;
    subEl.textContent   = cfg.subtitle;
    updateVisibleSections(cfg.visible);
    const v = btn.dataset.view;
    if (v === "resumen") renderDocs(3);
    else if (v === "gastos") renderDocs(10);
  }));
}

/* ── INIT ─────────────────────────────────────────────────── */
function initDashboard() {
  /* Sidebar "Ver reportes" button */
  const verReportesBtn = document.getElementById('btn-ver-reportes');
  if (verReportesBtn) {
    verReportesBtn.addEventListener('click', function() {
      document.querySelector('[data-view="reportes"]').click();
    });
  }
  renderKPIs();
  renderAlerts();
  renderDocs(3);
  renderControl();
  renderProveedores();
  renderCaja();
  renderBalance();
  renderReportes();
  renderBottomCards();
  setupNavigation();
  updateVisibleSections(views.resumen.visible);
  cargarGastosDesdeSupabase();
}

document.addEventListener("DOMContentLoaded", initDashboard);