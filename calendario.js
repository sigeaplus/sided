// Calendário global

function abrirCal(id) {
  document.querySelectorAll('.cal-popup').forEach(c => { if (c.id !== id) c.classList.remove('open'); });
  document.getElementById(id).classList.add('open');
  atualizarCalendario(id);
  document.addEventListener('click', function handler(e) {
    if (!e.target.closest('.date-picker-wrap')) { document.getElementById(id).classList.remove('open'); document.removeEventListener('click', handler); }
  });
}

async function atualizarCalendario(id) {
  if (!calState[id]) calState[id] = { ano: new Date().getFullYear(), mes: new Date().getMonth() };
  const labelEl = document.getElementById(`${id}-label`);
  const gridEl  = document.getElementById(`${id}-grid`);
  if (!labelEl || !gridEl) return; // calendário não está visível, sai silenciosamente
  const { ano, mes } = calState[id];
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  labelEl.textContent = `${meses[mes]} ${ano}`;
  const primeiro = new Date(ano, mes, 1).getDay();
  const dias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date().toISOString().split('T')[0];
  if ((id === 'cal-aula' || id === 'cal-chamada') && feriadosCache.length === 0) {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const escolaId = profData.escolas?.id || profData.escola_id;
    if (escolaId) {
      feriadosCache = await api(`calendario_escolar?escola_id=eq.${escolaId}&select=*`) || [];
    }
  }
  const aulasMap = {};
  if (aulasTurma) aulasTurma.forEach(a => { aulasMap[dataAulaOnly(a.data)] = a.status; });
  let html = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => `<div class="cal-day-label">${d}</div>`).join('');
  for (let i = 0; i < primeiro; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= dias; d++) {
    const dateStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const status = aulasMap[dateStr];
    const isFeriado = feriadosCache.some(ev => ev.tipo.startsWith('feriado') && isDateInRange(dateStr, ev.data, ev.data_fim));
    const cls = [
      dateStr === hoje ? 'today' : '',
      status ? `has-aula-${status}` : '',
      isFeriado ? 'feriado' : ''
    ].filter(Boolean).join(' ');
    html += `<div class="cal-day ${cls}" onclick="selecionarData('${id}','${dateStr}')">${d}</div>`;
  }
  gridEl.innerHTML = html;
}

function selecionarData(id, dateStr) {
  const [ano, mes, dia] = dateStr.split('-');
  if (id === 'cal-aula') {
    document.getElementById('aula-data').value = `${dia}/${mes}/${ano}`;
    if (typeof _atualizarInfoStatusModal === 'function') _atualizarInfoStatusModal();
  } else if (id === 'cal-chamada') {
    document.getElementById('chamada-date-input').value = `${dia}/${mes}/${ano}`;
    carregarChamadaPorData(dateStr);
  }
  document.querySelectorAll(`#${id}-grid .cal-day`).forEach(d => d.classList.remove('selected'));
  event.target.classList.add('selected');
  document.getElementById(id).classList.remove('open');
}

async function mesAnterior(id) { const s = calState[id]; s.mes--; if (s.mes < 0) { s.mes = 11; s.ano--; } await atualizarCalendario(id); }
async function proximoMes(id) { const s = calState[id]; s.mes++; if (s.mes > 11) { s.mes = 0; s.ano++; } await atualizarCalendario(id); }
async function onDateInput(inp, calId) { const m = inp.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) { calState[calId] = { ano: parseInt(m[3]), mes: parseInt(m[2]) - 1 }; await atualizarCalendario(calId); } }
async function onChamadaDateInput(inp, calId) {
  const m = inp.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    calState[calId] = { ano: parseInt(m[3]), mes: parseInt(m[2]) - 1 };
    await atualizarCalendario(calId);
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    carregarChamadaPorData(iso);
  }
}

function isDateInRange(dateStr, start, end) {
  const d = new Date(dateStr + 'T12:00:00');
  const s = new Date(start + 'T12:00:00');
  const e = new Date((end || start) + 'T12:00:00');
  return d >= s && d <= e;
}
