import type { MaquinaExterna, TalhaoExterno } from '@talhio/deere';
import type { Operacao, Talhao, TipoMaquina } from '@talhio/shared';

/** Tradução na borda: daqui para dentro, só tipos do contrato (@talhio/shared). */
const TIPOS: Record<MaquinaExterna['categoria'], TipoMaquina> = {
  tractor: 'trator',
  sprayer: 'pulverizador',
  combine: 'colheitadeira',
};

export function paraTipoMaquina(categoria: MaquinaExterna['categoria']): TipoMaquina {
  return TIPOS[categoria];
}

export function paraTalhao(externo: TalhaoExterno, operacao: Operacao | null = null, percentualFeito: number | null = null): Talhao {
  return {
    id: externo.id,
    nome: externo.nome,
    areaHa: externo.areaHa,
    cultura: externo.cultura,
    contorno: { type: 'Polygon', coordinates: [externo.contorno] },
    operacao,
    percentualFeito: operacao ? percentualFeito : null,
  };
}
