import { DeereProvedor, combustivelDaFrota, type ArmazemDeCombustivel, type TemposDaLeitura } from '@talhio/deere';
import { criarBancoDeTeste } from '../../banco/banco-de-teste.js';
import { combustivelImportado, organizacoes } from '../../banco/schema.js';
import { CombustivelAcumuladoRepository } from './combustivel-acumulado.repository.js';

const BASE = 'https://sandboxapi.deere.com/platform';
const EQUIP = 'https://equipmentapi.deere.com/isg/equipment?organizationIds=111&categories=Machine&archived=false&itemLimit=100';
const AEMP = 'https://aemp.teste';
const SERIE = '1RW8270RABC';
const dia = (deslocamento = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + deslocamento * 86_400_000));
const frotaXml = (litros: number, horas?: number, quando?: { litrosEm: Date; horasEm: Date }) => `<Fleet><Equipment><EquipmentHeader><SerialNumber>${SERIE}</SerialNumber></EquipmentHeader>${horas === undefined ? '' : `<CumulativeOperatingHours${quando ? ` datetime="${quando.horasEm.toISOString()}"` : ''}><Hour>${horas}</Hour></CumulativeOperatingHours>`}<FuelUsed${quando ? ` datetime="${quando.litrosEm.toISOString()}"` : ''}><FuelUnits>litre</FuelUnits><FuelConsumed>${litros}</FuelConsumed></FuelUsed></Equipment></Fleet>`;

function memoria(): ArmazemDeCombustivel & { dados: Map<string, number>; importados: Map<string, { litros: number; horasMotor: number | null }> } {
  const dados = new Map<string, number>();
  const horas = new Map<string, number | null>();
  const importados = new Map<string, { litros: number; horasMotor: number | null }>();
  const primeiras = new Map<string, { litros: number; em: Date; horasMotor: number | null }>();
  const tempos = new Map<string, TemposDaLeitura>();
  return {
    dados,
    importados,
    guardar: async (orgId, d, leituras) =>
      leituras.forEach((l) => {
        const chave = `${orgId}|${l.serie}|${d}`;
        dados.set(chave, l.litros);
        horas.set(chave, l.horasMotor ?? null);
        const t = tempos.get(chave);
        tempos.set(chave, { litrosEm: l.litrosEm ?? null, horasEm: l.horasEm ?? null, primeiraLitrosEm: t ? t.primeiraLitrosEm : (l.litrosEm ?? null), primeiraHorasEm: t ? t.primeiraHorasEm : (l.horasEm ?? null) });
        if (!primeiras.has(chave)) primeiras.set(chave, { litros: l.litros, em: new Date(), horasMotor: l.horasMotor ?? null });
      }),
    buscar: async (orgId, serie, d) => dados.get(`${orgId}|${serie}|${d}`) ?? null,
    buscarHoras: async (orgId, serie, d) => horas.get(`${orgId}|${serie}|${d}`) ?? null,
    tempos: async (orgId, serie, d) => tempos.get(`${orgId}|${serie}|${d}`) ?? null,
    importado: async (orgId, maquina, d) => importados.get(`${orgId}|${maquina}|${d}`) ?? null,
    primeira: async (orgId, serie, d) => primeiras.get(`${orgId}|${serie}|${d}`) ?? null,
  };
}

function provedorCom(combustivel: ArmazemDeCombustivel | undefined, acumuladoAgora: number | null, opcoes: { combustivelPeloTanque?: boolean } = {}, horasAgora?: number, quandoAgora?: { litrosEm: Date; horasEm: Date }) {
  const http = (async (url: string) => {
    if (url === EQUIP) return new Response(JSON.stringify({ values: [{ id: 7, name: '8270R - 24', type: { name: 'Tractor' }, model: { name: '8270R' }, serialNumber: SERIE }] }), { status: 200 });
    if (url === `${AEMP}/Fleet/1`) return acumuladoAgora === null ? new Response('', { status: 403 }) : new Response(frotaXml(acumuladoAgora, horasAgora, quandoAgora), { status: 200 });
    return new Response(JSON.stringify({ values: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  return new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, aempUrl: AEMP, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined, combustivel, ...opcoes });
}

describe('litros do dia pelo combustível acumulado do motor (ISO 15143-3)', () => {
  it('hoje: leitura de agora menos a última de ontem, exata', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-1), [{ serie: SERIE, litros: 63_000 }]);
    const provedor = provedorCom(armazem, 63_226.4);
    expect((await provedor.atividadeNoDia('org', '7', dia())).combustivelL).toBe(226.4);
    // A leitura de hoje ficou guardada: amanhã ela é a base do dia seguinte.
    expect(armazem.dados.get(`org|${SERIE}|${dia()}`)).toBe(63_226.4);
  });

  it('dia passado: última leitura do dia menos a última do dia anterior', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-3), [{ serie: SERIE, litros: 62_000 }]);
    await armazem.guardar('org', dia(-2), [{ serie: SERIE, litros: 62_210 }]);
    const provedor = provedorCom(armazem, 63_000);
    expect((await provedor.atividadeNoDia('org', '7', dia(-2))).combustivelL).toBe(210);
  });

  it('sem a leitura do dia anterior não há número (zero = "sem leitura" no relatório), nem estimativa pelo tanque', async () => {
    const provedor = provedorCom(memoria(), 63_226.4);
    expect((await provedor.atividadeNoDia('org', '7', dia())).combustivelL).toBe(0);
    expect((await provedor.atividadeNoDia('org', '7', dia(-2))).combustivelL).toBe(0);
  });

  it('hoje, sem a leitura de ontem: parte da primeira leitura do dia e avisa a partir de que horas', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(), [{ serie: SERIE, litros: 63_000 }]); // primeira leitura de hoje
    const provedor = provedorCom(armazem, 63_226.4);
    const hoje = await provedor.atividadeNoDia('org', '7', dia());
    expect(hoje.combustivelL).toBe(226.4);
    expect(hoje.combustivelEstimado).toBeUndefined();
    expect(hoje.combustivelDesde).toMatch(/^\d{2}:\d{2}$/);
    // Dia passado sem a leitura anterior continua sem número: a primeira leitura só vale para hoje.
    expect((await provedor.atividadeNoDia('org', '7', dia(-2))).combustivelL).toBe(0);
  });

  it('com a leitura de ontem, o dia está inteiro e não leva aviso de horário', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-1), [{ serie: SERIE, litros: 63_000 }]);
    const hoje = await provedorCom(armazem, 63_226.4).atividadeNoDia('org', '7', dia());
    expect(hoje.combustivelL).toBe(226.4);
    expect(hoje.combustivelDesde).toBeUndefined();
  });

  const agoraMs = Date.now();
  const hora = (minutosAtras: number) => new Date(agoraMs - minutosAtras * 60_000);

  it('L/h: litros e horas de motor saem das mesmas duas leituras da ISO (e não das horas do rastro)', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-1), [{ serie: SERIE, litros: 63_000, horasMotor: 5000, litrosEm: hora(1500), horasEm: hora(1495) }]);
    const hoje = await provedorCom(armazem, 63_222, {}, 5010, { litrosEm: hora(10), horasEm: hora(5) }).atividadeNoDia('org', '7', dia());
    expect(hoje.combustivelL).toBe(222);
    expect(hoje.combustivelComHorasL).toBe(222);
    expect(hoje.horasMotorLeitura).toBe(10);
  });

  it('litro e horas reportados em horas diferentes (como a 8270R - 29: 04:07 e 07:53) não formam par para o L/h', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-1), [{ serie: SERIE, litros: 63_000, horasMotor: 5000, litrosEm: hora(1500), horasEm: hora(1495) }]);
    // Litro da 1h, horas de 4h depois: as duas pontas não combinam.
    const hoje = await provedorCom(armazem, 63_222, {}, 5010, { litrosEm: hora(400), horasEm: hora(5) }).atividadeNoDia('org', '7', dia());
    expect(hoje.combustivelL).toBe(222);
    expect(hoje.horasMotorLeitura).toBeUndefined();
  });

  it('sem as horas dos contadores guardadas na leitura anterior, o litro vale mas não há par para o L/h', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-1), [{ serie: SERIE, litros: 63_000, horasMotor: 5000 }]); // leitura antiga, sem horas dos contadores
    const hoje = await provedorCom(armazem, 63_222, {}, 5010, { litrosEm: hora(10), horasEm: hora(5) }).atividadeNoDia('org', '7', dia());
    expect(hoje.combustivelL).toBe(222);
    expect(hoje.horasMotorLeitura).toBeUndefined();
  });

  it('hoje a partir da primeira leitura: avisa a hora do contador (não a da nossa leitura) e liga o par', async () => {
    const armazem = memoria();
    const contador = hora(240); // a máquina reportou há 4 h; nós lemos agora
    await armazem.guardar('org', dia(), [{ serie: SERIE, litros: 63_000, horasMotor: 5000, litrosEm: contador, horasEm: contador }]);
    const hoje = await provedorCom(armazem, 63_050, {}, 5002, { litrosEm: hora(10), horasEm: hora(10) }).atividadeNoDia('org', '7', dia());
    expect(hoje.combustivelL).toBe(50);
    expect(hoje.horasMotorLeitura).toBe(2);
    const hh = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(contador);
    expect(hoje.combustivelDesde).toBe(hh);
  });

  it('dia passado com consumo importado do Operations Center: usa o número do monitor e as horas do mesmo dia', async () => {
    const armazem = memoria();
    armazem.importados.set(`org|7|${dia(-5)}`, { litros: 435.4, horasMotor: 16.4 });
    const r = await provedorCom(armazem, 63_000, {}, 5000).atividadeNoDia('org', '7', dia(-5));
    expect(r.combustivelL).toBe(435.4);
    expect(r.combustivelComHorasL).toBe(435.4);
    expect(r.horasMotorLeitura).toBe(16.4);
    expect(r.combustivelEstimado).toBeUndefined();
  });

  it('dia antigo, que a Deere não cobre mais e sem caminho guardado: horas e tempo ocioso vêm da mesma leitura dos litros', async () => {
    const armazem = memoria();
    (armazem.importados as Map<string, { litros: number; horasMotor: number | null; horasOcioso?: number | null }>).set(`org|7|${dia(-200)}`, { litros: 357.49, horasMotor: 16.09, horasOcioso: 2.97 });
    const r = await provedorCom(armazem, 63_000, {}, 5000).atividadeNoDia('org', '7', dia(-200));
    expect(r.combustivelL).toBe(357.5);
    expect(r.horas).toBe(16.1);
    expect(r.paradoMin).toBe(178);
    expect(r.horasMotorLeitura).toBe(16.09);
    // Hoje não é completado por aqui: as horas e a parada de hoje saem do caminho do dia.
    armazem.importados.set(`org|7|${dia()}`, { litros: 50, horasMotor: 3 });
    expect((await provedorCom(armazem, 63_000, {}, 5000).atividadeNoDia('org', '7', dia())).paradoMin).toBe(0);
  });

  it('o consumo importado não depende da lista de máquinas da Deere (que pode demorar mais que o prazo do relatório)', async () => {
    const armazem = memoria();
    armazem.importados.set(`org|7|${dia(-5)}`, { litros: 357.49, horasMotor: 16.2 });
    let consultouEquipamentos = false;
    const http = (async (url: string) => {
      if (url === EQUIP) consultouEquipamentos = true;
      return new Response(JSON.stringify({ values: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new DeereProvedor({ clientId: 'a', clientSecret: 'b', baseUrl: BASE, aempUrl: AEMP, obterToken: async () => 'tok', obterOrganizacao: async () => '111', http, esperar: async () => undefined, combustivel: armazem });
    expect((await p.atividadeNoDia('org', '7', dia(-5))).combustivelL).toBe(357.5);
    expect(consultouEquipamentos).toBe(false);
  });

  it('o importado vence a leitura da ISO no mesmo dia, e dia sem importação segue pela ISO', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-1), [{ serie: SERIE, litros: 63_000, horasMotor: 5000 }]);
    armazem.importados.set(`org|7|${dia()}`, { litros: 999, horasMotor: 9 });
    expect((await provedorCom(armazem, 63_222, {}, 5010).atividadeNoDia('org', '7', dia())).combustivelL).toBe(999);
    expect((await provedorCom(armazem, 63_222, {}, 5010).atividadeNoDia('org', '7', dia(-1))).combustivelL).toBe(0);
  });

  it('se a John Deere não libera o acumulado, o combustível fica sem leitura', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-1), [{ serie: SERIE, litros: 63_000 }]);
    const provedor = provedorCom(armazem, null);
    expect((await provedor.atividadeNoDia('org', '7', dia())).combustivelL).toBe(0);
  });
});

describe('estimativa pelo tanque ligada (COMBUSTIVEL_PELO_TANQUE=1)', () => {
  const diario = (litros: number | null) => ({ buscar: async () => ({ trabalhandoH: 8, ociosoH: 1, transporteH: 0, areaHa: 0, areaForaHa: 0, combustivelL: litros, paradas: [], porTalhao: [] }), guardar: async () => undefined, diasFechados: async () => new Set<string>(), apagar: async () => undefined });

  it('sem leitura do motor, o litro do fechamento entra MARCADO como estimado', async () => {
    const provedor = provedorCom(memoria(), null, { combustivelPeloTanque: true, diario: diario(190) } as never);
    expect(await provedor.atividadeNoDia('org', '7', dia(-2))).toMatchObject({ combustivelL: 190, combustivelEstimado: true });
  });

  it('com leitura do motor, vale ela e não há marca de estimado', async () => {
    const armazem = memoria();
    await armazem.guardar('org', dia(-3), [{ serie: SERIE, litros: 62_000 }]);
    await armazem.guardar('org', dia(-2), [{ serie: SERIE, litros: 62_210 }]);
    const a = await provedorCom(armazem, 63_000, { combustivelPeloTanque: true, diario: diario(190) } as never).atividadeNoDia('org', '7', dia(-2));
    expect(a.combustivelL).toBe(210);
    expect(a.combustivelEstimado).toBeUndefined();
  });
});

describe('endereço da API ISO 15143-3 e resposta da frota', () => {
  const mensagens: string[] = [];
  const novo = (aceita: (url: string) => Response | null, aempUrl?: string) =>
    new DeereProvedor({
      clientId: 'a', clientSecret: 'b', baseUrl: BASE, aempUrl, obterToken: async () => 'tok', obterOrganizacao: async () => '111', esperar: async () => undefined,
      registrar: (m) => mensagens.push(m), combustivel: memoria(),
      http: (async (url: string) => {
        if (url === EQUIP) return new Response(JSON.stringify({ values: [{ id: 7, name: '8270R - 24', type: { name: 'Tractor' }, model: { name: '8270R' }, serialNumber: SERIE }] }), { status: 200 });
        return aceita(url) ?? new Response('', { status: 404 });
      }) as unknown as typeof fetch,
    });

  it('sem endereço configurado, tenta o próximo candidato e diz no log qual respondeu', async () => {
    mensagens.length = 0;
    const provedor = novo((url) => (url === 'https://aemp.deere.com/Fleet/1' ? new Response(frotaXml(63_100), { status: 200 }) : null));
    await provedor.atividadeNoDia('org', '7', dia());
    expect(mensagens.some((m) => m.includes('https://aemp.deere.com') && m.includes('1 com combustível acumulado'))).toBe(true);
  });

  it('com endereço configurado, não testa outros', async () => {
    mensagens.length = 0;
    const pedidos: string[] = [];
    const provedor = novo((url) => { pedidos.push(url); return null; }, AEMP);
    await provedor.atividadeNoDia('org', '7', dia());
    expect(pedidos.filter((u) => u.includes('/Fleet'))).toEqual([`${AEMP}/Fleet/1`]);
    expect(mensagens.some((m) => m.includes('não veio') && m.includes('resposta 404'))).toBe(true);
  });

  it('no 403 o log traz o que a Deere disse (licença e escopos que faltam)', async () => {
    mensagens.length = 0;
    const provedor = novo(() => new Response('The client does not have a proper access for this API. license needed: aemp', { status: 403 }), AEMP);
    await provedor.atividadeNoDia('org', '7', dia());
    expect(mensagens.some((m) => m.includes('resposta 403') && m.includes('license needed: aemp'))).toBe(true);
  });

  it('avisa no log quando a Deere pede para liberar a organização', async () => {
    mensagens.length = 0;
    const xml = '<Fleet><Links><Link><rel>connections</rel><href>https://connections.deere.com/connections/x/select-organizations</href></Link></Links></Fleet>';
    const provedor = novo(() => new Response(xml, { status: 200 }), AEMP);
    await provedor.atividadeNoDia('org', '7', dia());
    expect(mensagens.some((m) => m.includes('0 máquina(s) na frota') && m.includes('select-organizations'))).toBe(true);
  });

  it('lê a resposta mesmo com prefixo de espaço de nomes nas tags', () => {
    const xml = `<ns2:Fleet xmlns:ns2="http://standards.iso.org/iso/15143/-3"><ns2:Equipment><ns2:EquipmentHeader><ns2:SerialNumber>ABC1</ns2:SerialNumber></ns2:EquipmentHeader><ns2:FuelUsed><ns2:FuelUnits>litre</ns2:FuelUnits><ns2:FuelConsumed>500.5</ns2:FuelConsumed></ns2:FuelUsed></ns2:Equipment></ns2:Fleet>`;
    expect([...combustivelDaFrota(xml)]).toEqual([['ABC1', 500.5]]);
  });

  it('lê a resposta real da Deere, em que FuelUsed leva o atributo datetime', () => {
    const xml = `<Fleet><Equipment><EquipmentHeader><SerialNumber>ABC1</SerialNumber></EquipmentHeader><FuelUsed datetime="2026-11-13T10:00:00.000Z"><FuelUnits>litre</FuelUnits><FuelConsumed>1234</FuelConsumed></FuelUsed><FuelRemaining datetime="2026-11-13T10:00:00.000Z"><Percent>55.5</Percent></FuelRemaining></Equipment></Fleet>`;
    expect([...combustivelDaFrota(xml)]).toEqual([['ABC1', 1234]]);
  });
});

describe('CombustivelAcumuladoRepository', () => {
  it('guarda a leitura mais alta do dia por máquina, sem misturar fazendas', async () => {
    const db = await criarBancoDeTeste();
    await db.insert(organizacoes).values({ id: 'org-outra', nome: 'Outra' });
    const repo = new CombustivelAcumuladoRepository(db);
    await repo.guardar('org-demo', '2026-11-11', [{ serie: 'A', litros: 1000 }, { serie: 'B', litros: 500 }]);
    await repo.guardar('org-demo', '2026-11-11', [{ serie: 'A', litros: 1040.5 }]);
    await repo.guardar('org-demo', '2026-11-11', [{ serie: 'A', litros: 900 }]); // leitura velha chegando depois: não volta atrás
    await repo.guardar('org-outra', '2026-11-11', [{ serie: 'A', litros: 7 }]);
    expect(await repo.buscar('org-demo', 'A', '2026-11-11')).toBe(1040.5);
    expect(await repo.buscar('org-demo', 'B', '2026-11-11')).toBe(500);
    expect(await repo.buscar('org-demo', 'A', '2026-11-10')).toBeNull();
    expect(await repo.buscar('org-outra', 'A', '2026-11-11')).toBe(7);
  });

  it('consumo importado: lido por máquina e dia, sem misturar fazendas', async () => {
    const db = await criarBancoDeTeste();
    await db.insert(organizacoes).values({ id: 'org-outra-2', nome: 'Outra 2' });
    await db.insert(combustivelImportado).values([
      { orgId: 'org-demo', maquinaId: '7', dia: '2026-11-06', litros: 435.4, horasMotor: 16.4 },
      { orgId: 'org-outra-2', maquinaId: '7', dia: '2026-11-06', litros: 1, horasMotor: null },
    ]);
    const repo = new CombustivelAcumuladoRepository(db);
    expect(await repo.importado('org-demo', '7', '2026-11-06')).toEqual({ litros: 435.4, horasMotor: 16.4, horasOcioso: null });
    expect(await repo.importado('org-demo', '7', '2026-11-07')).toBeNull();
    expect(await repo.importado('org-demo', '8', '2026-11-06')).toBeNull();
    expect(await repo.importado('org-outra-2', '7', '2026-11-06')).toEqual({ litros: 1, horasMotor: null, horasOcioso: null });
  });

  it('a primeira leitura do dia não muda quando chegam leituras novas', async () => {
    const db = await criarBancoDeTeste();
    const repo = new CombustivelAcumuladoRepository(db);
    await repo.guardar('org-demo', '2026-11-12', [{ serie: 'A', litros: 1000 }]);
    await repo.guardar('org-demo', '2026-11-12', [{ serie: 'A', litros: 1060 }]);
    expect(await repo.buscar('org-demo', 'A', '2026-11-12')).toBe(1060);
    expect((await repo.primeira('org-demo', 'A', '2026-11-12'))?.litros).toBe(1000);
    // Horas de motor: a primeira fica com a do litro dela; a última vai subindo.
    await repo.guardar('org-demo', '2026-11-14', [{ serie: 'A', litros: 2000, horasMotor: 100 }]);
    await repo.guardar('org-demo', '2026-11-14', [{ serie: 'A', litros: 2030, horasMotor: 101.5 }]);
    expect((await repo.primeira('org-demo', 'A', '2026-11-14'))?.horasMotor).toBe(100);
    expect(await repo.buscarHoras('org-demo', 'A', '2026-11-14')).toBe(101.5);
    expect(await repo.buscarHoras('org-demo', 'A', '2026-11-12')).toBeNull();
    expect(await repo.primeira('org-demo', 'A', '2026-11-11')).toBeNull();
  });
});
