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
  'no-speech': 'Não ouvi nada. Segure o microfone, fale e solte para enviar.',
  'audio-capture': 'Não consegui usar o microfone deste aparelho.',
  network: 'O reconhecimento de fala precisa de internet agora. Tente de novo.',
  'language-not-supported': 'Este aparelho não reconhece fala em português.',
  'service-not-allowed': 'O reconhecimento de fala está desligado neste aparelho.',
};

/** Toque mais curto que isto não é gravação: a pessoa só encostou no botão. */
const TOQUE_CURTO_MS = 450;
/** Depois de soltar, quanto esperar o aparelho fechar o texto antes de enviar o que já se tem. */
const ESPERA_DO_FIM_MS = 2500;

export type GravacaoDeVoz = ReturnType<typeof useGravacaoDeVoz>;

/**
 * Áudio como no WhatsApp: segura o microfone para falar, solta para enviar, desliza para cancelar.
 * A fala vira texto no próprio aparelho (reconhecimento do iOS/Android) e é o texto que vai para o assistente;
 * o áudio não passa pelo servidor do Talhio. `aoEnviar` recebe a pergunta quando a pessoa solta o botão.
 */
export function useGravacaoDeVoz(aoEnviar: (texto: string) => void) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [parcial, setParcial] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const modulo = useRef(carregarModulo()).current;
  const entregar = useRef(aoEnviar);
  useEffect(() => {
    entregar.current = aoEnviar;
  });

  // O que foi entendido: trechos já fechados pelo aparelho e o trecho que ainda está sendo falado.
  const fechados = useRef<string[]>([]);
  const atual = useRef('');
  const texto = () => [...fechados.current, atual.current].join(' ').replace(/\s+/g, ' ').trim();
  /** O que fazer quando o aparelho parar de ouvir: enviar, descartar ou nada (parou sozinho). */
  const destino = useRef<'enviar' | 'descartar' | null>(null);
  const segurando = useRef(false);
  const comecouEm = useRef(0);
  const esperaDoFim = useRef<ReturnType<typeof setTimeout> | null>(null);

  const concluir = () => {
    if (esperaDoFim.current) clearTimeout(esperaDoFim.current);
    esperaDoFim.current = null;
    const fazer = destino.current;
    destino.current = null;
    const entendido = texto();
    fechados.current = [];
    atual.current = '';
    setGravando(false);
    setParcial('');
    if (fazer !== 'enviar') return;
    if (entendido) entregar.current(entendido);
    else setAviso(AVISOS['no-speech']!);
  };
  const concluirRef = useRef(concluir);
  useEffect(() => {
    concluirRef.current = concluir;
  });

  useEffect(() => {
    if (!modulo) return;
    const assinaturas = [
      modulo.addListener('start', () => {
        comecouEm.current = Date.now();
        setSegundos(0);
        setGravando(true);
        // Soltou antes de o aparelho começar a ouvir: para na hora.
        if (!segurando.current) modulo.abort();
      }),
      modulo.addListener('result', (evento) => {
        const trecho = evento.results[0]?.transcript ?? '';
        if (evento.isFinal) {
          // No iOS o texto final já traz tudo; no Android cada pausa fecha um trecho.
          if (trecho && !fechados.current.includes(trecho)) fechados.current = trecho.startsWith(fechados.current.join(' ')) ? [trecho] : [...fechados.current, trecho];
          atual.current = '';
        } else {
          atual.current = trecho;
        }
        setParcial(texto());
      }),
      modulo.addListener('end', () => concluirRef.current()),
      modulo.addListener('error', (evento) => {
        const eraParaEnviar = destino.current === 'enviar';
        // Com texto já entendido, o erro do fim ("não ouvi mais nada") não joga a pergunta fora.
        if (eraParaEnviar && texto()) return concluirRef.current();
        destino.current = null;
        concluirRef.current();
        if (evento.error !== 'aborted') setAviso(AVISOS[evento.error] ?? 'Não consegui entender o áudio. Tente de novo.');
      }),
    ];
    return () => {
      for (const assinatura of assinaturas) assinatura.remove();
      if (esperaDoFim.current) clearTimeout(esperaDoFim.current);
      modulo.abort();
    };
  }, [modulo]);

  // O relógio da gravação, como no WhatsApp.
  useEffect(() => {
    if (!gravando) return;
    const relogio = setInterval(() => setSegundos(Math.floor((Date.now() - comecouEm.current) / 1000)), 250);
    return () => clearInterval(relogio);
  }, [gravando]);

  /** A pessoa encostou e segurou o microfone. */
  const comecar = async () => {
    setAviso(null);
    if (!modulo) {
      setAviso('O áudio precisa da versão nova do app. Atualize o app para usar o microfone.');
      return;
    }
    segurando.current = true;
    comecouEm.current = Date.now();
    destino.current = null;
    fechados.current = [];
    atual.current = '';
    const permissao = await modulo.getPermissionsAsync();
    if (!permissao.granted) {
      // O aparelho abre a pergunta de permissão por cima do botão: a gravação começa no próximo toque.
      segurando.current = false;
      const pedido = await modulo.requestPermissionsAsync();
      setAviso(pedido.granted ? 'Pronto. Agora segure o microfone para falar e solte para enviar.' : AVISOS['not-allowed']!);
      return;
    }
    if (!segurando.current) {
      setAviso('Segure o microfone para falar e solte para enviar.');
      return;
    }
    modulo.start({ lang: 'pt-BR', interimResults: true, continuous: true, addsPunctuation: true });
  };

  /** Soltou o botão: fecha o áudio e envia o que foi entendido. */
  const soltar = () => {
    if (!segurando.current) return;
    segurando.current = false;
    if (!modulo) return;
    if (Date.now() - comecouEm.current < TOQUE_CURTO_MS) {
      destino.current = 'descartar';
      modulo.abort();
      setAviso('Segure o microfone para falar e solte para enviar.');
      return;
    }
    destino.current = 'enviar';
    modulo.stop();
    // Se o aparelho demorar a fechar, envia o que já foi entendido.
    esperaDoFim.current = setTimeout(() => {
      modulo.abort();
      concluirRef.current();
    }, ESPERA_DO_FIM_MS);
  };

  /** Deslizou para cancelar: nada é enviado. */
  const cancelar = () => {
    segurando.current = false;
    destino.current = 'descartar';
    modulo?.abort();
    setGravando(false);
    setParcial('');
  };

  return { gravando, segundos, parcial, aviso, limparAviso: () => setAviso(null), comecar: () => void comecar(), soltar, cancelar };
}
