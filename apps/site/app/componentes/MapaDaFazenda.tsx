/**
 * Ilustração do mapa do aplicativo: talhões, as passadas já feitas (cheias) e por fazer (tracejadas) e as máquinas,
 * cada uma com a cor do estado. É demonstração e decorativa: o texto ao lado diz o que o mapa mostra.
 */
export function MapaDaFazenda() {
  return (
    <svg className="mapa-fazenda" viewBox="0 0 560 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="560" height="300" fill="#274A2C" />
      <path d="M-10 210 180 150l170 54 220-70v176H-10z" fill="#2F5632" />
      <path d="M-10 262 250 214l320 44v52H-10z" fill="#21402A" />
      <g strokeLinejoin="round" strokeWidth="2">
        <path d="M372 28 530 44 520 150 362 132z" fill="#5E5236" stroke="rgba(241,242,236,.75)" />
        <path d="M34 196 190 176 208 270 50 284z" fill="#3D6337" stroke="rgba(241,242,236,.75)" />
        <path d="M52 40 326 18 348 150 74 174z" fill="#4E7A3A" stroke="#E7B31F" strokeWidth="3.5" />
      </g>
      <g strokeLinecap="round" strokeWidth="3" stroke="#E7B31F">
        <path d="M70 58 316 38" />
        <path d="M73 76 319 56" />
        <path d="M76 94 322 74" />
        <path d="M79 112 325 92" />
        <path d="M82 130 250 116" />
      </g>
      <g strokeLinecap="round" strokeWidth="3" stroke="#F1F2EC" strokeDasharray="1 9" opacity=".8">
        <path d="M262 115 328 110" />
        <path d="M85 148 331 128" />
      </g>
      <g stroke="#F1F2EC" strokeWidth="4">
        <circle cx="250" cy="116" r="12" fill="#3F7A2C" />
        <circle cx="170" cy="86" r="12" fill="#3F7A2C" />
        <circle cx="446" cy="86" r="12" fill="#3F7A2C" />
        <circle cx="118" cy="232" r="11" fill="#E7B31F" />
        <circle cx="500" cy="236" r="7" fill="#9AA79A" strokeWidth="3" />
      </g>
      <circle cx="250" cy="116" r="21" fill="none" stroke="#9CC46A" strokeWidth="2" opacity=".7" />
    </svg>
  );
}
