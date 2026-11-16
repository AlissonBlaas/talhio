// Única porta de entrada da feature. Quem está fora importa daqui, nunca de arquivos internos.
export { PassoWhatsapp } from './components/PassoWhatsapp';
export { AlertaWhatsapp } from './components/AlertaWhatsapp';
export { useWhatsapp } from './hooks/useWhatsapp';
// Usado pelos botões de enviar do relatório, da escala e do plano.
export { useEnviarAoGrupo } from './hooks/useEnviarAoGrupo';
export { ConectarWhatsapp } from './components/ConectarWhatsapp';
