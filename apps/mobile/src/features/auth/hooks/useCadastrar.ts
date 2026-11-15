import { useMutation } from '@tanstack/react-query';

import { sessao } from '@/shared/lib/sessao';

import { authApi } from '../api/authApi';

export function useCadastrar() {
  const mutacao = useMutation({
    mutationFn: authApi.cadastrar,
    // Conta criada já entra logada: o layout raiz troca para o app, que leva ao onboarding.
    onSuccess: (nova) => sessao.definir(nova),
  });
  return { cadastrar: mutacao.mutate, cadastrando: mutacao.isPending, erro: mutacao.error, limparErro: mutacao.reset };
}
