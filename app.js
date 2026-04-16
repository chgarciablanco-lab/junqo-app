import { supabase } from './supabaseClient.js'

const IVA_RATE = 0.19
const INITIAL_VISIBLE = 3
const MORE_STEP = 5

let visibleCount = INITIAL_VISIBLE
let editingId = null
let editingFotoPath = null

const authView = document.getElementById('authView')
const appView = document.getElementById('appView')
const userChip = document.getElementById('userChip')
const cardsWrap = document.getElementById('cardsWrap')
const moreBtn = document.getElementById('moreBtn')
const formTitle = document.getElementById('formTitle')
const modoForm = document.getElementById('modoForm')
const cancelEditBtn = document.getElementById('cancelEditBtn')
const fotoActualInfo = document.getElementById('fotoActualInfo')

function log(msg) { console.log(msg) }
function fechaHoy() { return new Date().toISOString().split('T')[0] }
function valorTexto(id) { return document.getElementById(id).value.trim() }
function valorNumero(id) {
  const v = document.getElementById(id).value.trim()
  if (v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}
function redondear2(n) { return Math.round((n + Number.EPSILON) * 100) / 100 }

function recalcularMontos() {
  const neto = valorNumero('neto')
  if (neto === null) {
    document.getElementById('iva').value = ''
    document.getElementById('total').value = ''
    return
  }
  const iva = redondear2(neto * IVA_RATE)
  const total = redondear2(neto + iva)
  document.getElementById('iva').value = iva.toFixed(2)
  document.getElementById('total').value = total.toFixed(2)
}
window.recalcularMontosJunquillar = recalcularMontos

function limpiarRut(rut) { return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase() }
function calcularDvRut(cuerpo) {
  let suma = 0
  let multiplicador = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
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
  return calcularDvRut(limpio.slice(0, -1)) === limpio.slice(-1)
}
function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return rut || ''
  const cuerpoConPuntos = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpoConPuntos}-${limpio.slice(-1)}`
}
function normalizarRutInput() {
  const input = document.getElementById('rut')
  if (!input.value.trim()) return
  input.value = formatearRut(input.value)
}

function setSection(sectionId) {
  document.querySelectorAll('.section-panel').forEach(panel => panel.classList.toggle('active', panel.id === sectionId))
}

function cargarFechaInicial() { document.getElementById('fecha').value = fechaHoy() }

function obtenerPayloadBase() {
  return {
    fecha: valorTexto('fecha') || fechaHoy(),
    proveedor: valorTexto('proveedor') || null,
    rut: valorTexto('rut') || null,
    tipo_documento: valorTexto('tipo_documento') || null,
    numero_documento: valorTexto('numero_documento') || null,
    neto: valorNumero('neto'),
    iva: valorNumero('iva'),
    total: valorNumero('total'),
    categoria: valorTexto('categoria') || null,
    metodo_pago: valorTexto('metodo_pago') || null,
    proyecto: 'Junquillar',
    observacion: valorTexto('observacion') || null,
    estado_ocr: 'pendiente'
  }
}

function validarFormulario(requiereFoto = false) {
  const proveedor = valorTexto('proveedor')
  const rut = valorTexto('rut')
  const tipoDocumento = valorTexto('tipo_documento')
  const neto = valorNumero('neto')
  const categoria = valorTexto('categoria')
  const metodoPago = valorTexto('metodo_pago')
  const file = document.getElementById('fileInput').files[0]

  if (!proveedor) return alert('Debes ingresar el proveedor'), false
  if (!rut) return alert('Debes ingresar el RUT del proveedor'), false
  if (!validarRutChileno(rut)) return alert('El RUT ingresado no es válido'), false
  document.getElementById('rut').value = formatearRut(rut)
  if (!tipoDocumento) return alert('Debes seleccionar el tipo de documento'), false
  if (neto === null || neto <= 0) return alert('Debes ingresar un neto válido'), false
  if (!categoria) return alert('Debes seleccionar la categoría'), false
  if (!metodoPago) return alert('Debes seleccionar el método de pago'), false
  if (requiereFoto && !editingId && !file) return alert('Debes elegir una imagen'), false
  return true
}

async function ensureSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  if (!data.session) {
    alert('Primero debes iniciar sesión')
    return null
  }
  return data.session
}

function limpiarFormulario() {
  ;['proveedor','rut','numero_documento','neto','iva','total','observacion'].forEach(id => document.getElementById(id).value = '')
  ;['tipo_documento','categoria','metodo_pago'].forEach(id => document.getElementById(id).value = '')
  document.getElementById('fileInput').value = ''
  document.getElementById('fecha').value = fechaHoy()
  fotoActualInfo.textContent = ''
}
function limpiarFiltros() {
  ;['filtroProveedor','filtroFechaDesde','filtroFechaHasta'].forEach(id => document.getElementById(id).value = '')
}

function resetModoEdicion() {
  editingId = null
  editingFotoPath = null
  formTitle.textContent = 'Registrar gasto'
  modoForm.textContent = ''
  cancelEditBtn.classList.add('hidden')
  document.getElementById('uploadBtn').textContent = 'Guardar con foto'
  document.getElementById('testDbBtn').textContent = 'Guardar sin foto'
  limpiarFormulario()
}

function setModoEdicion(registro) {
  editingId = registro.id
  editingFotoPath = registro.foto_path || null
  formTitle.textContent = 'Editar gasto'
  modoForm.textContent = `Editando ID ${registro.id}`
  cancelEditBtn.classList.remove('hidden')
  document.getElementById('uploadBtn').textContent = 'Actualizar con foto'
  document.getElementById('testDbBtn').textContent = 'Actualizar sin foto'
  document.getElementById('fecha').value = registro.fecha || fechaHoy()
  document.getElementById('proveedor').value = registro.proveedor || ''
  document.getElementById('rut').value = registro.rut || ''
  document.getElementById('tipo_documento').value = registro.tipo_documento || ''
  document.getElementById('numero_documento').value = registro.numero_documento || ''
  document.getElementById('neto').value = registro.neto ?? ''
  document.getElementById('iva').value = registro.iva ?? ''
  document.getElementById('total').value = registro.total ?? ''
  document.getElementById('categoria').value = registro.categoria || ''
  document.getElementById('metodo_pago').value = registro.metodo_pago || ''
  document.getElementById('observacion').value = registro.observacion || ''
  document.getElementById('fileInput').value = ''
  fotoActualInfo.textContent = editingFotoPath ? 'Si subes una foto nueva, reemplaza la actual.' : 'Este registro no tiene foto actual.'
  setSection('registerSection')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function enriquecerFilasConUrl(filas) {
  return Promise.all(filas.map(async f => {
    if (!f.foto_path) return { ...f, foto_url_firmada: null }
    const { data, error } = await supabase.storage.from('comprobantes-junquillar').createSignedUrl(f.foto_path, 3600)
    return { ...f, foto_url_firmada: error || !data?.signedUrl ? null : data.signedUrl }
  }))
}

function renderCards(filas) {
  if (!filas || filas.length === 0) {
    cardsWrap.innerHTML = '<div class="empty-card">No hay gastos aún.</div>'
    moreBtn.classList.add('hidden')
    return
  }

  cardsWrap.innerHTML = filas.map(f => `
    <article class="expense-card">
      <div class="expense-top">
        <div>
          <div class="expense-provider">${f.proveedor ?? 'Sin proveedor'}</div>
          <div class="expense-date">${f.fecha ?? ''}</div>
        </div>
        <span class="pill">${f.tipo_documento ?? 'Documento'}</span>
      </div>

      <div class="expense-badges">
        ${f.categoria ? `<span class="pill">${f.categoria}</span>` : ''}
        ${f.metodo_pago ? `<span class="pill">${f.metodo_pago}</span>` : ''}
        ${f.numero_documento ? `<span class="pill">N° ${f.numero_documento}</span>` : ''}
      </div>

      <div class="expense-meta">
        <div class="meta-box"><span>RUT</span><strong>${f.rut ?? '-'}</strong></div>
        <div class="meta-box"><span>Neto</span><strong>${f.neto ?? '-'}</strong></div>
        <div class="meta-box"><span>IVA</span><strong>${f.iva ?? '-'}</strong></div>
        <div class="meta-box"><span>Total</span><strong>${f.total ?? '-'}</strong></div>
      </div>

      <div class="expense-note">${f.observacion ?? ''}</div>

      <div class="expense-actions">
        ${f.foto_url_firmada ? `<a class="btn btn-soft" href="${f.foto_url_firmada}" target="_blank" rel="noopener noreferrer">Ver foto</a>` : ''}
        <button type="button" class="btn btn-soft" onclick="window.editarGasto(${f.id})">Editar</button>
        <button type="button" class="btn btn-danger" onclick="window.eliminarGasto(${f.id})">Eliminar</button>
      </div>
    </article>
  `).join('')
}

function construirQueryBase(fetchLimit) {
  let query = supabase.from('gastos_junquillar_app').select('*').order('id', { ascending: false }).limit(fetchLimit)
  const filtroProveedor = valorTexto('filtroProveedor')
  const filtroFechaDesde = valorTexto('filtroFechaDesde')
  const filtroFechaHasta = valorTexto('filtroFechaHasta')
  if (filtroProveedor) query = query.ilike('proveedor', `%${filtroProveedor}%`)
  if (filtroFechaDesde) query = query.gte('fecha', filtroFechaDesde)
  if (filtroFechaHasta) query = query.lte('fecha', filtroFechaHasta)
  return query
}

async function cargarUltimosGastos(reset = false) {
  const session = await ensureSession()
  if (!session) return
  if (reset) visibleCount = INITIAL_VISIBLE

  const { data, error } = await construirQueryBase(visibleCount + 1)
  if (error) return

  const hayMas = data.length > visibleCount
  const filasConUrl = await enriquecerFilasConUrl(hayMas ? data.slice(0, visibleCount) : data)
  renderCards(filasConUrl)
  moreBtn.classList.toggle('hidden', !hayMas)
}

async function guardarRegistro(requiereFoto) {
  const session = await ensureSession()
  if (!session || !validarFormulario(requiereFoto)) return

  const payload = obtenerPayloadBase()
  const file = document.getElementById('fileInput').files[0]
  let nuevoFotoPath = editingFotoPath

  if (file) {
    const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, '-')
    const filePath = `junquillar/${safeName}`
    const { error: uploadError } = await supabase.storage.from('comprobantes-junquillar').upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (uploadError) return alert('No se pudo subir la foto')
    nuevoFotoPath = filePath
  }

  payload.foto_path = nuevoFotoPath || null

  if (editingId) {
    const fotoAnterior = editingFotoPath
    const { error } = await supabase.from('gastos_junquillar_app').update(payload).eq('id', editingId)
    if (error) return alert('No se pudo actualizar el gasto')
    if (file && fotoAnterior && fotoAnterior !== nuevoFotoPath) {
      await supabase.storage.from('comprobantes-junquillar').remove([fotoAnterior])
    }
    alert('Gasto actualizado correctamente')
  } else {
    const { error } = await supabase.from('gastos_junquillar_app').insert(payload)
    if (error) return alert('No se pudo guardar el gasto')
    alert('Gasto guardado correctamente')
  }

  resetModoEdicion()
  setSection('listSection')
  await cargarUltimosGastos(true)
}

async function editarGasto(id) {
  const session = await ensureSession()
  if (!session) return
  const { data, error } = await supabase.from('gastos_junquillar_app').select('*').eq('id', id).single()
  if (error) return alert('No se pudo cargar el gasto')
  setModoEdicion(data)
}

async function eliminarGasto(id) {
  const session = await ensureSession()
  if (!session) return
  const { data: registro, error: readError } = await supabase.from('gastos_junquillar_app').select('id, foto_path, proveedor, total').eq('id', id).single()
  if (readError) return alert('No se pudo leer el gasto')

  const confirmado = confirm(`Eliminar gasto ID ${registro.id}${registro.proveedor ? ' - ' + registro.proveedor : ''}${registro.total ? ' - $' + registro.total : ''}?`)
  if (!confirmado) return

  if (registro.foto_path) {
    await supabase.storage.from('comprobantes-junquillar').remove([registro.foto_path])
  }
  const { error } = await supabase.from('gastos_junquillar_app').delete().eq('id', id)
  if (error) return alert('No se pudo eliminar el gasto')
  if (editingId === id) resetModoEdicion()
  await cargarUltimosGastos(true)
}

window.editarGasto = editarGasto
window.eliminarGasto = eliminarGasto

function setLoggedOutView() {
  authView.classList.remove('hidden')
  appView.classList.add('hidden')
}

function setLoggedInView(session) {
  authView.classList.add('hidden')
  appView.classList.remove('hidden')
  userChip.textContent = session.user?.email || 'Sesión activa'
  setSection('menuSection')
  if (!document.getElementById('fecha').value) cargarFechaInicial()
}

async function tryLoadExistingSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) setLoggedInView(data.session)
  else setLoggedOutView()
}

document.getElementById('goToRegisterBtn').addEventListener('click', () => setSection('registerSection'))
document.getElementById('backToMenuFromRegisterBtn').addEventListener('click', () => { resetModoEdicion(); setSection('menuSection') })
document.getElementById('goToListBtn').addEventListener('click', async () => { setSection('listSection'); await cargarUltimosGastos(true) })
document.getElementById('backToMenuFromListBtn').addEventListener('click', () => setSection('menuSection'))

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = valorTexto('email')
  const password = valorTexto('password')
  if (!email || !password) return alert('Debes ingresar correo y contraseña')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return alert('No se pudo iniciar sesión')
  setLoggedInView(data.session)
})

document.getElementById('logoutBtn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut()
  if (error) return alert('No se pudo cerrar sesión')
  setLoggedOutView()
  resetModoEdicion()
})

document.getElementById('uploadBtn').addEventListener('click', async () => guardarRegistro(true))
document.getElementById('testDbBtn').addEventListener('click', async () => guardarRegistro(false))
document.getElementById('cancelEditBtn').addEventListener('click', () => resetModoEdicion())
document.getElementById('loadBtn').addEventListener('click', async () => cargarUltimosGastos(true))
document.getElementById('applyFiltersBtn').addEventListener('click', async () => { setSection('listSection'); await cargarUltimosGastos(true) })
document.getElementById('clearFiltersBtn').addEventListener('click', async () => { limpiarFiltros(); await cargarUltimosGastos(true) })
document.getElementById('moreBtn').addEventListener('click', async () => { visibleCount += MORE_STEP; await cargarUltimosGastos(false) })
document.getElementById('rut').addEventListener('blur', normalizarRutInput)

cargarFechaInicial()
tryLoadExistingSession()
