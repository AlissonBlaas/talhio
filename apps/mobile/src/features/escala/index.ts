// Única porta de entrada da feature. Quem está fora importa daqui, nunca de arquivos internos.
export { EscalaScreen } from './screens/EscalaScreen';
export { useEscala } from './hooks/useEscala';
export { useMudarEscala, type ItemParaGravar } from './hooks/useMudarEscala';
export { escalaKeys } from './escala.keys';
export { rotuloDoTurno, TURNOS, detalheDoItem } from './textos';
