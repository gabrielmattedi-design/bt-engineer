/**
 * Camada 5 — interpretação do texto livre (§19).
 *
 * CONTRATO DE ISOLAMENTO (docs/ARCHITECTURE.md §5):
 *   1. A IA NUNCA recebe o catálogo — não pode escolher um produto.
 *   2. A IA NUNCA retorna números técnicos — `value` é enum ou booleano, jamais peso/RA/swingweight.
 *   3. Toda saída passa por Zod. Falha de schema ⇒ descartado, log, segue sem o sinal.
 *   4. O retorno é `ProfileSignal[]`, nunca um `PlayerProfile`. O merge com as respostas objetivas
 *      acontece em `build-profile.ts`, onde a resposta explícita sempre vence (R-05).
 *
 * A extração usa TOOL USE com `tool_choice` forçado: é o mecanismo de saída estruturada suportado
 * em todas as versões do SDK, e o schema da ferramenta é a própria fronteira do que a IA pode dizer.
 */

import { z } from 'zod';
import type { ProfileSignal } from '@/domain/player-profile';
import { AI_MODEL, getAiClient } from './client';

/**
 * Campos que a IA pode preencher. Note que TODOS são enums fechados: não existe caminho pelo qual
 * a IA devolva um número de especificação técnica.
 */
const SIGNAL_FIELDS = {
  swing_speed: ['lenta', 'moderada', 'rapida', 'muito_rapida'],
  swing_length: ['curto', 'medio', 'longo'],
  forehand_type: ['topspin_pesado', 'topspin_moderado', 'mais_chapado'],
  backhand_hands: ['uma_mao', 'duas_maos'],
  perceived_level: [
    'iniciante',
    'iniciante_avancado',
    'intermediario',
    'intermediario_avancado',
    'avancado',
  ],
  play_style: [
    'dominar_fundo',
    'muito_topspin',
    'mais_chapado',
    'atacar_cedo',
    'contra_atacar',
    'all_court',
    'subir_rede',
  ],
  discomfort_areas: ['cotovelo', 'ombro', 'punho', 'nenhum'],
  objective: [
    'potencializar',
    'ganhar_potencia',
    'ganhar_controle',
    'mais_spin',
    'atacar_mais',
    'mais_conforto',
    'mais_estabilidade',
    'mais_facil',
    'mais_exigente',
  ],
} as const;

const signalSchema = z.object({
  field: z.enum(
    Object.keys(SIGNAL_FIELDS) as [keyof typeof SIGNAL_FIELDS, ...Array<keyof typeof SIGNAL_FIELDS>],
  ),
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
  /** Sem evidência literal, sem sinal. Isso é o que torna o merge auditável. */
  evidence: z.string().min(3),
});

const extractionSchema = z.object({
  signals: z.array(signalSchema).max(12),
});

const TOOL_NAME = 'registrar_sinais';

const TOOL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    signals: {
      type: 'array',
      maxItems: 12,
      description:
        'Sinais extraídos do texto. Registre apenas o que o jogador AFIRMOU. Não infira, ' +
        'não complete lacunas, não deduza a partir de conhecimento geral de tênis.',
      items: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: Object.keys(SIGNAL_FIELDS),
            description: 'Qual característica do jogador este trecho descreve.',
          },
          value: {
            type: 'string',
            description:
              'Valor do enum correspondente ao campo. Valores válidos por campo: ' +
              Object.entries(SIGNAL_FIELDS)
                .map(([k, v]) => `${k}: ${v.join('|')}`)
                .join(' · '),
          },
          confidence: {
            type: 'number',
            description:
              'Entre 0 e 1. Use ≥ 0.8 apenas quando o jogador afirmou explicitamente. ' +
              'Use < 0.5 quando for interpretação — sinais abaixo de 0.5 são descartados.',
          },
          evidence: {
            type: 'string',
            description: 'O trecho LITERAL do texto do jogador que sustenta este sinal.',
          },
        },
        required: ['field', 'value', 'confidence', 'evidence'],
      },
    },
  },
  required: ['signals'],
};

const SYSTEM_PROMPT = `Você extrai informações estruturadas de um texto escrito por um jogador de tênis sobre o próprio jogo.

Sua única tarefa é registrar o que o jogador AFIRMOU sobre si mesmo, usando a ferramenta ${TOOL_NAME}.

Regras:
- Registre apenas o que está explícito ou fortemente implícito no texto.
- Nunca infira características a partir de conhecimento geral de tênis. Se o jogador diz que usa uma raquete de 300 g, isso NÃO significa que o swing dele é rápido.
- Nunca produza especificações técnicas de equipamento (peso, swingweight, rigidez, padrão de cordas, tensão). Esses dados vêm do banco de dados, não de você.
- Toda entrada precisa citar o trecho literal do texto como evidência.
- Se o texto não trouxer informação sobre nenhum dos campos, retorne uma lista vazia. Uma lista vazia é uma resposta correta e comum.
- Não invente. Não complete lacunas. Não seja prestativo além do texto.`;

export type ExtractionContext = {
  /** Campos que o questionário já respondeu — usado apenas para telemetria de divergência. */
  readonly answeredFields: readonly string[];
};

/**
 * Extrai sinais do texto livre.
 *
 * Nunca lança: qualquer falha (sem chave, timeout, schema inválido, resposta inesperada) devolve
 * lista vazia. A ausência de IA degrada a análise, não a quebra.
 */
export async function extractFreeText(
  text: string,
  _ctx: ExtractionContext = { answeredFields: [] },
): Promise<ProfileSignal[]> {
  const trimmed = text.trim();
  if (trimmed.length < 15) return [];

  const client = getAiClient();
  if (!client) return [];

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      // Folga suficiente para o raciocínio interno + a chamada de ferramenta, sem truncar.
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description:
            'Registra os sinais estruturados extraídos do texto do jogador. ' +
            'Chame exatamente uma vez, mesmo que a lista de sinais esteja vazia.',
          input_schema: TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: trimmed }],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return [];

    const parsed = extractionSchema.safeParse(toolUse.input);
    if (!parsed.success) return [];

    // Validação final: o valor precisa pertencer ao enum daquele campo. Um LLM pode devolver
    // um valor plausível mas inexistente; aqui ele é descartado em vez de contaminar o perfil.
    return parsed.data.signals
      .filter((signal) => {
        const allowed = SIGNAL_FIELDS[signal.field] as readonly string[];
        return allowed.includes(signal.value);
      })
      .map(
        (signal): ProfileSignal => ({
          field: signal.field,
          value: signal.value,
          confidence: signal.confidence,
          evidence: signal.evidence,
        }),
      );
  } catch {
    // Timeout, rede, rate limit, erro de API: seguimos sem os sinais.
    return [];
  }
}

export const AI_SIGNAL_FIELDS = SIGNAL_FIELDS;
