import { useQuery } from '@tanstack/react-query';

import { conexaoApi } from '../api/conexaoApi';
import { conexaoKeys } from '../conexao.keys';

/** Como está a ligação da fazenda com a John Deere. */
export function useConexaoDeere() {
  const query = useQuery({ queryKey: conexaoKeys.estado(), queryFn: conexaoApi.estado, staleTime: 60_000 });
  return { conexao: query.data ?? null, carregando: query.isPending, erro: query.error, atualizar: () => void query.refetch() };
}
