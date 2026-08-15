import { isTestMode } from '@/domain/sourced';

/**
 * Aviso permanente de ambiente de testes.
 *
 * Aparece em TODA página enquanto `ALLOW_UNVERIFIED_DATASET=true`. Não é fechável, e isso é
 * deliberado: um aviso que o visitante dispensa no primeiro clique não avisa ninguém.
 *
 * O §69 proíbe vender com dado não conferido. Publicar uma versão de testes é legítimo — desde que
 * quem chegue saiba exatamente o que está vendo.
 */
export function TestModeBanner() {
  if (!isTestMode()) return null;

  return (
    <div className="bg-ball px-4 py-2 text-center text-xs font-medium text-ink">
      Ambiente de testes — as especificações técnicas ainda estão em conferência e nada aqui está à
      venda.
    </div>
  );
}
