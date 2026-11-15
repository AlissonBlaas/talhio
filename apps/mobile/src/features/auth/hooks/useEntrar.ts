import { useMutation } from '@tanstack/react-query';

import { sessao } from '@/shared/lib/sessao';

import { authApi } from '../api/authApi';

export function useEntrar() {
  const mutacao = useMutation({
    mutationFn: authApi.entrar,
    // Guardar a sessão troca as rotas sozinho: o layout raiz mostra o app no lugar do login.
    onSuccess: (nova) => sessao.definir(nova),
  });
  return { entrar: mutacao.mutate, entrando: mutacao.isPending, erro: mutacao.error, limparErro: mutacao.reset };
}
