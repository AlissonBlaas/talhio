import { Test } from '@nestjs/testing';
import { LarguraImplementoRepository } from '../integracoes/deere/largura-implemento.repository.js';
import { FakeProvedor } from '@talhio/deere';
import { NovoPlanoSchema, PlanoSchema } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { EscalaRepository } from '../escala/escala.repository.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { TalhoesRepository } from '../talhoes/talhoes.repository.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { PlanosRepository } from './planos.repository.js';
import { PlanosService } from './planos.service.js';

// Meio-dia em Brasília de 10/11/2026.
const AGORA = new Date('2026-11-10T15:00:00.000Z');
const ORG = 'org-demo';

describe('PlanosService', () => {
  let service: PlanosService;
  let escalas: EscalaRepository;
  let talhaoIds: string[];

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      providers: [PlanosService, PlanosRepository, EscalaRepository, MaquinasService, LarguraImplementoRepository, TalhoesService, TalhoesRepository, { provide: BANCO, useValue: await criarBancoDeTeste() }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor(() => AGORA) }],
    }).compile();
    service = modulo.get(PlanosService);
    escalas = modulo.get(EscalaRepository);
    talhaoIds = (await modulo.get(TalhoesService).listar(ORG)).map((t) => t.id);
  });

  const plantio = (extra: object = {}) =>
    NovoPlanoSchema.parse({ talhaoIds: [talhaoIds[0]], operacao: 'plantio', cultura: 'Soja', variedade: 'Híbrido de teste', sementesPorHa: 65000, dataInicio: '2026-11-10', maquinaIds: ['m-8r410'], ...extra });

  it('plantio exige cultura, variedade e taxa; as outras operações não', () => {
    const base = { talhaoIds: ['t'], dataInicio: '2026-11-10', maquinaIds: ['m'] };
    const semDados = NovoPlanoSchema.safeParse({ ...base, operacao: 'plantio' });
    expect(semDados.success ? [] : semDados.error.issues.map((i) => i.path[0])).toEqual(['cultura', 'variedade', 'sementesPorHa']);
    expect(NovoPlanoSchema.safeParse({ ...base, operacao: 'pulverizacao' }).success).toBe(true);
    expect(NovoPlanoSchema.safeParse({ ...base, operacao: 'colheita', maquinaIds: [] }).success).toBe(false);
  });

  it('salva o plano, avisa que o envio aguarda a John Deere e põe a tarefa na escala de hoje', async () => {
    const plano = PlanoSchema.parse(await service.criar(ORG, plantio(), AGORA));
    expect(plano).toMatchObject({ operacao: 'plantio', cultura: 'Soja', dataInicio: '2026-11-10' });
    expect(plano.talhoes).toHaveLength(1);
    expect(plano.maquinas).toEqual([{ id: 'm-8r410', nome: 'Trator 8R 410', envio: 'aguardando-liberacao' }]);
    expect(await escalas.doDia(ORG, '2026-11-10')).toMatchObject([{ maquinaId: 'm-8r410', operador: 'João', tarefa: 'Plantio de soja', talhaoId: talhaoIds[0] }]);
    expect(await service.listar(ORG)).toHaveLength(1);
  });

  it('plano para outro dia não mexe na escala de hoje', async () => {
    await service.criar(ORG, plantio({ dataInicio: '2026-11-12', maquinaIds: ['m-7r330'] }), AGORA);
    expect((await escalas.doDia(ORG, '2026-11-10')).map((e) => e.maquinaId)).toEqual(['m-8r410']);
    expect(await escalas.doDia(ORG, '2026-11-12')).toEqual([]);
  });

  it('recusa talhão ou máquina que não existem, e não mostra plano de outra fazenda', async () => {
    await expect(service.criar(ORG, plantio({ talhaoIds: ['nao-existe'] }), AGORA)).rejects.toMatchObject({ status: 422, response: { codigo: 'TALHAO_NAO_ENCONTRADO' } });
    await expect(service.criar(ORG, plantio({ maquinaIds: ['nao-existe'] }), AGORA)).rejects.toMatchObject({ status: 422, response: { codigo: 'MAQUINA_NAO_ENCONTRADA' } });
    expect(await service.listar('outra-org')).toEqual([]);
    const [plano] = await service.listar(ORG);
    expect((await service.buscar(ORG, plano!.id)).id).toBe(plano!.id);
    await expect(service.buscar('outra-org', plano!.id)).rejects.toMatchObject({ status: 404, response: { codigo: 'PLANO_NAO_ENCONTRADO' } });
  });
});
