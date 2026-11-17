/** Todo o texto da página. O que está aqui também alimenta os dados estruturados (SEO). */

/** O que o Talhio cobre, do começo ao fim do serviço. */
export const pilares = [
  { icone: "plano", titulo: "Planejamento de operações" },
  { icone: "mapa", titulo: "Acompanhamento em tempo real" },
  { icone: "relatorio", titulo: "Relatórios automáticos" },
  { icone: "assistente", titulo: "IA com os dados da fazenda" },
] as const;

/** A promessa central: o que o agrônomo planeja chega ao monitor da máquina. */
export const noMonitor = [
  "O agrônomo planeja o plantio ou a colheita pelo aplicativo",
  "Escala quem opera cada máquina, em cada turno",
  "O operador recebe o talhão, a linha e o serviço no monitor",
  "Ninguém precisa de treinamento nem de aplicativo novo",
] as const;

export const sobreORelatorio = [
  "Hectares, horas e tempo parado, calculados pelo sistema",
  "Por máquina, por dia, por semana e por mês",
  "Sempre comparado com o período anterior",
  "Em PDF, pronto para o grupo da equipe no WhatsApp",
] as const;

export const paraQuem = [
  { icone: "mapa", titulo: "Produtores rurais", texto: "Saiba o que cada máquina fez no dia sem ligar para ninguém." },
  { icone: "plano", titulo: "Agrônomos", texto: "Planeje, acompanhe e entregue o relatório em poucos toques." },
  { icone: "escala", titulo: "Grupos e fazendas", texto: "A mesma rotina para toda a equipe, em todas as áreas." },
] as const;

/** Relatório de exemplo. É demonstração: os números não são de uma fazenda real. */
export const relatorio = {
  periodo: "Hoje, 10 de novembro",
  numeros: [
    { valor: "112 ha", rotulo: "Área trabalhada", variacao: "14% a mais que ontem" },
    { valor: "31h", rotulo: "Horas de máquina", variacao: "2h a mais que ontem" },
    { valor: "2h10", rotulo: "Tempo parado", variacao: "40 min a menos" },
  ],
  maquinas: [
    { nome: "Trator 8R 410", area: "44 ha", parte: 100 },
    { nome: "Trator 8R 370", area: "41 ha", parte: 93 },
    { nome: "Trator 7R 330", area: "27 ha", parte: 61 },
  ],
  resumo: "O plantio avançou 112 ha, 14% acima de ontem. A maior parada foi do Trator 6M 195, com 1h20.",
} as const;

/** Mensagem de exemplo da escala no grupo da equipe. É demonstração: nomes e números não são de uma fazenda real. */
export const escala = {
  hora: "18:04",
  titulo: "Escala de amanhã · Talhão 7",
  linhas: ["Trator 8R 410 · manhã: João", "Trator 8R 410 · tarde: Marcos", "Trator 7R 330 · manhã: Pedro", "Recado: começar pela cabeceira perto da estrada."],
} as const;

/** Conversa de exemplo da IA. É demonstração: os números não são de uma fazenda real. */
export const conversa = [
  { de: "voce", texto: "Qual foi a maior parada de hoje?" },
  { de: "ia", texto: "Foi do Trator 6M 195: 1h20, com o motor desligado desde as 11h33. Vale conferir com o operador o que houve." },
] as const;

export const passos = [
  { titulo: "Conecte a John Deere", texto: "A fazenda autoriza o acesso na página da própria John Deere. As máquinas e os talhões aparecem no Talhio em seguida." },
  { titulo: "Monte o plano e a escala", texto: "Diga o que vai ser feito no talhão e escolha o operador de cada máquina, por turno." },
  { titulo: "Avise a equipe", texto: "A escala vai para o grupo do WhatsApp da fazenda. O operador não instala nada." },
  { titulo: "Acompanhe e feche o dia", texto: "Veja o serviço avançar no mapa, pergunte à IA o que quiser saber e receba o relatório pronto." },
] as const;

export const integracao = [
  { estado: "Pronto", titulo: "Conexão com o Operations Center", texto: "Máquinas, posição, horas e talhões direto da conta da fazenda, com a autorização dela." },
  { estado: "Pronto", titulo: "Talhões e linhas por arquivo", texto: "Importe a pasta do monitor Geração 4 (4200, 4240, 4600 e 4640) ou um arquivo KML ou KMZ." },
  { estado: "Em teste", titulo: "Do Talhio para o monitor", texto: "O talhão e a linha criados no Talhio vão para o Operations Center da fazenda. O envio do plano de trabalho depende de liberação da John Deere." },
] as const;

export const perguntas = [
  { pergunta: "O que quer dizer “tempo real”?", resposta: "O mapa e os números se atualizam sozinhos enquanto você olha, com o último dado que a máquina enviou. O intervalo depende da conexão da máquina; quando ela fica sem sinal, o Talhio mostra o horário do último dado e atualiza quando ela reconecta." },
  { pergunta: "Como a escala e o relatório chegam no WhatsApp?", resposta: "Você conecta o WhatsApp da fazenda uma vez e escolhe o grupo da equipe. Depois, ao tocar em enviar, a escala ou o relatório chega no grupo. Nada é enviado sem você mandar." },
  { pergunta: "A IA pode inventar um número?", resposta: "Os números (hectares, horas, paradas) são calculados pelo sistema a partir dos dados das máquinas; a IA só escreve a resposta com eles. Como toda IA, ela pode se enganar ao escrever, então o relatório é sempre a referência." },
  { pergunta: "O que a IA sabe sobre a minha fazenda?", resposta: "O que está no Talhio: máquinas, talhões, escala, andamento e os relatórios do dia e da semana. Ela também explica como usar o aplicativo. Cada usuário só vê as próprias conversas, e os dados de uma fazenda não aparecem para outra." },
  { pergunta: "O Talhio funciona com quais marcas de máquina?", resposta: "Por enquanto, só John Deere. Começamos por uma marca para fazer bem feito; outras entram depois." },
  { pergunta: "Preciso trocar o monitor ou instalar algum aparelho na máquina?", resposta: "Não. O Talhio usa o que a máquina já envia para o John Deere Operations Center e os arquivos do próprio monitor." },
  { pergunta: "O Talhio fica com a minha senha da John Deere?", resposta: "Não. A fazenda autoriza o acesso na página da própria John Deere e pode cancelar essa autorização quando quiser. O Talhio nunca vê a senha." },
  { pergunta: "E quando a máquina fica sem sinal no campo?", resposta: "Ela aparece como “sem sinal” no mapa e no relatório, com o horário do último dado. As informações entram quando a máquina volta a se conectar." },
  { pergunta: "Tem para iPhone e Android?", resposta: "Sim, o aplicativo é feito para os dois." },
  { pergunta: "Quanto custa?", resposta: "Ainda estamos definindo os planos. Fale com a gente e conte o tamanho da sua operação." },
] as const;
