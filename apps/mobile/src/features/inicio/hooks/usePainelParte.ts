import type { Painel } from '@talhio/shared';
import { useQuery } from '@tanstack/react-query';

import { intervaloDeAtualizacao } from '@/shared/lib/canalAoVivo';

import { painelApi } from '../api/painelApi';
import { inicioKeys } from '../inicio.keys';

/**
 * Cada bloco do Início lê só a sua fatia do painel. Todos usam a mesma chave, então há uma única
 * requisição, e o bloco só renderiza de novo quando a fatia dele muda (o `select` compara por
 * estrutura). Passe um seletor estável, definido fora do componente.
 */
export function usePainelParte<T>(seletor: (painel: Painel) => T): T | undefined {
  return useQuery({
    queryKey: inicioKeys.painel(),
    queryFn: painelApi.buscar,
    // A visão do dia muda rápido: atualiza a cada 30 s com a tela aberta.
    refetchInterval: intervaloDeAtualizacao,
    refetchIntervalInBackground: false,
    select: seletor,
  }).data;
}
