import { comVariacoes, conferirResposta } from './conferencia.js';

const HOJE = '2026-11-16';

/** O retrato que vai nas instruções: máquinas de agora, o relatório de hoje e o dos últimos 7 dias. */
const RETRATO = {
  fazenda: 'Granja Mangueira',
  maquinas: [
    { id: '637795', nome: '8270R - 23', ultimoSinal: '2026-11-16T11:04:00.000Z', horasHoje: 6.5, areaHojeHa: 31.2, combustivelPct: 62, horimetro: 5431.7, usoHoje: { trabalhandoH: 5.1, ociosoH: 1.4, combustivelL: 143.2, porTalhao: [{ nome: 'Talhão 3', andandoH: 4.2, paradoH: 0.6 }] } },
    { id: '637796', nome: '8270R - 29', ultimoSinal: '2026-11-16T10:30:00.000Z', horasHoje: 8.2, areaHojeHa: 44.9, combustivelPct: 94, horimetro: 4980.3, usoHoje: { trabalhandoH: 7.7, ociosoH: 0.5, combustivelL: 188.6, porTalhao: [] } },
  ],
  talhoes: [{ id: 't3', nome: 'Talhão 3', areaHa: 120.4, percentualFeito: 38 }],
  relatorioDeHoje: {
    periodo: 'dia',
    inicio: HOJE,
    fim: HOJE,
    anteriorInicio: '2026-11-15',
    anteriorFim: '2026-11-15',
    indicadores: { areaHa: { valor: 76.1, anterior: 60, diferenca: 16.1, variacaoPct: 27 }, horas: { valor: 14.7, anterior: 12 }, litros: { valor: 331.8, anterior: 290 }, consumoLPorHora: { valor: 22.6, anterior: 24.2 }, paradoMin: { valor: 114, anterior: 80 } },
    porMaquina: [
      { maquinaId: '637796', nome: '8270R - 29', areaHa: 44.9, horas: 8.2, litros: 189, consumoLPorHora: 23, paradoMin: 30 },
      { maquinaId: '637795', nome: '8270R - 23', areaHa: 31.2, horas: 6.5, litros: 143, consumoLPorHora: 22, paradoMin: 84 },
    ],
  },
  relatorioDosUltimos7Dias: {
    periodo: 'semana',
    inicio: '2026-11-10',
    fim: HOJE,
    anteriorInicio: '2026-11-03',
    anteriorFim: '2026-11-09',
    indicadores: { areaHa: { valor: 512.4, anterior: 480 }, horas: { valor: 98.3, anterior: 91 }, litros: { valor: 2210, anterior: 2050 }, consumoLPorHora: { valor: 22.5, anterior: 22.5 }, paradoMin: { valor: 640, anterior: 700 } },
    porMaquina: [{ maquinaId: '637796', nome: '8270R - 29', areaHa: 300.2, horas: 55.1, litros: 1260, consumoLPorHora: 22.9, paradoMin: 210 }],
  },
};

/** O que `consultar_relatorio` devolve para outubro. */
const OUTUBRO = {
  periodo: 'mes',
  inicio: '2026-10-01',
  fim: '2026-10-31',
  anteriorInicio: '2026-09-01',
  anteriorFim: '2026-09-30',
  indicadores: {
    areaHa: { valor: 11738.7, anterior: 1276.6, diferenca: 10462.1, variacaoPct: 820 },
    horas: { valor: 991.6, anterior: 1153, diferenca: -161.4, variacaoPct: -14 },
    litros: { valor: 19140, anterior: 17300 },
    consumoLPorHora: { valor: 19.3, anterior: 15 },
    paradoMin: { valor: 19792, anterior: 27786 },
  },
  maiorParada: { maquinaId: '637795', maquinaNome: '8270R - 23', minutos: 4138, talhaoNome: 'Talhão 3' },
  porDia: [
    { dia: '2026-10-12', areaHa: 402.5, horas: 31.9, paradoMin: 512, litros: 357 },
    { dia: '2026-10-13', areaHa: 380.1, horas: 30.2, paradoMin: 498, litros: 612 },
  ],
  porMaquina: [
    { maquinaId: '637796', nome: '8270R - 29', areaHa: 2210.4, horas: 180.3, litros: 3900, consumoLPorHora: 21.6, paradoMin: 2890 },
    { maquinaId: '637795', nome: '8270R - 23', areaHa: 1890.9, horas: 171.8, litros: 3450, consumoLPorHora: 20.1, paradoMin: 4138 },
  ],
};

const conferir = (resposta: string, pergunta = 'Como foi?', dados: unknown[] = [RETRATO, OUTUBRO]) => conferirResposta(resposta, { dados, textos: [pergunta], pergunta, hoje: HOJE });

describe('conferirResposta: o que passa', () => {
  it('número da fazenda no período certo, escrito em português, arredondado e com a variação pronta', () => {
    expect(conferir('Em outubro a fazenda fez **11.738,7 ha**, contra 1.276,6 ha em setembro (820% a mais).')).toEqual([]);
    expect(conferir('Em outubro foram 992 h de máquina, a 19 L/h, com 19.140 L.')).toEqual([]);
    expect(conferir('Hoje a fazenda fez 76,1 ha em 14,7 h e gastou 332 L.')).toEqual([]);
    expect(conferir('Na semana foram 512,4 ha e 2.210 L.')).toEqual([]);
  });

  it('número da máquina na frase que cita a máquina, com o nome escrito de outro jeito', () => {
    expect(conferir('Em outubro o 8270R - 23 ficou 68h58 parado e gastou 3.450 L.')).toEqual([]);
    expect(conferir('Hoje o 8270R-23 trabalhou 6,5 h e fez 31,2 ha; o tanque está em 62%.')).toEqual([]);
    expect(conferir('O horímetro do 8270R – 29 marca 4.980,3 h. Último sinal às 07:30.')).toEqual([]);
    expect(conferir('Hoje o 8270R - 23 andou 4,2 h no Talhão 3.')).toEqual([]);
  });

  it('tabela: a linha diz de quem é, a coluna diz a medida e o título diz o período', () => {
    const tabela = ['Outubro, por máquina:', '', '| Máquina | Litros | Horas | L/h |', '|---|---|---|---|', '| 8270R - 29 | 3.900 | 180,3 | 21,6 |', '| 8270R - 23 | 3.450 | 171,8 | 20,1 |', '| Total | 19.140 | 991,6 | 19,3 |'].join('\n');
    expect(conferir(tabela)).toEqual([]);
    const porDia = ['## Outubro, dia a dia', '', '| Dia | Litros | Área |', '|---|---|---|', '| 12/10 | 357 | 402,5 |', '| 13/10 | 612 | 380,1 |'].join('\n');
    expect(conferir(porDia)).toEqual([]);
  });

  it('a pergunta diz de quem e de quando a resposta fala', () => {
    expect(conferir('Gastou 3.900 L em 180,3 h.', 'Como foi o 8270R - 29 em outubro?')).toEqual([]);
  });

  it('contagem, dia do mês, ano e o número que a pessoa escreveu não são conferidos', () => {
    expect(conferir('1. Em 16 de novembro de 2026, 2 máquinas trabalharam.\n2. Não tenho os últimos 45 dias.')).toEqual([]);
    expect(conferir('Não tenho dados do talhão 2451.', 'Como foi o talhão 2451?')).toEqual([]);
  });
});

describe('conferirResposta: o que é barrado', () => {
  const motivo = (resposta: string, pergunta?: string) => conferir(resposta, pergunta).join(' | ');

  it('número que não existe nos dados', () => {
    expect(motivo('O total do ano foi 17.485 ha.')).toContain('17.485 ha (não existe nos dados)');
    expect(motivo('Último sinal às 14:20.')).toContain('14:20');
    expect(motivo('Em outubro o 8270R - 23 ficou 12h30 parado.')).toContain('12h30');
  });

  it('número certo na máquina errada', () => {
    // 68h58 e 3.450 L são do 8270R - 23.
    expect(motivo('Em outubro o 8270R - 29 ficou 68h58 parado.')).toContain('68h58 (não é de 8270r 29 nos dados)');
    expect(motivo('Em outubro o 8270R - 29 gastou 3.450 L.')).toContain('3.450 L (não é de 8270r 29 nos dados)');
    const tabela = ['Outubro:', '', '| Máquina | Litros |', '|---|---|', '| 8270R - 29 | 3.450 |'].join('\n');
    expect(motivo(tabela)).toContain('não é de 8270r 29');
  });

  it('número de uma máquina sem dizer de qual, e número da fazenda dado como de uma máquina', () => {
    expect(motivo('Em outubro foram gastos 3.900 L.')).toContain('é de uma máquina ou talhão que a frase não cita');
    expect(motivo('Em outubro o 8270R - 23 fez 11.738,7 ha.')).toContain('não é de 8270r 23');
  });

  it('número certo na medida errada', () => {
    // 991,6 são horas, não litros; 19,3 é L/h, não L/ha.
    expect(motivo('Em outubro a fazenda gastou 991,6 L.')).toContain('991,6 L (existe nos dados, mas em outra medida)');
    expect(motivo('Em outubro o consumo da fazenda foi 19,3 L/ha.')).toContain('em outra medida');
  });

  it('número certo no período errado', () => {
    expect(motivo('Em setembro a fazenda fez 11.738,7 ha.')).toContain('é de outro período');
    expect(motivo('Hoje a fazenda fez 512,4 ha.')).toContain('é de outro período');
    // 357 L é de UM dia de outubro, não do mês.
    expect(motivo('Em outubro a fazenda gastou 357 L.')).toContain('é de outro período');
    expect(motivo('Na semana o 8270R - 29 gastou 3.900 L.')).toContain('é de outro período');
  });
});

describe('comVariacoes', () => {
  it('acrescenta diferença e variação em % a todo par valor/anterior, em qualquer profundidade', () => {
    const saida = comVariacoes({ indicadores: { horas: { valor: 992, anterior: 1153 }, litros: { valor: 10, anterior: null }, area: { valor: 5, anterior: 0 } }, lista: [{ valor: 3, anterior: 2 }], nome: 'x' });
    expect(saida.indicadores.horas).toEqual({ valor: 992, anterior: 1153, diferenca: -161, variacaoPct: -14 });
    expect(saida.indicadores.litros).toEqual({ valor: 10, anterior: null });
    expect(saida.indicadores.area).toMatchObject({ diferenca: 5, variacaoPct: null });
    expect(saida.lista[0]).toMatchObject({ diferenca: 1, variacaoPct: 50 });
    expect(saida.nome).toBe('x');
  });
});

describe('conversa de continuação e jeito de falar do campo', () => {
  const dados = [{ maquinas: [{ nome: '8270R - 24', horasHoje: 5.8, usoHoje: { trabalhandoH: 1.9, ociosoH: 0.4, transporteH: 0, semPosicaoH: 3.5 } }, { nome: '8270R - 22', horasHoje: 2.1 }] }];
  const base = { dados, textos: [], hoje: '2026-11-16' };

  it('"o trator 24" cita a máquina cujo nome termina em 24', () => {
    expect(conferirResposta('O trator 24 ficou 5,8 h ligado hoje: 1,9 h trabalhando, 0,4 h ocioso e 3,5 h sem posição.', { ...base, pergunta: 'E o trator 24?' })).toEqual([]);
    expect(conferirResposta('O trator 22 ficou 5,8 h ligado hoje.', { ...base, pergunta: 'E o trator 22?' })).not.toEqual([]);
  });

  it('pergunta de continuação vale para a máquina de que a conversa falava', () => {
    const contexto = 'Como foi o trator 24 hoje?\nO 8270R - 24 ficou 5,8 h ligado.';
    expect(conferirResposta('São 5,8 h de motor ligado, com 3,5 h sem posição.', { ...base, pergunta: 'Esses dados de horas, qual a diferença?', contexto })).toEqual([]);
    expect(conferirResposta('São 5,8 h de motor ligado.', { ...base, pergunta: 'Esses dados de horas, qual a diferença?' })).not.toEqual([]);
  });

  it('repetir o número que a pessoa escreveu é permitido; outro número continua barrado', () => {
    expect(conferirResposta('Não encontrei 7,3 L nos dados.', { ...base, pergunta: 'E os 7,3 L?', ditoPelaPessoa: ['E os 7,3 L?'] })).toEqual([]);
    expect(conferirResposta('Foram 9,9 L.', { ...base, pergunta: 'E os 7,3 L?', ditoPelaPessoa: ['E os 7,3 L?'] })).not.toEqual([]);
  });
});
