import { Test } from '@nestjs/testing';
import { PlanosRepository } from '../planos/planos.repository.js';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { FakeProvedor } from '@talhio/deere';
import type { Mensagem } from '@talhio/shared';
import { gerarHash } from '../auth/senha.js';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { combustivelImportado, usuarios } from '../banco/schema.js';
import { ConsumoDeereRepository } from '../integracoes/deere/consumo-deere.repository.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { PainelService } from '../painel/painel.service.js';
import { RelatoriosService } from '../relatorios/relatorios.service.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { EscalaService } from '../escala/escala.service.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { AssistenteService, SO_O_CONFIRMADO } from './assistente.service.js';
import { ConversasRepository } from './conversas.repository.js';
import { CortaSugestoes, separarSugestoes } from './instrucoes.js';
import { IaDesligada, IaIndisponivel, MODELO_IA, type ModeloIa } from './modelo-ia.js';

const AGORA = new Date('2026-11-10T15:00:00.000Z');
const ANA = { orgId: 'org-demo', usuarioId: 'u-ana' };
const BETO = { orgId: 'org-demo', usuarioId: 'u-beto' };

async function montar(ia: ModeloIa, preparar?: (banco: Banco) => Promise<void>) {
  const banco: Banco = await criarBancoDeTeste();
  await preparar?.(banco);
  const senhaHash = await gerarHash('qualquer-senha');
  await banco.insert(usuarios).values([
    { id: ANA.usuarioId, orgId: 'org-demo', nome: 'Ana', email: 'ana@teste.com', senhaHash },
    { id: BETO.usuarioId, orgId: 'org-demo', nome: 'Beto', email: 'beto@teste.com', senhaHash },
  ]);
  const modulo = await Test.createTestingModule({
    providers: [
      AssistenteService, ConversasRepository, ConsumoDeereRepository, EscalaService, PainelService, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, EscalaRepository, RelatoriosService, PlanosRepository,
      { provide: BANCO, useValue: banco },
      { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) },
      { provide: MODELO_IA, useValue: ia },
    ],
  }).compile();
  return modulo.get(AssistenteService);
}

/** IA de mentira: guarda o que recebeu e responde com um texto numerado. */
function iaDeTeste() {
  const visto: { instrucoes: string; conversa: Mensagem[] }[] = [];
  const ia: ModeloIa = {
    responder: async (instrucoes, conversa) => {
      visto.push({ instrucoes, conversa });
      return `Resposta ${visto.length}.\nSUGESTOES: Quem mais parou? | E na semana?`;
    },
  };
  return { ia, visto };
}

describe('ferramenta de relatório', () => {
  it('o modelo consulta outro período e recebe os números do servidor, só da própria organização', async () => {
    let achado: unknown;
    let invalido: unknown;
    const ia: ModeloIa = {
      responder: async (_instrucoes, _conversa, ferramentas) => {
        achado = await ferramentas?.consultarRelatorio({ periodo: 'mes', data: '2026-10-15' });
        invalido = await ferramentas?.consultarRelatorio({ periodo: 'ano' });
        return `Em outubro a fazenda fez ${String((achado as any).indicadores.areaHa.valor).replace('.', ',')} ha.`;
      },
    };
    const resposta = await (await montar(ia)).responder(ANA, null, 'Como foi outubro?', AGORA);
    expect(resposta.texto).toMatch(/^Em outubro a fazenda fez [\d,]+ ha\.$/);
    expect(achado).toMatchObject({ periodo: 'mes', inicio: '2026-10-01', fim: '2026-10-31' });
    expect(invalido).toMatchObject({ erro: expect.stringContaining('Pedido inválido') });
  });
});

describe('ferramentas de outras épocas', () => {
  it('histórico mensal: um mês por linha com os números da aba Relatórios, o total já somado e o detalhe do motor', async () => {
    let historico: any;
    let invalido: unknown;
    const ia: ModeloIa = {
      responder: async (_instrucoes, _conversa, ferramentas) => {
        historico = await ferramentas?.consultarHistoricoMensal?.({ meses: 3 });
        invalido = await ferramentas?.consultarHistoricoMensal?.({ meses: 99 });
        return 'ok';
      },
    };
    const fake = new FakeProvedor(() => AGORA);
    const [primeira] = await fake.listarMaquinas();
    const linha = (dia: string, litros: number, horasMotor: number) => ({ orgId: 'org-demo', maquinaId: primeira!.id, dia, litros, horasMotor, litrosTrabalhando: litros - 10, litrosOcioso: 10, litrosTransporte: 0, horasTrabalhando: horasMotor - 1, horasOcioso: 1, horasTransporte: 0, fonte: 'api' });
    const service = await montar(ia, async (banco) => {
      await banco.insert(combustivelImportado).values([linha('2026-08-15', 9999, 10), linha('2026-10-02', 440, 20), linha('2026-10-03', 60, 5)]);
    });
    await service.responder(ANA, null, 'Como foi o ano?', AGORA);

    // 3 meses contando novembro, do dia 1 ao último dia; o atual vai até hoje.
    expect(historico.desde).toBe('2026-09-01');
    expect(historico.meses.map((m: any) => [m.mes, m.de, m.ate, m.emAndamento])).toEqual([
      ['2026-09', '2026-09-01', '2026-09-30', false],
      ['2026-10', '2026-10-01', '2026-10-31', false],
      ['2026-11', '2026-11-01', '2026-11-10', true],
    ]);
    // Cada mês é o relatório mensal da tela: os mesmos números de RelatoriosService.
    const relatorios = service['relatorios'];
    const outubro = await relatorios.montar('org-demo', 'mes', '2026-10-31', AGORA);
    expect(historico.meses[1]).toMatchObject({ areaHa: outubro.indicadores.areaHa.valor, horas: outubro.indicadores.horas.valor, litros: outubro.indicadores.litros.valor, paradoMin: outubro.indicadores.paradoMin.valor });
    expect(historico.meses[1].porMaquina.map((m: any) => [m.nome, m.areaHa])).toEqual(outubro.porMaquina.map((m) => [m.nome, m.areaHa]));
    expect(outubro.indicadores.areaHa.valor).toBeGreaterThan(0);
    // O total do período vem somado do servidor.
    const soma = (campo: string) => Math.round(historico.meses.reduce((t: number, m: any) => t + m[campo], 0) * 10) / 10;
    expect(historico.total).toMatchObject({ meses: 3, areaHa: soma('areaHa'), horas: soma('horas') });
    // Detalhe do motor só no mês que tem leitura guardada; nos outros é nulo, não zero.
    expect(historico.meses[1].motorPorEstado).toEqual({ litrosTrabalhando: 480, litrosOcioso: 20, litrosTransporte: 0, horasTrabalhando: 23, horasOcioso: 2, horasTransporte: 0 });
    expect(historico.meses[0].motorPorEstado).toBeNull();
    expect(invalido).toMatchObject({ erro: expect.stringContaining('Pedido inválido') });
  }, 60_000);

  it('relatório só de algumas máquinas e análise de uma máquina, sempre da própria organização', async () => {
    let soUma: any;
    let analise: any;
    let deOutra: unknown;
    const ia: ModeloIa = {
      responder: async (instrucoes, _conversa, ferramentas) => {
        const id = /"id":"([^"]+)"/.exec(instrucoes.slice(instrucoes.indexOf('"maquinas"')))![1]!;
        soUma = await ferramentas?.consultarRelatorio({ periodo: 'mes', data: '2026-10-15', maquinas: [id] });
        analise = await ferramentas?.consultarAnaliseDaMaquina?.({ maquina: id, de: '2026-10-01', ate: '2026-10-20' });
        deOutra = await ferramentas?.consultarAnaliseDaMaquina?.({ maquina: id, de: 'ontem' });
        return 'ok';
      },
    };
    await (await montar(ia)).responder(ANA, null, 'Como foi o trator em outubro?', AGORA);
    expect(soUma).toMatchObject({ periodo: 'mes', inicio: '2026-10-01', fim: '2026-10-31' });
    expect(soUma.soMaquinas).toHaveLength(1);
    expect(analise).toMatchObject({ de: '2026-10-01', ate: '2026-10-20' });
    expect(deOutra).toMatchObject({ erro: expect.stringContaining('Pedido inválido') });
  });

  it('as instruções pedem resposta organizada (frase, tabela, tópicos) e mandam consultar outras épocas', async () => {
    const { ia, visto } = iaDeTeste();
    await (await montar(ia)).responder(ANA, null, 'Oi', AGORA);
    const instrucoes = visto[0]!.instrucoes;
    for (const trecho of ['consultar_historico_mensal', 'consultar_analise_da_maquina', '**negrito**', 'tabela', '"## "', 'Nunca invente', 'CONSULTE ANTES DE ESCREVER', 'Respostas anteriores da conversa não são fonte', 'ferramenta calcular', 'Pode interpretar']) expect(instrucoes).toContain(trecho);
    expect(instrucoes).not.toContain('Sem markdown');
  });
});

describe('AssistenteService', () => {
  it('entrega ao modelo os números já calculados e separa as sugestões', async () => {
    const { ia, visto } = iaDeTeste();
    const resposta = await (await montar(ia)).responder(ANA, null, 'Quanto fizemos hoje?', AGORA);

    expect(resposta).toMatchObject({ texto: 'Resposta 1.', sugestoes: ['Quem mais parou?', 'E na semana?'] });
    expect(visto[0]!.conversa).toEqual([{ papel: 'usuario', texto: 'Quanto fizemos hoje?' }]);
    // O total do dia (342 ha) e a máquina parada vêm do relatório, não do modelo.
    expect(visto[0]!.instrucoes).toContain('"areaHa":{"valor":342');
    expect(visto[0]!.instrucoes).toContain('Trator 6M 195');
    // Contornos, coordenadas e número de série não vão para a IA.
    expect(visto[0]!.instrucoes).not.toContain('"contorno"');
    expect(visto[0]!.instrucoes).not.toContain('"posicao"');
    expect(visto[0]!.instrucoes).not.toContain('1RW8410RJPD012345');
  });

  it('guarda a conversa e usa o histórico do banco na pergunta seguinte', async () => {
    const { ia, visto } = iaDeTeste();
    const service = await montar(ia);
    const primeira = await service.responder(ANA, null, 'Quanto fizemos hoje?', AGORA);
    const segunda = await service.responder(ANA, primeira.conversaId, 'E ontem?', AGORA);

    expect(segunda.conversaId).toBe(primeira.conversaId);
    expect(visto[1]!.conversa).toEqual([
      { papel: 'usuario', texto: 'Quanto fizemos hoje?' },
      { papel: 'assistente', texto: 'Resposta 1.' },
      { papel: 'usuario', texto: 'E ontem?' },
    ]);
    const conversa = await service.abrirConversa(ANA, primeira.conversaId);
    expect(conversa.titulo).toBe('Quanto fizemos hoje?');
    expect(conversa.mensagens.map((m) => m.texto)).toEqual(['Quanto fizemos hoje?', 'Resposta 1.', 'E ontem?', 'Resposta 2.']);
  });

  it('lista da mais recente para a mais antiga e encurta títulos longos', async () => {
    const service = await montar(iaDeTeste().ia);
    const a = await service.responder(ANA, null, 'Primeira conversa', AGORA);
    await service.responder(ANA, null, 'x'.repeat(200), AGORA);
    await service.responder(ANA, a.conversaId, 'Voltei na primeira', AGORA);

    const lista = (await service.listarConversas(ANA)).conversas;
    expect(lista.map((c) => c.id)[0]).toBe(a.conversaId);
    expect(lista).toHaveLength(2);
    expect(lista[1]!.titulo).toHaveLength(60);
    expect(lista[1]!.titulo.endsWith('…')).toBe(true);
  });

  it('a conversa é só de quem perguntou: outro usuário da mesma fazenda não lê, continua nem apaga', async () => {
    const service = await montar(iaDeTeste().ia);
    const { conversaId } = await service.responder(ANA, null, 'Assunto da Ana', AGORA);

    expect((await service.listarConversas(BETO)).conversas).toEqual([]);
    await expect(service.abrirConversa(BETO, conversaId)).rejects.toMatchObject({ status: 404 });
    await expect(service.responder(BETO, conversaId, 'Intruso', AGORA)).rejects.toMatchObject({ status: 404 });
    await expect(service.apagarConversa(BETO, conversaId)).rejects.toMatchObject({ status: 404 });
    expect((await service.abrirConversa(ANA, conversaId)).mensagens).toHaveLength(2);
  });

  it('apagar remove a conversa e as mensagens', async () => {
    const service = await montar(iaDeTeste().ia);
    const { conversaId } = await service.responder(ANA, null, 'Vou apagar', AGORA);
    await service.apagarConversa(ANA, conversaId);
    expect((await service.listarConversas(ANA)).conversas).toEqual([]);
    await expect(service.abrirConversa(ANA, conversaId)).rejects.toMatchObject({ status: 404, response: { codigo: 'CONVERSA_NAO_ENCONTRADA' } });
  });

  it('quando a IA falha nada é gravado, e o erro do fornecedor não vaza', async () => {
    const desligada = await montar(new IaDesligada());
    await expect(desligada.responder(ANA, null, 'Oi', AGORA)).rejects.toMatchObject({ status: 503, response: { codigo: 'IA_NAO_CONFIGURADA' } });
    expect((await desligada.listarConversas(ANA)).conversas).toEqual([]);

    const quebrada = await montar({ responder: () => Promise.reject(new IaIndisponivel('Anthropic respondeu 401: chave sk-ant-xxxx inválida')) });
    const erro = await quebrada.responder(ANA, null, 'Oi', AGORA).catch((e) => e);
    expect(erro.status).toBe(502);
    expect(JSON.stringify(erro.getResponse())).not.toContain('sk-ant');
    expect((await quebrada.listarConversas(ANA)).conversas).toEqual([]);
  });

  it.each([['chave', 'ANTHROPIC_API_KEY'], ['credito', 'sem crédito'], ['modelo', 'ANTHROPIC_MODELO']] as const)('falha por %s diz o que conferir', async (motivo, trecho) => {
    const service = await montar({ responder: () => Promise.reject(new IaIndisponivel('x', motivo)) });
    const falha = await service.responder(ANA, null, 'Oi', AGORA).catch((e) => e);
    expect(falha.getResponse()).toMatchObject({ codigo: `IA_${motivo.toUpperCase()}` });
    expect(falha.getResponse().mensagem).toContain(trecho);
  });
});

describe('paginação do assistente', () => {
  it('abre só o fim da conversa e busca o que vem antes aos poucos', async () => {
    let n = 0;
    const service = await montar({ responder: () => Promise.resolve(`resposta ${++n}`) });
    let conversaId: string | null = null;
    for (let i = 1; i <= 6; i++) conversaId = (await service.responder(ANA, conversaId, `pergunta ${i}`, AGORA)).conversaId;

    // 12 mensagens (0 a 11). O fim: as 4 últimas.
    const fim = await service.abrirConversa(ANA, conversaId!, { limite: 4 });
    expect(fim.mensagens.map((m) => m.texto)).toEqual(['pergunta 5', 'resposta 5', 'pergunta 6', 'resposta 6']);
    expect(fim.primeiraOrdem).toBe(8);
    const antes = await service.abrirConversa(ANA, conversaId!, { limite: 4, antes: fim.primeiraOrdem });
    expect(antes.mensagens.map((m) => m.texto)).toEqual(['pergunta 3', 'resposta 3', 'pergunta 4', 'resposta 4']);
    const comeco = await service.abrirConversa(ANA, conversaId!, { limite: 50, antes: antes.primeiraOrdem });
    expect(comeco.mensagens).toHaveLength(4);
    expect(comeco.primeiraOrdem).toBe(0);
  });

  it('lista as conversas em páginas de 20, sem repetir nem pular', async () => {
    const service = await montar({ responder: () => Promise.resolve('ok') });
    for (let i = 1; i <= 23; i++) await service.responder(ANA, null, `conversa ${i}`, AGORA);
    const primeira = await service.listarConversas(ANA);
    expect(primeira.conversas).toHaveLength(20);
    expect(primeira.proximo).toBe(20);
    const segunda = await service.listarConversas(ANA, primeira.proximo!);
    expect(segunda.conversas).toHaveLength(3);
    expect(segunda.proximo).toBeNull();
    expect(new Set([...primeira.conversas, ...segunda.conversas].map((c) => c.id)).size).toBe(23);
  }, 20_000);
});

describe('separarSugestoes', () => {
  it('lida com resposta sem sugestões, com lista e com excesso', () => {
    expect(separarSugestoes('Só o texto.')).toEqual({ texto: 'Só o texto.', sugestoes: [], atalhos: [] });
    expect(separarSugestoes('Texto.\n\nSUGESTOES: a | b | c | d').sugestoes).toEqual(['a', 'b', 'c']);
    expect(separarSugestoes('Texto.\nSUGESTOES:\n- um\n- dois').sugestoes).toEqual(['um', 'dois']);
  });
});

describe('conferência dos números', () => {
  it('número sem fonte não chega ao app: o modelo responde de novo e só a resposta conferida é mostrada e guardada', async () => {
    const recebido: Mensagem[][] = [];
    const ia: ModeloIa = {
      responder: async (_instrucoes, conversa) => {
        recebido.push(conversa);
        return recebido.length === 1 ? 'O total do ano foi 17.485 ha.\nSUGESTOES: E o mês?' : 'Hoje foram 342 ha.\nSUGESTOES: E a semana?';
      },
    };
    const servico = await montar(ia);
    const vistos: string[] = [];
    const r = await servico.responderEmFluxo(ANA, null, 'Quanto fizemos no ano?', (t) => vistos.push(t), AGORA);
    expect(r).toMatchObject({ texto: 'Hoje foram 342 ha.', sugestoes: ['E a semana?'] });
    expect(vistos.join('')).toBe('Hoje foram 342 ha.');
    // A segunda chamada recebe a resposta barrada e a lista do que não tem fonte.
    expect(recebido).toHaveLength(2);
    expect(recebido[1]!.at(-1)!.texto).toContain('17.485 ha');
    // Só a pergunta e a resposta conferida ficam na conversa.
    expect((await servico.abrirConversa(ANA, r.conversaId)).mensagens.map((m) => m.texto)).toEqual(['Quanto fizemos no ano?', 'Hoje foram 342 ha.']);
  });

  it('número real dado à máquina errada, ou ao período errado, também é barrado', async () => {
    const tentativas: string[] = [];
    const ia: ModeloIa = {
      responder: async (_instrucoes, _conversa, ferramentas) => {
        const outubro: any = await ferramentas?.consultarRelatorio({ periodo: 'mes', data: '2026-10-15' });
        const [a, b] = outubro.porMaquina.filter((m: any) => m.horas > 0);
        const horas = (n: number) => String(n).replace('.', ',');
        // 1ª: as horas de uma máquina com o nome da outra. 2ª: o número de outubro dito como de hoje. As duas são barradas.
        const texto = tentativas.length === 0 ? `Em outubro o ${b.nome} trabalhou ${horas(a.horas)} h.` : `Hoje o ${a.nome} trabalhou ${horas(a.horas)} h.`;
        expect(a.horas).not.toBe(b.horas);
        tentativas.push(texto);
        return texto;
      },
    };
    const r = await (await montar(ia)).responder(ANA, null, 'Quanto cada máquina trabalhou?', AGORA);
    expect(tentativas).toHaveLength(2);
    expect(r.texto.startsWith(SO_O_CONFIRMADO)).toBe(true);
  });

  it('se a segunda resposta também inventa, nenhuma é mostrada', async () => {
    const ia: ModeloIa = { responder: async () => 'Foram 17.485 ha no ano e 4.470 ha em novembro.' };
    const servico = await montar(ia);
    const vistos: string[] = [];
    const r = await servico.responderEmFluxo(ANA, null, 'Quanto fizemos no ano?', (t) => vistos.push(t), AGORA);
    expect(r.texto.startsWith(SO_O_CONFIRMADO)).toBe(true);
    expect(vistos.join('')).toBe(r.texto);
    expect(vistos.join('')).not.toContain('17.485');
  });

  it('número que veio de uma consulta desta resposta tem fonte, e a variação em % chega pronta', async () => {
    let outubro: any;
    const ia: ModeloIa = {
      responder: async (instrucoes, _conversa, ferramentas) => {
        outubro = await ferramentas?.consultarRelatorio({ periodo: 'mes', data: '2026-10-15' });
        expect(instrucoes).toContain('"variacaoPct"');
        const area = outubro.indicadores.areaHa;
        return `Outubro teve ${String(area.valor).replace('.', ',')} ha (${area.variacaoPct}% contra o mês anterior).`;
      },
    };
    const r = await (await montar(ia)).responder(ANA, null, 'Como foi outubro?', AGORA);
    expect(outubro.indicadores.areaHa).toHaveProperty('diferenca');
    expect(r.texto).toContain('Outubro teve');
  });
});

describe('contas da IA', () => {
  it('a conta é feita no servidor, com números dos dados e o preço que a pessoa informou, e o resultado vale na resposta', async () => {
    let custo: any;
    let media: any;
    let inventada: any;
    const ia: ModeloIa = {
      responder: async (_instrucoes, _conversa, ferramentas) => {
        const outubro: any = await ferramentas?.consultarRelatorio({ periodo: 'mes', data: '2026-10-15' });
        const [a, b] = outubro.porMaquina.filter((m: any) => m.horas > 0);
        custo = await ferramentas?.calcular?.({ expressao: `${a.horas} * 6.2`, descricao: 'horas vezes o preço informado', unidade: 'R$' });
        media = await ferramentas?.calcular?.({ expressao: `(${a.horas} + ${b.horas}) / 2`, descricao: 'média de horas das duas máquinas', unidade: 'h' });
        // Operando que não está em lugar nenhum: a conta é recusada.
        inventada = await ferramentas?.calcular?.({ expressao: '98765 * 2', descricao: 'número inventado' });
        const br = (n: number) => String(n).replace('.', ',');
        return `Em outubro, a R$ 6,20 por hora que você informou, o ${a.nome} custou R$ ${br(custo.resultado)}. A média das duas máquinas foi ${br(media.resultado)} h.`;
      },
    };
    const r = await (await montar(ia)).responder(ANA, null, 'Quanto custou outubro a R$ 6,20 por hora?', AGORA);
    expect(custo.resultado).toBeGreaterThan(0);
    expect(media).toMatchObject({ unidade: 'h' });
    expect(inventada).toMatchObject({ erro: expect.stringContaining('98765') });
    expect(r.texto).toContain('A média das duas máquinas foi');
  });

  it('conta de cabeça (sem a ferramenta) continua barrada', async () => {
    const ia: ModeloIa = { responder: async () => 'Somando tudo, a fazenda fez 123.456 ha.' };
    const r = await (await montar(ia)).responder(ANA, null, 'Quanto no total?', AGORA);
    expect(r.texto.startsWith(SO_O_CONFIRMADO)).toBe(true);
    expect(r.texto).not.toContain('123.456');
  });
});

describe('resposta em fluxo', () => {
  it('o texto chega em pedaços, sem as sugestões, só depois de conferido, e a conversa guarda o texto inteiro', async () => {
    const texto = 'Hoje foram **342 ha** no total.\n\n- Tudo dentro do esperado.';
    const ia: ModeloIa = { responder: async () => `${texto}\nSUGESTOES: Quem parou? | E a semana?` };
    const servico = await montar(ia);
    const vistos: string[] = [];
    const r = await servico.responderEmFluxo(ANA, null, 'Como foi hoje?', (t) => vistos.push(t), AGORA);
    expect(vistos.join('')).toBe(texto);
    expect(vistos.length).toBeGreaterThan(1);
    expect(r.texto).toBe(texto);
    expect(r.sugestoes).toEqual(['Quem parou?', 'E a semana?']);
    expect((await servico.abrirConversa(ANA, r.conversaId)).mensagens.at(-1)?.texto).toBe(texto);
  });

  it('em fluxo, cada linha sai assim que é conferida, antes de a resposta terminar', async () => {
    const linhas = ['Hoje a fazenda fez **342 ha**.\n', '\n', '- Tudo dentro do esperado.\n', 'SUGESTOES: E a semana?'];
    const vistos: string[] = [];
    let vistoAntesDoFim = '';
    const ia: ModeloIa = {
      responder: async () => linhas.join(''),
      transmitir: async (_i, _c, _f, aoTrecho) => {
        // O modelo manda em pedaços que não respeitam as linhas.
        for (const pedaco of linhas.join('').match(/.{1,7}/gs) ?? []) aoTrecho(pedaco);
        vistoAntesDoFim = vistos.join('');
        return linhas.join('');
      },
    };
    const r = await (await montar(ia)).responderEmFluxo(ANA, null, 'Como foi hoje?', (t) => vistos.push(t), AGORA);
    expect(vistoAntesDoFim).toContain('Hoje a fazenda fez **342 ha**.');
    expect(vistos.join('')).toBe(r.texto);
    expect(r.sugestoes).toEqual(['E a semana?']);
  });

  it('em fluxo, a linha com número sem fonte não sai, nem o que vem depois dela; o texto final é o conferido', async () => {
    const vistos: string[] = [];
    let chamadas = 0;
    const ia: ModeloIa = {
      responder: async () => (++chamadas, 'Hoje a fazenda fez 342 ha.'),
      transmitir: async (_i, _c, _f, aoTrecho) => {
        const texto = 'Hoje a fazenda fez 342 ha.\nNo ano foram 17.485 ha.\nE mais 99.999 L.\n';
        aoTrecho(texto);
        return texto;
      },
    };
    const r = await (await montar(ia)).responderEmFluxo(ANA, null, 'Como foi?', (t) => vistos.push(t), AGORA);
    expect(vistos.join('')).not.toContain('17.485');
    expect(vistos.join('')).not.toContain('99.999');
    expect(chamadas).toBe(1);
    expect(r.texto).toBe('Hoje a fazenda fez 342 ha.');
  });

  it('com uma IA que não transmite, entrega a resposta de uma vez', async () => {
    const { ia } = iaDeTeste();
    const servico = await montar(ia);
    const vistos: string[] = [];
    const r = await servico.responderEmFluxo(ANA, null, 'oi', (t) => vistos.push(t), AGORA);
    expect(vistos.join('')).toBe('Resposta 1.');
    expect(r.sugestoes).toHaveLength(2);
  });

  it('o filtro nunca solta pedaço da marca de sugestões', () => {
    const corte = new CortaSugestoes();
    const saida = 'Olá, tudo certo.SUGESTOES: a | b'.split('').map((c) => corte.empurrar(c)).join('') + corte.terminar();
    expect(saida).toBe('Olá, tudo certo.');
  });
});

describe('soOQueConfere', () => {
  it('tira só a linha sem fonte e o título que ficou vazio', async () => {
    const { soOQueConfere } = await import('./assistente.service.js');
    const conferir = (t: string) => (t.includes('999') ? ['999'] : []);
    expect(soOQueConfere('Certo: 10 ha.\n\n## Detalhe\nErrado: 999 ha.\n\n## Outro\nCerto de novo.', conferir)).toBe('Certo: 10 ha.\n\n## Outro\nCerto de novo.');
    expect(soOQueConfere('| Máquina | Horas |\n|---|---|\n| A | 999 |', conferir)).toBe('');
  });
});

describe('atalhos para as telas do aplicativo', () => {
  it('a linha ATALHOS vira botões de uma lista fixa e não aparece no texto', async () => {
    const { separarSugestoes, CortaSugestoes } = await import('./instrucoes.js');
    const { resolverAtalhos } = await import('./atalhos.js');
    const bruto = 'É você quem monta, na aba Escala.\nSUGESTOES: Quem está escalado hoje?\nATALHOS: escala | maquina: 8270R - 22 | https://site-de-fora.com | banco';
    const lido = separarSugestoes(bruto);
    expect(lido.texto).toBe('É você quem monta, na aba Escala.');
    expect(lido.sugestoes).toEqual(['Quem está escalado hoje?']);
    expect(resolverAtalhos(lido.atalhos, [{ id: 'm 1', nome: '8270R - 22' }])).toEqual([
      { rotulo: 'Abrir a Escala', rota: '/escala' },
      { rotulo: 'Ver 8270R - 22', rota: '/maquina/m%201' },
    ]);
    // Em fluxo, nada depois da primeira marca sai, mesmo se a ordem das duas linhas vier trocada.
    const corte = new CortaSugestoes();
    const saiu = corte.empurrar('Resposta.\nATALHOS: escala\nSUGESTOES: outra?') + corte.terminar();
    expect(saiu).toBe('Resposta.');
    expect(separarSugestoes('Resposta.\nATALHOS: escala\nSUGESTOES: outra?')).toEqual({ texto: 'Resposta.', sugestoes: ['outra?'], atalhos: ['escala'] });
  });

  it('a resposta guarda os botões e eles voltam ao reabrir a conversa', async () => {
    const ia: ModeloIa = { responder: async () => 'É você quem monta a escala, por turno.\nATALHOS: escala' };
    const servico = await montar(ia);
    const r = await servico.responder(ANA, null, 'Eu que defino o horário dele?', AGORA);
    expect(r.atalhos).toEqual([{ rotulo: 'Abrir a Escala', rota: '/escala' }]);
    expect(r.texto).not.toContain('ATALHOS');
    const aberta = await servico.abrirConversa(ANA, r.conversaId);
    expect(aberta.mensagens.at(-1)).toMatchObject({ papel: 'assistente', atalhos: [{ rota: '/escala' }] });
    expect(aberta.mensagens[0]!.atalhos).toBeUndefined();
  });
});
