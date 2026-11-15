import { useEffect, useRef, useState } from 'react';

type Modulo = typeof import('expo-speech-recognition');

/**
 * Carrega o reconhecimento de fala só quando é usado. Se o app instalado foi compilado antes de
 * este módulo entrar, ele não existe: o resto do app continua funcionando e o microfone avisa.
 */
function carregarModulo(): Modulo['ExpoSpeechRecognitionModule'] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-speech-recognition') as Modulo).ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

const AVISOS: Record<string, string> = {
  'not-allowed': 'Permita o microfone e o reconhecimento de fala para o Talhio nos Ajustes do aparelho.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
  'audio-capture': 'Não consegui usar o microfone deste aparelho.',
  network: 'O reconhecimento de fala precisa de internet agora. Tente de novo.',
  'language-not-supported': 'Este aparelho não reconhece fala em português.',
  'service-not-allowed': 'O reconhecimento de fala está desligado neste aparelho.',
};

/**
 * Fala vira texto no próprio aparelho (reconhecimento do iOS/Android): o áudio não passa pelo
 * servidor do Talhio. `aoOuvir` recebe o texto enquanto a pessoa fala, e de novo ao terminar.
 */
export function useDitado(aoOuvir: (texto: string) => void) {
  const [ouvindo, setOuvindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const modulo = useRef(carregarModulo()).current;
  const entregar = useRef(aoOuvir);
  useEffect(() => {
    entregar.current = aoOuvir;
  });

  useEffect(() => {
    if (!modulo) return;
    const assinaturas = [
      modulo.addListener('start', () => setOuvindo(true)),
      modulo.addListener('end', () => setOuvindo(false)),
      modulo.addListener('result', (evento) => {
        const texto = evento.results[0]?.transcript;
        if (texto) entregar.current(texto);
      }),
      modulo.addListener('error', (evento) => {
        setOuvindo(false);
        if (evento.error !== 'aborted') setAviso(AVISOS[evento.error] ?? 'Não consegui entender o áudio. Tente de novo.');
      }),
    ];
    return () => {
      for (const assinatura of assinaturas) assinatura.remove();
      modulo.abort();
    };
  }, [modulo]);

  const comecar = async () => {
    setAviso(null);
    if (!modulo) {
      setAviso('O áudio precisa da versão nova do app. Recompile o app para usar o microfone.');
      return;
    }
    const permissao = await modulo.requestPermissionsAsync();
    if (!permissao.granted) {
      setAviso(AVISOS['not-allowed']!);
      return;
    }
    modulo.start({ lang: 'pt-BR', interimResults: true, continuous: false, addsPunctuation: true });
  };

  return {
    ouvindo,
    aviso,
    limparAviso: () => setAviso(null),
    /** Começa a ouvir; se já estiver ouvindo, para e fica com o que entendeu. */
    alternar: () => (ouvindo ? modulo?.stop() : void comecar()),
  };
}
