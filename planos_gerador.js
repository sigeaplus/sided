// ═════════════════════════════════════════════════════════════════════════════
// SIDED+ — Gerador de Plano de Aula / Plano de Aula Semanal
// Gera PDFs fiéis ao papel timbrado da escola usando jsPDF (client-side),
// mesma lib já usada em aulas.js para exportação de aulas.
// Fase inicial: standalone, fora da aba Planejamento. Timbre fixo (EE
// Professor Raymundo Cândido) — sem multi-tenant por enquanto.
// ═════════════════════════════════════════════════════════════════════════════

async function _garantirJsPDFPlanos() {
  if (window.jspdf && window.jspdf.jsPDF) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Cabeçalho comum (timbre) ──────────────────────────────────────────────────
function _desenharTimbre(doc, margemX, largura, y) {
  const alturaLogo = 16;
  try {
    doc.addImage(LOGO_RC_B64, 'PNG', margemX, y, alturaLogo, alturaLogo);
  } catch (e) { console.warn('[PLANOS PDF] Falha ao inserir logo RC:', e); }
  try {
    doc.addImage(BRASAO_MG_B64, 'PNG', margemX + largura - alturaLogo, y, alturaLogo, alturaLogo);
  } catch (e) { console.warn('[PLANOS PDF] Falha ao inserir brasão MG:', e); }
  return y + alturaLogo;
}

function _linhaCentralizada(doc, texto, centroX, y, tamanho, negrito) {
  doc.setFont('helvetica', negrito ? 'bold' : 'normal');
  doc.setFontSize(tamanho);
  doc.text(texto, centroX, y, { align: 'center' });
}

// ── Campo de formulário desenhado como "rótulo: linha em branco" ─────────────
// Usado para simular os campos preenchíveis do papel (rótulo + valor sobre a
// linha, como no original que tem "____________" para preencher à mão).
function _campoLinha(doc, rotulo, valor, x, y, largura, tamanhoFonte = 9) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(tamanhoFonte);
  const rotuloTexto = `${rotulo}: `;
  doc.text(rotuloTexto, x, y);
  const larguraRotulo = doc.getTextWidth(rotuloTexto);
  if (valor) {
    doc.text(String(valor), x + larguraRotulo, y);
  }
}

// Quebra texto em múltiplas linhas dentro de uma largura, retorna array de linhas
function _quebrarTexto(doc, texto, largura, tamanhoFonte = 9) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(tamanhoFonte);
  return doc.splitTextToSize(String(texto || ''), largura);
}

// Desenha um bloco de "campo grande" (rótulo + texto corrido em várias linhas,
// dentro de uma caixa com borda, como Objetivo(s)/Metodologia(s)/etc no modelo)
function _blocoCampo(doc, rotulo, valor, x, y, largura, alturaMin, tamanhoFonte = 9) {
  const linhas = _quebrarTexto(doc, valor, largura - 6, tamanhoFonte);
  const alturaLinha = 4.6;
  const alturaConteudo = Math.max(alturaMin, 8 + linhas.length * alturaLinha);

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, largura, alturaConteudo);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(tamanhoFonte);
  doc.text(`${rotulo}:`, x + 3, y + 5.5);

  doc.setFont('helvetica', 'normal');
  let ly = y + 5.5 + alturaLinha;
  linhas.forEach(l => {
    doc.text(l, x + 3, ly);
    ly += alturaLinha;
  });

  return y + alturaConteudo;
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANO DE AULA — MATRIZ BNCC (formulário único por aula/tema)
// ═════════════════════════════════════════════════════════════════════════════

function gerarPdfPlanoAula(dados) {
  // dados: { professor, periodo, turma, componente, tema, habilidades,
  //          objetivo, metodologia, recursos, conteudo, avaliacao, observacoes }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margemX = 14;
  const largura = 210 - margemX * 2;
  let y = 12;

  y = _desenharTimbre(doc, margemX, largura, y);
  const centroX = margemX + largura / 2;
  let yTexto = 14;
  _linhaCentralizada(doc, 'ESCOLA ESTADUAL PROFESSOR RAYMUNDO CÂNDIDO', centroX, yTexto, 11, true);
  yTexto += 5;
  _linhaCentralizada(doc, 'Amando, educando, seguindo um grande exemplo.', centroX, yTexto, 8, false);
  yTexto += 5;
  _linhaCentralizada(doc, 'Rua Franca, 630 - São Francisco de Assis - Esmeraldas - MG - CEP: 35740-000', centroX, yTexto, 7, false);
  yTexto += 4;
  _linhaCentralizada(doc, 'Fone: (31) 2576-0991', centroX, yTexto, 7, false);
  yTexto += 6;
  _linhaCentralizada(doc, 'PLANO DE AULA – MATRIZ BNCC', centroX, yTexto, 11, true);

  y = Math.max(y, yTexto) + 5;

  // Linha 1: Professor(a) | Período
  doc.setLineWidth(0.3);
  const meio = margemX + largura * 0.62;
  doc.rect(margemX, y, largura, 7);
  doc.line(meio, y, meio, y + 7);
  _campoLinha(doc, 'Professor(a)', dados.professor, margemX + 2, y + 4.7, meio - margemX - 4);
  _campoLinha(doc, 'Período', dados.periodo, meio + 2, y + 4.7, margemX + largura - meio - 4);
  y += 7;

  // Linha 2: Turma(s) | Componente curricular
  doc.rect(margemX, y, largura, 7);
  doc.line(meio, y, meio, y + 7);
  _campoLinha(doc, 'Turma(s)', dados.turma, margemX + 2, y + 4.7, meio - margemX - 4);
  _campoLinha(doc, 'Componente curricular', dados.componente, meio + 2, y + 4.7, margemX + largura - meio - 4);
  y += 7;

  // Linha 3: Tema(s)
  doc.rect(margemX, y, largura, 7);
  _campoLinha(doc, 'Tema(s)', dados.tema, margemX + 2, y + 4.7, largura - 4);
  y += 7;

  y += 2;
  y = _blocoCampo(doc, 'Habilidade(s) BNCC', dados.habilidades, margemX, y, largura, 20);
  y += 2;
  y = _blocoCampo(doc, 'Objetivo(s)', dados.objetivo, margemX, y, largura, 26);
  y += 2;
  y = _blocoCampo(doc, 'Metodologia(s)', dados.metodologia, margemX, y, largura, 22);
  y += 2;
  y = _blocoCampo(doc, 'Recursos', dados.recursos, margemX, y, largura, 14);
  y += 2;
  y = _blocoCampo(doc, 'Conteúdo(s)', dados.conteudo, margemX, y, largura, 22);
  y += 2;
  y = _blocoCampo(doc, 'Avaliação(ões)', dados.avaliacao, margemX, y, largura, 18);
  y += 2;
  y = _blocoCampo(doc, 'Observações', dados.observacoes, margemX, y, largura, 24);

  // Assinaturas
  y += 14;
  if (y > 260) { doc.addPage(); y = 20; }
  const largAssin = (largura - 20) / 2;
  doc.setLineWidth(0.2);
  doc.line(margemX, y, margemX + largAssin, y);
  doc.line(margemX + largAssin + 20, y, margemX + largAssin * 2 + 20, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Supervisor Responsável', margemX + largAssin / 2, y + 4, { align: 'center' });
  doc.text('Professor(a) responsável', margemX + largAssin + 20 + largAssin / 2, y + 4, { align: 'center' });

  return doc;
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANO DE AULA SEMANAL (colunas por dia — dias/aulas escolhidos manualmente)
// ═════════════════════════════════════════════════════════════════════════════

function gerarPdfPlanoSemanal(dados) {
  // dados: { componente, periodoInicio, periodoFim, turma, habilidades,
  //          trimestre, dias: [{ titulo, tema, objetivo, metodologia, conteudo, obs }, ...] }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const margemX = 12;
  const largura = 297 - margemX * 2;
  let y = 10;

  // Timbre compacto (logo à esquerda, texto centralizado, brasão à direita)
  const alturaLogo = 14;
  try { doc.addImage(LOGO_RC_B64, 'PNG', margemX, y, alturaLogo, alturaLogo); } catch (e) {}
  try { doc.addImage(BRASAO_MG_B64, 'PNG', margemX + largura - alturaLogo, y, alturaLogo, alturaLogo); } catch (e) {}

  const centroX = margemX + largura / 2;
  _linhaCentralizada(doc, 'ESCOLA ESTADUAL PROFESSOR RAYMUNDO CÂNDIDO', centroX, y + 5, 11, true);
  _linhaCentralizada(doc, `PLANO DE AULA SEMANAL - ${dados.trimestre || '___'}º Trimestre/${dados.ano || new Date().getFullYear()}`, centroX, y + 11, 9, false);
  y += alturaLogo + 3;

  // Linha 1: Componente Curricular | Período | Turma(s)
  doc.setLineWidth(0.3);
  const col1 = margemX + largura * 0.34;
  const col2 = margemX + largura * 0.66;
  doc.rect(margemX, y, largura, 6);
  doc.line(col1, y, col1, y + 6);
  doc.line(col2, y, col2, y + 6);
  _campoLinha(doc, 'Componente Curricular', dados.componente, margemX + 2, y + 4, col1 - margemX - 4, 8);
  _campoLinha(doc, 'Período', `${dados.periodoInicio || '__/__'}/${dados.ano || '____'} à ${dados.periodoFim || '__/__'}/${dados.ano || '____'}`, col1 + 2, y + 4, col2 - col1 - 4, 8);
  _campoLinha(doc, 'Turma(s)', dados.turma, col2 + 2, y + 4, margemX + largura - col2 - 4, 8);
  y += 6;

  // Linha 2: Habilidade(s) BNCC (tema agora é por dia, exibido em cada coluna)
  doc.rect(margemX, y, largura, 6);
  _campoLinha(doc, 'Habilidade(s) BNCC', dados.habilidades, margemX + 2, y + 4, largura - 4, 8);
  y += 6;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text('A CRMG exige que o plano semanal seja alinhado à BNCC e ao plano de aula geral do tema.', margemX, y + 4);
  y += 7;

  // Grade por dia (colunas dinâmicas conforme dados.dias, largura da tabela até o fim da página)
  const dias = dados.dias && dados.dias.length ? dados.dias : [{ titulo: '', tema: '', objetivo: '', metodologia: '', conteudo: '', obs: '' }];
  const larguraLabelLinha = 7; // coluna vertical de rótulos (TEMA/OBJETIVO/METODOLOGIA/CONTEÚDO/OBS.)
  const larguraColunas = largura - larguraLabelLinha;
  const larguraCadaDia = larguraColunas / dias.length;
  const alturaHeader = 7;
  const alturaTabela = 297 - 20 - y - alturaHeader - 6; // até quase o fim da página landscape (A4: 210x297)
  const linhas = [
    { chave: 'tema', rotulo: 'TEMA' },
    { chave: 'objetivo', rotulo: 'OBJETIVO' },
    { chave: 'metodologia', rotulo: 'METODOLOGIA' },
    { chave: 'conteudo', rotulo: 'CONTEÚDO' },
    { chave: 'obs', rotulo: 'OBS.' },
  ];
  const alturaLinhaRotulo = alturaTabela / linhas.length;

  // Cabeçalho dos dias
  doc.setLineWidth(0.3);
  doc.rect(margemX, y, larguraLabelLinha, alturaHeader);
  dias.forEach((d, i) => {
    const x = margemX + larguraLabelLinha + i * larguraCadaDia;
    doc.rect(x, y, larguraCadaDia, alturaHeader);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(String(d.titulo || `DIA ${i + 1}`), x + larguraCadaDia / 2, y + 4.7, { align: 'center' });
  });
  y += alturaHeader;

  // Corpo: uma linha por rótulo (TEMA/OBJETIVO/METODOLOGIA/CONTEÚDO/OBS), célula por dia
  linhas.forEach(linha => {
    doc.rect(margemX, y, larguraLabelLinha, alturaLinhaRotulo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    // Rótulo vertical (texto rotacionado)
    doc.text(linha.rotulo, margemX + larguraLabelLinha / 2, y + alturaLinhaRotulo / 2, {
      align: 'center', angle: 90,
    });

    dias.forEach((d, i) => {
      const x = margemX + larguraLabelLinha + i * larguraCadaDia;
      doc.rect(x, y, larguraCadaDia, alturaLinhaRotulo);
      const texto = d[linha.chave] || '';
      const fonteTexto = linha.chave === 'tema' ? 7.5 : 7.5;
      const negritoTema = linha.chave === 'tema';
      const linhasTexto = _quebrarTexto(doc, texto, larguraCadaDia - 4, fonteTexto);
      doc.setFont('helvetica', negritoTema ? 'bold' : 'normal');
      doc.setFontSize(fonteTexto);
      let ty = y + 4;
      const maxLinhas = Math.floor((alturaLinhaRotulo - 3) / 3.6);
      linhasTexto.slice(0, maxLinhas).forEach(lt => {
        doc.text(lt, x + 2, ty);
        ty += 3.6;
      });
    });
    y += alturaLinhaRotulo;
  });

  return doc;
}

// ═════════════════════════════════════════════════════════════════════════════
// Helpers de download / múltiplas turmas
// ═════════════════════════════════════════════════════════════════════════════

function _nomeArquivoSeguro(texto) {
  return String(texto || 'plano')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

// Gera um PDF por turma selecionada (mesmo conteúdo, variando Turma/Período)
async function gerarPlanoAulaMultiTurma(dadosBase, turmasSelecionadas) {
  await _garantirJsPDFPlanos();
  const turmas = turmasSelecionadas && turmasSelecionadas.length ? turmasSelecionadas : [dadosBase.turma];
  turmas.forEach(turmaNome => {
    const doc = gerarPdfPlanoAula({ ...dadosBase, turma: turmaNome });
    doc.save(`plano_aula_${_nomeArquivoSeguro(turmaNome)}_${_nomeArquivoSeguro(dadosBase.tema)}.pdf`);
  });
}

async function gerarPlanoSemanalMultiTurma(dadosBase, turmasSelecionadas) {
  await _garantirJsPDFPlanos();
  const turmas = turmasSelecionadas && turmasSelecionadas.length ? turmasSelecionadas : [dadosBase.turma];
  turmas.forEach(turmaNome => {
    const doc = gerarPdfPlanoSemanal({ ...dadosBase, turma: turmaNome });
    doc.save(`plano_semanal_${_nomeArquivoSeguro(turmaNome)}.pdf`);
  });
}

window.gerarPdfPlanoAula = gerarPdfPlanoAula;
window.gerarPdfPlanoSemanal = gerarPdfPlanoSemanal;
window.gerarPlanoAulaMultiTurma = gerarPlanoAulaMultiTurma;
window.gerarPlanoSemanalMultiTurma = gerarPlanoSemanalMultiTurma;
window._garantirJsPDFPlanos = _garantirJsPDFPlanos;
