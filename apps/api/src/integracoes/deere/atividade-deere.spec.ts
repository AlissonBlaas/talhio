import { criarBancoDeTeste } from '../../banco/banco-de-teste.js';
import { organizacoes } from '../../banco/schema.js';
import { AtividadeDeereRepository } from './atividade-deere.repository.js';

const dia = (maquinaId: string, horas: number) => ({ maquinaId, dia: '2026-11-10', horas, areaHa: horas * 5, combustivelL: horas * 20, paradoMin: 3 });

describe('AtividadeDeereRepository', () => {
  it('guarda por operação, soma no dia e troca a versão sem duplicar', async () => {
    const banco = await criarBancoDeTeste('org-a');
    const repo = new AtividadeDeereRepository(banco);
    await repo.guardar('org-a', 'OP1', 'v1', [dia('M1', 2)]);
    await repo.guardar('org-a', 'OP2', 'v1', [dia('M1', 1)]);
    expect(await repo.buscar('org-a', 'M1', '2026-11-10')).toMatchObject({ horas: 3, areaHa: 15, combustivelL: 60, paradoMin: 6 });

    await repo.guardar('org-a', 'OP1', 'v2', [dia('M1', 4)]);
    expect((await repo.buscar('org-a', 'M1', '2026-11-10'))?.horas).toBe(5);
    expect(await repo.versoes('org-a')).toEqual(new Map([['OP1', 'v2'], ['OP2', 'v1']]));
    expect(await repo.buscar('org-a', 'M1', '2026-11-11')).toBeNull();
  });

  it('não mistura fazendas', async () => {
    const banco = await criarBancoDeTeste('org-a');
    await banco.insert(organizacoes).values({ id: 'org-b', nome: 'Outra' });
    const repo = new AtividadeDeereRepository(banco);
    await repo.guardar('org-a', 'OP1', 'v1', [dia('M1', 2)]);
    expect(await repo.buscar('org-b', 'M1', '2026-11-10')).toBeNull();
    expect((await repo.versoes('org-b')).size).toBe(0);
  });
});
