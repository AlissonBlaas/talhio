import { strToU8, zipSync } from 'fflate';
import { DeereProvedor, areaDoCaminho, areasDoCaminho, capacidadeDoTanqueL, litrosPelaQuedaDoTanque, combustivelDaFrota, horasPorEstado, paradasDe, tanqueTravado, categoriaDe, lerExportacao, resumoDoExport, maquinaDe, maquinasDoMeta, motorLigadoDe, posicaoDe, talhaoDe } from '@talhio/deere';

/**
 * ATENÇÃO: as respostas abaixo seguem a documentação da John Deere, não o sandbox real.
 * Quando as chaves saírem, confira com respostas verdadeiras e ajuste estes exemplos.
 */
const BASE = 'https://sandboxapi.deere.com/platform';
const EQUIP = 'https://equipmentapi.deere.com/isg/equipment?organizationIds=111&categories=Machine&archived=false&itemLimit=100';

const quadrado = (lat: number, lon: number, lado = 0.01) => [
  { lat, lon },
  { lat, lon: lon + lado },
  { lat: lat + lado, lon: lon + lado },
  { lat: lat + lado, lon },
  { lat, lon },
];

function rede(rotas: Record<string, unknown | (() => Response)>) {
  const pedidos: string[] = [];
  const http = (async (url: string) => {
    pedidos.push(url);
    // Rota terminada em `*` casa pelo começo (para endereços com data).
    const rota = Object.entries(rotas).find(([caminho]) => {
      const inteiro = caminho.startsWith('http') ? caminho : `${BASE}${caminho}`;
      return inteiro.endsWith('*') ? url.startsWith(inteiro.slice(0, -1)) : url === inteiro;
    });
    if (!rota) return new Response('{}', { status: 404 });
    return typeof rota[1] === 'function' ? (rota[1] as () => Response)() : new Response(JSON.stringify(rota[1]), { status: 200 });
  }) as unknown as typeof fetch;
  const provedor = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined });
  return { provedor, pedidos };
}

describe('mapeadores', () => {
  it('classifica o tipo da máquina', () => {
    expect(categoriaDe('Sprayer')).toBe('sprayer');
    expect(categoriaDe('Combine Harvester')).toBe('combine');
    expect(categoriaDe('Tractor')).toBe('tractor');
    expect(categoriaDe(null)).toBe('tractor');
  });

  it('lê o equipamento e usa o modelo quando não há nome', () => {
    expect(maquinaDe({ id: 7, name: 'Trator 8R', type: { name: 'Tractor' }, model: { name: '8R 410' }, serialNumber: 'ABC', modelYear: '2023' })).toMatchObject({
      id: '7', nome: 'Trator 8R', categoria: 'tractor', modelo: '8R 410', numeroSerie: 'ABC', ano: 2023,
    });
    expect(maquinaDe({ id: 8, model: { name: 'S780' } }).nome).toBe('S780');
  });

  it('monta o talhão com o anel externo fechado e a área convertida', () => {
    const t = talhaoDe(
      { id: 1, name: 'T1' },
      { area: { valueAsDouble: 100, unit: 'ac' }, multipolygons: [{ rings: [{ type: 'interior', points: quadrado(-20.001, -50.001, 0.001) }, { type: 'exterior', points: quadrado(-20, -50) }] }] },
    );
    expect(t?.areaHa).toBe(40.5);
    expect(t?.contorno[0]).toEqual([-50, -20]);
    expect(t?.contorno.at(-1)).toEqual(t?.contorno[0]);
  });

  it('calcula a área quando a Deere não informa, e descarta talhão sem contorno', () => {
    const t = talhaoDe({ id: 1 }, { multipolygons: [{ rings: [{ type: 'exterior', points: quadrado(-20, -50) }] }] });
    expect(t?.areaHa).toBeGreaterThan(100);
    expect(t?.areaHa).toBeLessThan(130);
    expect(talhaoDe({ id: 2 }, { multipolygons: [] })).toBeNull();
    expect(talhaoDe({ id: 3 }, undefined)).toBeNull();
  });

  it('pega a posição mais recente e o estado do motor mais recente', () => {
    const p = posicaoDe(
      'm1',
      [
        { eventTimestamp: '2026-11-10T10:00:00Z', point: { lat: 1, lon: 2 }, speed: 7 },
        { eventTimestamp: '2026-11-10T12:00:00Z', point: { lat: 3, lon: 4 }, speed: 0 },
      ],
      [{ eventTimestamp: '2026-11-10T11:00:00Z', engineRunning: false }, { eventTimestamp: '2026-11-10T12:00:00Z', engineRunning: true }],
    );
    expect(p).toMatchObject({ lat: 3, lng: 4, motorLigado: true, velocidadeKmH: 0, registradaEm: '2026-11-10T12:00:00.000Z', paradaDesde: '2026-11-10T12:00:00.000Z' });
    expect(posicaoDe('m1', [], [])).toBeNull();
    expect(motorLigadoDe({ engineState: 'ON' })).toBe(true);
    expect(motorLigadoDe(undefined)).toBe(false);
  });
});

describe('DeereProvedor', () => {
  it('lista as máquinas da organização escolhida, seguindo as páginas', async () => {
    const { provedor, pedidos } = rede({
      [EQUIP]: { values: [{ principalId: 1, isoName: 'Trator A', name: 'SERIE1', type: { name: 'Tractor' }, telematicsCapable: true }], links: [{ rel: 'nextPage', uri: `${EQUIP}&pageOffset=100` }] },
      [`${EQUIP}&pageOffset=100`]: { values: { principalId: 2, name: 'B', type: { name: 'Sprayer' }, telematicsCapable: false } },
    });
    const maquinas = await provedor.listarMaquinas('org-a');
    expect(maquinas.map((m) => [m.id, m.nome, m.categoria, m.telemetriaAtiva])).toEqual([['1', 'Trator A', 'tractor', true], ['2', 'B', 'sprayer', false]]);
    expect(pedidos).toHaveLength(2);
  });

  it('talhão de teste com área zero não entra (o app recusaria a lista inteira)', () => {
    const minusculo = { active: true, area: { valueAsDouble: 0, unit: 'ha' }, multipolygons: [{ rings: [{ type: 'exterior', points: [{ lat: -31, lon: -52 }, { lat: -31, lon: -51.99999 }, { lat: -30.99999, lon: -51.99999 }, { lat: -31, lon: -52 }] }] }] };
    expect(talhaoDe({ id: 1, name: 'Desktop' }, minusculo)).toBeNull();
    // Área informada zerada, mas contorno de verdade: vale a área calculada.
    const real = { active: true, area: { valueAsDouble: 0, unit: 'ha' }, multipolygons: [{ rings: [{ type: 'exterior', points: quadrado(-20, -50) }] }] };
    expect(talhaoDe({ id: 2, name: 'Real' }, real)?.areaHa).toBeGreaterThan(0);
  });

  it('lista talhões com contorno e ignora arquivados e sem limite', async () => {
    const { provedor } = rede({
      '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 1, name: 'T1' }, { id: 2, name: 'Velho', archived: true }, { id: 3, name: 'SemLimite' }] },
      '/organizations/111/fields/1/boundaries': { values: [{ active: true, multipolygons: [{ rings: [{ type: 'exterior', points: quadrado(-20, -50) }] }] }] },
      '/organizations/111/fields/3/boundaries': { values: [] },
    });
    const talhoes = await provedor.listarTalhoes('org-a');
    expect(talhoes.map((t) => t.id)).toEqual(['1']);
  });

  it('devolve a posição e o horímetro; sem dado, nulo', async () => {
    const { provedor } = rede({
      '/machines/m1/breadcrumbs?lastKnown=true': { values: [{ eventTimestamp: '2026-11-10T12:00:00Z', point: { lat: 3, lon: 4 }, speed: { valueAsDouble: 12, unit: 'km1hr-1' }, fuelLevel: { valueAsDouble: 62, unit: 'prcnt' } }] },
      '/machines/m1/deviceStateReports?startDate=*': { values: [{ time: '2026-11-10T11:00:00Z', engineState: 0 }, { time: '2026-11-10T12:00:00Z', engineState: 1 }] },
      '/machines/m1/engineHours?lastKnown=true': { values: [{ reading: { valueAsDouble: 1840.5 }, reportTime: '2026-11-10T12:00:00Z' }, { reading: { valueAsDouble: 1500 }, reportTime: '2026-11-01T12:00:00Z' }] },
    });
    expect(await provedor.ultimaPosicao('org-a', 'm1')).toMatchObject({ lat: 3, lng: 4, motorLigado: true });
    expect(await provedor.medicoes('org-a', 'm1')).toEqual({ horimetro: 1840.5, combustivelPct: 62, combustivelSuspeito: false });
    expect((await provedor.ultimaPosicao('org-a', 'm1'))?.velocidadeKmH).toBe(12);
    expect(await provedor.ultimaPosicao('org-a', 'sem-dados')).toBeNull();
  });

  it('máquina com acesso negado (403) para de ser consultada', async () => {
    const { provedor, pedidos } = rede({ '/machines/m9/breadcrumbs?lastKnown=true': () => new Response('{}', { status: 403 }) });
    expect(await provedor.ultimaPosicao('org-a', 'm9')).toBeNull();
    const depois = pedidos.length;
    expect(await provedor.medicoes('org-a', 'm9')).toEqual({ horimetro: null, combustivelPct: null, combustivelSuspeito: false });
    expect(await provedor.ultimaPosicao('org-a', 'm9')).toBeNull();
    expect(pedidos.filter((u) => u.includes('engineHours'))).toHaveLength(0);
    expect(pedidos.length - depois).toBeLessThanOrEqual(1);
  });

  it('monta o caminho de hoje em trechos, partindo quando o sinal some', async () => {
    const t0 = Date.now() - 60 * 60_000;
    const em = (min: number) => new Date(t0 + min * 60_000).toISOString();
    const { provedor } = rede({
      '/machines/m1/breadcrumbs?startDate=*': {
        values: [
          { eventTimestamp: em(0), point: { lat: -31.0, lon: -52.0 } },
          { eventTimestamp: em(1), point: { lat: -31.0005, lon: -52.0 } },
          { eventTimestamp: em(2), point: { lat: -31.001, lon: -52.0 } },
          // 20 min sem sinal: começa outro trecho
          { eventTimestamp: em(22), point: { lat: -31.002, lon: -52.0 } },
          { eventTimestamp: em(23), point: { lat: -31.0025, lon: -52.0 } },
        ],
      },
    });
    expect(await provedor.rastroDeHoje('org-a', 'm1')).toEqual([]); // primeira vez: não espera a Deere
    await new Promise((ok) => setTimeout(ok, 20));
    const trechos = await provedor.rastroDeHoje('org-a', 'm1');
    expect(trechos.map((t) => t.length)).toEqual([3, 2]);
    expect(trechos[0]![0]).toEqual([-52.0, -31.0]);
  });

  it('soma as horas trabalhando, ocioso e em transporte pela velocidade dos pontos', () => {
    const min = 60_000;
    const p = (t: number, kmh: number) => ({ t: t * min, lng: 0, lat: 0, kmh, estado: '1' });
    // 30 min a 6 km/h, 12 min parado, 18 min a 25 km/h, buraco de 40 min (não conta), 6 min a 6 km/h
    const pontos = [...Array.from({ length: 11 }, (_, i) => p(i * 3, 6)), ...Array.from({ length: 4 }, (_, i) => p(33 + i * 3, 0)), ...Array.from({ length: 6 }, (_, i) => p(45 + i * 3, 25)), p(63, 0), p(103, 6), p(106, 6), p(109, 6)];
    const h = horasPorEstado(pontos);
    expect(h.trabalhandoH).toBeCloseTo(0.7, 1); // 30 + 3 (até a parada) + 6 min
    expect(h.ociosoH).toBeCloseTo(0.2, 1);
    expect(h.transporteH).toBeCloseTo(0.3, 1);
  });

  it('estima os hectares pelo caminho dentro do talhão, com a largura da passada, sem passar da área', () => {
    // Talhão de ~1,1 km x ~0,95 km. Trator anda 1 km dentro (10 trechos de 100 m) e depois 1 km fora.
    const talhao = { id: 't1', nome: 'T1', areaHa: 100, cultura: null, contorno: [[-52, -31], [-51.99, -31], [-51.99, -30.99], [-52, -30.99], [-52, -31]] as [number, number][] };
    const passo = 100 / 111_320; // 100 m em graus de latitude
    const p = (i: number, lng: number) => ({ t: i * 30_000, lng, lat: -30.999 + i * passo, kmh: 12, estado: '1' });
    const dentro = Array.from({ length: 11 }, (_, i) => p(i, -51.995));
    expect(areaDoCaminho(dentro, [talhao])).toBe(1.2); // 1000 m x 12 m (padrão)
    expect(areaDoCaminho(dentro, [talhao], new Map([['t1', 6]]))).toBe(0.6); // largura tirada das linhas
    expect(areaDoCaminho(dentro, [{ ...talhao, areaHa: 0.5 }])).toBe(0.5); // não passa da área do talhão
    // Fora do talhão TAMBÉM conta: o talhão só separa o que foi dentro do que foi fora.
    const fora = Array.from({ length: 11 }, (_, i) => p(i, -51.9));
    expect(areasDoCaminho(fora, [talhao])).toEqual({ totalHa: 1.2, dentroHa: 0, foraHa: 1.2 });
    expect(areasDoCaminho([...dentro, ...fora.map((x) => ({ ...x, t: x.t + 3_600_000 }))], [talhao], new Map([['t1', 6]]))).toEqual({ totalHa: 1.2, dentroHa: 0.6, foraHa: 0.6 }); // fora usa a largura da fazenda (6 m)
  });

  it('a largura informada para a máquina vale no lugar da largura das linhas, dentro e fora do talhão', () => {
    const talhao = { id: 't1', nome: 'T1', areaHa: 100, cultura: null, contorno: [[-52, -31], [-51.99, -31], [-51.99, -30.99], [-52, -30.99], [-52, -31]] as [number, number][] };
    const passo = 100 / 111_320;
    const p = (i: number, lng: number) => ({ t: i * 30_000, lng, lat: -30.999 + i * passo, kmh: 12, estado: '1' });
    const dentro = Array.from({ length: 11 }, (_, i) => p(i, -51.995)); // 1 km dentro
    const fora = Array.from({ length: 11 }, (_, i) => p(i + 200, -51.9)); // 1 km fora
    const semLargura = areasDoCaminho(dentro, [talhao], new Map([['t1', 6]]));
    const comLargura = areasDoCaminho(dentro, [talhao], new Map([['t1', 6]]), 18);
    expect(semLargura).toMatchObject({ totalHa: 0.6, foraHa: 0 });
    expect(comLargura).toMatchObject({ totalHa: 1.8, foraHa: 0 }); // 1000 m x 18 m
    expect(areasDoCaminho(fora, [talhao], new Map([['t1', 6]]), 18)).toEqual({ totalHa: 1.8, dentroHa: 0, foraHa: 1.8 });
  });

  it('mede os litros gastos pela queda do nível do tanque, sem contar o abastecimento', () => {
    const p = (min: number, tanque: number | null, kmh = 6) => ({ t: min * 60_000, lng: 0, lat: 0, kmh, estado: '1', tanque });
    // 60% -> 50,5% (9,5%), abastece para 95%, cai para 90% (5%); a boia balançando 1% no minuto 61 entra na mediana: 14,5% de 680 L.
    const dia = [p(0, 60), p(30, 55), p(60, 50), p(61, 51), p(65, 95), p(90, 93), p(120, 90)];
    expect(litrosPelaQuedaDoTanque(dia, 680)).toBe(98.6);
    expect(litrosPelaQuedaDoTanque(dia, null)).toBeNull(); // modelo sem capacidade conhecida
    expect(litrosPelaQuedaDoTanque(Array.from({ length: 40 }, (_, i) => p(i * 3, 100)), 680)).toBeNull(); // boia travada em cheio
    expect(litrosPelaQuedaDoTanque(Array.from({ length: 10 }, (_, i) => p(i * 3, null)), 680)).toBeNull(); // sem leitura
    expect(capacidadeDoTanqueL('8270R')).toBe(680);
    expect(capacidadeDoTanqueL('6150j')).toBe(300);
    expect(capacidadeDoTanqueL('S550')).toBe(757);
    expect(capacidadeDoTanqueL('Modelo desconhecido')).toBeNull();
  });

  it('boia balançando o dia inteiro não vira consumo: vale a queda líquida do nível', () => {
    // Caso real de 12/11: 8270R trabalhando 9 h a uns 24 L/h (monitor), e o relatório dizia 85 L/h.
    // Uma leitura por minuto; o nível cai 32% no dia (216 L de 680) com a boia oscilando até 4% para cada lado.
    const oscilacao = [0, 3, -2, 4, -4, 1, -3, 2, -1, 4, -4, 0];
    const dia = Array.from({ length: 9 * 60 + 1 }, (_, min) => ({ t: min * 60_000, lng: 0, lat: 0, kmh: 6, estado: '1', tanque: 80 - (32 * min) / (9 * 60) + oscilacao[min % oscilacao.length]! }));
    const litros = litrosPelaQuedaDoTanque(dia, 680)!;
    expect(litros).toBeGreaterThan(200);
    expect(litros).toBeLessThan(235);
    expect(litros / 9).toBeLessThan(27); // perto dos 24 L/h do monitor, não 85
  });

  it('abastecimento no meio do dia separa os trechos, e inclinação de até 9% não é abastecimento', () => {
    const p = (min: number, tanque: number) => ({ t: min * 60_000, lng: 0, lat: 0, kmh: 6, estado: '1', tanque });
    // 70% -> 50% em 4 h, abastece para 98%, cai para 86% em 3 h: 32% de 680 L = 217,6 L.
    const manha = Array.from({ length: 241 }, (_, i) => p(i, 70 - (20 * i) / 240));
    const tarde = Array.from({ length: 181 }, (_, i) => p(250 + i, 98 - (12 * i) / 180));
    // A mediana de 5 min come uns 2 L nas pontas de cada trecho: fica um pouco abaixo, nunca acima.
    const comAbastecimento = litrosPelaQuedaDoTanque([...manha, ...tarde], 680)!;
    expect(comAbastecimento).toBeGreaterThan(212);
    expect(comAbastecimento).toBeLessThanOrEqual(217.6);
    // Trator inclinado por 20 min: a leitura sobe 8% e volta. Não pode contar como abastecer e gastar de novo.
    const inclinado = Array.from({ length: 241 }, (_, i) => p(i, 70 - (20 * i) / 240 + (i >= 100 && i < 120 ? 8 : 0)));
    const comInclinacao = litrosPelaQuedaDoTanque(inclinado, 680)!;
    expect(comInclinacao).toBeGreaterThan(132);
    expect(comInclinacao).toBeLessThanOrEqual(136);
  });

  it('consumo que nenhum motor alcança não vira número', () => {
    const p = (min: number, tanque: number) => ({ t: min * 60_000, lng: 0, lat: 0, kmh: 6, estado: '1', tanque });
    // 60% do tanque (408 L) em 1 hora: sensor com defeito, não consumo.
    expect(litrosPelaQuedaDoTanque(Array.from({ length: 61 }, (_, i) => p(i, 90 - i)), 680)).toBeNull();
  });

  it('tanque cheio há 1 h 30 de trabalho é leitura suspeita; se abasteceu há pouco, não', () => {
    const p = (min: number, tanque: number | null, kmh = 6) => ({ t: min * 60_000, lng: 0, lat: 0, kmh, estado: '1', tanque });
    expect(tanqueTravado(Array.from({ length: 40 }, (_, i) => p(i * 3, 100)))).toBe(true); // 117 min andando, sempre 100%
    expect(tanqueTravado(Array.from({ length: 20 }, (_, i) => p(i * 3, 100)))).toBe(false); // só 57 min
    expect(tanqueTravado([...Array.from({ length: 30 }, (_, i) => p(i * 3, 60)), ...Array.from({ length: 20 }, (_, i) => p(90 + i * 3, 100))])).toBe(false); // abasteceu há 1 h
    expect(tanqueTravado(Array.from({ length: 40 }, (_, i) => p(i * 3, 100, 0)))).toBe(false); // parado não conta
    expect(tanqueTravado(Array.from({ length: 40 }, (_, i) => p(i * 3, 72)))).toBe(false);
  });

  it('acha as paradas de 2 min ou mais ao longo do caminho', () => {
    const min = 60_000;
    const p = (t: number, kmh: number, lat = -31) => ({ t: t * min, lng: -52, lat, kmh, estado: '1' });
    const pontos = [
      p(0, 6, -31.0), p(1, 6, -31.001),
      p(2, 0, -31.002), p(3, 0, -31.002), p(7, 0, -31.002), // parou 6 min (até voltar a andar no minuto 8)
      p(8, 6, -31.003), p(9, 6, -31.004),
      p(10, 0, -31.005), p(11, 6, -31.006), // parada curta, de 1 min: entra também
      p(12, 6, -31.007), p(40, 6, -31.007), // 28 min sem sinal no mesmo lugar: entra
      p(41, 6, -31.008),
    ];
    const paradas = paradasDe(pontos);
    expect(paradas.map((x) => x.minutos)).toEqual([6, 1, 28]);
    expect(paradas[0]).toMatchObject({ lat: -31.002, lng: -52 });
  });

  it('lê os litros acumulados da frota (ISO 15143-3) por número de série', () => {
    const xml = `<Fleet><Links><Link><rel>self</rel><href>x</href></Link></Links>
      <Equipment><EquipmentHeader><SerialNumber>1RW8270RABC</SerialNumber><PIN>1RW8270RABC</PIN></EquipmentHeader><FuelUsed><FuelUnits>litre</FuelUnits><FuelConsumed>63119.5</FuelConsumed></FuelUsed></Equipment>
      <Equipment><EquipmentHeader><SerialNumber>SEMDADO</SerialNumber></EquipmentHeader></Equipment></Fleet>`;
    expect([...combustivelDaFrota(xml)]).toEqual([['1RW8270RABC', 63119.5]]);
  });

  it('tenta de novo em 429 e respeita o limite de tentativas', async () => {
    let n = 0;
    const { provedor } = rede({
      [EQUIP]: () => (++n < 3 ? new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }) : new Response(JSON.stringify({ values: [] }), { status: 200 })),
    });
    expect(await provedor.listarMaquinas('org-a')).toEqual([]);
    expect(n).toBe(3);

    n = -10;
    const outra = rede({ [EQUIP]: () => (++n < 99 ? new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }) : new Response('{}', { status: 200 })) });
    await expect(outra.provedor.listarMaquinas('org-a')).rejects.toMatchObject({ codigo: 'DEERE_LIMITE' });
  });

  it('traduz 403 com termos novos e 401 em códigos estáveis', async () => {
    const termos = rede({ [EQUIP]: () => new Response('{}', { status: 403, headers: { 'X-Deere-Terms-Location': 'https://x' } }) });
    await expect(termos.provedor.listarMaquinas('org-a')).rejects.toMatchObject({ codigo: 'DEERE_TERMOS' });
    const negado = rede({ [EQUIP]: () => new Response('{}', { status: 401 }) });
    await expect(negado.provedor.listarMaquinas('org-a')).rejects.toMatchObject({ codigo: 'DEERE_SEM_ACESSO' });
  });
});

describe('DeereProvedor: escrita', () => {
  function redeEscrita(existentes: unknown[] = []) {
    const envios: { url: string; corpo: any }[] = [];
    let n = 0;
    const http = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        envios.push({ url, corpo: JSON.parse(String(init.body)) });
        return new Response(null, { status: 201, headers: { Location: `${url}/novo-${++n}` } });
      }
      if (url === `${BASE}/organizations/111/fields`) return new Response(JSON.stringify({ values: existentes }), { status: 200 });
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
    const provedor = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined });
    return { provedor, envios };
  }
  const linha = { id: 'l1', nome: 'Reta 1', talhaoId: 'T1', a: [-50, -20] as [number, number], b: [-50, -19.99] as [number, number], padrao: false };

  it('envia a linha AB com os pontos A e B', async () => {
    const { provedor, envios } = redeEscrita();
    await provedor.enviarLinha('org', linha, 'k');
    expect(envios[0]!.url).toBe(`${BASE}/organizations/111/fields/T1/guidanceLines`);
    expect(envios[0]!.corpo).toMatchObject({ '@type': 'ABLine', name: 'Reta 1', aPoint: { lat: -20, lon: -50 }, bPoint: { lat: -19.99, lon: -50 } });
  });

  it('recusa linha curva e linha sem talhão', async () => {
    const { provedor, envios } = redeEscrita();
    await expect(provedor.enviarLinha('org', { ...linha, passadas: [[[-50, -20]]] }, 'k')).rejects.toThrow(/reta/);
    await expect(provedor.enviarLinha('org', { ...linha, talhaoId: null }, 'k')).rejects.toThrow(/talhão/);
    expect(envios).toHaveLength(0);
  });

  it('importa talhão novo com contorno fechado e a linha dele; reaproveita o que já existe', async () => {
    const { provedor, envios } = redeEscrita([{ id: 'X9', name: 'Existente' }]);
    const anel: [number, number][] = [[-50, -20], [-50, -19.9], [-49.9, -19.9]];
    await provedor.enviarFazendaParaDeere('org', {
      cliente: 'Granja',
      talhoes: [
        { id: 'a', nome: 'Novo', areaHa: 10, cultura: null, contorno: anel },
        { id: 'b', nome: 'existente', areaHa: 10, cultura: null, contorno: anel },
      ],
      linhas: [{ ...linha, talhaoId: 'a' }, { ...linha, id: 'l2', talhaoId: 'b' }],
    });
    const urls = envios.map((e) => e.url.replace(BASE, ''));
    expect(urls).toEqual([
      '/organizations/111/fields',
      '/organizations/111/fields/novo-1/boundaries',
      '/organizations/111/fields/novo-1/guidanceLines',
      '/organizations/111/fields/X9/guidanceLines',
    ]);
    expect(envios[0]!.corpo).toMatchObject({ name: 'Novo', farms: { farms: [{ name: 'Granja' }] } });
    const pontos = envios[1]!.corpo.multipolygons[0].rings[0].points;
    expect(pontos).toHaveLength(4);
    expect(pontos[0]).toEqual(pontos[3]);
  });
});

describe('DeereProvedor: operações de campo', () => {
  const campo = { id: 'T1', name: 'Talhão 1', boundaries: undefined };
  const op = {
    id: 'OP1',
    fieldOperationType: 'Seeding',
    startDate: '2026-11-10T11:00:00.000Z',
    endDate: '2026-11-10T21:00:00.000Z',
    fieldOperationMachines: [{ machineId: 637795, operators: [{ name: 'João' }] }],
  };
  const rotas = {
    '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [campo] },
    '/organizations/111/fields/T1/boundaries': { values: [{ active: true, area: { valueAsDouble: 100, unit: 'ha' }, multipolygons: [{ rings: [{ points: quadrado(-20, -50), type: 'exterior' }] }] }] },
    '/organizations/111/fields/T1/fieldOperations': { values: [op] },
    '/fieldOperations/OP1/measurementTypes': { values: [{ measurementName: 'SeedingRateTarget' }, { measurementName: 'SeedingRateResult' }] },
    '/fieldOperations/OP1/measurementTypes/SeedingRateResult': { measurementName: 'SeedingRateResult', area: { value: 40, unitId: 'ha' } },
    '/organizations/111': { name: 'Granja Boa Safra' },
    '/organizations/111/fields/T1/guidanceLines?embed=shapes': {
      values: [
        { '@type': 'ABLine', id: 'g1', name: 'Reta', aPoint: { lat: -20, lon: -50 }, bPoint: { lat: -19.9, lon: -50 } },
        { '@type': 'ABCurve', id: 'g2' }, // curva sem traçado: fica de fora
        { '@type': 'AdaptiveCurve', id: 'g3', name: 'Curva', shapes: [{ '@type': 'MultiPoint', points: [{ lat: -20, lon: -50 }, { lat: -20.001, lon: -50.001 }, { lat: -20.002, lon: -50.003 }] }] },
        { '@type': 'CircleTrack', id: 'g4' },
      ],
    },
  };

  it('soma área e horas da máquina no dia', async () => {
    const { provedor } = rede(rotas);
    expect(await provedor.atividadeNoDia('org', '637795', '2026-11-10')).toEqual({ horas: 10, areaHa: 40, combustivelL: 0, paradoMin: 0 });
    expect(await provedor.atividadeNoDia('org', '637795', '2026-11-12')).toMatchObject({ horas: 0, areaHa: 0 });
    expect(await provedor.atividadeNoDia('org', '999', '2026-11-10')).toMatchObject({ areaHa: 0 });
  });

  it('casa a máquina da operação pelo chassi quando o id dela é outro', async () => {
    const { provedor } = rede({
      ...rotas,
      [EQUIP]: { values: [{ principalId: '5001', name: 'Trator', serialNumber: '1rw8270rabc' }] },
      '/organizations/111/fields/T1/fieldOperations': { values: [{ ...op, fieldOperationMachines: [{ machineId: 637795, vin: '1RW8270RABC', operators: [{ name: 'João' }] }] }] },
    });
    expect(await provedor.atividadeNoDia('org', '5001', '2026-11-10')).toMatchObject({ horas: 10, areaHa: 40 });
  });

  it('reparte pelo tempo a operação que atravessa dois dias', async () => {
    const duas = { ...rotas, '/organizations/111/fields/T1/fieldOperations': { values: [{ ...op, startDate: '2026-11-10T12:00:00.000Z', endDate: '2026-11-11T12:00:00.000Z' }] } };
    const { provedor } = rede(duas);
    // 10/11 em -03:00 vai de 03:00Z do dia 10 a 03:00Z do dia 11: 15h das 24h da operação.
    const dia = await provedor.atividadeNoDia('org', '637795', '2026-11-10');
    expect(dia.horas).toBe(15);
    expect(dia.areaHa).toBe(25);
  });

  it('lê as linhas AB e ignora curvas', async () => {
    const { provedor } = rede(rotas);
    expect(await provedor.listarLinhas('org')).toEqual([
      { id: 'g1', nome: 'Reta', talhaoId: 'T1', a: [-50, -20], b: [-50, -19.9], padrao: false },
      { id: 'g3', nome: 'Curva', talhaoId: 'T1', a: [-50, -20], b: [-50.003, -20.002], padrao: false, passadas: [[[-50, -20], [-50.001, -20.001], [-50.003, -20.002]]] },
    ]);
  });

  it('resume o andamento por talhão com a operação recente', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-11T12:00:00Z') });
    try {
      const { provedor } = rede(rotas);
      const r = await provedor.resumoDaFazenda('org');
      expect(r.nome).toBe('Granja Boa Safra');
      expect(r.operacoesPorTalhao).toEqual({ T1: 'plantio' });
      expect(r.percentualPorTalhao.T1).toBeGreaterThan(0);
      expect(r.operacaoAtual?.nome).toBe('Plantio · Talhão 1');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DeereProvedor: sincronização do export', () => {
  // Monta um .dbf mínimo (dBase IV) com as colunas que a Deere documenta.
  function dbf(linhas: Record<string, string>[], colunas: [string, number][]): Uint8Array {
    const tam = 1 + colunas.reduce((t, [, n]) => t + n, 0);
    const cab = 32 + colunas.length * 32 + 1;
    const saida = new Uint8Array(cab + linhas.length * tam);
    const v = new DataView(saida.buffer);
    v.setUint32(4, linhas.length, true);
    v.setUint16(8, cab, true);
    v.setUint16(10, tam, true);
    colunas.forEach(([nome, n], i) => {
      saida.set(new TextEncoder().encode(nome), 32 + i * 32);
      saida[32 + i * 32 + 16] = n;
    });
    saida[cab - 1] = 0x0d;
    linhas.forEach((l, r) => {
      let p = cab + r * tam;
      saida[p++] = 0x20;
      for (const [nome, n] of colunas) {
        saida.set(new TextEncoder().encode((l[nome] ?? '').padEnd(n, ' ').slice(0, n)), p);
        p += n;
      }
    });
    return saida;
  }

  // 10 pontos a cada 1 s: 6 andando (3 m x 12 m, 0,01 L cada) e 4 parados.
  const pontos = Array.from({ length: 10 }, (_, i) => ({
    ISOTIME: new Date(Date.parse('2026-11-10T14:00:00Z') + i * 1000).toISOString(),
    DISTANCE: i < 6 ? '3' : '0',
    SWATHWIDTH: '12',
    FUEL: '0.01',
    VEHICLSPEED: i < 6 ? '10' : '0',
    MACHINE: '1',
  }));
  const zip = zipSync({
    'op.dbf': dbf(pontos, [['ISOTIME', 24], ['DISTANCE', 10], ['SWATHWIDTH', 10], ['FUEL', 10], ['VEHICLSPEED', 10], ['MACHINE', 4]]),
    'op.json': strToU8(JSON.stringify({ machines: [{ index: 1, machineId: '637795' }] })),
  });

  it('lê horas, combustível, parado e área do shapefile', () => {
    const [d] = lerExportacao(zip, null);
    expect(d).toMatchObject({ maquinaId: '637795', dia: '2026-11-10', combustivelL: 0.1, paradoMin: 0.1 });
    expect(d!.horas).toBeCloseTo(9 / 3600, 3);
    expect(d!.areaHa).toBeCloseTo((6 * 3 * 12) / 10_000, 4);
  });

  it('resume o export para o log: colunas e estatística do combustível, sem coordenadas', () => {
    const r = resumoDoExport(zip);
    expect(r).toContain('10 pontos');
    expect(r).toContain('colunas: ISOTIME,DISTANCE,SWATHWIDTH,FUEL,VEHICLSPEED,MACHINE');
    expect(r).toContain('FUEL: 10 valores, min 0.01, max 0.01, soma 0.1, só cresce: sim');
    expect(resumoDoExport(new Uint8Array([1, 2, 3]))).toContain('não consegui ler');
  });

  it('pede o export, espera ficar pronto, guarda e não relê a mesma versão', async () => {
    const guardado = new Map<string, { versao: string; dias: unknown[] }>();
    const armazem = {
      versoes: async () => new Map([...guardado].map(([k, v]) => [k, v.versao])),
      guardar: async (_o: string, op: string, versao: string, dias: unknown[]) => void guardado.set(op, { versao, dias }),
      buscar: async () => null,
    };
    let consultas = 0;
    const op = { id: 'OP1', fieldOperationType: 'Seeding', startDate: new Date().toISOString(), endDate: new Date().toISOString(), fieldOperationMachines: [{ machineId: 637795 }] };
    const http = (async (url: string, init?: RequestInit) => {
      const u = url.replace(BASE, '');
      if (init?.method === 'POST') return new Response(JSON.stringify({ id: 'REQ1' }), { status: 201 });
      if (u === '/organizations/111/fields?embed=boundaries&itemLimit=100') return new Response(JSON.stringify({ values: [campoX] }), { status: 200 });
      if (u.endsWith('/boundaries')) return new Response(JSON.stringify({ values: [{ active: true, multipolygons: [{ rings: [{ points: quadrado(-20, -50), type: 'exterior' }] }] }] }), { status: 200 });
      if (u.endsWith('/fieldOperations')) return new Response(JSON.stringify({ values: [op] }), { status: 200 });
      if (url.includes('/isg/operations/OP1/operationsExportRequests/REQ1')) {
        consultas++;
        return new Response(JSON.stringify(consultas < 2 ? { requestStatus: 'CREATED', files: [] } : { requestStatus: 'SUCCESSFUL', files: [{ presignedUri: 'https://arquivos.exemplo/a.zip' }] }), { status: 200 });
      }
      if (url === 'https://arquivos.exemplo/a.zip') return new Response(zip, { status: 200 });
      if (u.includes('/measurementTypes') && !u.includes('Result')) return new Response(JSON.stringify({ values: ['SeedingRateResult'] }), { status: 200 });
      if (u.includes('SeedingRateResult')) return new Response(JSON.stringify({ area: { value: 10, unitId: 'ha' } }), { status: 200 });
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
    const provedor = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, obterToken: async () => 't', obterOrganizacao: async () => '111', http, esperar: async () => undefined, armazem });

    expect(await provedor.sincronizar('org')).toEqual({ lidas: 0, esperando: 1, falhas: 0 });
    expect(await provedor.sincronizar('org')).toEqual({ lidas: 1, esperando: 0, falhas: 0 });
    const salvo = guardado.get('OP1')!.dias as { maquinaId: string; areaHa: number }[];
    expect(salvo[0]).toMatchObject({ maquinaId: '637795', areaHa: 10 }); // ajustada ao total oficial
    expect(await provedor.sincronizar('org')).toEqual({ lidas: 0, esperando: 0, falhas: 0 });
  });
});
const campoX = { id: 'T1', name: 'Talhão 1' };

describe('contornos, do jeito que a documentação da Deere descreve', () => {
  const desenho = { active: true, multipolygons: [{ rings: [{ type: 'exterior', points: quadrado(-20, -50) }] }] };

  it('lê os contornos que vêm junto da lista de talhões, sem pedir de novo', async () => {
    const { provedor, pedidos } = rede({ '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 'T1', name: 'Junto', boundaries: [desenho] }] } });
    expect(await provedor.listarTalhoes('org')).toHaveLength(1);
    expect(pedidos).toHaveLength(1);
  });

  it('usa a lista de contornos da organização, casando pelo link do talhão', async () => {
    const { provedor } = rede({
      '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 'ABC-1', name: 'Pela organização' }] },
      '/organizations/111/boundaries?itemLimit=100': { values: [{ ...desenho, links: [{ rel: 'field', uri: `${BASE}/organizations/111/fields/abc-1` }] }] },
    });
    expect((await provedor.listarTalhoes('org')).map((t) => t.nome)).toEqual(['Pela organização']);
  });

  it('segue o endereço que a Deere indica no talhão (talhão de outra organização)', async () => {
    const { provedor } = rede({
      '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 'T9', name: 'Compartilhado', links: [{ rel: 'boundaries', uri: `${BASE}/organizations/999/fields/T9/boundaries` }] }] },
      '/organizations/999/fields/T9/boundaries': { values: [desenho] },
    });
    expect((await provedor.listarTalhoes('org')).map((t) => t.nome)).toEqual(['Compartilhado']);
  });

  it('usa o link do contorno ativo que o talhão traz', async () => {
    const { provedor } = rede({
      '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 'T5', name: 'Ativo', links: [{ rel: 'activeBoundary', uri: `${BASE}/organizations/111/fields/T5 /boundaries/b1` }] }] },
      '/organizations/111/fields/T5/boundaries/b1': desenho,
    });
    expect((await provedor.listarTalhoes('org')).map((t) => t.nome)).toEqual(['Ativo']);
  });

  it('talhão sem contorno desenhado usa o contorno que a Deere gera pela operação mais recente', async () => {
    const { provedor } = rede({
      '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 'T7', name: 'Sem desenho' }] },
      '/organizations/111/fields/T7/fieldOperations': { values: [{ id: 'velha', endDate: '2025-01-01T00:00:00Z' }, { id: 'nova', endDate: '2026-11-01T00:00:00Z' }] },
      '/fieldOperations/nova/boundary': { '@type': 'Boundary', multipolygons: [{ rings: [{ type: 'exterior', points: quadrado(-20, -50) }] }] },
    });
    expect((await provedor.listarTalhoes('org')).map((t) => t.nome)).toEqual(['Sem desenho']);
  });

  it('por último pede também os contornos não ativos', async () => {
    const { provedor } = rede({
      '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 'T2', name: 'Arquivado' }] },
      '/organizations/111/fields/T2/boundaries': { values: [] },
      '/organizations/111/fields/T2/boundaries?recordFilter=all': { values: [{ ...desenho, active: false }] },
    });
    expect((await provedor.listarTalhoes('org')).map((t) => t.nome)).toEqual(['Arquivado']);
  });
});

describe('formato atual do export e horas de motor ligado', () => {
  it('lê o mapa MachineUsage do .json (índice -> máquina)', () => {
    const mapa = maquinasDoMeta({ MachineUsage: { '1': { MachineId: 637795, OperatorId: 'x' }, '2': { machineId: '5001' } } });
    expect([...mapa]).toEqual([['1', '637795'], ['2', '5001']]);
  });

  it('busca do passado: fecha os dias pelo caminho, aos poucos, e o relatório passa a ter hectares', async () => {
    const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);
    const ontem = dia(1);
    const guardados = new Map<string, any>();
    const diario = {
      buscar: async (_o: string, m: string, d: string) => guardados.get(`${m}|${d}`) ?? null,
      fechados: async () => new Set(guardados.keys()),
      guardar: async (_o: string, m: string, d: string, uso: any) => void guardados.set(`${m}|${d}`, uso),
    };
    const pedidos: string[] = [];
    const passo = 100 / 111_320;
    const http = (async (url: string) => {
      pedidos.push(url);
      let values: unknown[] = [];
      if (url.includes('/equipment?')) values = [{ principalId: 'm1', name: 'Trator', type: { name: 'Tractor' }, telematicsCapable: true }];
      else if (url.includes('fields?embed=boundaries')) values = [{ id: 'T1', name: 'Sulco', boundaries: [{ active: true, multipolygons: [{ rings: [{ type: 'exterior', points: [{ lat: -31, lon: -52 }, { lat: -31, lon: -51.99 }, { lat: -30.99, lon: -51.99 }, { lat: -30.99, lon: -52 }, { lat: -31, lon: -52 }] }] }] }] }];
      else if (url.includes('/hoursOfOperation')) values = [{ startDate: `${ontem}T12:00:00.000Z`, endDate: `${ontem}T14:00:00.000Z`, engineState: 1 }];
      // Só a janela das 09h às 15h (hora local) de ontem tem pontos: 1 km andado dentro do talhão, um ponto a cada 30 s.
      else if (url.includes('/breadcrumbs?startDate=') && url.includes(`startDate=${ontem}T09`)) values = Array.from({ length: 11 }, (_, i) => ({ eventTimestamp: new Date(Date.parse(`${ontem}T12:00:00.000Z`) + i * 30_000).toISOString(), point: { lat: -30.999 + i * passo, lon: -51.995 }, speed: { valueAsDouble: 12, unit: 'km1hr-1' } }));
      return new Response(JSON.stringify({ values }), { status: 200 });
    }) as unknown as typeof fetch;
    const provedor = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined, diario });

    const r = await provedor.recuperarPassado('org', 8, 3);
    expect(r).toEqual({ fechados: 3, faltam: 0 }); // 3 dias: 1 lido na Deere, 2 em que a máquina nem ligou
    expect(pedidos.filter((u) => u.includes('/breadcrumbs?startDate='))).toHaveLength(4); // só ontem, em 4 janelas
    expect(guardados.get(`m1|${ontem}`)).toMatchObject({ areaHa: 1.2, pontos: 11, porTalhao: [{ talhaoId: 'T1', nome: 'Sulco' }] });
    expect(guardados.get(`m1|${dia(2)}`)).toMatchObject({ areaHa: 0, pontos: 0 });
    expect((await provedor.atividadeNoDia('org', 'm1', ontem)).areaHa).toBe(1.2);
    // Rodar de novo não lê nada: já está tudo fechado.
    const antes = pedidos.length;
    expect(await provedor.recuperarPassado('org', 8, 3)).toEqual({ fechados: 0, faltam: 0 });
    expect(pedidos.filter((u) => u.includes('/breadcrumbs')).length).toBe(pedidos.slice(0, antes).filter((u) => u.includes('/breadcrumbs')).length);
  });

  it('dia passado, sem export, também traz as horas com a chave ligada', async () => {
    const ontem = new Date(Date.now() - 3 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);
    const http = (async (url: string) =>
      new Response(JSON.stringify({ values: url.includes('/hoursOfOperation') ? [{ startDate: `${ontem}T11:00:00.000Z`, endDate: `${ontem}T15:30:00.000Z`, engineState: 1 }, { startDate: `${ontem}T15:30:00.000Z`, endDate: `${ontem}T18:00:00.000Z`, engineState: 0 }] : [] }), { status: 200 })) as unknown as typeof fetch;
    const provedor = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined });
    expect((await provedor.atividadeNoDia('org', 'm1', ontem)).horas).toBe(4.5);
  });

  it('hoje, sem export, as horas vêm do tempo com a chave ligada', async () => {
    const agora = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const http = (async (url: string) => {
      if (url.includes('/hoursOfOperation')) {
        return new Response(JSON.stringify({ values: [
          { startDate: iso(agora - 12 * 60_000), endDate: iso(agora - 6 * 60_000), engineState: 0 },
          { startDate: iso(agora - 6 * 60_000), endDate: iso(agora), engineState: 1 },
        ] }), { status: 200 });
      }
      return new Response(JSON.stringify({ values: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provedor = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined });
    const hoje = new Date(agora - 3 * 3_600_000).toISOString().slice(0, 10);
    const r = await provedor.atividadeNoDia('org', '5001', hoje);
    // 6 minutos ligado = 0,1 h (só o período com a chave ligada conta).
    expect(r.horas).toBe(0.1);
  });
});

describe('fazenda importada de arquivo', () => {
  const contorno = quadrado(-20, -50).map((p) => [p.lon, p.lat] as [number, number]);
  const fazenda = {
    cliente: 'Granja',
    talhoes: [{ id: 'arq-1', nome: '15 serpa', areaHa: 42, cultura: null, contorno }],
    linhas: [{ id: 'l-1', nome: 'Curva 1', talhaoId: 'arq-1', a: contorno[0]!, b: contorno[1]!, padrao: false, passadas: [[contorno[0]!, contorno[1]!]] }],
  };

  it('entra no mapa junto com o que vem da Deere, sem gravar nada lá', async () => {
    const { provedor, pedidos } = rede({ '/organizations/111/fields?embed=boundaries&itemLimit=100': { values: [{ id: 'T1', name: 'Só nome' }] } });
    await provedor.importarFazenda('org', fazenda);
    expect((await provedor.listarTalhoes('org')).map((t) => t.nome)).toEqual(['15 serpa']);
    expect((await provedor.listarLinhas('org')).map((l) => l.nome)).toEqual(['Curva 1']);
    // Nenhuma escrita, e o talhão do arquivo nunca é consultado na Deere.
    expect(pedidos.some((u) => u.includes('arq-1'))).toBe(false);
  });

  it('aparece mesmo se a Deere estiver fora do ar', async () => {
    const { provedor } = rede({ '/organizations/111/fields?embed=boundaries&itemLimit=100': () => new Response('{}', { status: 500 }) });
    await provedor.importarFazenda('org', fazenda);
    expect(await provedor.listarTalhoes('org')).toHaveLength(1);
  });
});
