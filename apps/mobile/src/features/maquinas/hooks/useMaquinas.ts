import type { Maquina, StatusMaquina } from '@talhio/shared';
import { useQuery } from '@tanstack/react-query';

import { intervaloDeAtualizacao } from '@/shared/lib/canalAoVivo';
import { useState } from 'react';

import { maquinasApi } from '../api/maquinasApi';
import { maquinasKeys } from '../maquinas.keys';

export type Filtro = 'todas' | StatusMaquina;

/** Camada de lógica: busca, filtra e conta. A tela só recebe o que vai desenhar. */
export function useMaquinas() {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const query = useQuery({
    queryKey: maquinasKeys.lista(),
    queryFn: maquinasApi.listar,
    // Status de máquina muda rápido: atualiza a cada 30 s com a tela aberta.
    refetchInterval: intervaloDeAtualizacao,
    refetchIntervalInBackground: false,
  });

  const todas: Maquina[] = query.data ?? [];

  return {
    maquinas: filtro === 'todas' ? todas : todas.filter((m) => m.status === filtro),
    filtro,
    setFiltro,
    carregando: query.isPending,
    erro: query.error,
    atualizando: query.isRefetching,
    atualizar: () => void query.refetch(),
  };
}
