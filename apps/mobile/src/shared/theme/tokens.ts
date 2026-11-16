/** Tokens visuais do Talhio, iguais aos do protótipo. Toda cor e fonte do app vem daqui. */
/**
 * Marca do Talhio (a mesma do site): verde lavoura, milho, algodão. Linha cheia é o que já foi feito,
 * tracejada é o que falta. As cores do mapa (talhões, passadas) seguem funcionais, não de marca.
 */
export const cores = {
  /** Marca. `mata` é o verde dos fundos escuros; `milho` é o destaque e o "feito". */
  mata: '#15321F',
  mataClara: '#1E4429',
  milho: '#E7B31F',
  milhoForte: '#F0C448',
  folha: '#3F7A2C',
  folhaClara: '#9CC46A',
  /** Texto sobre o milho. */
  sobreMilho: '#15321F',
  /** Texto suave sobre fundo escuro. */
  suaveSobreEscuro: '#CFDCC9',

  fundo: '#F1F2EC',
  cartao: '#FBFAF4',
  borda: '#D6D9CC',
  bordaForte: '#C9CDBE',
  divisor: '#E3E5DA',
  trilho: '#D3D8C8',

  texto: '#26201A',
  textoMedio: '#3E352C',
  textoSuave: '#5F564C',
  sobreEscuro: '#FFFFFF',

  primario: '#2E6A39',
  primarioSuave: '#E1EBD4',
  /** Texto sobre o fundo primário suave. */
  textoSobreSuave: '#1E4429',
  escuro: '#15321F',
  /** Texto e destaque dentro de cartões escuros. */
  textoSobreEscuro: '#F1F2EC',
  destaqueSobreEscuro: '#E7B31F',
  atalhoBorda: '#C5D4B5',

  sucesso: '#1E4429',
  sucessoFundo: '#E1EBD4',
  online: '#3F7A2C',
  alerta: '#7A4508',
  alertaForte: '#8A5A06',
  alertaFundo: '#F8EBC7',
  parada: '#E7B31F',
  neutro: '#3F4A44',
  neutroFundo: '#ECEEE6',
  semSinal: '#6B756F',

  perigo: '#B42318',
  perigoTexto: '#9A2A12',
  perigoFundo: '#FFF4ED',
  perigoBorda: '#F6D3BE',
  perigoIcone: '#FDE3D3',
  perigoDescricao: '#5E4A3E',
  aviso: '#C2410C',

  mapaFundo: '#2B3A28',
  /** Máquina sem sinal no mapa: cinza que não disputa atenção com quem está trabalhando. */
  semSinalNoMapa: '#8C9189',
  talhaoContorno: '#E040FB',
  talhaoPlantio: 'rgba(240,138,60,0.55)',
  talhaoPulverizacao: 'rgba(90,169,230,0.5)',
  talhaoSelecionado: 'rgba(224,64,251,0.18)',
  plantio: '#F08A3C',
  plantioTexto: '#8A3B08',
  plantioFundo: '#FDEBDD',
  pulverizacao: '#5AA9E6',
  pulverizacaoTexto: '#0E4A7A',
  pulverizacaoFundo: '#E2F0FB',
  alca: '#CFD2C3',
  desenho: '#F4C430',
  desenhoTexto: '#3A2A00',
  desenhoFundo: 'rgba(244,196,48,0.22)',
  talhaoSalvoFundo: 'rgba(224,64,251,0.28)',
  campoFundo: '#FBFAF4',
  campoBorda: '#CFD2C3',
  erroBorda: '#D92D20',
  desabilitado: '#E3E5DA',
  desabilitadoTexto: '#7A7569',
  dicaTexto: '#2B241D',
  controleMapa: 'rgba(21,50,31,0.88)',
  /** Ponto vermelho e texto do selo "AO VIVO". */
  aoVivo: '#EF4444',
  aoVivoTexto: '#FCA5A5',
  /** Barrinha de passos por cima do mapa. */
  passoSobreMapa: 'rgba(255,255,255,0.4)',
  /** Borda escura por baixo das linhas do trator: é o que as destaca do talhão colorido e do satélite. */
  passadaBorda: 'rgba(12,20,16,0.8)',
  passadaPendente: '#FFFFFF',
  /** Tons claros da operação, para a passada feita não sumir sobre o talhão da mesma cor. */
  passadaPlantio: '#FFD27A',
  passadaPulverizacao: '#BFE4FF',
  passadaColheita: '#B9F2CD',
} as const;

/**
 * Big Shoulders Display (condensada, de placa de silo e adesivo de máquina) para títulos, números e
 * rótulos de botão; Source Serif 4 (de caderneta de campo) para o texto. A condensada é estreita:
 * use tamanhos cerca de 30% maiores que numa sans comum.
 */
export const fontes = {
  titulo: 'Outfit_800ExtraBold',
  rotulo: 'Outfit_700Bold',
  rotuloLeve: 'Outfit_600SemiBold',
  regular: 'NunitoSans_400Regular',
  medio: 'NunitoSans_500Medium',
  semi: 'NunitoSans_600SemiBold',
  italico: 'NunitoSans_400Regular_Italic',
} as const;

/** Margem lateral das telas e altura da barra de abas (sem a área segura). */
export const MARGEM_TELA = 20;
export const ALTURA_BARRA = 66;
