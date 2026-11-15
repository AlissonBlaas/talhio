import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Devolve uma função com identidade fixa que sempre chama a versão mais nova de `fn`.
 * É o que permite às camadas do mapa ficarem memorizadas mesmo quando a tela recria os
 * manipuladores de toque a cada desenho.
 */
export function useEventoEstavel<Args extends unknown[]>(fn: ((...args: Args) => void) | undefined): (...args: Args) => void {
  const atual = useRef(fn);
  useLayoutEffect(() => {
    atual.current = fn;
  });
  return useCallback((...args: Args) => atual.current?.(...args), []);
}
