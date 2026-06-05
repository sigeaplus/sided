// ── Verificação de sessão ──────────────────────────────────────────────────
const session = JSON.parse(sessionStorage.getItem('ded_user') || 'null');
if (!session || !session.role || !['professor','admin'].includes(session.role)) {
  window.location.href = 'index.html';
}

// ── Logout ─────────────────────────────────────────────────────────────────
function sair() { sessionStorage.clear(); window.location.href = 'index.html'; }
