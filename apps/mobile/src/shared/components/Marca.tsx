import Svg, { Path } from 'react-native-svg';

import { cores } from '@/shared/theme/tokens';

/**
 * Símbolo do Talhio: quatro passadas curvas. Três feitas (linha cheia) e uma por fazer (tracejada), como o mapa
 * mostra o andamento do talhão. É o desenho oficial da logo (`assets/marca`).
 * `escuro`: para fundo verde (milho, folha e branco). `claro`: para fundo claro (milho, folha e verde lavoura).
 * `tamanho` é a altura; a largura segue a proporção do desenho.
 */
export function Marca({ tamanho = 28, variante = 'escuro' }: { tamanho?: number; variante?: 'escuro' | 'claro' }) {
  const base = variante === 'escuro' ? '#FFFFFF' : cores.mata;
  return (
    <Svg width={(tamanho * 136) / 111} height={tamanho} viewBox="12 16 136 111" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M18 58 Q66 21 142 23" stroke={cores.milho} strokeWidth={13} strokeLinecap="round" />
      <Path d="M18 84 Q68 48 142 49" stroke={cores.folha} strokeWidth={13} strokeLinecap="round" />
      <Path d="M18 110 Q69 75 142 75" stroke={base} strokeWidth={13} strokeLinecap="round" />
      <Path d="M41 121 Q86 96 142 100" stroke={base} strokeWidth={11} strokeLinecap="round" strokeDasharray="12 14" />
    </Svg>
  );
}
