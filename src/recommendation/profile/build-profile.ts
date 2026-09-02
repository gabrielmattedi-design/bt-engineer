/**
 * Camada 3 — construção do `PlayerProfile`.
 *
 * Implementa docs/RECOMMENDATION_ENGINE.md §3. Função pura: respostas + sinais → perfil.
 * Nenhuma resposta bruta chega ao ranking; tudo passa por aqui e vira score documentado.
 */

import { clamp, mean, norm, round } from '@/domain/scores';
import type { PlayStyle } from '@/domain/racket';
import type {
  Contradiction,
  CurrentRacketSnapshot,
  CurrentStringSnapshot,
  NeedKey,
  ObjectiveKey,
  PlayerProfile,
  ProfileSignal,
  SwingLength,
} from '@/domain/player-profile';
import { NEED_KEYS, PROFILE_VERSION } from '@/domain/player-profile';
import {
  DISLIKE_NEED_BONUS,
  NEED_PRIORITY_BONUS,
  OBJECTIVE_NEED_BONUS,
} from '@/recommendation/config/weights.v1';
import type { QuestionnaireAnswers, TriState } from './answers';
import { computeNeeds, preservedNeeds } from './needs';
import { countUnknowns } from './answers';

const TRISTATE_SCORE: Record<TriState, number> = { sim: 100, as_vezes: 55, nao: 15 };

/**
 * Nome de exibição: só letras, espaços e apóstrofo, no máximo 24 caracteres.
 *
 * O nome é o único texto livre que vai parar dentro de um SVG gerado — e SVG é um formato onde
 * `<` e `&` têm significado. A filtragem acontece aqui, na fronteira de entrada, para que nenhum
 * ponto de saída precise lembrar de escapar.
 */
function sanitizeName(raw: string | null): string | null {
  if (!raw) return null;
  const clean = raw
    .replace(/[^\p{L}\p{M}\s'’-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return clean.length > 0 ? clean : null;
}

const PERCEIVED_LEVEL_SCORE: Record<string, number> = {
  iniciante: 15,
  iniciante_avancado: 35,
  intermediario: 55,
  intermediario_avancado: 72,
  avancado: 88,
};

const EXPERIENCE_YEARS: Record<string, number> = {
  menos_6m: 0.4,
  '6_12m': 0.8,
  '1_2a': 1.5,
  '2_5a': 3.5,
  mais_5a: 6,
};

const TOURNAMENT_SCORE: Record<string, number> = {
  nunca: 20,
  amadores: 60,
  regionais: 85,
  competitivo: 100,
};

const SWING_SPEED_SCORE: Record<string, number> = {
  lenta: 20,
  moderada: 45,
  rapida: 72,
  muito_rapida: 90,
};

const SWING_LENGTH_SCORE: Record<SwingLength, number> = {
  short: 25,
  medium: 55,
  long: 85,
  unknown: 50,
};

/**
 * ─── A RÉGUA É A DO AMADOR DE CLUBE ────────────────────────────────────────────────────────
 *
 * As duas escalas abaixo alimentam `physical_capacity_score`, que decide quanta massa a pessoa
 * consegue manejar. Elas estavam calibradas como se o universo fosse de atletas: "abaixo da média"
 * valia 25 de 100, um valor que descreve alguém que mal sustenta o braço.
 *
 * Só que o público deste produto é amador de clube, e nessa população cansar no terceiro set é a
 * norma, não a exceção. Com a régua antiga, o jogador mediano se classificava para baixo, recebia
 * `physical_capacity` baixo e, por consequência, uma raquete mais leve do que ele aguenta — leve
 * demais é instável contra bola pesada, que é justamente o que se joga em clube.
 *
 * A base sobe e a amplitude diminui: o meio da escala passa a descrever o jogador de clube típico,
 * e os extremos ficam reservados a quem realmente está fora dessa média.
 */
const STRENGTH_SCORE: Record<string, number> = {
  abaixo: 38,
  media: 58,
  acima: 78,
  bem_acima: 93,
};

const FITNESS_SCORE: Record<string, number> = {
  sedentario: 35,
  moderado: 55,
  bom: 75,
  atletico: 92,
};

const BREAKAGE_SCORE: Record<string, number> = {
  nunca: 10,
  raramente: 30,
  a_cada_2_3_meses: 55,
  mensalmente: 80,
  semanalmente: 95,
};

/**
 * Fator etário para capacidade física. Platô até 34 anos, decaimento linear até 0.65 aos 65.
 * Abaixo de 16, 0.8 — não por fraqueza, mas por desenvolvimento físico incompleto.
 */
export function ageFactor(age: number | null): number {
  if (age === null) return 0.85;
  if (age < 16) return 0.8;
  if (age <= 34) return 1.0;
  if (age >= 65) return 0.65;
  return 1.0 - ((age - 34) / (65 - 34)) * 0.35;
}

/**
 * Nível calibrado — docs/RECOMMENDATION_ENGINE.md §3.1.
 *
 * O autoavaliado pesa apenas 0.15: carrega informação real, mas tem viés conhecido nas duas direções
 * e não pode dominar. As 6 perguntas objetivas pesam 0.60.
 */
export function calibrateLevel(a: QuestionnaireAnswers): {
  objective: number;
  perceived: number;
  final: number;
  mismatch: boolean;
} {
  const objectiveItems: number[] = [];
  for (const q of [
    a.can_sustain_rally,
    a.can_direct_ball,
    a.can_generate_spin,
    a.can_vary_depth,
    a.reliable_second_serve,
  ]) {
    if (q !== null) objectiveItems.push(TRISTATE_SCORE[q]);
  }
  if (a.tournament_experience !== null) {
    objectiveItems.push(TOURNAMENT_SCORE[a.tournament_experience] ?? 20);
  }

  const perceived =
    a.perceived_level === null ? 45 : (PERCEIVED_LEVEL_SCORE[a.perceived_level] ?? 45);

  // Sem nenhuma resposta objetiva, cai-se no autoavaliado — e a confiança despenca em confidence.ts.
  const objective = objectiveItems.length === 0 ? perceived : mean(objectiveItems);

  const years = a.experience_duration === null ? 1 : (EXPERIENCE_YEARS[a.experience_duration] ?? 1);
  const lessonsFactor =
    a.has_lessons === 'atualmente' ? 1 : a.has_lessons === 'ja_fiz' ? 0.75 : 0.4;
  const experience =
    0.5 * norm(years, 0, 5) +
    0.3 * norm(a.frequency_per_week ?? 1, 0, 4) +
    0.2 * lessonsFactor;

  const final = clamp(0.6 * objective + 0.25 * (100 * experience) + 0.15 * perceived, 0, 100);

  return {
    objective: round(objective),
    perceived,
    final: round(final),
    mismatch: Math.abs(perceived - objective) > 25,
  };
}

/**
 * Porte físico — massa e estatura, na escala em que a raquete é comprada.
 *
 * ═══ O BURACO QUE ISTO FECHA ══════════════════════════════════════════════════════════════════
 *
 * `computePhysicalCapacity` pesava força percebida, preparo, idade e frequência — e NÃO usava
 * altura nem peso. O questionário perguntava as duas coisas na primeira tela e as descartava aqui.
 * Uma pessoa de 1,60 m e 50 kg e outra de 1,90 m e 95 kg, com a mesma autoavaliação de força,
 * recebiam a mesma capacidade de manejo e, portanto, a mesma faixa de peso de raquete.
 *
 * O caso foi relatado: uma iniciante de 1,60 m e 50 kg recebeu uma raquete de 300 g.
 *
 * A massa da raquete é ABSOLUTA — 300 g são 300 g —, e o que a sustenta durante duas horas é massa
 * corporal e alavanca. Quem tem 50 kg move 0,6% do próprio peso a cada golpe; quem tem 90 kg move
 * 0,33%. Ignorar isso é ignorar a variável mais direta que existe no formulário.
 *
 * O peso domina (0.6) porque é o que sustenta a inércia; a altura entra como alavanca e como
 * proxy de envergadura. As faixas cobrem o adulto praticante, e o `clamp` cuida dos extremos.
 */
/**
 * Ajuste de composição corporal por sexo — pequeno, e limitado a ESTE termo.
 *
 * ═══ POR QUE PEQUENO, E POR QUE SÓ AQUI ══════════════════════════════════════════════════════
 *
 * A pergunta foi pedida com a justificativa de que "mulheres naturalmente pedem algo mais leve".
 * Na média isso se confirma, e o motor já responde a isso SEM saber o sexo — porque responde ao
 * corpo. Medido, com força e preparo declarados idênticos:
 *
 *     1,60 m / 55 kg  →  capacidade 62  →  raquete de 285 g
 *     1,78 m / 78 kg  →  capacidade 71  →  raquete de 305 g
 *
 * Vinte gramas de diferença saem só de altura e peso. O que o sexo acrescenta ALÉM disso é a
 * fração de massa magra do tronco e dos braços, que difere na média para o mesmo peso — e é ela,
 * não o peso total, que sustenta a raquete durante duas horas.
 *
 * Por isso o ajuste incide só sobre o termo de porte, que carrega 0.22 da capacidade. O efeito
 * final fica em torno de um ponto: suficiente para desempatar um caso de fronteira, insuficiente
 * para reescrever a recomendação de alguém.
 *
 * ─── O LIMITE QUE ISTO NÃO PODE CRUZAR ────────────────────────────────────────────────────
 *
 * Sexo é uma média de população; a pessoa que respondeu é uma pessoa. Existe muita mulher mais
 * forte que muito homem, e um motor que decidisse pelo sexo estaria errado sobre ela — e sobre a
 * própria física, porque quem segura a raquete é o braço, não a estatística.
 *
 * Daí o desenho: a força declarada pesa 0.30, o preparo 0.24, e o sexo entra como um multiplicador
 * modesto dentro de 0.22. Uma mulher que responde "bem acima da média" recebe mais capacidade que
 * um homem que responde "abaixo da média", e é assim que tem de ser. `prefiro_nao_dizer` fica no
 * meio, sem penalizar quem não quis responder.
 */
const SEX_BODY_FACTOR: Record<string, number> = {
  feminino: 0.9,
  masculino: 1.0,
  prefiro_nao_dizer: 0.95,
};

function bodyScore(a: QuestionnaireAnswers): number {
  const weight = a.weight_kg === null ? null : norm(a.weight_kg, 45, 95) * 100;
  const height = a.height_cm === null ? null : norm(a.height_cm, 150, 195) * 100;

  // Sem nenhuma das duas, o termo vira neutro em vez de inventar um corpo.
  if (weight === null && height === null) return 50;

  const size = weight === null ? height! : height === null ? weight : 0.6 * weight + 0.4 * height;
  return clamp(size * (SEX_BODY_FACTOR[a.sex ?? ''] ?? 1.0), 0, 100);
}

/**
 * ═══ O TETO DE PESO ESTÁTICO ═════════════════════════════════════════════════════════════════
 *
 * O motor ordena por inércia de swing, e não por peso — ver `frame_weight_ceiling_g` em
 * `domain/player-profile.ts` para o porquê disso estar certo e do porquê de mesmo assim faltar um
 * limite absoluto acima da pontuação. Aqui está o limite.
 *
 * ─── A FÓRMULA ────────────────────────────────────────────────────────────────────────────────
 *
 *     teto = min(320, 240 + 1,03 × kg)   ·   × 0,98 se feminino   ·   e ≤ 300 se menor de 16
 *
 * O coeficiente de 1,03 g por quilo não saiu de uma tabela publicada — não existe uma. Ele foi
 * ajustado contra alvos que o dono do produto fixou olhando perfil por perfil, e o teste é se a
 * mesma reta atende todos eles ao mesmo tempo:
 *
 *     rapaz 16a · 68 kg · avançado ...... alvo 310 g   →   240 + 70,0 = 310 g   ✓
 *     mulher 45a · 54 kg · fraca ........ alvo 290 g   →   295,6 × 0,98 = 289 g  ✓
 *     mulher 35a · 63 kg · mediana ...... alvo 295 g   →   304,9 × 0,98 = 298 g  ✓ (*)
 *
 * (*) O catálogo é granular: os pesos existentes são 270, 275, 280, 285, 295, 300, 305, 310 e 315.
 *     Não há nada entre 285 e 295, então um teto de 298 e um de 295 selecionam exatamente o mesmo
 *     conjunto. A diferença entre a reta e o alvo desaparece na prática — e é por isso que não vale
 *     a pena torturar a fórmula por três gramas.
 *
 * ─── OS DOIS EXTREMOS, E POR QUE ELES SE RESOLVEM SOZINHOS ────────────────────────────────────
 *
 * O questionário aceita de 35 a 150 kg (`quiz/steps.ts`), e a reta foi desenhada para que nenhuma
 * das pontas precise de tratamento especial:
 *
 *   • 35 kg, feminino, o menor corpo possível: 276,05 × 0,98 = 270,5 g. O quadro mais leve do
 *     catálogo pesa 270 g. O teto encosta no chão do catálogo sem passar por baixo dele — nunca
 *     existe um perfil para o qual o teto sozinho zere as candidatas.
 *
 *   • 78 kg para cima: a reta passa de 320 g e o `min` a segura ali. Como o quadro mais pesado do
 *     catálogo tem 315 g, o teto deixa de restringir qualquer coisa. É o comportamento certo — o
 *     limite existe para proteger quem tem pouco corpo, não para dizer a quem tem muito que precisa
 *     de mais peso. Um homem de 92 kg que joga por lazer continua recebendo o que o encaixe físico
 *     e o pedido dele indicarem, que muitas vezes é um quadro de 300 g.
 *
 * ─── POR QUE O SEXO ENTRA, E POR QUE TÃO POUCO ────────────────────────────────────────────────
 *
 * Pedido explícito: "acho que o teto precisa ter um fator por sexo sim, mesmo que não tão alto". O
 * 0,98 é a menor correção que ainda muda alguma coisa — dois por cento de 300 g são 6 g, e 6 g é
 * menos que um degrau do catálogo na maior parte da faixa. Ele só age nas fronteiras, que é
 * exatamente onde a diferença de composição corporal para o mesmo peso importa (ver
 * `SEX_BODY_FACTOR`, algumas linhas acima, para o argumento longo).
 *
 * `prefiro_nao_dizer` recebe 0,99, o meio-termo — mesma lógica do 0,95 lá em cima: quem não quis
 * responder não é penalizado como se tivesse respondido o menor valor.
 *
 * ─── E POR QUE OS MENORES DE 16 TÊM UM TETO PRÓPRIO, ALÉM DO PORTE ────────────────────────────
 *
 * Porque a reta lê o corpo de hoje e não lê o osso. Um garoto de 13 anos com 75 kg recebe pela reta
 * um teto de 317 g, e ele é grande — mas ainda está com a placa de crescimento aberta, e ombro e
 * cotovelo em desenvolvimento é a única parte desta conta que o peso na balança não descreve.
 *
 * O corte em 16 anos é o mesmo de `ageFactor`, algumas linhas acima, e é o mesmo que o mercado usa
 * para separar o quadro juvenil do adulto. 300 g é o topo da faixa em que os fabricantes posicionam
 * os modelos de transição. Para o menino de 52 kg do caso original a reta já é mais restritiva
 * (293 g), então este teto só age em quem é grande e novo ao mesmo tempo.
 */
const CEILING_BASE_G = 240;
const CEILING_PER_KG = 1.03;
const CEILING_MAX_G = 320;
const CEILING_UNDER_16_G = 300;
const CEILING_SEX_FACTOR: Record<string, number> = {
  feminino: 0.98,
  masculino: 1.0,
  prefiro_nao_dizer: 0.99,
};

export function frameWeightCeiling(a: Pick<QuestionnaireAnswers, 'age' | 'weight_kg' | 'sex'>): number | null {
  // Sem peso não há reta. Inventar um corpo para poder limitar seria pior do que não limitar:
  // o teto viraria uma restrição sobre uma pessoa imaginária.
  if (a.weight_kg === null) return null;

  const porPorte =
    Math.min(CEILING_MAX_G, CEILING_BASE_G + CEILING_PER_KG * a.weight_kg) *
    (CEILING_SEX_FACTOR[a.sex ?? ''] ?? 1.0);

  const teto = a.age !== null && a.age < 16 ? Math.min(porPorte, CEILING_UNDER_16_G) : porPorte;

  /*
    Arredonda PARA BAIXO, e não para o inteiro mais próximo.

    Um teto é uma afirmação de segurança, e afirmação de segurança arredonda contra si mesma. A
    diferença é de menos de um grama e nunca muda qual quadro sobrevive — os pesos do catálogo são
    inteiros de cinco em cinco —, mas o dia em que aparecer um quadro de 289,5 g o comportamento
    já estará decidido, e decidido do lado certo.
  */
  return Math.floor(teto);
}

/**
 * Multiplicador de INTENSIDADE sobre a frequência — o que transforma sessões em carga.
 *
 * ═══ POR QUE A FREQUÊNCIA SOZINHA NÃO DESCREVE A CARGA ═══════════════════════════════════════
 *
 * A capacidade física usava `frequency_per_week` cru. Três vezes por semana peloteando e três
 * vezes por semana jogando partida são o mesmo número e não são o mesmo condicionamento: a partida
 * tem ponto disputado, deslocamento sob pressão e duas horas sem escolher o ritmo.
 *
 * `plays_matches` é a pergunta que separa os dois casos, e ela era COLETADA E DESCARTADA — nenhum
 * componente do motor lia esse campo. O questionário perguntava e jogava fora.
 *
 * ─── POR QUE MULTIPLICADOR, E NÃO MAIS UM TERMO SOMADO ──────────────────────────────────────
 *
 * Somado, quem joga partida ganharia carga mesmo jogando uma vez por mês — e não ganha: sem volume
 * não há condicionamento, por mais disputada que seja a partida. A intensidade MODULA o volume, ela
 * não substitui. Quem não joga partida nenhuma mantém a maior parte da carga (0.75, não zero),
 * porque treinar também condiciona.
 */
const MATCH_INTENSITY: Record<string, number> = {
  sim: 1.0,
  as_vezes: 0.88,
  nao: 0.75,
};

/**
 * Carga de jogo, 0–1 — volume modulado pela intensidade.
 *
 * Fica separada do NÍVEL TÉCNICO de propósito. `frequency_per_week` e `tournament_experience`
 * também alimentam `calibrateLevel`, e é correto que alimentem: quem joga mais e compete tende a
 * jogar melhor. Mas jogar melhor e aguentar mais raquete são coisas diferentes — um veterano de
 * torneio aos 60 anos tem nível alto e carga física que o corpo dele já não sustenta. Misturar as
 * duas leituras num número só foi o que manteve a intensidade fora da conta do físico até agora.
 */
function playLoad(a: QuestionnaireAnswers): number {
  const volume = norm(a.frequency_per_week ?? 1, 0, 4);
  const intensity = a.plays_matches === null ? 0.88 : (MATCH_INTENSITY[a.plays_matches] ?? 0.88);
  return clamp(volume * intensity, 0, 1);
}

function computePhysicalCapacity(a: QuestionnaireAnswers): number {
  const strength = a.perceived_strength === null ? 50 : (STRENGTH_SCORE[a.perceived_strength] ?? 50);
  const fitness = a.fitness_level === null ? 50 : (FITNESS_SCORE[a.fitness_level] ?? 50);

  /**
   * O porte entra com peso 0.22 — abaixo da força declarada, e de propósito.
   *
   * Corpo pequeno não é sinônimo de fraco, e existe muita gente leve e forte. A autoavaliação de
   * força continua sendo o termo mais pesado justamente para que ela possa contradizer o porte:
   * quem tem 55 kg e responde "bem acima da média" sobe, e deve subir.
   *
   * O que o porte impede é o oposto — que a ausência do dado deixe o motor cego para um corpo que
   * não sustenta 300 g, quando o próprio formulário já perguntou quanto ele pesa.
   */
  /**
   * ═══ POR QUE O PREPARO CEDEU PESO PARA A CARGA DE JOGO ═════════════════════════════════════
   *
   * Era preparo 0.24 e frequência 0.10. Os dois medem a MESMA coisa — condicionamento — por
   * caminhos diferentes: `fitness_level` é o que a pessoa diz sobre si, `playLoad` é o que ela faz
   * toda semana. Evidência de comportamento costuma valer mais que autoavaliação, e a distância de
   * mais de duas vezes entre eles não tinha justificativa.
   *
   * Passam a 0.18 e 0.16 — quase par. Não fui além disso de propósito: `frequency_per_week` é uma
   * contagem grosseira de 0 a 4, e deixá-la superar uma pergunta direta seria confiar demais numa
   * régua curta. E o preparo declarado captura o que a frequência de tênis não vê — academia,
   * corrida, quem é atlético fora da quadra.
   *
   * A soma dos cinco termos continua 1.00. Uma versão intermediária destas linhas somou 1.06 por
   * engano e inflou a capacidade de todo mundo em ~6%, o que passou nos testes de persona e teria
   * ido para produção parecendo o efeito pretendido — a soma é conferida agora porque ela não se
   * denuncia sozinha.
   */
  const base =
    0.3 * strength +
    0.18 * fitness +
    0.22 * bodyScore(a) +
    0.14 * (ageFactor(a.age) * 100) +
    0.16 * (playLoad(a) * 100);

  return clamp(base + backhandAdjustment(a), 0, 100);
}

/**
 * Ajuste por backhand de uma mão — o outro campo que era coletado e descartado.
 *
 * ═══ POR QUE O BACKHAND ENTRA NA CAPACIDADE ══════════════════════════════════════════════════
 *
 * "Quanto de raquete o corpo sustenta" é decidido pelo golpe MAIS FRACO, não pela média. De nada
 * adianta o forehand aguentar 310 g se o backhand desmonta: o jogador vai chegar atrasado nesse
 * lado a tarde inteira. Para quem joga com uma mão só, o braço de trás não ajuda a sustentar o
 * peso nem a estabilizar o impacto, e é esse lado que define o teto.
 *
 * ─── POR QUE PEQUENO, E POR QUE NÃO É "UMA MÃO PEDE RAQUETE LEVE" ────────────────────────────
 *
 * Muito jogador de uma mão usa quadro pesado, e com razão: massa ajuda a estabilizar o impacto
 * justamente onde falta o segundo braço. O ajuste NÃO diz que uma mão quer raquete leve — diz que
 * a margem de erro é menor, porque o mesmo excesso de massa cobra mais caro de um lado só.
 *
 * Por isso são 3 pontos, e não 10. É o suficiente para desempatar uma fronteira entre dois quadros
 * próximos, e insuficiente para reescrever a recomendação de alguém — que é o mesmo critério usado
 * no ajuste de composição corporal por sexo, algumas linhas acima.
 *
 * Sem resposta, nenhum ajuste: não inventamos um backhand que a pessoa não declarou.
 */
function backhandAdjustment(a: QuestionnaireAnswers): number {
  return a.backhand_hands === 'uma_mao' ? -3 : 0;
}

function computeSwingLength(a: QuestionnaireAnswers): SwingLength {
  switch (a.swing_length) {
    case 'curto':
      return 'short';
    case 'medio':
      return 'medium';
    case 'longo':
      return 'long';
    default:
      return 'unknown';
  }
}

/** Sensibilidade no braço (§17). Nunca é diagnóstico — é um peso de decisão de equipamento. */
/**
 * Sensibilidade no braço — graduada por ÁREA, RECÊNCIA e INTENSIDADE.
 *
 * ═══ POR QUE ISTO PRECISOU MUDAR ════════════════════════════════════════════════════════════
 *
 * Marcar "ombro" bastava para o motor tratar conforto como prioridade máxima. E a pergunta aceita
 * "sente OU JÁ SENTIU" — praticamente todo jogador de clube com alguns anos de quadra marca
 * alguma coisa. O efeito era desproporcional e em quatro frentes ao mesmo tempo: o peso do
 * componente de conforto quase triplicava, a necessidade de conforto era fixada em 80, uma
 * penalização passava a cobrar de todo frame de viga larga, e o poliéster saía da lista de cordas.
 *
 * Uma dor leve de três anos atrás — que pode nem ter vindo da raquete — governava a recomendação
 * inteira. E o jogador via uma raquete confortável e fraca sem entender por quê.
 *
 * ═══ COMO FICA ══════════════════════════════════════════════════════════════════════════
 *
 * A área dá a base. A recência e a intensidade MULTIPLICAM, e as duas juntas separam o histórico
 * do problema atual: dor forte e presente mantém o comportamento antigo, dor leve e antiga vira um
 * sinal fraco que informa sem mandar.
 *
 * ─── E POR QUE O SILÊNCIO NÃO REDUZ NADA ─────────────────────────────────────────────────────
 *
 * Quem marca "cotovelo" e não qualifica recebe o peso INTEGRAL da área, como se a dor fosse atual
 * e relevante. Isso parece contradizer o parágrafo acima e não contradiz: o que foi calibrado é a
 * resposta a uma qualificação DADA, não a ausência dela.
 *
 * A primeira versão desta função descontava o não-respondido para 0.49 do peso, e a consequência
 * foi medida pelos testes de persona: um jogador que relatava cotovelo caía de 75 para 36.75, o
 * suficiente para desligar o filtro de viga muito larga E devolver poliéster à lista de cordas —
 * as duas travas de segurança da R-11 — sem que ele tivesse dito nada que justificasse isso.
 *
 * Silêncio não é evidência de leveza. Uma dor não qualificada pode ser qualquer uma das nove
 * combinações, incluindo a pior, e é a pior que define o risco. O caminho para baixo existe e é
 * barato: são duas perguntas, exibidas assim que a área é marcada. Quem quiser menos conforto e
 * mais raquete responde "leve" e "há mais tempo", e o motor obedece na hora.
 */
const DISCOMFORT_RECENCY: Record<string, number> = {
  agora: 1.0,
  ultimos_meses: 0.8,
  ano_passado: 0.5,
  ha_mais_tempo: 0.3,
};

const DISCOMFORT_INTENSITY: Record<string, number> = {
  leve: 0.55,
  moderada: 0.8,
  forte: 1.0,
};

/**
 * A origem do desconforto — o fator que mais separa dois casos que pareciam iguais.
 *
 * Um cotovelo lesionado na academia não é evidência de que a raquete está errada; o mesmo cotovelo
 * lesionado JOGANDO é o sinal mais forte do questionário inteiro. Antes desta pergunta os dois
 * entravam idênticos no motor, e o equipamento era escolhido pelo primeiro.
 *
 * `nao` não zera. Uma articulação sensível continua sensível seja qual for a origem, e um frame
 * rígido vai castigá-la do mesmo jeito — o que muda é que a raquete deixa de ser tratada como causa
 * do problema, e passa a ser tratada como algo que não deve piorá-lo. Daí 0.55, e não 0.
 *
 * `nao_sei` fica perto do topo de propósito: na dúvida sobre a origem, protege-se.
 */
const DISCOMFORT_ORIGIN: Record<string, number> = {
  sim: 1.0,
  nao_sei: 0.85,
  nao: 0.55,
};

function computeArmSensitivity(a: QuestionnaireAnswers): number {
  const relevant = a.discomfort_areas.filter((x) => x !== 'nenhum');
  if (relevant.length === 0) return 0;

  const scores: Record<string, number> = { cotovelo: 75, ombro: 65, punho: 60 };
  const values = relevant.map((r) => scores[r] ?? 60);
  const base = clamp(relevant.length > 1 ? Math.max(...values) + 10 : Math.max(...values), 0, 95);

  /**
   * Recência agora vem de DUAS perguntas, e a primeira manda.
   *
   * `discomfort_status` é a pergunta direta — está ou esteve. Quem responde "atual" recebe peso
   * integral sem precisar datar nada, porque não há o que datar. Só quem responde "passado" vê a
   * pergunta de quando, e é ali que o desconto acontece.
   *
   * O `?? a.discomfort_when` cobre os questionários respondidos antes desta mudança, que só tinham
   * a pergunta antiga: eles continuam sendo lidos exatamente como foram respondidos.
   */
  const recency =
    a.discomfort_status === 'atual'
      ? 1.0
      : (DISCOMFORT_RECENCY[a.discomfort_when ?? ''] ?? 1.0);

  // Sem qualificação, peso integral: o desconto é resposta a uma resposta, nunca ao silêncio.
  const intensity = DISCOMFORT_INTENSITY[a.discomfort_intensity ?? ''] ?? 1.0;
  const origin = DISCOMFORT_ORIGIN[a.discomfort_from_tennis ?? ''] ?? 1.0;

  return clamp(base * recency * intensity * origin, 0, 95);
}

const STYLE_ANSWER_MAP: Record<string, PlayStyle[]> = {
  dominar_fundo: ['aggressive_baseliner', 'baseline'],
  muito_topspin: ['heavy_spin'],
  mais_chapado: ['flat_hitter'],
  atacar_cedo: ['aggressive_baseliner'],
  contra_atacar: ['counterpuncher'],
  all_court: ['all_court'],
  subir_rede: ['serve_and_volley', 'net_player'],
  sem_estilo: ['baseline', 'all_court', 'counterpuncher'],
};

function computeStyleWeights(a: QuestionnaireAnswers): {
  weights: Record<PlayStyle, number>;
  declared: boolean;
} {
  const weights: Record<PlayStyle, number> = {
    baseline: 0,
    aggressive_baseliner: 0,
    counterpuncher: 0,
    heavy_spin: 0,
    flat_hitter: 0,
    all_court: 0,
    serve_and_volley: 0,
    net_player: 0,
  };

  const selections = a.play_style.filter((s) => s !== 'sem_estilo');
  for (const sel of selections) {
    for (const style of STYLE_ANSWER_MAP[sel] ?? []) {
      weights[style] += 1;
    }
  }

  // Forehand reforça o eixo spin/flat sem sobrepor a declaração explícita de estilo.
  if (a.forehand_type === 'topspin_pesado') weights.heavy_spin += 0.6;
  if (a.forehand_type === 'mais_chapado') weights.flat_hitter += 0.6;

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (total === 0) {
    /**
     * Nenhum estilo declarado — o jogador respondeu "ainda não tenho um estilo" ou pulou a
     * pergunta. Este é o caso NORMAL do iniciante, não uma resposta incompleta.
     *
     * O vetor devolvido é um placeholder difuso, mantido apenas para que consumidores que leem
     * `style_weights` tenham algo coerente. `declared: false` é o dado que importa: o motor
     * renormaliza `playstyle_fit` para fora em vez de cobrar aderência a um estilo inventado.
     * Sem isso, o iniciante era reprovado por não parecer um contra-atacante.
     */
    return { weights: { ...weights, baseline: 1, all_court: 1, counterpuncher: 1 }, declared: false };
  }
  return { weights, declared: true };
}

const OBJECTIVE_MAP: Record<string, ObjectiveKey> = {
  potencializar: 'maximize_current',
  ganhar_potencia: 'more_power',
  ganhar_controle: 'more_control',
  mais_spin: 'more_spin',
  atacar_mais: 'attack_more',
  mais_conforto: 'more_comfort',
  mais_estabilidade: 'more_stability',
  mais_facil: 'easier_equipment',
  mais_exigente: 'more_demanding_equipment',
  nao_sei: 'unknown',
};

const OBJECTIVE_NEED: Partial<Record<ObjectiveKey, NeedKey>> = {
  more_power: 'power',
  more_control: 'control',
  more_spin: 'spin',
  more_comfort: 'comfort',
  more_stability: 'stability',
};

/**
 * Merge dos sinais de texto livre — regras de R-05.
 *
 * A resposta objetiva SEMPRE vence quando existe e diverge. Nenhum caminho aqui sobrescreve
 * silenciosamente uma resposta explícita do usuário.
 */
function mergeSignals(
  a: QuestionnaireAnswers,
  signals: readonly ProfileSignal[],
): { applied: Partial<QuestionnaireAnswers>; contradictions: Contradiction[] } {
  const applied: Record<string, unknown> = {};
  const contradictions: Contradiction[] = [];
  const answers = a as unknown as Record<string, unknown>;

  const CRITICAL_FIELDS = new Set(['perceived_level', 'discomfort_areas', 'swing_speed']);

  for (const signal of signals) {
    if (signal.confidence < 0.5) continue;

    const current = answers[signal.field];
    const isUnset = current === null || current === undefined || current === 'nao_sei';

    if (isUnset) {
      applied[signal.field] = signal.value;
      continue;
    }

    if (current === signal.value) continue; // concordância: nada a fazer além do ganho de confiança

    contradictions.push({
      code: 'free_text_conflict',
      field: signal.field,
      objective_value: String(current),
      signal_value: String(signal.value),
      resolution: CRITICAL_FIELDS.has(signal.field) ? 'needs_confirmation' : 'objective_wins',
      message: `Você respondeu "${String(current)}", mas no texto livre mencionou algo compatível com "${String(signal.value)}".`,
    });
  }

  return { applied: applied as Partial<QuestionnaireAnswers>, contradictions };
}

export function buildPlayerProfile(
  rawAnswers: QuestionnaireAnswers,
  signals: readonly ProfileSignal[] = [],
): PlayerProfile {
  const merge = mergeSignals(rawAnswers, signals);
  const a: QuestionnaireAnswers = { ...rawAnswers, ...merge.applied };

  const level = calibrateLevel(a);
  const physicalCapacity = computePhysicalCapacity(a);
  const armSensitivity = computeArmSensitivity(a);
  const swingLength = computeSwingLength(a);

  // Swing desconhecido é INFERIDO, e a inferência é marcada — nunca fingimos que o usuário respondeu.
  const swingSpeedInferred = a.swing_speed === null || a.swing_speed === 'nao_sei';
  const declaredSwingSpeed = swingSpeedInferred
    ? clamp(0.6 * level.final + 0.4 * physicalCapacity, 0, 100)
    : (SWING_SPEED_SCORE[a.swing_speed as string] ?? 45);

  /**
   * Velocidade de swing declarada é LIMITADA pelo que o nível calibrado sustenta.
   *
   * ═══ O SEGUNDO MOTIVO DA RAQUETE DE 300 g ════════════════════════════════════════════════
   *
   * Varrendo as 9600 combinações possíveis para 1,60 m e 50 kg iniciante, 3,6% terminavam com uma
   * raquete de 295 g ou mais — e TODAS tinham a mesma resposta: swing "muito rápido". Aquele 90
   * entra em `handlingCapacity` com peso 0.35 e levanta sozinho o teto de massa.
   *
   * O problema não é a pessoa mentir. É que a pergunta não tem referência: um iniciante nunca viu
   * o próprio swing de fora e não tem com o que comparar. O questionário já sabe disso — ele fez
   * cinco perguntas objetivas (sustenta troca? direciona? gera efeito? varia profundidade? segundo
   * saque confiável?) e ela respondeu "não" às cinco.
   *
   * A regra R-05 já está escrita no produto: quando o percebido contradiz o objetivo, o objetivo
   * prevalece. Faltava aplicá-la aqui. O teto é generoso — 35 pontos acima do nível calibrado —,
   * então um jogador que realmente acelera o braço mais do que a técnica acompanha continua sendo
   * ouvido; o que deixa de acontecer é o salto de 70 pontos que punha uma raquete de tour na mão de
   * quem está aprendendo a sacar.
   */
  const SWING_OVER_LEVEL = 35;
  const swingCeiling = level.final + SWING_OVER_LEVEL;
  const swingSpeed = swingSpeedInferred
    ? declaredSwingSpeed
    : Math.min(declaredSwingSpeed, swingCeiling);

  // A contradição é REGISTRADA mais abaixo, junto das demais — aqui só se anota que houve.
  const swingSpeedCapped = !swingSpeedInferred && declaredSwingSpeed > swingCeiling;

  const naturalPower = clamp(
    0.45 * swingSpeed +
      0.25 * SWING_LENGTH_SCORE[swingLength] +
      0.2 * physicalCapacity +
      0.1 * level.final,
    0,
    100,
  );

  const depthScore = a.depth_control === null ? 50 : TRISTATE_SCORE[a.depth_control];
  const consistencyPenalty = a.ball_tendency.includes('variam_demais') ? 20 : 0;
  const technicalConsistency = clamp(
    0.55 * (depthScore - consistencyPenalty) + 0.45 * level.final,
    0,
    100,
  );

  const objectives: ObjectiveKey[] =
    a.objective.length === 0
      ? ['unknown']
      : a.objective.map((o) => OBJECTIVE_MAP[o] ?? 'unknown');

  const { needs, definition } = computeNeeds(a, armSensitivity);

  // Vetor de mudança desejada. Quem quer "potencializar o jogo atual" pede evolução, não revolução:
  // o ganho direcional cai pela metade.
  const conservative = objectives.includes('maximize_current');
  const gain = conservative ? 0.5 : 1.0;
  const style = computeStyleWeights(a);
  const desired: Record<NeedKey, number> = { ...needs };
  for (const k of NEED_KEYS) {
    desired[k] = round(clamp(needs[k] - 50, -40, 40) * gain);
  }

  /**
   * ═══ PISO POR POSIÇÃO NO TOP-3 DECLARADO ═════════════════════════════════════════════════
   *
   * A pergunta "do que você mais sente falta" é ORDENADA, e o jogador escolhe até três. A ordem
   * precisa aparecer na saída — mas o terceiro colocado é o terceiro DAQUELE TOP-3, não o último da
   * lista inteira: quem escolheu potência, controle e spin está dizendo que spin importa mais que
   * manobrabilidade, estabilidade e tudo o que ele NÃO escolheu.
   *
   * Sem este piso não era o que acontecia. O bônus de prioridade entra na escala 25/15/8, mas a
   * normalização de contraste (ver `needs.ts`) recentra e amplifica o vetor, e isso ESPALHA a
   * distância entre os três: medido, potência 35, controle 17, spin 5. Uma proporção de 7 para 1
   * onde o bônus previa 3 para 1. O terceiro colocado do top-3 caía para perto de zero e passava a
   * pesar menos que atributos que a pessoa nunca mencionou.
   *
   * A amplificação de contraste continua e é necessária — foi ela que resolveu o "hexágono
   * perfeito", em que todo mundo parecia precisar de tudo. O que ela não pode fazer é apagar uma
   * resposta explícita. O piso preserva a ORDEM (cada posição tem um mínimo menor que a anterior) e
   * garante que o menor deles continue acima do ruído dos não declarados.
   *
   * O piso é MÍNIMO, não valor fixo: as demais respostas do questionário continuam podendo elevar
   * qualquer eixo acima dele. Uma autoavaliação não é o único determinante — ela é um chão.
   */
  const PRIORITY_FLOOR = [22, 15, 10];
  const declaredPriorities = a.missing_attributes.filter((k): k is NeedKey =>
    (NEED_KEYS as readonly string[]).includes(k),
  );

  let previousFloor = Number.POSITIVE_INFINITY;
  for (const [index, key] of declaredPriorities.slice(0, PRIORITY_FLOOR.length).entries()) {
    const floor = Math.min(PRIORITY_FLOOR[index]!, previousFloor - 1) * gain;
    previousFloor = PRIORITY_FLOOR[index]!;
    if (desired[key] < floor) desired[key] = round(floor);
  }

  const currentRacket: CurrentRacketSnapshot | null = a.no_current_racket
    ? null
    : {
        variant_id: a.current_racket_id,
        unrecognized: a.current_racket_id === null && !!a.current_racket_free_text,
        // Preenchidos pelo motor a partir do catálogo quando a raquete é reconhecida.
        weight_g: null,
        head_size_sq_in: null,
        balance_mm: null,
        beam_width_avg_mm: null,
        swing_index: null,
      };

  const currentString: CurrentStringSnapshot | null = a.no_current_racket
    ? null
    : {
        string_variant_id: a.current_string_id,
        /*
          A categoria vem da resposta; `'nao_sei'` vira `null`, que é o que o motor entende por
          "não sabemos". Se um dia `current_string_id` chegar preenchido, `enrichProfileWithCatalog`
          sobrescreve isto com a categoria do MODELO — o dado mais forte ganha.
        */
        string_type:
          a.current_string_type === null || a.current_string_type === 'nao_sei'
            ? null
            : a.current_string_type,
        gauge_mm: a.current_string_gauge,
        tension_lbs: a.current_tension_lbs,
        tension_feeling: a.current_tension_feeling,
        breakage_frequency: a.string_breakage === null ? 30 : (BREAKAGE_SCORE[a.string_breakage] ?? 30),
      };

  const unknowns = countUnknowns(a);
  const contradictions = [...merge.contradictions];
  if (swingSpeedCapped) {
    contradictions.push({
      code: 'swing_speed_over_level',
      field: 'swing_speed',
      objective_value: String(round(swingCeiling)),
      signal_value: String(round(declaredSwingSpeed)),
      resolution: 'objective_wins',
      message:
        'Você descreveu um swing bem mais rápido do que as respostas técnicas sustentam. ' +
        'Consideramos um valor entre os dois: velocidade de braço acima da média para o seu ' +
        'nível, sem tratar você como jogador avançado na hora de escolher o peso do quadro.',
    });
  }
  if (level.mismatch) {
    contradictions.push({
      code: 'level_mismatch',
      field: 'perceived_level',
      objective_value: String(round(level.objective)),
      signal_value: String(level.perceived),
      resolution: 'objective_wins',
      message:
        'Seu nível autoavaliado difere do que as perguntas objetivas indicaram. Usamos o calibrado, ' +
        'com peso menor no autoavaliado.',
    });
  }

  return {
    profile_version: PROFILE_VERSION,
    player_level_score: level.final,
    perceived_level_score: level.perceived,
    objective_level_score: level.objective,
    technical_consistency_score: round(technicalConsistency),
    swing_speed_score: round(swingSpeed),
    swing_speed_inferred: swingSpeedInferred,
    swing_length: swingLength,
    natural_power_score: round(naturalPower),
    physical_capacity_score: round(physicalCapacity),
    age: a.age,
    frame_weight_ceiling_g: frameWeightCeiling(a),
    arm_sensitivity_score: armSensitivity,
    string_budget: a.string_budget,
    discomfort_areas: a.discomfort_areas.filter((x) => x !== 'nenhum'),
    needs,
    desired_change_vector: desired,
    declared_priorities: declaredPriorities,
    preserved_needs: preservedNeeds(a),
    // Sanitizado aqui e não na UI: o nome vai para uma imagem gerada no servidor, e é o servidor
    // que precisa garantir que ele não carregue markup nem tamanho absurdo.
    player_name: sanitizeName(a.player_name),
    needs_definition: definition,
    style_weights: style.weights,
    style_declared: style.declared,
    current_racket: currentRacket,
    current_string: currentString,
    objectives,
    unknown_answer_ratio:
      unknowns.answerable === 0 ? 0 : round(unknowns.unknown / unknowns.answerable, 3),
    free_text_length: a.free_text?.trim().length ?? 0,
    contradictions,
  };
}
