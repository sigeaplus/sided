// ═════════════════════════════════════════════════════════════════════════════
// SIDED+ — Módulo de API e Cache
// Contém: credenciais Supabase, função de API, cache de turma, cache de chamadas
// ═════════════════════════════════════════════════════════════════════════════

// ── CREDENCIAIS SUPABASE ─────────────────────────────────────────────────────
const SUPABASE_URL = 'https://biocjxggjjfeqmpuysik.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpb2NqeGdnampmZXFtcHV5c2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODUwOTQsImV4cCI6MjA4OTc2MTA5NH0.3bL3dKqiWGoHROE6vSzf-7Orp0GLcLpn4mHtUSwC0dU';

// ── FUNÇÃO DE API ────────────────────────────────────────────────────────────
const api = async (path, opts = {}) => {
  const { headers: extraHeaders, ...restOpts } = opts;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...restOpts,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...extraHeaders },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.hint || JSON.stringify(data);
    console.error(`[API] Erro ${res.status} em ${path}:`, msg, data);
    throw new Error(`Supabase erro ${res.status}: ${msg}`);
  }
  return data;
};

// ── CACHE DE TURMA ──────────────────────────────────────────────────────────
// Evita re-buscar dados já carregados ao alternar entre turmas
const _cache = {};
function _cacheKey(turmaId, tipo) { return `${turmaId}::${tipo}`; }
function cacheSalvar(turmaId, tipo, dados) { _cache[_cacheKey(turmaId, tipo)] = { dados, ts: Date.now() }; }
function cacheLer(turmaId, tipo, ttl = 60000) {
  const entry = _cache[_cacheKey(turmaId, tipo)];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) return null; // expirado
  return entry.dados;
}
function cacheInvalidar(turmaId) {
  Object.keys(_cache).forEach(k => { if (k.startsWith(turmaId + '::')) delete _cache[k]; });
}

// ── WRAPPER DE API COM CACHE PARA GET SIMPLES ────────────────────────────────
async function apiCached(path, turmaId, tipo, ttl = 60000) {
  const hit = cacheLer(turmaId, tipo, ttl);
  if (hit !== null) return hit;
  const dados = await api(path) || [];
  cacheSalvar(turmaId, tipo, dados);
  return dados;
}

// ── CACHE DE CHAMADAS ────────────────────────────────────────────────────────
// Rastreia se uma aula tem chamada salva (aula_id → booleano)
const _chamadaCache = {};
function chamadaCacheSet(aulaId, temChamada) { _chamadaCache[aulaId] = temChamada; }
function chamadaCacheGet(aulaId) { return _chamadaCache[aulaId]; }

// Expor ao window para acesso global
if (typeof window !== 'undefined') {
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;
  window.api = api;
  window.apiCached = apiCached;
  window.cacheSalvar = cacheSalvar;
  window.cacheLer = cacheLer;
  window.cacheInvalidar = cacheInvalidar;
  window.chamadaCacheSet = chamadaCacheSet;
  window.chamadaCacheGet = chamadaCacheGet;
  // Expor também os internals usados diretamente no código
  window._cache = _cache;
  window._cacheKey = _cacheKey;
  window._chamadaCache = _chamadaCache;
}
