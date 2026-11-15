import type { RastroDaMaquina } from '@talhio/shared';
import { useQuery } from '@tanstack/react-query';

import { maquinasApi } from '../api/maquinasApi';
import { maquinasKeys } from '../maquinas.keys';

export type RastrosDasMaquinas = GeoJSON.FeatureCollection<GeoJSON.MultiLineString, { id: string }>;
export type ParadasDasMaquinas = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; minutos: number; inicio: string }>;

const VAZIO: RastrosDasMaquinas = { type: 'FeatureCollection', features: [] };
const SEM_PARADAS: ParadasDasMaquinas = { type: 'FeatureCollection', features: [] };

/** Fora do componente: o React Query devolve o MESMO objeto enquanto o caminho não muda, e o mapa não redesenha. */
function paraLinhas(rastros: RastroDaMaquina[]): RastrosDasMaquinas {
  return {
    type: 'FeatureCollection',
    features: rastros.map((r) => ({ type: 'Feature' as const, id: r.maquinaId, properties: { id: r.maquinaId }, geometry: { type: 'MultiLineString' as const, coordinates: r.trechos } })),
  };
}

function paraParadas(rastros: RastroDaMaquina[]): ParadasDasMaquinas {
  return {
    type: 'FeatureCollection',
    features: rastros.flatMap((r) =>
      r.paradas.map((p) => ({ type: 'Feature' as const, properties: { id: r.maquinaId, minutos: p.minutos, inicio: p.inicio }, geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] } })),
    ),
  };
}

const opcoes = { queryKey: maquinasKeys.rastros(), queryFn: maquinasApi.rastros, refetchInterval: 10_000, refetchIntervalInBackground: false } as const;

/** Caminho que cada máquina fez hoje, como linhas GeoJSON para o mapa. Atualiza a cada 10 s com a tela aberta. */
export function useRastrosDasMaquinas(): RastrosDasMaquinas {
  return useQuery({ ...opcoes, select: paraLinhas }).data ?? VAZIO;
}

/** Paradas de hoje (2 min ou mais) de cada máquina, como pontos para o mapa. Usa a mesma busca do caminho. */
export function useParadasDasMaquinas(): ParadasDasMaquinas {
  return useQuery({ ...opcoes, select: paraParadas }).data ?? SEM_PARADAS;
}

/** Paradas de hoje de uma máquina, da mais recente para a mais antiga (para o painel). */
export function useParadasDaMaquina(maquinaId: string | null): RastroDaMaquina['paradas'] {
  const todas = useQuery({ ...opcoes }).data;
  return [...(todas?.find((r) => r.maquinaId === maquinaId)?.paradas ?? [])].reverse();
}
