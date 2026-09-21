import { describe, expect, it } from 'vitest';
import { canTransition, type PaymentStatus } from '@/payments/provider';

/**
 * ═══ A MÁQUINA DE ESTADOS NÃO PODE RECUSAR DINHEIRO QUE ENTROU ═══════════════════════════════
 *
 * ⚠️ CASO REAL (21/09/2026)
 *
 * Um cliente pagou R$ 49,99 no cartão, recebeu comprovante, e não recebeu o relatório. O pedido
 * estava em `failed`, e a tabela de transições recusava:
 *
 *   "O pedido 5ef9efeb… está em 'failed' e não aceita ir para 'paid'. Nada foi alterado."
 *
 * Dinheiro na conta, comprovante no celular do cliente, e o sistema estruturalmente impedido de
 * entregar — nem pelo webhook, nem pela recuperação manual.
 *
 * O caminho até ali é comum no Checkout Pro: a primeira tentativa é recusada (limite, banco,
 * antifraude), o comprador tenta de novo na mesma tela, e a segunda passa. O `external_reference`
 * é o mesmo, então a aprovação chega para um pedido já marcado como falho.
 *
 * ─── A INCOERÊNCIA QUE DENUNCIAVA O DESCUIDO ──────────────────────────────────────────────
 *
 * `failed → pending` já era permitido, e `pending → paid` também. A tabela sempre aceitou que um
 * pedido falho voltasse à vida — só bloqueava o ÚLTIMO passo da mesma jornada. Caminho longo
 * passava, atalho não. Isso não é regra, é caso esquecido.
 */
describe('transições de pagamento', () => {
  /** O que o caso de 21/09 exigia, e que a tabela recusava. */
  it('um pedido falho aceita ser pago — a segunda tentativa do cliente passou', () => {
    expect(
      canTransition('failed', 'paid'),
      'voltou a recusar dinheiro que entrou: cliente com comprovante e sem produto',
    ).toBe(true);
  });

  /**
   * E a proteção original continua de pé: `paid` é terminal, exceto por estorno.
   *
   * É o que impede um `pending` atrasado, chegando fora de ordem, de revogar na prática o acesso de
   * quem já pagou. Afrouxar isso para consertar o caso acima teria trocado um defeito por outro.
   */
  it('pago não volta para trás', () => {
    for (const destino of ['pending', 'failed', 'cancelled'] as PaymentStatus[]) {
      expect(canTransition('paid', destino), `paid → ${destino} deixou de ser bloqueado`).toBe(
        false,
      );
    }
    expect(canTransition('paid', 'refunded'), 'estorno é a única saída de paid').toBe(true);
  });

  /**
   * A coerência que faltava: se o caminho longo até `paid` existe, o atalho tem de existir.
   *
   * Qualquer estado que alcance `paid` em dois passos precisa alcançá-lo em um. Enquanto isso não
   * for verdade, a tabela contém de novo um caso esquecido — e o custo dele é sempre o mesmo:
   * alguém pagou e não recebeu.
   *
   * ─── POR QUE SÓ `paid`, E NÃO TODO DESTINO ────────────────────────────────────────────────
   *
   * A primeira versão deste teste cobrava a propriedade para qualquer destino, e reprovou em
   * `pending → paid → refunded` (permitido) contra `pending → refunded` (proibido).
   *
   * Isso não é o mesmo defeito. Ele é anterior a esta correção, ninguém mediu um caso dele, e
   * liberar `pending → refunded` por simetria seria exatamente o que o comentário de `cancelled`
   * em provider.ts diz para não fazer: decidir por analogia em vez de com o caso na mão. Se um dia
   * um estorno chegar para um pedido que nunca foi marcado como pago, a varredura mostra, e aí se
   * decide.
   *
   * O invariante fica no que foi medido: dinheiro que entrou não pode ser recusado.
   */
  it('nenhum estado alcança "paid" em dois passos e fica proibido em um', () => {
    const estados: PaymentStatus[] = ['pending', 'paid', 'failed', 'cancelled', 'refunded'];

    for (const origem of estados) {
      for (const meio of estados) {
        if (!canTransition(origem, meio)) continue;
        if (!canTransition(meio, 'paid')) continue;
        expect(
          canTransition(origem, 'paid'),
          `${origem} → ${meio} → paid é permitido, mas ${origem} → paid não`,
        ).toBe(true);
      }
    }
  });

  /**
   * `cancelled` continua fechado, e é decisão — não esquecimento.
   *
   * Cancelamento no gateway é ato deliberado (PIX expirado, comprador desistindo), não tentativa
   * malsucedida. Não apareceu nenhum caso de pedido cancelado com pagamento aprovado; se aparecer,
   * a varredura vai mostrar, e aí se decide com o caso na mão em vez de por analogia.
   */
  it('cancelado segue sem saída, por decisão', () => {
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
  });
});
