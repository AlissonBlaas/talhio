import type { Maquina } from '@talhio/shared';
import { useQuery } from '@tanstack/react-query';

import { intervaloDeAtualizacao } from '@/shared/lib/canalAoVivo';

import { maquinasApi } from '../api/maquinasApi';
import { maquinasKeys } from '../maquinas.keys';

export type PontosDasMaquinas = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; status: Maquina['status'] }>;

const VAZIO: PontosDasMaquinas = { type: 'FeatureCollection', features: [] };

/** Fora do componente para ter sempre a mesma referência: o React Query só refaz o cálculo quando o dado muda. */
function paraPontos(maquinas: Maquina[]): PontosDasMaquinas {
  return {
    type: 'FeatureCollection',
    features: maquinas.flatMap((m) =>
      m.posicao
        ? [{ type: 'Feature' as const, id: m.id, properties: { id: m.id, status: m.status, tipo: m.tipo }, geometry: { type: 'Point' as const, coordinates: [m.posicao.lng, m.posicao.lat] } }]
        : [],
    ),
  };
}

/**
 * Máquinas como pontos GeoJSON, para a camada do mapa.
 *
 * Só leva o que o mapa desenha (posição e status). O React Query compara o resultado com o
 * anterior e devolve o MESMO objeto quando nada disso mudou; assim a atualização de 30 s não
 * reenvia os pontos ao mapa se nenhuma máquina saiu do lugar.
 */
export function usePontosDasMaquinas(): PontosDasMaquinas {
  const query = useQuery({
    queryKey: maquinasKeys.lista(),
    queryFn: maquinasApi.listar,
    select: paraPontos,
    refetchInterval: intervaloDeAtualizacao,
    refetchIntervalInBackground: false,
  });
  return query.data ?? VAZIO;
}
