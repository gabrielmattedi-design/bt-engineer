import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { attemptCounters } from '../schema/throttle';

/**
 * Limitador de tentativas. Ver `schema/throttle.ts` para o desenho e o porquê.
 */

/** Tamanho da janela. Curto o bastante para não punir engano honesto, longo para atrapalhar ataque. */
const JANELA_MIN = 15;

/** Início da janela atual, arredondado — é o que faz duas requisições caírem na mesma linha. */
function janelaAtual(): Date {
  const ms = JANELA_MIN * 60_000;
  return new Date(Math.floor(Date.now() / ms) * ms);
}

export type Veredito = { readonly permitido: boolean; readonly restantes: number };

/**
 * Conta a tentativa e diz se ela ainda cabe no limite.
 *
 * ─── POR QUE CONTA ANTES DE SABER SE ACERTOU ─────────────────────────────────────────────────
 *
 * O incremento acontece na tentativa, não na falha. Contar só os erros deixaria um caminho aberto:
 * quem já conhece um código válido poderia usá-lo entre palpites para zerar a conta, e um atacante
 * com um acerto na mão teria tentativas infinitas para descobrir os outros.
 *
 * ─── POR QUE ELE FALHA ABERTO ────────────────────────────────────────────────────────────────
 *
 * Sem banco configurado, ou com o banco fora do ar, a função LIBERA. É uma escolha, e não a mais
 * segura das duas: um banco indisponível passaria a barrar todo mundo, inclusive quem está pagando,
 * transformando uma falha de infraestrutura numa loja fechada.
 *
 * O limitador é defesa em profundidade, não a única. Quem passar por aqui ainda precisa da senha
 * certa ou do código certo — o que ele impede é a tentativa BARATA e repetida, e um atacante que
 * dependesse de derrubar nosso banco para tentar já teria um problema maior nas mãos.
 */
export async function contarTentativa(scope: string, maximo: number): Promise<Veredito> {
  if (!isDatabaseConfigured()) return { permitido: true, restantes: maximo };

  try {
    const janela = janelaAtual();

    /*
      Incremento atômico: uma ida ao banco, sem ler antes de escrever.

      Ler-e-depois-escrever tem uma janela em que duas tentativas simultâneas leem o mesmo valor e
      gravam o mesmo incremento — o clássico jeito de um limitador de 5 deixar passar 10 sob
      rajada, que é exatamente a condição de um ataque.
    */
    const linhas = await db()
      .insert(attemptCounters)
      .values({ scope, windowStart: janela, attempts: 1 })
      .onConflictDoUpdate({
        target: [attemptCounters.scope, attemptCounters.windowStart],
        set: { attempts: sql`${attemptCounters.attempts} + 1` },
      })
      .returning({ attempts: attemptCounters.attempts });

    const usadas = linhas[0]?.attempts ?? 1;
    return { permitido: usadas <= maximo, restantes: Math.max(0, maximo - usadas) };
  } catch (error) {
    console.error('[limite] não foi possível contar a tentativa', scope, error);
    return { permitido: true, restantes: maximo };
  }
}

/**
 * Zera o contador — chamado quando a tentativa dá certo.
 *
 * Sem isto, o dono do site que errasse a senha algumas vezes e depois acertasse continuaria
 * consumindo a mesma janela, e um engano honesto de manhã o deixaria de fora à tarde.
 */
export async function limparTentativas(scope: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await db()
      .delete(attemptCounters)
      .where(and(eq(attemptCounters.scope, scope), gte(attemptCounters.windowStart, janelaAtual())));
  } catch {
    // Falhar aqui só mantém um contador que expira sozinho. Não vale derrubar um login que deu certo.
  }
}

export const LIMITE_JANELA_MINUTOS = JANELA_MIN;
