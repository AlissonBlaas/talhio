import { Test } from '@nestjs/testing';
import { FakeProvedor } from '@talhio/deere';
import { areaHaDoPoligono, NovoTalhaoSchema } from '@talhio/shared';
import { BANCO } from '../banco/banco.module.js';
import { criarBancoDeTeste } from '../banco/banco-de-teste.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { TalhoesRepository } from './talhoes.repository.js';
import { TalhoesService } from './talhoes.service.js';

// Quadrado de 1 km de lado no equador: 100 ha.
const LADO = 1000 / 111_319.49;
const quadrado = (lado: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[0, 0], [lado, 0], [lado, lado], [0, lado], [0, 0]] as [number, number][]],
});

describe('areaHaDoPoligono', () => {
  it('1 km x 1 km no equador dá cerca de 100 ha', () => {
    expect(areaHaDoPoligono(quadrado(LADO))).toBeCloseTo(100, 0);
  });
  it('dá o mesmo resultado com o anel aberto ou fechado, em qualquer sentido', () => {
    const fechado = quadrado(LADO);
    const aberto = { type: 'Polygon' as const, coordinates: [fechado.coordinates[0]!.slice(0, -1)] };
    const invertido = { type: 'Polygon' as const, coordinates: [[...fechado.coordinates[0]!].reverse()] };
    expect(areaHaDoPoligono(aberto)).toBeCloseTo(areaHaDoPoligono(fechado), 6);
    expect(areaHaDoPoligono(invertido)).toBeCloseTo(areaHaDoPoligono(fechado), 6);
  });
});

describe('TalhoesService.criar', () => {
  let service: TalhoesService;
  const novo = (dados: unknown) => NovoTalhaoSchema.parse(dados);

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({
      providers: [TalhoesService, TalhoesRepository, { provide: BANCO, useValue: await criarBancoDeTeste('org') }, { provide: PROVEDOR_MAQUINAS, useValue: new FakeProvedor() }],
    }).compile();
    service = modulo.get(TalhoesService);
  });

  it('calcula a área, fecha o contorno e passa a listar o talhão', async () => {
    const aberto = { type: 'Polygon', coordinates: [quadrado(LADO).coordinates[0]!.slice(0, -1)] };
    const criado = await service.criar('org', novo({ nome: 'Baixada', contorno: { ...aberto, coordinates: [[...aberto.coordinates[0]!, [0, 0.00001]]] } }));
    expect(criado.areaHa).toBeGreaterThan(90);
    const anel = criado.contorno.coordinates[0]!;
    expect(anel[anel.length - 1]).toEqual(anel[0]);
    expect((await service.listar('org')).map((t) => t.nome)).toContain('Baixada');
  });

  it('recusa nome repetido, inclusive de talhão importado', async () => {
    await expect(service.criar('org', novo({ nome: 'talhão 7', contorno: quadrado(LADO) }))).rejects.toMatchObject({
      response: { codigo: 'TALHAO_NOME_REPETIDO' },
    });
  });

  it('recusa contorno pequeno demais', async () => {
    await expect(service.criar('org', novo({ nome: 'Ponto', contorno: quadrado(LADO / 100) }))).rejects.toMatchObject({
      response: { codigo: 'TALHAO_MUITO_PEQUENO' },
    });
  });
});
