const socket = io();
const $ = (id) => document.getElementById(id);
let latestState = null;
let participantUrl = '';

const phaseNames = {
  intro: 'PANTALLA INICIAL', question: 'SITUACIÓN Y DECISIÓN', voting: 'VOTACIÓN ABIERTA',
  results: 'RESULTADOS DEL GRUPO', explanation: 'EXPLICACIÓN Y CONCEPTO', finished: 'CIERRE DE LA ACTIVIDAD'
};

$('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  $('login-error').textContent = 'Verificando…';
  socket.emit('presenter:login', $('pin-input').value);
});
socket.on('presenter:auth', (result) => {
  if (!result.ok) {
    $('login-error').textContent = result.message || 'No se pudo iniciar sesión.';
    return;
  }
  $('login-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  loadQr();
});
socket.on('connect', () => {
  $('connection-label').textContent = 'Conectado';
  $('connection-label').classList.add('connected');
});
socket.on('disconnect', () => {
  $('connection-label').textContent = 'Sin conexión';
  $('connection-label').classList.remove('connected');
});
socket.on('notice', (notice) => {
  if (notice && notice.message) $('control-hint').textContent = notice.message;
});
socket.on('classroom:update', (state) => {
  latestState = state;
  render(state);
});

function loadQr() {
  fetch('/api/config').then(r => r.json()).then(config => {
    participantUrl = config.participantUrl;
    $('room-label').textContent = config.roomCode;
    $('qr-room').textContent = config.roomCode;
    $('participant-link').href = participantUrl;
    $('participant-link').textContent = participantUrl;
  }).catch(() => { $('qr-warning').textContent = 'No se pudo cargar la dirección de acceso.'; });
  fetch('/api/qr').then(r => r.json()).then(data => {
    if (data.dataUrl) $('qr-image').src = data.dataUrl;
    if (data.url) {
      participantUrl = data.url;
      $('participant-link').href = data.url;
      $('participant-link').textContent = data.url;
    }
  }).catch(() => { $('qr-warning').textContent = 'No se pudo generar el QR. Comparte el enlace que aparece aquí.'; });
}
$('copy-link').addEventListener('click', async () => {
  if (!participantUrl) return;
  try {
    await navigator.clipboard.writeText(participantUrl);
    $('copy-link').textContent = '¡Copiado!';
    setTimeout(() => $('copy-link').textContent = 'Copiar enlace', 1500);
  } catch (_error) {
    $('qr-warning').textContent = 'Selecciona y copia el enlace manualmente.';
  }
});

$('start-btn').addEventListener('click', () => socket.emit('control:start'));
$('open-btn').addEventListener('click', () => socket.emit('control:open-vote'));
$('close-btn').addEventListener('click', () => socket.emit('control:close-vote'));
$('explain-btn').addEventListener('click', () => socket.emit('control:show-explanation'));
$('next-btn').addEventListener('click', () => socket.emit('control:next'));
$('restart-btn').addEventListener('click', () => {
  if (confirm('¿Reiniciar toda la actividad y borrar los votos de las seis rondas?')) socket.emit('control:restart');
});

function render(state) {
  $('phase-label').textContent = phaseNames[state.phase] || 'ACTIVIDAD';
  $('round-label').textContent = state.round ? `Ronda ${state.currentIndex + 1} de ${state.totalRounds}` : 'Cierre';
  $('online-count').textContent = state.onlineParticipants ?? 0;
  $('vote-total').textContent = state.totalVotes ?? 0;
  $('room-label').textContent = state.roomCode;
  updateControls(state);
  renderStage(state);
  renderMonitor(state);
  renderSpeakerNotes(state);
}

function updateControls(state) {
  $('start-btn').disabled = state.phase !== 'intro';
  $('open-btn').disabled = state.phase !== 'question';
  $('close-btn').disabled = state.phase !== 'voting';
  $('explain-btn').disabled = state.phase !== 'results';
  $('next-btn').disabled = state.phase !== 'explanation';
  $('next-btn').textContent = state.currentIndex === state.totalRounds - 1 ? 'Terminar y ver cierre →' : 'Siguiente ronda →';
  const hints = {
    intro: 'Inicia la presentación. El público verá una pantalla de espera.',
    question: 'Presenta el caso y las tres opciones. Abre la votación cuando la clase esté lista.',
    voting: 'La votación está abierta. Observa cómo cambian los resultados en tiempo real y ciérrala cuando quieras.',
    results: 'Los resultados ya son visibles. Comenta la distribución y muestra después la explicación.',
    explanation: 'Explica el concepto y la relación con las lecturas. Avanza cuando termine la intervención.',
    finished: 'La actividad terminó. Puedes reiniciarla para otra clase.'
  };
  $('control-hint').textContent = hints[state.phase] || '';
}

function progressMarkup(index) {
  return `<div class="slide-progress">${Array.from({length:6}, (_, i) => `<span class="${i <= index ? 'active' : ''}"></span>`).join('')}</div>`;
}
function renderStage(state) {
  const round = state.round;
  if (state.phase === 'intro') {
    $('stage').innerHTML = `<div class="stage-kicker">DINÁMICA DE CLASE</div><h1>¿Pobreza o falta de libertad?</h1><h2>El desafío de construir una sociedad con capacidades</h2><p>Seis situaciones. Tres decisiones posibles. Una pregunta de fondo: ¿qué significa realmente superar la pobreza?</p><div class="stage-rule">Cuando el equipo esté listo, pulsa <b>Iniciar presentación</b>. Después abre cada votación.</div><div class="concept-label">Ruta de la clase</div><p class="tiny">Ingresos y capacidades → factores de conversión → salud y educación → desempleo → género y justicia → territorio y paz.</p>`;
    $('speaker-label').textContent = 'Equipo expositor'; $('slide-counter').textContent = 'Inicio';
    return;
  }
  if (state.phase === 'finished') {
    $('stage').innerHTML = `<div class="stage-kicker">SÍNTESIS FINAL</div><h1>La pobreza limita libertades reales.</h1><h2>¿Qué debemos mirar para comprenderla y enfrentarla?</h2><div class="explanation-block"><p><b>1. Recursos:</b> ¿con qué ingresos y bienes cuentan las personas?</p></div><div class="explanation-block"><p><b>2. Conversión:</b> ¿qué condiciones personales, sociales e institucionales permiten transformar esos recursos en oportunidades?</p></div><div class="explanation-block"><p><b>3. Justicia y voz:</b> ¿quién recibe, quién decide, quién es reconocido y quién participa?</p></div><p class="takeaway">Desarrollar es ampliar las libertades reales de las personas para vivir la vida que valoran.</p><div class="discussion-prompt"><b>Pregunta de cierre:</b> Después de las seis rondas, ¿qué decisión cambiarían en la forma de diseñar una política contra la pobreza?</div><div class="concept-label">Lecturas utilizadas</div><div class="teaching-box"><p><b>Amartya Sen.</b> <i>Desarrollo y libertad</i>, capítulo 4: “Poverty as Capability Deprivation” (la pobreza como privación de capacidades).</p><p><b>Becerril Velasco.</b> “El papel del Estado en el alivio a la pobreza en la era neoliberal. Una aproximación teórica”.</p><p><b>Nancy Fraser.</b> “De la distribución al reconocimiento” y “La justicia social en la era de la política de identidad: redistribución, reconocimiento y participación”.</p><p><b>Brookings.</b> <i>Peace with Justice: The Colombian Experience with Transitional Justice</i>, sobre justicia transicional y compromisos del Acuerdo Final colombiano.</p><p class="tiny muted">Completen los datos editoriales (año, revista, páginas o URL) con la portada y los datos bibliográficos de los PDF entregados por el curso.</p></div>`;
    $('speaker-label').textContent = 'Cierre colectivo'; $('slide-counter').textContent = 'Conclusión';
    return;
  }
  if (!round) return;
  $('speaker-label').textContent = `${round.speaker} · ${round.time}`;
  $('slide-counter').textContent = `Diapositiva ${state.currentIndex + 1} / 6`;
  const options = round.options.map(o => `<div class="option-card"><span class="option-letter">${o.id}</span><div><strong>${o.label}</strong></div></div>`).join('');
  if (state.phase === 'question' || state.phase === 'voting') {
    $('stage').innerHTML = `<div class="stage-kicker">RONDA ${round.id} · ${round.speaker.toUpperCase()}</div><div class="scenario-label">El caso</div><p class="scenario-text">${round.scenario}</p><h2 class="question-heading">${round.question}</h2><div class="option-grid">${options}</div><div class="stage-rule">${state.phase === 'voting' ? '<b>VOTACIÓN ABIERTA:</b> el público puede elegir o cambiar su respuesta desde el celular.' : 'Lee el escenario y las opciones. La votación todavía no está abierta.'}</div>${progressMarkup(state.currentIndex)}`;
  } else if (state.phase === 'results') {
    const counts = state.counts || {A:0,B:0,C:0};
    const total = state.totalVotes || 0;
    const resultCards = round.options.map(o => {
      const count = counts[o.id] || 0; const pct = total ? Math.round(count / total * 100) : 0;
      return `<div class="result-item"><div class="result-top"><strong><span class="option-letter" style="display:inline-grid;width:25px;height:25px;margin-right:7px;vertical-align:middle">${o.id}</span>${o.label}</strong><span class="result-count"><b class="result-percent">${pct}%</b> · ${count} votos</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="result-consequence">${o.consequence}</div></div>`;
    }).join('');
    $('stage').innerHTML = `<div class="stage-kicker">RONDA ${round.id} · RESULTADOS DEL GRUPO</div><h1 class="question-heading">${round.title}</h1><p>Así respondió la clase. Lean las tres consecuencias: no se trata solo de identificar una opción ganadora, sino de discutir qué dimensiones de la pobreza atiende cada decisión.</p><div class="result-grid">${resultCards}</div><div class="stage-rule"><b>${total} votos registrados.</b> Ahora pulsa “Mostrar explicación” para conectar las decisiones con Sen y las lecturas complementarias.</div>${progressMarkup(state.currentIndex)}`;
  } else if (state.phase === 'explanation') {
    $('stage').innerHTML = `<div class="stage-kicker">RONDA ${round.id} · CONCEPTO CLAVE</div><h1 class="question-heading">${round.insightTitle}</h1><div class="explanation-block"><p>${round.explanation}</p></div><div class="concept-label">Para explicar en clase</div><div class="teaching-box"><strong>Idea para desarrollar</strong><p>${round.teaching}</p></div><div class="teaching-box"><strong>Conexión con otra lectura</strong><p>${round.connection}</p></div><p class="takeaway">${round.takeaway}</p><div class="discussion-prompt"><b>Pregunta al grupo:</b> ${round.discussion}</div>${progressMarkup(state.currentIndex)}`;
  }
}
function renderMonitor(state) {
  const round = state.round;
  if (!round) {
    $('live-bars').innerHTML = '<p class="muted tiny">La actividad terminó.</p>';
    return;
  }
  if (!['voting','results','explanation'].includes(state.phase)) {
    $('live-bars').innerHTML = '<p class="muted tiny">Las barras aparecerán cuando se abra la votación.</p>';
    return;
  }
  const counts = state.counts || {A:0,B:0,C:0};
  const total = state.totalVotes || 0;
  $('live-bars').innerHTML = round.options.map(o => {
    const n = counts[o.id] || 0; const pct = total ? Math.round(n / total * 100) : 0;
    return `<div class="live-row"><b>${o.id}</b><div class="live-track"><span style="width:${pct}%"></span></div><span>${n} · ${pct}%</span></div>`;
  }).join('');
}
function renderSpeakerNotes(state) {
  const round = state.round;
  if (!round) {
    $('speaker-notes').innerHTML = '<strong>Cierre colectivo.</strong><br>Retomen la idea central: el desarrollo consiste en ampliar las libertades reales y no solo aumentar el ingreso.';
    $('time-chip').textContent = '3 minutos · reflexión final';
    return;
  }
  $('speaker-notes').innerHTML = `<strong>${round.speaker}:</strong> ${round.teaching}<br><br><strong>Conexión:</strong> ${round.connection}`;
  $('time-chip').textContent = `${round.time} · ${round.speaker}`;
}
