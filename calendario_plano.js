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

function _planoStorageDir() {
  const ano = new Date().getFullYear();
  return `planos/${turmaAtiva?.id || 'turma'}_${ano}`;
}

function _sanitizarNomeArquivo(nome) {
  return nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\//g, '-')
    .replace(/\\/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // só ASCII seguro
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim();
}

function _planoStoragePath(fileName) {
  if (!fileName) return _planoStorageDir();
  return `${_planoStorageDir()}/${_sanitizarNomeArquivo(fileName)}`;
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

function _planoRenderLista(files) {
  const lista = document.getElementById('plano-arquivos-lista');
  if (!lista) return;
  if (!files.length) {
    lista.style.display = 'none';
    lista.innerHTML = '';
    return;
  }

  lista.style.display = 'flex';
  lista.style.flexWrap = 'wrap';
  lista.innerHTML = files.map(file => {
    const safeName = String(file.name || file.path || '').replace(/'/g, "\\'");
    const displayName = safeName.replace(/^.*\/(.*)$/, '$1');
    return `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#F8FAFC;">
      <button onclick="planoExibirArquivo('${safeName}')" style="padding:0;border:none;background:none;color:var(--text-muted);font-size:12px;cursor:pointer;white-space:nowrap;flex:1;text-align:left;">${displayName}</button>
      <button onclick="planoRemoverArquivo('${safeName}')" style="padding:3px 6px;border:1px solid #FBBFBF;border-radius:5px;background:none;color:#DC2626;font-size:11px;font-weight:600;cursor:pointer;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='none'">✕</button>
    </div>`;
  }).join('');
}

async function iniciarPlanoCurso() {
  const label = document.getElementById('plano-turma-label');
  if (label) label.textContent = turmaAtiva ? `${turmaAtiva.nome} · ${turmaAtiva.disciplina || ''} · ${new Date().getFullYear()}` : '';

  document.getElementById('plano-empty').style.display = 'none';
  document.getElementById('plano-viewer').style.display = 'none';
  document.getElementById('plano-btn-trocar').style.display = 'none';
  document.getElementById('plano-arquivos-lista').style.display = 'none';

  mostrarToast('Verificando plano de curso...');
  const files = await _storageList('documentos', `${_planoStorageDir()}/`);
  if (files.length) {
    _planoRenderLista(files);
    const first = files[0];
    const name = first.name || first.path;
    if (name) {
      planoExibirArquivo(name);
      return;
    }
  }

  const path = _planoStoragePath();
  const url = _storagePublicUrl('documentos', path);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      _planoExibirUrl(url, ct.includes('pdf'));
      return;
    }
  } catch {
    // fallback to empty state
  }

  document.getElementById('plano-empty').style.display = 'flex';
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

function planoExibirArquivo(fileName) {
  const url = _storagePublicUrl('documentos', _planoStoragePath(fileName));
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  _planoExibirUrl(url, isPdf);
}

async function planoRemoverArquivo(fileName) {
  if (!confirm(`Tem certeza que quer deletar "${fileName}"?`)) {
    return;
  }
  
  mostrarToast('Removendo arquivo...');
  try {
    const path = _planoStoragePath(fileName);
    await _storageDelete('documentos', path);
    mostrarToast('✅ Arquivo removido!');
    await iniciarPlanoCurso();
  } catch(err) {
    console.error('[PLANO] Erro ao remover:', err);
    mostrarToast('❌ Erro ao remover: ' + err.message);
  }
}

async function planoHandleFile(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const invalid = files.find(file => file.size > 50 * 1024 * 1024);
  if (invalid) {
    mostrarToast('Arquivo muito grande. Máx. 50 MB cada.');
    return;
  }

  const processWithAI = document.getElementById('plano-process-ai')?.checked ?? false;

  mostrarToast(`Enviando ${files.length} plano${files.length > 1 ? 's' : ''}...`);
  try {
    await Promise.all(files.map(file => {
      const path = _planoStoragePath(file.name);
      return _storageUpload('documentos', path, file);
    }));

    mostrarToast(`✅ ${files.length} arquivo${files.length > 1 ? 's' : ''} salvo${files.length > 1 ? 's' : ''}!`);
    
    // Se "Processar com IA" está marcado, extrai BNCC de cada arquivo
    if (processWithAI && typeof processPlanoWithAI === 'function') {
      mostrarToast('Iniciando processamento com IA...');
      for (const file of files) {
        try {
          await processPlanoWithAI(file, turmaAtiva?.id);
        } catch (aiErr) {
          console.error('[PLANO AI] Erro ao processar', file.name, ':', aiErr);
          // Continua com próximo arquivo
        }
      }
    }
    
    await iniciarPlanoCurso();
  } catch(err) {
    console.error('[PLANO] Erro upload:', err);
    mostrarToast('❌ Erro ao salvar: ' + err.message);
  }
  input.value = '';
}

