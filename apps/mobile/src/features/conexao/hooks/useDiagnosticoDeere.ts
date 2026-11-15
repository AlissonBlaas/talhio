import { useQuery } from '@tanstack/react-query';

import { conexaoApi } from '../api/conexaoApi';
import { conexaoKeys } from '../conexao.keys';

/** Só consulta quando o administrador pede (toque no botão): faz várias chamadas à Deere. */
export function useDiagnosticoDeere() {
  const q = useQuery({ queryKey: [...conexaoKeys.todas, 'diagnostico'], queryFn: conexaoApi.diagnostico, enabled: false, staleTime: 0, gcTime: 0, retry: false });
  return { passos: q.data ?? null, carregando: q.isFetching, falhou: q.isError, rodar: () => void q.refetch() };
}
