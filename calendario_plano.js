function _calStoragePath() {
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaId = profData.escola_id || profData.escolas?.id || profData.id || 'escola';
  const ano = new Date().getFullYear();
  return `calendarios/${escolaId}_${ano}`;
}

async function _storageUpload(bucket, path, file) {
  // Tenta upsert (sobrescreve se já existe)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true'
    },
    body: file
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload falhou: ${res.status}`);
  }
  return true;
}

function _storagePublicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function iniciarCalendario() {
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaNome = profData.escolas?.nome || '—';
  const ano = new Date().getFullYear();
  document.getElementById('cal-escola-label').textContent = `${escolaNome} · ${ano}`;

  document.getElementById('cal-empty').style.display = 'none';
  document.getElementById('cal-viewer').style.display = 'none';
  document.getElementById('cal-btn-trocar').style.display = 'none';

  const path = _calStoragePath();
  mostrarToast('Verificando calendário...');
  const url = _storagePublicUrl('documentos', path);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      _calExibirUrl(url, ct.includes('pdf'));
    } else {
      document.getElementById('cal-empty').style.display = 'flex';
    }
  } catch {
    document.getElementById('cal-empty').style.display = 'flex';
  }
}

function _calExibirUrl(url, isPdf = false) {
  document.getElementById('cal-empty').style.display = 'none';
  document.getElementById('cal-viewer').style.display = 'block';
  document.getElementById('cal-btn-trocar').style.display = 'flex';
  const iframe = document.getElementById('cal-iframe');
  const img    = document.getElementById('cal-img');
  const linkMob = document.getElementById('cal-link-mob');
  const linkMobA = document.getElementById('cal-link-mob-a');
  const urlNocache = url + '?t=' + Date.now();
  const isMobile = window.innerWidth <= 768;
  if (isPdf) {
    if (isMobile) {
      // iOS/Android não exibem PDF em iframe — mostra link para abrir
      iframe.style.display = 'none'; img.style.display = 'none';
      if (linkMob) { linkMob.style.display = 'block'; linkMobA.href = urlNocache; }
    } else {
      if (linkMob) linkMob.style.display = 'none';
      iframe.style.display = 'block'; img.style.display = 'none';
      iframe.src = urlNocache;
    }
  } else {
    if (linkMob) linkMob.style.display = 'none';
    img.style.display = 'block'; iframe.style.display = 'none';
    img.src = urlNocache;
  }
}

async function calHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { mostrarToast('Arquivo muito grande. Máx. 10 MB.'); return; }
  mostrarToast('Enviando calendário...');
  try {
    const path = _calStoragePath();
    await _storageUpload('documentos', path, file);
    const isPdf = file.type === 'application/pdf';
    _calExibirUrl(_storagePublicUrl('documentos', path), isPdf);
    mostrarToast('✅ Calendário salvo!');
  } catch(err) {
    console.error('[CAL] Erro upload:', err);
    mostrarToast('❌ Erro ao salvar: ' + err.message);
  }
  input.value = '';
}

function _planoStoragePath() {
  const ano = new Date().getFullYear();
  return `planos/${turmaAtiva?.id || 'turma'}_${ano}`;
}

async function iniciarPlanoCurso() {
  const label = document.getElementById('plano-turma-label');
  if (label) label.textContent = turmaAtiva ? `${turmaAtiva.nome} · ${turmaAtiva.disciplina || ''} · ${new Date().getFullYear()}` : '';

  document.getElementById('plano-empty').style.display = 'none';
  document.getElementById('plano-viewer').style.display = 'none';
  document.getElementById('plano-btn-trocar').style.display = 'none';

  const path = _planoStoragePath();
  mostrarToast('Verificando plano de curso...');
  const url = _storagePublicUrl('documentos', path);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      _planoExibirUrl(url, ct.includes('pdf'));
    } else {
      document.getElementById('plano-empty').style.display = 'flex';
    }
  } catch {
    document.getElementById('plano-empty').style.display = 'flex';
  }
}

function _planoExibirUrl(url, isPdf = false) {
  document.getElementById('plano-empty').style.display = 'none';
  document.getElementById('plano-viewer').style.display = 'block';
  document.getElementById('plano-btn-trocar').style.display = 'flex';
  const iframe = document.getElementById('plano-iframe');
  const img    = document.getElementById('plano-img');
  const linkMob = document.getElementById('plano-link-mob');
  const linkMobA = document.getElementById('plano-link-mob-a');
  const urlNocache = url + '?t=' + Date.now();
  const isMobile = window.innerWidth <= 768;
  if (isPdf) {
    if (isMobile) {
      iframe.style.display = 'none'; img.style.display = 'none';
      if (linkMob) { linkMob.style.display = 'block'; linkMobA.href = urlNocache; }
    } else {
      if (linkMob) linkMob.style.display = 'none';
      iframe.style.display = 'block'; img.style.display = 'none';
      iframe.src = urlNocache;
    }
  } else {
    if (linkMob) linkMob.style.display = 'none';
    img.style.display = 'block'; iframe.style.display = 'none';
    img.src = urlNocache;
  }
}

async function planoHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { mostrarToast('Arquivo muito grande. Máx. 10 MB.'); return; }
  mostrarToast('Enviando plano de curso...');
  try {
    const path = _planoStoragePath();
    await _storageUpload('documentos', path, file);
    const isPdf = file.type === 'application/pdf';
    _planoExibirUrl(_storagePublicUrl('documentos', path), isPdf);
    mostrarToast('✅ Plano de curso salvo!');
  } catch(err) {
    console.error('[PLANO] Erro upload:', err);
    mostrarToast('❌ Erro ao salvar: ' + err.message);
  }
  input.value = '';
}

