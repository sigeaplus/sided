// UI helpers moved to ui.js

function mostrarToast(msg) {
  let t = document.getElementById('toast-global');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-global';
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#1E1248;color:#fff;padding:13px 24px;border-radius:12px;font-family:Sora,sans-serif;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:all 0.3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;';
    document.body.appendChild(t);
  }
  t.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${msg}`;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}

function fecharModal(id) { document.getElementById(id).classList.remove('open'); }
function fecharModalOutside(e, id) { if (e.target === document.getElementById(id)) fecharModal(id); }
