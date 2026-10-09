// ======================================================
// CONFIGURACIÓN: completar con los datos de tu canal de ThingSpeak
// ======================================================
const CONFIG = {
  channelId: "3523746",   // Channel ID de tu canal de ThingSpeak
  readApiKey: "",                     // <-- Read API Key, solo si el canal NO es público
  pollIntervalMs: 15000                // cada cuánto consulta (15 s)
};
// ======================================================

const puntoEstado = document.getElementById('puntoEstado');
const textoEstado = document.getElementById('textoEstado');
const mmAcumulado = document.getElementById('mmAcumulado');
const ultimaActualizacion = document.getElementById('ultimaActualizacion');
const listaRegistro = document.getElementById('listaRegistro');
const canvasGrafica = document.getElementById('grafica');

function setEstado(estado, texto) {
  // estado: 'espera' | 'ok' | 'error'
  puntoEstado.className = 'punto punto--' + estado;
  textoEstado.textContent = texto;
}

async function cargarDatos() {
  if (!CONFIG.channelId) {
    setEstado('error', 'Falta configurar el Channel ID en app.js');
    return;
  }
  try {
    const keyParam = CONFIG.readApiKey ? `&api_key=${encodeURIComponent(CONFIG.readApiKey)}` : '';
    const resp = await fetch(`https://api.thingspeak.com/channels/${CONFIG.channelId}/feeds.json?results=20${keyParam}`);
    if (!resp.ok) throw new Error('Respuesta no válida');
    const data = await resp.json();
    const feeds = (data.feeds || []).filter(f => f.field1 !== null && f.field1 !== "");

    if (feeds.length === 0) {
      setEstado('espera', 'Conectado — esperando la primera lectura');
      return;
    }

    setEstado('ok', 'Conectado');
    actualizarAcumulado(feeds);
    actualizarGraficaYRegistro(feeds);
  } catch (err) {
    setEstado('error', 'Sin conexión — revisá el Channel ID / API Key');
  }
}

function actualizarAcumulado(feeds) {
  const ultimo = feeds[feeds.length - 1];
  mmAcumulado.textContent = parseFloat(ultimo.field1).toFixed(1);
  const hora = new Date(ultimo.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  ultimaActualizacion.textContent = `Última lectura: ${hora}`;
}

function actualizarGraficaYRegistro(feeds) {
  // delta entre lecturas consecutivas = mm caídos en ese tramo
  const tramos = [];
  for (let i = 1; i < feeds.length; i++) {
    const anterior = parseFloat(feeds[i - 1].field1);
    const actual = parseFloat(feeds[i].field1);
    const delta = Math.max(0, actual - anterior); // evita negativos si el contador se reinició
    tramos.push({ hora: feeds[i].created_at, delta, acumulado: actual });
  }

  dibujarGrafica(tramos.slice(-10));
  dibujarRegistro(tramos.slice(-15).reverse());
}

function dibujarGrafica(tramos) {
  const ctx = canvasGrafica.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvasGrafica.clientWidth, h = 160;
  canvasGrafica.width = w * dpr;
  canvasGrafica.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (tramos.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('El gráfico aparece con la segunda lectura del sensor.', 10, h / 2);
    return;
  }

  const maxVal = Math.max(...tramos.map(t => t.delta), 0.1);
  const baseY = h - 26;
  const barW = Math.min(40, (w - 40) / tramos.length - 8);

  tramos.forEach((t, i) => {
    const x = 20 + i * ((w - 40) / tramos.length);
    const barH = (t.delta / maxVal) * (h - 50);
    ctx.fillStyle = '#3E7C8C';
    ctx.fillRect(x, baseY - barH, barW, barH);
    ctx.fillStyle = '#1E2430';
    ctx.font = '11px monospace';
    ctx.fillText(t.delta.toFixed(1), x, baseY - barH - 5);
    ctx.fillStyle = '#777';
    ctx.font = '10px monospace';
    ctx.fillText(new Date(t.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), x, baseY + 16);
  });
}

function dibujarRegistro(tramos) {
  listaRegistro.innerHTML = '';
  if (tramos.length === 0) {
    listaRegistro.innerHTML = '<li class="registro__vacio">Todavía no hay lecturas registradas</li>';
    return;
  }
  tramos.forEach(t => {
    const li = document.createElement('li');
    li.className = 'registro__item';
    const hora = new Date(t.hora).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    li.textContent = `${hora} — ${t.delta.toFixed(1)} mm (acumulado: ${t.acumulado.toFixed(1)} mm)`;
    listaRegistro.appendChild(li);
  });
}

cargarDatos();
setInterval(cargarDatos, CONFIG.pollIntervalMs);
