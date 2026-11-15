import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Relatorio } from '@talhio/shared';
import PDFDocument from 'pdfkit';
import { FUSO } from '../shared/dia.js';

/** Cores da marca, as mesmas do aplicativo e do site. */
const COR = { mata: '#15321F', milho: '#E7B31F', folha: '#3F7A2C', algodao: '#F1F2EC', papel: '#FBFAF4', giz: '#D6D9CC', tinta: '#26201A', suave: '#5F564C', alerta: '#B42318' } as const;

const require = createRequire(import.meta.url);
const arquivoDeFonte = (pacote: string, nome: string) => join(dirname(require.resolve(`${pacote}/package.json`)), 'files', nome);

/** Outfit nos títulos e Nunito Sans no texto. Se os arquivos faltarem, cai para a Helvetica embutida. */
function registrarFontes(doc: PDFKit.PDFDocument) {
  try {
    doc.registerFont('titulo', arquivoDeFonte('@fontsource/outfit', 'outfit-latin-800-normal.woff'));
    doc.registerFont('rotulo', arquivoDeFonte('@fontsource/outfit', 'outfit-latin-700-normal.woff'));
    doc.registerFont('texto', arquivoDeFonte('@fontsource/nunito-sans', 'nunito-sans-latin-400-normal.woff'));
    doc.registerFont('semi', arquivoDeFonte('@fontsource/nunito-sans', 'nunito-sans-latin-600-normal.woff'));
  } catch {
    doc.registerFont('titulo', 'Helvetica-Bold');
    doc.registerFont('rotulo', 'Helvetica-Bold');
    doc.registerFont('texto', 'Helvetica');
    doc.registerFont('semi', 'Helvetica-Bold');
  }
}

const numero = (v: number, casas = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
const ha = (v: number) => `${numero(v, v < 100 ? 1 : 0)} ha`;
function duracao(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h}h${String(m).padStart(2, '0')}`;
}
const data = (dia: string, opcoes: Intl.DateTimeFormatOptions) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { ...opcoes, timeZone: 'UTC' });
const semTipo = (nome: string) => nome.replace(/^(Trator|Pulverizador|Colheitadeira)\s+/, '');

export const TITULO_DO_PERIODO = { dia: 'Relatório do dia', semana: 'Relatório da semana', mes: 'Relatório do mês' } as const;

/** "terça-feira, 10 de novembro de 2026", "4 a 10 de novembro de 2026" ou "novembro de 2026". */
export function rotuloDoPeriodoPdf(r: Pick<Relatorio, 'periodo' | 'inicio' | 'fim'>): string {
  if (r.periodo === 'dia') return data(r.fim, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (r.periodo === 'mes') return data(r.inicio, { month: 'long', year: 'numeric' }) + ` · dias ${Number(r.inicio.slice(8))} a ${Number(r.fim.slice(8))}`;
  const mesmoMes = r.inicio.slice(0, 7) === r.fim.slice(0, 7);
  return `${mesmoMes ? Number(r.inicio.slice(8)) : data(r.inicio, { day: 'numeric', month: 'long' })} a ${data(r.fim, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** Símbolo do Talhio: quatro passadas num quadrado de milho (três feitas, uma por fazer). */
function desenharMarca(doc: PDFKit.PDFDocument, x: number, y: number, tamanho: number) {
  const k = tamanho / 24;
  const p = (a: number, b: number): [number, number] => [x + a * k, y + b * k];
  doc.save();
  doc.roundedRect(x + k, y + k, 22 * k, 22 * k, 7 * k).fill(COR.milho);
  doc.lineWidth(2.2 * k).lineCap('round').strokeColor(COR.mata);
  for (const [a, b, c, d] of [
    [4.5, 19.5, 9, 4.5],
    [8.5, 19.5, 13, 4.5],
    [12.5, 19.5, 17, 4.5],
  ] as const) doc.moveTo(...p(a, b)).lineTo(...p(c, d)).stroke();
  doc.dash(0.1, { space: 3.6 * k }).moveTo(...p(16.5, 19.5)).lineTo(...p(20, 7.5)).stroke().undash();
  doc.restore();
}

const variacao = (valor: number, anterior: number) => (anterior > 0 ? Math.round(((valor - anterior) / anterior) * 100) : null);

/**
 * PDF do relatório: cabeçalho com a marca, resumo, indicadores, gráfico por dia e por máquina.
 * Todos os números vêm prontos do `Relatorio`; aqui só se desenha.
 */
export function gerarPdfDoRelatorio(r: Relatorio, agora = new Date()): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${TITULO_DO_PERIODO[r.periodo]} · ${r.fazendaNome}`, Author: 'Talhio' } });
  registrarFontes(doc);
  const partes: Buffer[] = [];
  doc.on('data', (p: Buffer) => partes.push(p));
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  const L = doc.page.width;
  const M = 40;
  const largura = L - M * 2;
  const fundoDaPagina = () => doc.rect(0, 0, L, doc.page.height).fill(COR.algodao);
  fundoDaPagina();
  doc.on('pageAdded', fundoDaPagina);

  // Cabeçalho verde com cantos de baixo arredondados.
  doc.roundedRect(0, -30, L, 175, 30).fill(COR.mata);
  desenharMarca(doc, M, 30, 30);
  doc.font('titulo').fontSize(22).fillColor(COR.algodao).text('talhio', M + 40, 34, { lineBreak: false });
  doc.font('semi').fontSize(10).fillColor('#CFDCC9').text(TITULO_DO_PERIODO[r.periodo], M, 38, { width: largura, align: 'right' });
  doc.font('titulo').fontSize(30).fillColor(COR.algodao).text(r.fazendaNome, M, 80, { width: largura, lineBreak: false, ellipsis: true });
  const rotulo = rotuloDoPeriodoPdf(r);
  // Relatório só de algumas máquinas: o período divide a linha com a lista delas.
  const soMaquinas = r.soMaquinas ? ` · Só: ${r.soMaquinas.map((m) => m.nome).join(', ')}` : '';
  doc.font('texto').fontSize(12).fillColor('#CFDCC9').text(rotulo.charAt(0).toUpperCase() + rotulo.slice(1) + soMaquinas, M, 120, { width: largura, height: 16, lineBreak: false, ellipsis: true });

  let y = 165;
  const cabe = (altura: number) => {
    if (y + altura > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
  };
  const titulo = (texto: string) => {
    cabe(40);
    doc.font('titulo').fontSize(15).fillColor(COR.tinta).text(texto, M, y, { lineBreak: false });
    y += 26;
  };

  // Resumo em cartão de papel.
  const alturaResumo = doc.font('texto').fontSize(12).heightOfString(r.resumo, { width: largura - 40, lineGap: 3 }) + 36;
  doc.roundedRect(M, y, largura, alturaResumo, 18).fillAndStroke(COR.papel, COR.giz);
  doc.fillColor(COR.tinta).font('texto').fontSize(12).text(r.resumo, M + 20, y + 18, { width: largura - 40, lineGap: 3 });
  y += alturaResumo + 20;

  // Indicadores: quatro blocos lado a lado.
  const { areaHa, horas, consumoLPorHa, consumoLPorHora, paradoMin, litros, areaForaDosTalhoesHa } = r.indicadores;
    const contra = r.periodo === 'dia' ? 'dia anterior' : r.periodo === 'semana' ? '7 dias antes' : 'mês anterior';
  const pct = (v: number, a: number, menorEMelhor = false) => {
    const p = variacao(v, a);
    if (p === null) return { texto: 'sem comparação', bom: true };
    return { texto: `${p > 0 ? '+' : ''}${p}% vs ${contra}`, bom: menorEMelhor ? p <= 0 : p >= 0 };
  };
  const semLeitura = { texto: 'sem leitura de combustível', bom: true };
  const comparar = (v: { valor: number | null; anterior: number | null }) => (v.valor !== null && v.anterior !== null ? pct(v.valor, v.anterior, true) : v.valor === null ? semLeitura : { texto: 'sem comparação', bom: true });
  const foraHa = Math.min(areaHa.valor, areaForaDosTalhoesHa);
  // Litros estimados pela queda do tanque (não lidos do motor) saem marcados em todo lugar em que aparecem.
  const est = r.combustivelEstimado ? ' (estimado)' : '';
  const indicadores = [
    { nome: 'Área trabalhada', valor: ha(areaHa.valor), ...pct(areaHa.valor, areaHa.anterior) },
    { nome: 'Horas de máquina', valor: `${numero(horas.valor, horas.valor < 100 ? 1 : 0)} h`, ...pct(horas.valor, horas.anterior) },
    { nome: `Combustível usado${est}`, valor: litros.valor === null ? '—' : `${numero(litros.valor)} L`, ...comparar(litros) },
    { nome: 'Tempo parado', valor: duracao(paradoMin.valor), ...pct(paradoMin.valor, paradoMin.anterior, true) },
    { nome: `Litros por hectare${est}`, valor: consumoLPorHa.valor === null ? '—' : `${numero(consumoLPorHa.valor, 1)} L`, ...comparar(consumoLPorHa) },
    { nome: `Litros por hora${est}`, valor: consumoLPorHora.valor === null ? '—' : `${numero(consumoLPorHora.valor, 1)} L`, ...comparar(consumoLPorHora) },
    { nome: 'Área dentro dos talhões', valor: ha(Math.max(0, areaHa.valor - foraHa)), texto: 'com contorno cadastrado', bom: true },
    { nome: 'Área fora dos talhões', valor: ha(foraHa), texto: foraHa > 0 ? 'sem contorno cadastrado' : 'nenhuma', bom: true },
  ];
  const gap = 10;
  const larguraBloco = (largura - gap * 3) / 4;
  indicadores.forEach((item, i) => {
    const x = M + (i % 4) * (larguraBloco + gap);
    const linha = Math.floor(i / 4);
    const y0 = y + linha * (78 + gap);
    doc.roundedRect(x, y0, larguraBloco, 78, 16).fillAndStroke(COR.papel, COR.giz);
    doc.font('texto').fontSize(9).fillColor(COR.suave).text(item.nome, x + 12, y0 + 12, { width: larguraBloco - 24, lineBreak: false });
    doc.font('titulo').fontSize(20).fillColor(COR.tinta).text(item.valor, x + 12, y0 + 28, { width: larguraBloco - 24, lineBreak: false });
    doc.font('semi').fontSize(8.5).fillColor(item.bom ? COR.folha : COR.alerta).text(item.texto, x + 12, y0 + 56, { width: larguraBloco - 24, lineBreak: false });
  });
  y += 78 * 2 + gap + 22;

  // Gráfico de colunas: área por dia (só quando há mais de um dia).
  if (r.porDia.length > 1) {
    titulo('Área por dia');
    const altura = 100;
    const base = y + altura;
    const maximo = Math.max(1, ...r.porDia.map((d) => d.areaHa));
    // Topo da escala arredondado para um número fácil de ler.
    const passo = 10 ** Math.floor(Math.log10(maximo));
    const topo = Math.ceil(maximo / passo) * passo;
    const esquerda = M + 34;
    const larguraGrafico = largura - 34;
    doc.lineWidth(0.5);
    for (let i = 0; i <= 4; i++) {
      const gy = base - (altura * i) / 4;
      doc.moveTo(esquerda, gy).lineTo(esquerda + larguraGrafico, gy).strokeColor(COR.giz).stroke();
      doc.font('texto').fontSize(8).fillColor(COR.suave).text(numero((topo * i) / 4), M, gy - 4, { width: 28, align: 'right', lineBreak: false });
    }
    const faixa = larguraGrafico / r.porDia.length;
    const coluna = Math.min(22, faixa * 0.62);
    const cadaQuantos = Math.ceil(r.porDia.length / 12);
    r.porDia.forEach((d, i) => {
      const h = (d.areaHa / topo) * altura;
      const x = esquerda + i * faixa + (faixa - coluna) / 2;
      if (h > 0) doc.roundedRect(x, base - h, coluna, h, Math.min(4, coluna / 2)).fill(i === r.porDia.length - 1 && r.periodo !== 'dia' ? COR.milho : COR.folha);
      if (i % cadaQuantos === 0 || i === r.porDia.length - 1) {
        doc.font('texto').fontSize(8).fillColor(COR.suave).text(String(Number(d.dia.slice(8))), x - 6, base + 5, { width: coluna + 12, align: 'center', lineBreak: false });
      }
    });
    doc.font('texto').fontSize(8).fillColor(COR.suave).text('Hectares por dia. O último dia aparece em amarelo.', esquerda, base + 20, { lineBreak: false });
    y = base + 38;
  }

  // Barras horizontais: hectares por máquina.
  titulo('Hectares por máquina');
  const maior = Math.max(1, ...r.porMaquina.map((m) => m.areaHa));
  const colunaNome = 120;
  const colunaValor = 110;
  const trilho = largura - colunaNome - colunaValor - 16;
  r.porMaquina.forEach((m) => {
    cabe(22);
    doc.font('semi').fontSize(10).fillColor(COR.tinta).text(semTipo(m.nome), M, y + 2, { width: colunaNome - 8, lineBreak: false, ellipsis: true });
    doc.roundedRect(M + colunaNome, y + 1, trilho, 11, 5.5).fill(COR.giz);
    const preenchido = Math.max(11, (m.areaHa / maior) * trilho);
    if (m.areaHa > 0) doc.roundedRect(M + colunaNome, y + 1, preenchido, 11, 5.5).fill(m.destaque ? COR.milho : COR.folha);
    doc.font('semi').fontSize(10).fillColor(COR.tinta).text(`${ha(m.areaHa)} · ${numero(m.horas, 1)} h`, M + colunaNome + trilho + 10, y + 2, { width: colunaValor, align: 'right', lineBreak: false });
    y += 22;
  });
  if (r.porMaquina.some((m) => m.destaque)) {
    doc.font('texto').fontSize(8).fillColor(COR.suave).text('Em amarelo: a máquina que mais ficou parada no período.', M, y + 2, { lineBreak: false });
    y += 18;
  }

  // Tempo parado por dia, em colunas pequenas.
  if (r.porDia.length > 1 && r.porDia.some((d) => d.paradoMin > 0)) {
    y += 4;
    titulo('Tempo parado por dia');
    const altura = 46;
    const base = y + altura;
    const maximo = Math.max(1, ...r.porDia.map((d) => d.paradoMin));
    const esquerda = M + 34;
    const larguraGrafico = largura - 34;
    doc.moveTo(esquerda, base).lineTo(esquerda + larguraGrafico, base).lineWidth(0.5).strokeColor(COR.giz).stroke();
    doc.font('texto').fontSize(8).fillColor(COR.suave).text(duracao(maximo), M, y - 4, { width: 28, align: 'right', lineBreak: false });
    const faixa = larguraGrafico / r.porDia.length;
    const coluna = Math.min(22, faixa * 0.62);
    r.porDia.forEach((d, i) => {
      const h = (d.paradoMin / maximo) * altura;
      if (h > 0) doc.roundedRect(esquerda + i * faixa + (faixa - coluna) / 2, base - h, coluna, h, Math.min(4, coluna / 2)).fill(COR.milho);
    });
    y = base + 20;
  }

  // Tabela completa por máquina: tudo que o servidor sabe de cada uma no período.
  y += 6;
  titulo('Detalhe por máquina');
  const col = [
    { nome: 'Máquina', x: 0, w: 118, alinha: 'left' as const },
    { nome: 'Área', x: 118, w: 62, alinha: 'right' as const },
    { nome: 'Horas', x: 180, w: 52, alinha: 'right' as const },
    { nome: 'Litros', x: 232, w: 62, alinha: 'right' as const },
    { nome: 'L/ha', x: 294, w: 56, alinha: 'right' as const },
    { nome: 'L/h', x: 350, w: 56, alinha: 'right' as const },
    { nome: 'Parado', x: 406, w: largura - 406, alinha: 'right' as const },
  ];
  const cabecalhoDaTabela = () => {
    doc.roundedRect(M, y, largura, 20, 10).fill(COR.mata);
    col.forEach((c) => doc.font('rotulo').fontSize(9).fillColor(COR.algodao).text(c.nome, M + c.x + (c.alinha === 'left' ? 12 : 0), y + 6, { width: c.w - (c.alinha === 'left' ? 12 : 10), align: c.alinha, lineBreak: false }));
    y += 24;
  };
  cabe(60);
  cabecalhoDaTabela();
  const celulas = (m: Relatorio['porMaquina'][number]) => [
    semTipo(m.nome),
    ha(m.areaHa),
    `${numero(m.horas, 1)} h`,
    m.litros === null ? '—' : `${numero(m.litros)} L${m.litrosEstimados ? '*' : ''}`,
    m.consumoLPorHa === null ? '—' : numero(m.consumoLPorHa, 1),
    m.consumoLPorHora === null ? '—' : numero(m.consumoLPorHora, 1),
    duracao(m.paradoMin),
  ];
  r.porMaquina.forEach((m, i) => {
    if (y + 20 > doc.page.height - 60) {
      doc.addPage();
      y = 40;
      cabecalhoDaTabela();
    }
    if (i % 2 === 0) doc.roundedRect(M, y - 2, largura, 18, 9).fill(COR.papel);
    celulas(m).forEach((texto, c) => doc.font(c === 0 ? 'semi' : 'texto').fontSize(9.5).fillColor(COR.tinta).text(texto, M + col[c]!.x + (c === 0 ? 12 : 0), y + 2, { width: col[c]!.w - (c === 0 ? 12 : 10), align: col[c]!.alinha, lineBreak: false, ellipsis: true }));
    y += 18;
  });
  const total = r.indicadores;
  doc.font('semi').fontSize(9.5).fillColor(COR.tinta);
  doc.moveTo(M, y + 1).lineTo(M + largura, y + 1).lineWidth(0.6).strokeColor(COR.giz).stroke();
  [
    'Total',
    ha(total.areaHa.valor),
    `${numero(total.horas.valor, 1)} h`,
    total.litros.valor === null ? '—' : `${numero(total.litros.valor)} L`,
    total.consumoLPorHa.valor === null ? '—' : numero(total.consumoLPorHa.valor, 1),
    total.consumoLPorHora.valor === null ? '—' : numero(total.consumoLPorHora.valor, 1),
    duracao(total.paradoMin.valor),
  ].forEach((texto, c) => doc.font('rotulo').fontSize(9.5).fillColor(COR.tinta).text(texto, M + col[c]!.x + (c === 0 ? 12 : 0), y + 6, { width: col[c]!.w - (c === 0 ? 12 : 10), align: col[c]!.alinha, lineBreak: false }));
  y += 26;
  doc.font('texto').fontSize(8).fillColor(COR.suave).text('"—" quer dizer sem leitura de combustível (não é zero litro). L/ha e L/h são litros por hectare e por hora de máquina.', M, y, { width: largura });
  y += 22;
  if (r.combustivelEstimado) {
    doc.font('texto').fontSize(8).fillColor(COR.suave).text('* Combustível ESTIMADO pela queda do nível do tanque, não lido do motor: pode diferir do que o monitor da máquina mostra.', M, y - 8, { width: largura });
    y += 14;
  }
  if (r.combustivelDesde) {
    doc.font('texto').fontSize(8).fillColor(COR.suave).text(`* Combustível lido do motor a partir das ${r.combustivelDesde}: o que a máquina gastou antes dessa leitura não entra na conta.`, M, y - 8, { width: largura });
    y += 14;
  }

  // Hectares por operação, a partir dos planos salvos.
  const nomeDaOperacao = { plantio: 'Plantio', pulverizacao: 'Pulverização', adubacao: 'Adubação', colheita: 'Colheita' } as const;
  if (r.porOperacao.length > 0) {
    titulo('Hectares por operação');
    const maiorOp = Math.max(1, ...r.porOperacao.map((o) => o.areaHa));
    r.porOperacao.forEach((o) => {
      cabe(22);
      doc.font('semi').fontSize(10).fillColor(COR.tinta).text(o.operacao ? nomeDaOperacao[o.operacao] : 'Máquinas sem plano', M, y + 2, { width: colunaNome - 8, lineBreak: false });
      doc.roundedRect(M + colunaNome, y + 1, trilho, 11, 5.5).fill(COR.giz);
      if (o.areaHa > 0) doc.roundedRect(M + colunaNome, y + 1, Math.max(11, (o.areaHa / maiorOp) * trilho), 11, 5.5).fill(o.operacao ? COR.folha : COR.giz);
      doc.font('semi').fontSize(10).fillColor(COR.tinta).text(ha(o.areaHa), M + colunaNome + trilho + 10, y + 2, { width: colunaValor, align: 'right', lineBreak: false });
      y += 22;
    });
    doc.font('texto').fontSize(8).fillColor(COR.suave).text('Pela operação do plano salvo para cada máquina em cada dia.', M, y + 2, { lineBreak: false });
    y += 22;
  }

  // Combustível por dia, quando há mais de um dia com leitura.
  if (r.porDia.length > 1 && r.porDia.some((d) => d.litros !== null)) {
    titulo('Combustível por dia');
    const altura = 70;
    const base = y + altura;
    const maxL = Math.max(1, ...r.porDia.map((d) => d.litros ?? 0));
    const esquerda = M + 34;
    const larguraGrafico = largura - 34;
    doc.moveTo(esquerda, base).lineTo(esquerda + larguraGrafico, base).lineWidth(0.5).strokeColor(COR.giz).stroke();
    doc.font('texto').fontSize(8).fillColor(COR.suave).text(`${numero(maxL)} L`, M - 6, y - 4, { width: 34, align: 'right', lineBreak: false });
    const faixa = larguraGrafico / r.porDia.length;
    const coluna = Math.min(22, faixa * 0.62);
    const cadaQuantos = Math.ceil(r.porDia.length / 12);
    r.porDia.forEach((d, i) => {
      const x = esquerda + i * faixa + (faixa - coluna) / 2;
      const h = ((d.litros ?? 0) / maxL) * altura;
      if (h > 0) doc.roundedRect(x, base - h, coluna, h, Math.min(4, coluna / 2)).fill(COR.mata);
      if (i % cadaQuantos === 0 || i === r.porDia.length - 1) doc.font('texto').fontSize(8).fillColor(COR.suave).text(String(Number(d.dia.slice(8))), x - 6, base + 5, { width: coluna + 12, align: 'center', lineBreak: false });
    });
    y = base + 28;
  }

  // Dia a dia, em tabela (semana e mês).
  if (r.porDia.length > 1) {
    cabe(60);
    titulo('Dia a dia');
    const colunasDia = [
      { nome: 'Dia', x: 0, w: 96, alinha: 'left' as const },
      { nome: 'Área', x: 96, w: 90, alinha: 'right' as const },
      { nome: 'Horas', x: 186, w: 80, alinha: 'right' as const },
      { nome: 'Combustível', x: 266, w: 96, alinha: 'right' as const },
      { nome: 'Parado', x: 362, w: largura - 362, alinha: 'right' as const },
    ];
    const cabecaDia = () => {
      doc.roundedRect(M, y, largura, 20, 10).fill(COR.mata);
      colunasDia.forEach((c) => doc.font('rotulo').fontSize(9).fillColor(COR.algodao).text(c.nome, M + c.x + (c.alinha === 'left' ? 12 : 0), y + 6, { width: c.w - (c.alinha === 'left' ? 12 : 10), align: c.alinha, lineBreak: false }));
      y += 24;
    };
    cabecaDia();
    r.porDia.forEach((d, i) => {
      if (y + 20 > doc.page.height - 60) {
        doc.addPage();
        y = 40;
        cabecaDia();
      }
      if (i % 2 === 0) doc.roundedRect(M, y - 2, largura, 18, 9).fill(COR.papel);
      [data(d.dia, { weekday: 'short', day: 'numeric', month: 'short' }), ha(d.areaHa), `${numero(d.horas, 1)} h`, d.litros === null ? '—' : `${numero(d.litros)} L`, duracao(d.paradoMin)].forEach((texto, c) =>
        doc.font(c === 0 ? 'semi' : 'texto').fontSize(9.5).fillColor(COR.tinta).text(texto, M + colunasDia[c]!.x + (c === 0 ? 12 : 0), y + 2, { width: colunasDia[c]!.w - (c === 0 ? 12 : 10), align: colunasDia[c]!.alinha, lineBreak: false }),
      );
      y += 18;
    });
    y += 10;
  }

  // Rodapé e número em todas as páginas.
  const quando = agora.toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });
  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    doc.font('texto').fontSize(8).fillColor(COR.suave).text(`Gerado pelo Talhio em ${quando}. Os números vêm das máquinas John Deere conectadas à fazenda.  ·  Página ${i + 1} de ${count}`, M, doc.page.height - 36, { width: largura, align: 'center', lineBreak: false });
  }

  doc.end();
  return pronto;
}

/** Nome do arquivo: relatorio-talhio-mes-2026-11.pdf */
export const nomeDoArquivoPdf = (r: Pick<Relatorio, 'periodo' | 'inicio' | 'fim'>) =>
  `relatorio-talhio-${r.periodo}-${r.periodo === 'mes' ? r.inicio.slice(0, 7) : r.fim}.pdf`;

