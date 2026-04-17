const kpis = [
  {
    title: "Presupuesto construcción",
    value: "$180.000.000",
    delta: "↓ -2,1%",
    type: "down",
    footer: "Meta estimada de obra"
  },
  {
    title: "Costo acumulado",
    value: "$86.100.000",
    delta: "↑ +4,3%",
    type: "up",
    footer: "Ejecutado según documentos ingresados"
  },
  {
    title: "IVA crédito acumulado",
    value: "$13.740.000",
    delta: "↑ +7,8%",
    type: "up",
    footer: "Crédito fiscal disponible"
  },
  {
    title: "Caja disponible",
    value: "$21.000.000",
    delta: "↓ -1,5%",
    type: "down",
    footer: "Liquidez actual del proyecto"
  }
];

const chartData = [
  { month: "Ene", budget: 18, real: 16 },
  { month: "Feb", budget: 28, real: 25 },
  { month: "Mar", budget: 42, real: 39 },
  { month: "Abr", budget: 55, real: 58 },
  { month: "May", budget: 70, real: 68 },
  { month: "Jun", budget: 84, real: 79 },
  { month: "Jul", budget: 100, real: 92 }
];

const alerts = [
  {
    icon: "📄",
    title: "4 documentos sin clasificación",
    sub: "Faltan categoría contable y forma de pago"
  },
  {
    icon: "⚠️",
    title: "Terminaciones sobre presupuesto",
    sub: "El avance real supera lo estimado en 6,3%"
  },
  {
    icon: "💵",
    title: "Revisar caja para impuestos",
    sub: "Conviene proyectar IVA débito y cierre de venta"
  },
  {
    icon: "📅",
    title: "Hito próximo de obra",
    sub: "Instalación eléctrica y sanitaria pendiente esta semana"
  }
];

const docs = [
  {
    name: "Construmart Talca",
    type: "Factura",
    amount: "$1.840.000",
    status: "Pendiente de clasificación",
    cls: "s-red",
    date: "14 Abr"
  },
  {
    name: "Arquitectura Proyecto",
    type: "Factura",
    amount: "$2.200.000",
    status: "Ingresada",
    cls: "s-green",
    date: "13 Abr"
  },
  {
    name: "Maderas del Maule",
    type: "Boleta",
    amount: "$386.500",
    status: "Pendiente de respaldo",
    cls: "s-sky",
    date: "12 Abr"
  },
  {
    name: "Ferretería Sur",
    type: "Factura",
    amount: "$924.000",
    status: "Por aprobar",
    cls: "s-amber",
    date: "11 Abr"
  }
];

const categories = [
  { name: "Obra gruesa", pct: 34 },
  { name: "Terminaciones", pct: 22 },
  { name: "Instalaciones", pct: 18 },
  { name: "Proyectos", pct: 8 },
  { name: "Permisos", pct: 6 },
  { name: "Terreno", pct: 12 }
];

const bottomCards = [
  {
    label: "Terreno aportado",
    value: "$100.000.000",
    sub: "Base del activo del proyecto",
    icon: "🏢"
  },
  {
    label: "Partidas abiertas",
    value: "11",
    sub: "Pendientes entre obra y documentación",
    icon: "📋"
  },
  {
    label: "Respaldo tributario",
    value: "92%",
    sub: "Documentos con soporte correcto",
    icon: "🛡️"
  },
  {
    label: "Avance de obra",
    value: "68%",
    sub: "Ejecución general estimada",
    icon: "🏗️"
  }
];

const views = {
  inicio: {
    title: "Dashboard Junquillar",
    subtitle: "Resumen general del proyecto",
    visible: ["section-kpis", "section-charts", "section-docs", "section-bottom"]
  },
  costos: {
    title: "Costos",
    subtitle: "Control de gastos y avance presupuestario",
    visible: ["section-kpis", "section-charts", "section-docs"]
  },
  compras: {
    title: "Compras",
    subtitle: "Seguimiento de adquisiciones y proveedores",
    visible: ["section-kpis", "section-docs"]
  },
  documentos: {
    title: "Documentos",
    subtitle: "Facturas, boletas y respaldo del proyecto",
    visible: ["section-docs"]
  },
  caja: {
    title: "Caja",
    subtitle: "Liquidez disponible y movimientos del proyecto",
    visible: ["section-kpis", "section-bottom"]
  },
  balance: {
    title: "Balance",
    subtitle: "Vista general del estado financiero",
    visible: ["section-kpis", "section-bottom"]
  },
  reportes: {
    title: "Reportes",
    subtitle: "Indicadores clave y análisis resumido",
    visible: ["section-charts", "section-docs", "section-bottom"]
  }
};

function renderKPIs() {
  const el = document.getElementById("section-kpis");
  if (!el) return;

  el.innerHTML = kpis.map((kpi) => `
    <div class="kpi-card">
      <div class="kpi-top">
        <div>
          <div class="kpi-title">${kpi.title}</div>
          <div class="kpi-value">${kpi.value}</div>
        </div>
        <div class="badge ${kpi.type}">${kpi.delta}</div>
      </div>
      <div class="kpi-footer">${kpi.footer}</div>
    </div>
  `).join("");
}

function renderChart() {
  const bars = document.getElementById("chart-bars");
  const labels = document.getElementById("chart-labels");
  if (!bars || !labels) return;

  bars.innerHTML = chartData.map((item) => `
    <div class="chart-bar-group">
      <div class="bar-budget" style="height:${item.budget}%"></div>
      <div class="bar-real" style="height:${item.real}%"></div>
    </div>
  `).join("");

  labels.innerHTML = chartData.map((item) => `
    <div class="chart-label">${item.month}</div>
  `).join("");
}

function renderAlerts() {
  const el = document.getElementById("alerts-list");
  if (!el) return;

  el.innerHTML = alerts.map((alert) => `
    <div class="alert-item">
      <div class="alert-icon">${alert.icon}</div>
      <div>
        <div class="alert-title">${alert.title}</div>
        <div class="alert-sub">${alert.sub}</div>
      </div>
    </div>
  `).join("");
}

function renderDocs() {
  const el = document.getElementById("docs-table");
  if (!el) return;

  el.innerHTML = docs.map((doc) => `
    <div class="table-row">
      <div>
        <div class="doc-name">${doc.name}</div>
      </div>
      <div>
        <div>${doc.type}</div>
        <div class="doc-amount">${doc.amount}</div>
      </div>
      <div>
        <span class="status ${doc.cls}">${doc.status}</span>
      </div>
      <div class="doc-date">${doc.date}</div>
    </div>
  `).join("");
}

function renderCategories() {
  const el = document.getElementById("categories-list");
  if (!el) return;

  el.innerHTML = categories.map((cat) => `
    <div class="cat-item">
      <div class="cat-row">
        <div class="cat-name">${cat.name}</div>
        <div class="cat-pct">${cat.pct}%</div>
      </div>
      <div class="cat-track">
        <div class="cat-fill" style="width:${cat.pct}%"></div>
      </div>
    </div>
  `).join("");
}

function renderBottomCards() {
  const el = document.getElementById("section-bottom");
  if (!el) return;

  el.innerHTML = bottomCards.map((card) => `
    <div class="bottom-card">
      <div class="bottom-top">
        <div class="bottom-label">${card.label}</div>
        <div>${card.icon}</div>
      </div>
      <div class="bottom-value">${card.value}</div>
      <div class="bottom-sub">${card.sub}</div>
    </div>
  `).join("");
}

function updateVisibleSections(sectionIds = []) {
  const allSections = document.querySelectorAll(".module-block");

  allSections.forEach((section) => {
    section.classList.add("module-hidden");
  });

  sectionIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("module-hidden");
    }
  });
}

function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  if (!buttons.length || !title || !subtitle) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      const view = button.dataset.view;
      const config = views[view];

      if (config) {
        title.textContent = config.title;
        subtitle.textContent = config.subtitle;
        updateVisibleSections(config.visible);
      }
    });
  });

  updateVisibleSections(views.inicio.visible);
}

function initDashboard() {
  renderKPIs();
  renderChart();
  renderAlerts();
  renderDocs();
  renderCategories();
  renderBottomCards();
  setupNavigation();
}

document.addEventListener("DOMContentLoaded", initDashboard);