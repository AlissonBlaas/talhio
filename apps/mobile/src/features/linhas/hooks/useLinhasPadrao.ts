import { useQuery } from '@tanstack/react-query';

import { linhasApi } from '../api/linhasApi';
import { linhasKeys } from '../linhas.keys';

/** Linhas salvas como padrão da fazenda, para reaproveitar em qualquer talhão. */
export function useLinhasPadrao() {
  const query = useQuery({
    queryKey: linhasKeys.lista(),
    queryFn: linhasApi.listar,
    // Linha quase não muda: fresca por 1 hora, atualiza ao invalidar depois de salvar.
    staleTime: 60 * 60 * 1000,
    select: (linhas) => linhas.filter((l) => l.padraoDaFazenda),
  });
  return { linhasPadrao: query.data ?? [], carregando: query.isPending };
}
