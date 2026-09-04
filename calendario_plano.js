function _calStoragePath() {
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaId = profData.escola_id || profData.escolas?.id || profData.id || 'escola';
  const ano = new Date().getFullYear();
  return `calendarios/${escolaId}_${ano}`;
}

async function _storageUpload(bucket, path, file) {
  // Tenta upsert (sobrescreve se já existe)
  const encodedPath = encodeURI(path);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`, {
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
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
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
  if (file.size > 50 * 1024 * 1024) { mostrarToast('Arquivo muito grande. Máx. 50 MB.'); return; }
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

async function _storageList(bucket, prefix) {
  // Supabase Storage list API usa POST com body JSON
  // prefix deve ser o diretório SEM a barra final
  const cleanPrefix = prefix.replace(/\/$/, '');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prefix: cleanPrefix, limit: 100, offset: 0 })
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function _storageDelete(bucket, path) {
  const encodedPath = encodeURI(path);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) {
    throw new Error(`Falha ao deletar: ${res.status}`);
  }
  return true;
}
