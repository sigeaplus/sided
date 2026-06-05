// IMPRESSÃO — PLANILHA GERAL
function imprimirRelatorioGeral() {
  const tri = document.getElementById('sel-rel-tri').value;
  const nomesTri = { 1: '1º Trimestre', 2: '2º Trimestre', 3: '3º Trimestre' };
  const thead = document.getElementById('relatorio-thead').innerHTML;
  const tbody = document.getElementById('relatorio-body').innerHTML;
  const turma = turmaAtiva?.nome || '';
  const escola = document.getElementById('sidebar-escola-display')?.textContent || '';
  const prof = document.getElementById('sidebar-prof-nome-display')?.textContent || '';

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
    <rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%236C4FD4%22/><rect x=%224%22 y=%224%22 width=%2210%22 height=%2210%22 rx=%222%22 fill=%22white%22/><rect x=%2218%22 y=%224%22 width=%2210%22 height=%2210%22 rx=%222%22 fill=%22white%22 opacity=%220.6%22/><rect x=%224%22 y=%2218%22 width=%2210%22 height=%2210%22 rx=%222%22 fill=%22white%22 opacity=%220.6%22/><rect x=%2218%22 y=%2218%22 width=%2210%22 height=%2210%22 rx=%222%22 fill=%22%23FF8C38%22/></svg>"/>
  <title>SIDED+ — Professor</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1E1248; font-size: 12px; }
    h2 { font-size: 16px; margin-bottom: 4px; }
    .sub { font-size: 12px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #EDE8FF; color: #4A2C6E; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px 10px; border-bottom: 1px solid #E4DDFF; font-size: 12px; }
    tr:nth-child(even) td { background: #FAFBFF; }
    .abaixo td { background: #FFF8F8 !important; color: #C0392B; }
    .rodape { margin-top: 24px; font-size: 11px; color: #999; text-align: right; }
  </style></head><body>
  <h2>Relatório Geral — ${turma}</h2>
  <div class="sub">${escola} · Professor(a): ${prof} · ${nomesTri[tri] || ''}</div>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  <div class="rodape">Gerado em ${new Date().toLocaleDateString('pt-BR')} pelo SIDED+</div>
  <script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// IMPRESSÃO — FICHA DO ALUNO
function imprimirFichaAluno() {
  const nome = document.getElementById('ficha-aluno-nome').textContent;
  const notas = document.getElementById('ficha-notas-resumo').textContent;
  const faltas = document.getElementById('ficha-faltas-resumo').textContent;
  const turma = turmaAtiva?.nome || '';
  const escola = document.getElementById('sidebar-escola-display')?.textContent || '';
  const prof = document.getElementById('sidebar-prof-nome-display')?.textContent || '';

  // expandir todos os trimestres para impressão
  [1,2,3].forEach(tri => {
    const el = document.getElementById(`ficha-tri-${tri}`);
    if (el) el.style.display = 'block';
  });

  const lista = document.getElementById('ficha-notas-lista').innerHTML;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>SIDED+ — Professor</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1E1248; font-size: 12px; }
    h2 { font-size: 16px; margin-bottom: 4px; }
    .sub { font-size: 12px; color: #666; margin-bottom: 16px; }
    .resumo { display: flex; gap: 24px; background: #EDE8FF; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .resumo-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; display: block; }
    .resumo-item span { font-size: 14px; font-weight: bold; }
    .faltas-val { color: #C0392B; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th { background: #EDE8FF; color: #4A2C6E; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 6px 8px; border-bottom: 1px solid #E4DDFF; font-size: 12px; }
    .tri-header { background: #F4F2FF; border-radius: 8px; padding: 10px 14px; margin: 14px 0 6px; display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; }
    .tri-detail { background: #FAFBFF; border: 1px solid #E4DDFF; border-radius: 0 0 8px 8px; padding: 10px 14px; }
    .rodape { margin-top: 24px; font-size: 10px; color: #999; text-align: right; }
    button, select, svg { display: none !important; }
  </style></head><body>
  <h2>Ficha do Aluno — ${nome}</h2>
  <div class="sub">${turma} · ${escola} · Professor(a): ${prof}</div>
  <div class="resumo">
    <div class="resumo-item"><label>Notas</label><span>${notas}</span></div>
    <div class="resumo-item"><label>Faltas</label><span class="faltas-val">${faltas}</span></div>
  </div>
  <strong style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#666;">Notas por trimestre</strong>
  ${lista}
  <div class="rodape">Gerado em ${new Date().toLocaleDateString('pt-BR')} pelo SIDED+</div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

