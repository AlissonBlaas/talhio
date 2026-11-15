import { useSyncExternalStore } from 'react';

/**
 * "Fazer depois" no onboarding: vale até fechar o app. Na próxima abertura o convite volta,
 * até a fazenda conectar. Fica em memória de propósito (não é dado da fazenda).
 */
let adiado = false;
const ouvintes = new Set<() => void>();

export function adiarOnboarding() {
  adiado = true;
  for (const ouvinte of ouvintes) ouvinte();
}

export function useOnboardingAdiado(): boolean {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => adiado,
  );
}
