import { Redirect } from 'expo-router';

import { useConexaoDeere, useOnboardingAdiado } from '@/features/conexao';
import { useSessao } from '@/shared/lib/sessao';

/**
 * Fica ao lado das abas. Se a fazenda tem a John Deere ligada no servidor e ainda não conectou,
 * leva o administrador para o onboarding. Quem só consulta (papel leitura) nunca é levado.
 */
export function PortaDoOnboarding() {
  const sessao = useSessao();
  const adiado = useOnboardingAdiado();
  const { conexao } = useConexaoDeere();
  const admin = sessao.status === 'logado' && sessao.usuario.papel === 'admin';
  if (!admin || adiado || !conexao || conexao.modo !== 'deere' || conexao.estado === 'pronto') return null;
  return <Redirect href="/onboarding" />;
}
