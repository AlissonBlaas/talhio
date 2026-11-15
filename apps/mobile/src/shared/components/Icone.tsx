import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Ícones de traço do protótipo (grade de 24 px).
const DESENHOS = {
  inicio: (
    <>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.5V21h14V9.5" />
    </>
  ),
  trator: (
    <>
      <Circle cx={7} cy={17} r={3} />
      <Circle cx={18} cy={18} r={2} />
      <Path d="M4 14V7h7l2 5h6v6h-2" />
      <Path d="M10 17h6" />
    </>
  ),
  colheitadeira: (
    <>
      <Circle cx={9.5} cy={17} r={3} />
      <Circle cx={19} cy={18.5} r={1.5} />
      <Path d="M6.5 15V8h5l1.5 3.5H21V17h-.5" />
      <Path d="M12.5 17h5" />
      <Path d="M6.5 12.5 2.5 15v3h4" />
      <Path d="M14.5 11.5V6.5H20" />
    </>
  ),
  pulverizador: (
    <>
      <Circle cx={8} cy={18} r={2} />
      <Circle cx={16.5} cy={18} r={2} />
      <Path d="M6.5 16v-4.5h4L12 7.5h4.5V16" />
      <Path d="M10 18h4.5" />
      <Path d="M1.5 12.5h5M16.5 12.5h6" />
      <Path d="M3 12.5v2.2M20.8 12.5v2.2" />
    </>
  ),
  mapa: (
    <>
      <Path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <Path d="M9 3v15" />
      <Path d="M15 6v15" />
    </>
  ),
  sair: (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="m16 17 5-5-5-5" />
      <Path d="M21 12H9" />
    </>
  ),
  microfone: (
    <>
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M5 11a7 7 0 0 0 14 0" />
      <Path d="M12 18v3" />
    </>
  ),
  parar: <Rect x={7} y={7} width={10} height={10} rx={2} />,
  historico: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  ia: <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />,
  grafico: (
    <>
      <Path d="M3 3v18h18" />
      <Path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
  calendario: (
    <>
      <Rect x={3} y={4} width={18} height={17} rx={2} />
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Path d="M3 10h18" />
    </>
  ),
  sino: (
    <>
      <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  enviar: (
    <>
      <Path d="M22 2 11 13" />
      <Path d="M22 2 15 22l-4-9-9-4z" />
    </>
  ),
  mais: (
    <>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </>
  ),
  menu: (
    <>
      <Path d="M4 7h16" />
      <Path d="M4 12h16" />
      <Path d="M4 17h10" />
    </>
  ),
  expandir: (
    <>
      <Path d="M15 3h6v6" />
      <Path d="M9 21H3v-6" />
      <Path d="M21 3l-7 7" />
      <Path d="M3 21l7-7" />
    </>
  ),
  baixar: (
    <>
      <Path d="M12 3v12" />
      <Path d="m7 10 5 5 5-5" />
      <Path d="M5 21h14" />
    </>
  ),
  ajustes: (
    <>
      <Path d="M4 21v-7" />
      <Path d="M4 10V3" />
      <Path d="M12 21v-9" />
      <Path d="M12 8V3" />
      <Path d="M20 21v-5" />
      <Path d="M20 12V3" />
      <Path d="M1 14h6" />
      <Path d="M9 8h6" />
      <Path d="M17 16h6" />
    </>
  ),
  voltar: <Path d="m15 18-6-6 6-6" />,
  confere: <Path d="M20 6 9 17l-5-5" />,
  fechar: (
    <>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </>
  ),
  atencao: (
    <>
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
      <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NomeIcone = keyof typeof DESENHOS;

type Props = { nome: NomeIcone; cor: string; tamanho?: number; espessura?: number };

export function Icone({ nome, cor, tamanho = 22, espessura = 1.8 }: Props) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round">
      {DESENHOS[nome]}
    </Svg>
  );
}
