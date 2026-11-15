import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { canalAoVivo } from '@/shared/lib/canalAoVivo';

import { maquinasKeys } from '../maquinas.keys';

/** Troca de máquinas atualiza no máximo a cada tanto os dado que depende delas (o painel). */
const INTERVALO_DERIVADOS_MS = 15_000;

/**
 * Máquinas que o servidor empurra pelo canal ao vivo entram direto no cache: mapa, lista, detalhe e painel
 * mudam sem nova consulta. Chamado uma vez, no layout raiz.
 */
export function useMaquinasAoVivo(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    let ultimo = 0;
    return canalAoVivo.ouvir((quadro) => {
      if (quadro.tipo !== 'maquinas') return;
      queryClient.setQueryData(maquinasKeys.lista(), quadro.maquinas);
      for (const m of quadro.maquinas) queryClient.setQueryData(maquinasKeys.detalhe(m.id), m);
      const agora = Date.now();
      if (agora - ultimo > INTERVALO_DERIVADOS_MS) {
        ultimo = agora;
        void queryClient.invalidateQueries({ queryKey: ['inicio'] });
      }
    });
  }, [queryClient]);
}
