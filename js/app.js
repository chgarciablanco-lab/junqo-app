import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://ccwaysefralvvcanfyck.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CkQMEYmO3PMnHS8NbtDd9A_En8pvV6W'
const IVA_RATE = 0.19
const INITIAL_VISIBLE = 3
const MORE_STEP = 5

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const state = {
  visibleCount: INITIAL_VISIBLE,
  editingId: null,
  editingFotoPath: null
}

const els = {
  topbar: document.getElementById('topbar'),
  topbarUser: document.getElementById('topbarUser'),
  logoutTopBtn: document.getElementById('logoutTopBtn'),
  loginScreen: document.getElementById('loginScreen'),
  menuScreen: document.getElementById('menuScreen'),
  formScreen: document.getElementById('formScreen'),
  reviewScreen: document.getElementById('reviewScreen'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  loginBtn: document.getElementById('loginBtn'),
  goFormBtn: document.getElementById('goFormBtn'),
  goReviewBtn: document.getElementById('goReviewBtn'),
  backFromFormBtn: document.getElementById('backFromFormBtn'),
  backFromReviewBtn: document.getElementById('backFromReviewBtn'),
  formTitle: document.getElementById('formTitle'),
  formSubtitle: document.getElementById('formSubtitle'),
  fecha: document.getElementById('fecha'),
  proveedor: document.getElementById('proveedor'),
  rut: document.getElementById('rut'),
  tipoDocumento: document.getElementById('tipo_documento'),
  numeroDocumento: document.getElementById('numero_documento'),
  neto: document.getElementById('neto'),
  iva: document.getElementById('iva'),
  total: document.getElementById('total'),
  categoria: document.getElementById('categoria'),
  metodoPago: document.getElementById('metodo_pago'),
  observacion: document.getElementById('observacion'),
  fileInput: document.getElementById('fileInput'),
  fotoActualInfo: document.getElementById('fotoActualInfo'),
  saveWithPhotoBtn: document.getElementById('saveWithPhotoBtn'),
  saveNoPhotoBtn: document.getElementById('saveNoPhotoBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  filtroProveedor: document.getElementById('filtroProveedor'),
  filtroFechaDesde: document.getElementById('filtroFechaDesde'),
  filtroFechaHasta: document.getElementById('filtroFechaHasta'),
  applyFiltersBtn: document.getElementById('applyFiltersBtn'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),
  cardsWrap: document.getElementById('cardsWrap'),
  moreBtn: document.getElementById('moreBtn'),
  toastWrap: document.getElementById('toastWrap')
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  els.toastWrap.appendChild(toast)
  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(10px)'
    window.setTimeout(() => toast.remove(), 250)
  }, 2600)
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0]
}

function valorTexto(element) {
  return element.value.trim()
}

function valorNumero(element) {
  const value = element.value.trim()
  if (value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function redondear2(numero) {
  return Math.round((numero + Number.EPSILON) * 100) / 100
}

function recalcularMontos() {
  const neto = valorNumero(els.neto)

  if (neto === null) {
    els.iva.value = ''
    els.total.value = ''
    return
  }

  const iva = redondear2(neto * IVA_RATE)
  const total = redondear2(neto + iva)

  els.iva.value = iva.toFixed(2)
  els.total.value = total.toFixed(2)
}

window.recalcularMontosJunquillar = recalcularMontos

function limpiarRut(rut) {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase()
}

function calcularDvRut(cuerpo) {
  let suma = 0
  let multiplicador = 2

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }

  const resto = 11 - (suma % 11)

  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}

function validarRutChileno(rut) {
  const limpio = limpiarRut(rut)
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  return calcularDvRut(cuerpo) === dv
}

function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return rut || ''
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpoConPuntos}-${dv}`
}

function normalizarRutInput() {
  const valor = valorTexto(els.rut)
  if (!valor) return
  els.rut.value = formatearRut(valor)
}

function cargarFechaInicial() {
  els.fecha.value = fechaHoy()
}

function setScreen(screenName) {
  const screens = ['loginScreen', 'menuScreen', 'formScreen', 'reviewScreen']
  screens.forEach((name) => {
    els[name].classList.toggle('active', name === screenName)
  })
}

function setTopbarVisible(visible) {
  els.topbar.style.display = visible ? 'flex' : 'none'
}

function updateTopbarUser(session) {
  els.topbarUser.textContent = session?.user?.email || ''
}

function obtenerPayloadBase() {
  return {
    fecha: valorTexto(els.fecha) || fechaHoy(),
    proveedor: valorTexto(els.proveedor) || null,
    rut: valorTexto(els.rut) || null,
    tipo_documento: valorTexto(els.tipoDocumento) || null,
    numero_documento: valorTexto(els.numeroDocumento) || null,
    neto: valorNumero(els.neto),
    iva: valorNumero(els.iva),
    total: valorNumero(els.total),
    categoria: valorTexto(els.categoria) || null,
    metodo_pago: valorTexto(els.metodoPago) || null,
    proyecto: 'Junquillar',
    observacion: valorTexto(els.observacion) || null,
    estado_ocr: 'pendiente'
  }
}

function validarFormulario(requiereFoto = false) {
  const proveedor = valorTexto(els.proveedor)
  const rut = valorTexto(els.rut)
  const tipoDocumento = valorTexto(els.tipoDocumento)
  const neto = valorNumero(els.neto)
  const categoria = valorTexto(els.categoria)
  const metodoPago = valorTexto(els.metodoPago)
  const file = els.fileInput.files[0]

  if (!proveedor) {
    showToast('Debes ingresar el proveedor', 'error')
    return false
  }
  if (!rut) {
    showToast('Debes ingresar el RUT del proveedor', 'error')
    return false
  }
  if (!validarRutChileno(rut)) {
    showToast('El RUT ingresado no es válido', 'error')
    return false
  }

  els.rut.value = formatearRut(rut)

  if (!tipoDocumento) {
    showToast('Debes seleccionar el tipo de documento', 'error')
    return false
  }
  if (neto === null || neto <= 0) {
    showToast('Debes ingresar un neto válido', 'error')
    return false
  }
  if (!categoria) {
    showToast('Debes seleccionar la categoría', 'error')
    return false
  }
  if (!metodoPago) {
    showToast('Debes seleccionar el método de pago', 'error')
    return false
  }
  if (requiereFoto && !state.editingId && !file) {
    showToast('Debes elegir una imagen', 'error')
    return false
  }
  return true
}

async function ensureSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    showToast('Error al validar sesión', 'error')
    console.error(error)
    return null
  }
  if (!data.session) {
    showToast('Primero debes iniciar sesión', 'error')
    setTopbarVisible(false)
    setScreen('loginScreen')
    return null
  }
  return data.session
}

function limpiarFormulario() {
  els.proveedor.value = ''
  els.rut.value = ''
  els.tipoDocumento.value = ''
  els.numeroDocumento.value = ''
  els.neto.value = ''
  els.iva.value = ''
  els.total.value = ''
  els.categoria.value = ''
  els.metodoPago.value = ''
  els.observacion.value = ''
  els.fileInput.value = ''
  els.fecha.value = fechaHoy()
  els.fotoActualInfo.textContent = ''
}

function limpiarFiltros() {
  els.filtroProveedor.value = ''
  els.filtroFechaDesde.value = ''
  els.filtroFechaHasta.value = ''
}

function resetModoEdicion() {
  state.editingId = null
  state.editingFotoPath = null
  els.formTitle.textContent = 'Registrar gasto'
  els.formSubtitle.textContent = 'Completa los datos y guarda el comprobante.'
  els.cancelEditBtn.style.display = 'none'
  els.saveWithPhotoBtn.textContent = 'Guardar con foto'
  els.saveNoPhotoBtn.textContent = 'Guardar sin foto'
  limpiarFormulario()
}

function setModoEdicion(registro) {
  state.editingId = registro.id
  state.editingFotoPath = registro.foto_path || null
  els.formTitle.textContent = 'Editar gasto'
  els.formSubtitle.textContent = `Editando ID ${registro.id}`
  els.cancelEditBtn.style.display = 'block'
  els.saveWithPhotoBtn.textContent = 'Actualizar con foto'
  els.saveNoPhotoBtn.textContent = 'Actualizar sin foto'
  els.fecha.value = registro.fecha || fechaHoy()
  els.proveedor.value = registro.proveedor || ''
  els.rut.value = registro.rut || ''
  els.tipoDocumento.value = registro.tipo_documento || ''
  els.numeroDocumento.value = registro.numero_documento || ''
  els.neto.value = registro.neto ?? ''
  els.iva.value = registro.iva ?? ''
  els.total.value = registro.total ?? ''
  els.categoria.value = registro.categoria || ''
  els.metodoPago.value = registro.metodo_pago || ''
  els.observacion.value = registro.observacion || ''
  els.fileInput.value = ''
  els.fotoActualInfo.textContent = state.editingFotoPath ? 'Si subes una foto nueva, reemplaza la actual.' : 'Este registro no tiene foto actual.'
  setScreen('formScreen')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function enriquecerFilasConUrl(filas) {
  return Promise.all(filas.map(async (fila) => {
    if (!fila.foto_path) return { ...fila, foto_url_firmada: null }
    const { data, error } = await supabase.storage.from('comprobantes-junquillar').createSignedUrl(fila.foto_path, 3600)
    if (error || !data?.signedUrl) return { ...fila, foto_url_firmada: null }
    return { ...fila, foto_url_firmada: data.signedUrl }
  }))
}

function renderCards(filas) {
  if (!filas || filas.length === 0) {
    els.cardsWrap.innerHTML = '<div class="empty-view">No hay gastos para mostrar.</div>'
    els.moreBtn.style.display = 'none'
    return
  }

  els.cardsWrap.innerHTML = filas.map((fila) => `
    <article class="gasto-card">
      <div class="gasto-top">
        <div>
          <div class="gasto-title">${fila.proveedor ?? 'Sin proveedor'}</div>
          <div class="gasto-date">${fila.fecha ?? ''}</div>
        </div>
        <div class="gasto-badge">#${fila.id}</div>
      </div>
      <div class="gasto-grid">
        <div class="meta"><span class="meta-label">RUT</span><span class="meta-value">${fila.rut ?? '-'}</span></div>
        <div class="meta"><span class="meta-label">Tipo documento</span><span class="meta-value">${fila.tipo_documento ?? '-'}</span></div>
        <div class="meta"><span class="meta-label">N° documento</span><span class="meta-value">${fila.numero_documento ?? '-'}</span></div>
        <div class="meta"><span class="meta-label">Categoría</span><span class="meta-value">${fila.categoria ?? '-'}</span></div>
        <div class="meta"><span class="meta-label">Método de pago</span><span class="meta-value">${fila.metodo_pago ?? '-'}</span></div>
        <div class="meta"><span class="meta-label">Neto</span><span class="meta-value">${fila.neto ?? '-'}</span></div>
        <div class="meta"><span class="meta-label">IVA</span><span class="meta-value">${fila.iva ?? '-'}</span></div>
        <div class="meta"><span class="meta-label">Total</span><span class="meta-value">${fila.total ?? '-'}</span></div>
      </div>
      <div class="meta"><span class="meta-label">Observación</span><span class="meta-value">${fila.observacion ?? '-'}</span></div>
      <div class="review-actions">
        ${fila.foto_url_firmada ? `<a class="btn btn-soft" href="${fila.foto_url_firmada}" target="_blank" rel="noopener noreferrer">Ver foto</a>` : `<button class="btn btn-secondary" type="button" disabled>Sin foto</button>`}
        <button class="btn btn-soft" type="button" data-action="edit" data-id="${fila.id}">Editar</button>
        <button class="btn btn-danger" type="button" data-action="delete" data-id="${fila.id}">Eliminar</button>
      </div>
    </article>
  `).join('')
}

function construirQueryBase(fetchLimit) {
  let query = supabase.from('gastos_junquillar_app').select('*').order('id', { ascending: false }).limit(fetchLimit)
  const filtroProveedor = valorTexto(els.filtroProveedor)
  const filtroFechaDesde = valorTexto(els.filtroFechaDesde)
  const filtroFechaHasta = valorTexto(els.filtroFechaHasta)
  if (filtroProveedor) query = query.ilike('proveedor', `%${filtroProveedor}%`)
  if (filtroFechaDesde) query = query.gte('fecha', filtroFechaDesde)
  if (filtroFechaHasta) query = query.lte('fecha', filtroFechaHasta)
  return query
}

async function cargarUltimosGastos(reset = false) {
  const session = await ensureSession()
  if (!session) return
  if (reset) state.visibleCount = INITIAL_VISIBLE
  const fetchLimit = state.visibleCount + 1
  const { data, error } = await construirQueryBase(fetchLimit)
  if (error) {
    showToast('Error al cargar gastos', 'error')
    console.error(error)
    return
  }
  const hayMas = data.length > state.visibleCount
  const filasBase = hayMas ? data.slice(0, state.visibleCount) : data
  const filasConUrl = await enriquecerFilasConUrl(filasBase)
  renderCards(filasConUrl)
  els.moreBtn.style.display = hayMas ? 'inline-flex' : 'none'
}

async function guardarRegistro(requiereFoto) {
  const session = await ensureSession()
  if (!session) return
  if (!validarFormulario(requiereFoto)) return

  const payload = obtenerPayloadBase()
  const file = els.fileInput.files[0]
  let nuevoFotoPath = state.editingFotoPath

  if (file) {
    const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, '-')
    const filePath = `junquillar/${safeName}`
    const { error: uploadError } = await supabase.storage.from('comprobantes-junquillar').upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (uploadError) {
      showToast('No se pudo subir la foto', 'error')
      console.error(uploadError)
      return
    }
    nuevoFotoPath = filePath
  }

  payload.foto_path = nuevoFotoPath || null

  if (state.editingId) {
    const fotoAnterior = state.editingFotoPath
    const { error } = await supabase.from('gastos_junquillar_app').update(payload).eq('id', state.editingId)
    if (error) {
      showToast('No se pudo actualizar el gasto', 'error')
      console.error(error)
      return
    }
    if (file && fotoAnterior && fotoAnterior !== nuevoFotoPath) {
      await supabase.storage.from('comprobantes-junquillar').remove([fotoAnterior])
    }
    showToast('Gasto actualizado correctamente', 'success')
  } else {
    const { error } = await supabase.from('gastos_junquillar_app').insert(payload)
    if (error) {
      showToast('No se pudo guardar el gasto', 'error')
      console.error(error)
      return
    }
    showToast('Gasto guardado correctamente', 'success')
  }

  resetModoEdicion()
  setScreen('reviewScreen')
  await cargarUltimosGastos(true)
}

async function editarGasto(id) {
  const session = await ensureSession()
  if (!session) return
  const { data, error } = await supabase.from('gastos_junquillar_app').select('*').eq('id', id).single()
  if (error) {
    showToast('No se pudo leer el gasto', 'error')
    console.error(error)
    return
  }
  setModoEdicion(data)
}

async function eliminarGasto(id) {
  const session = await ensureSession()
  if (!session) return
  const { data: registro, error: readError } = await supabase.from('gastos_junquillar_app').select('id, foto_path, proveedor, total').eq('id', id).single()
  if (readError) {
    showToast('No se pudo leer el gasto', 'error')
    console.error(readError)
    return
  }
  const confirmado = window.confirm(`Eliminar gasto ID ${registro.id}${registro.proveedor ? ' - ' + registro.proveedor : ''}${registro.total ? ' - $' + registro.total : ''}?`)
  if (!confirmado) return
  if (registro.foto_path) {
    await supabase.storage.from('comprobantes-junquillar').remove([registro.foto_path])
  }
  const { error } = await supabase.from('gastos_junquillar_app').delete().eq('id', id)
  if (error) {
    showToast('No se pudo eliminar el gasto', 'error')
    console.error(error)
    return
  }
  if (state.editingId === id) resetModoEdicion()
  showToast('Gasto eliminado correctamente', 'success')
  await cargarUltimosGastos(true)
}

async function handleLogin() {
  const email = valorTexto(els.email)
  const password = valorTexto(els.password)
  if (!email || !password) {
    showToast('Debes ingresar correo y contraseña', 'error')
    return
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    showToast('No se pudo iniciar sesión', 'error')
    console.error(error)
    return
  }
  updateTopbarUser(data.session)
  setTopbarVisible(true)
  setScreen('menuScreen')
  showToast('Sesión iniciada', 'success')
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    showToast('No se pudo cerrar sesión', 'error')
    console.error(error)
    return
  }
  setTopbarVisible(false)
  setScreen('loginScreen')
  resetModoEdicion()
  els.cardsWrap.innerHTML = ''
  els.moreBtn.style.display = 'none'
  showToast('Sesión cerrada', 'info')
}

function bindEvents() {
  els.loginBtn.addEventListener('click', handleLogin)
  els.logoutTopBtn.addEventListener('click', handleLogout)
  els.goFormBtn.addEventListener('click', () => { resetModoEdicion(); setScreen('formScreen') })
  els.goReviewBtn.addEventListener('click', async () => { setScreen('reviewScreen'); await cargarUltimosGastos(true) })
  els.backFromFormBtn.addEventListener('click', () => { resetModoEdicion(); setScreen('menuScreen') })
  els.backFromReviewBtn.addEventListener('click', () => setScreen('menuScreen'))
  els.saveWithPhotoBtn.addEventListener('click', () => guardarRegistro(true))
  els.saveNoPhotoBtn.addEventListener('click', () => guardarRegistro(false))
  els.cancelEditBtn.addEventListener('click', () => { resetModoEdicion(); setScreen('menuScreen') })
  els.applyFiltersBtn.addEventListener('click', () => cargarUltimosGastos(true))
  els.clearFiltersBtn.addEventListener('click', async () => { limpiarFiltros(); await cargarUltimosGastos(true) })
  els.moreBtn.addEventListener('click', async () => { state.visibleCount += MORE_STEP; await cargarUltimosGastos(false) })
  els.rut.addEventListener('blur', normalizarRutInput)
  els.cardsWrap.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]')
    if (!button) return
    const action = button.dataset.action
    const id = Number(button.dataset.id)
    if (!id) return
    if (action === 'edit') await editarGasto(id)
    if (action === 'delete') await eliminarGasto(id)
  })
}

function updateTopbarUser(session) {
  els.topbarUser.textContent = session?.user?.email || ''
}

async function init() {
  bindEvents()
  cargarFechaInicial()
  resetModoEdicion()
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    updateTopbarUser(data.session)
    setTopbarVisible(true)
    setScreen('menuScreen')
  } else {
    setTopbarVisible(false)
    setScreen('loginScreen')
  }
}

init()
