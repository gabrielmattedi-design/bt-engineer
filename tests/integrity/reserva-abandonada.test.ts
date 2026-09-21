import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * ═══ RESERVA NÃO É CONCLUSÃO ═════════════════════════════════════════════════════════════════
 *
 * ⚠️ DEFEITO REAL, MEDIDO NUM PAGAMENTO DE CLIENTE (21/09/2026)
 *
 * `processPaymentEvent` reserva o evento numa tabela com restrição única e só grava `processed_at`
 * no fim, depois de conceder o acesso. Entre as duas coisas acontecem seis operações.
 *
 * Se qualquer uma falhar — banco oscilando, timeout, função serverless encerrada antes da hora —
 * a reserva fica e o trabalho não acontece. E aí toda tentativa seguinte bate na restrição única e
 * devolve `duplicate`:
 *
 *   - o gateway reenvia a notificação → "duplicate", nada feito
 *   - o botão de recuperação manual → "duplicate", nada feito
 *
 * O pagamento fica IRRECUPERÁVEL. O dinheiro entrou, o cliente não recebeu, e o sistema inteiro
 * responde que já processou.
 *
 * Aconteceu com o pagamento 179878109696: o cliente reclamou, a recuperação respondeu "este
 * pagamento já tinha sido processado", e a venda continuou sem existir em lugar nenhum.
 *
 * ─── AS DUAS METADES DA CORREÇÃO ───────────────────────────────────────────────────────────
 *
 * 1. `processed_at IS NULL` distingue reserva abandonada de entrega concluída. A primeira é
 *    retomada; só a segunda é `duplicate` de verdade.
 * 2. A reserva é DESFEITA quando o trabalho falha — senão a correção 1 limparia os casos antigos
 *    enquanto o defeito seguisse criando novos.
 *
 * Sem a 2, o sistema se conserta no mesmo ritmo em que se quebra.
 */
const FONTE = readFileSync('src/database/repositories/commerce-repo.ts', 'utf8');

/** O trecho da função, para as buscas não pegarem código de outro lugar do arquivo. */
const FUNCAO =
  /export async function processPaymentEvent\([\s\S]*?\n\}\n/.exec(FONTE)?.[0] ?? '';

describe('uma reserva abandonada não trava o pagamento para sempre', () => {
  it('a função foi encontrada', () => {
    expect(FUNCAO, 'processPaymentEvent sumiu ou mudou de forma').not.toBe('');
  });

  /**
   * A regra central: bater na restrição única NÃO basta para devolver `duplicate`. É preciso
   * confirmar que a tentativa anterior chegou ao fim.
   */
  it('duplicate exige que a tentativa anterior tenha concluído', () => {
    expect(FUNCAO, 'a conclusão anterior deixou de ser verificada').toContain('processedAt');
    expect(
      FUNCAO,
      'voltou a devolver duplicate direto do conflito, sem olhar se o trabalho terminou',
    ).not.toMatch(/if \(!claimed\[0\]\) return \{ kind: 'duplicate' \};/);
  });

  /** A reserva abandonada é retomada, e o log diz isso — senão a retomada acontece às cegas. */
  it('a retomada é explícita e registrada', () => {
    expect(FUNCAO).toMatch(/reprocessando\s*=\s*true/);
    expect(FUNCAO).toContain('reserva abandonada');
  });

  /**
   * A segunda metade: falhar no meio libera a reserva.
   *
   * Sem isto, cada falha nova deixa um pagamento travado, e a retomada da metade 1 só enxuga gelo.
   */
  it('a reserva é liberada quando o trabalho falha', () => {
    expect(FUNCAO, 'o trabalho voltou a rodar sem rede de proteção').toMatch(/catch\s*\(/);
    expect(FUNCAO, 'a reserva deixou de ser desfeita na falha').toMatch(
      /delete\(paymentEvents\)/,
    );
  });

  /**
   * ⚠️ O cupom NÃO pode ser reprocessado.
   *
   * `consumirCupomDoPedido` incrementa `used_count` sem trava de repetição. Refazer uma reserva
   * abandonada gastaria um uso duas vezes — e num cupom com limite diário isso tira a vaga de
   * outra pessoa, que não tem nada a ver com a falha.
   *
   * Contar de menos é o erro barato: o pedido guarda o código e o percentual, então o caso segue
   * auditável, e o que a retomada existe para entregar é o produto que alguém pagou.
   */
  it('a retomada não consome o cupom de novo', () => {
    expect(FUNCAO, 'a retomada voltou a gastar o cupom uma segunda vez').toMatch(
      /!reprocessando && order\.couponCode/,
    );
  });
});
