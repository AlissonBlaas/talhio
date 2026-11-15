import { useQuery } from '@tanstack/react-query';

import { conexaoApi } from '../api/conexaoApi';
import { conexaoKeys } from '../conexao.keys';

/** Organizações da conta John Deere que autorizou o Talhio. Só busca quando a tela precisa. */
export function useOrganizacoesDeere(ligado: boolean) {
  const query = useQuery({ queryKey: conexaoKeys.organizacoes(), queryFn: conexaoApi.organizacoes, enabled: ligado });
  return { organizacoes: query.data ?? [], carregando: query.isPending && ligado, erro: query.error, atualizar: () => void query.refetch() };
}
