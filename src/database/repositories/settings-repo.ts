import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db, isDatabaseConfigured } from '@/database/client';
import { appSettings, SETTING_KEYS } from '@/database/schema';
import { isMissingTable } from '@/database/setup';

/**
 * Leitura e escrita das configurações operacionais (ver `schema/settings.ts`).
 *
 * ─── TOLERÂNCIA A BANCO AUSENTE ──────────────────────────────────────────────────────────────
 *
 * `readSetting` NUNCA lança. Ela é consultada por componentes que aparecem em toda página — o
 * aviso de modo de testes, por exemplo — e derrubar a home inteira porque uma tabela de
 * configuração ainda não existe seria trocar um problema pequeno por um total.
 *
 * A ausência é lida como "não configurado", que é o padrão SEGURO em todos os usos atuais: sem
 * resposta do banco, o modo simulado fica DESLIGADO e o produto se comporta como um site normal
 * de produção. Um default que erra para o lado de "cobrar" nunca dá dinheiro de graça a ninguém.
 */
export async function readSetting(key: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const rows = await db()
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    return rows[0]?.value ?? null;
  } catch (error) {
    // Tabela ainda não criada é o estado esperado antes do primeiro bootstrap, não uma falha.
    if (!isMissingTable(error)) {
      console.error('[settings] falha ao ler configuração', key, error);
    }
    return null;
  }
}

export async function writeSetting(key: string, value: string): Promise<void> {
  await db()
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Modo de pagamento simulado ligado pelo painel.
 *
 * `cache()` do React deduplica a consulta DENTRO de uma mesma renderização: o aviso do topo, a
 * página e a ação de checkout perguntam a mesma coisa, e sem isso seriam três idas ao banco para
 * responder a mesma pergunta em uma única request. O cache não atravessa requests, então desligar
 * o modo tem efeito imediato no próximo carregamento — que é o comportamento que um interruptor
 * precisa ter.
 */
export const simulatedPaymentsEnabledInDatabase = cache(async (): Promise<boolean> => {
  return (await readSetting(SETTING_KEYS.simulatedPayments)) === 'true';
});

/**
 * Acesso só por convite, ligado pelo painel.
 *
 * Mesmo `cache()` e mesma razão do interruptor acima: a pergunta aparece no aviso do topo, na
 * página de planos e na ação de checkout, e é uma só ida ao banco por request.
 */
export const inviteOnlyEnabledInDatabase = cache(async (): Promise<boolean> => {
  return (await readSetting(SETTING_KEYS.inviteOnly)) === 'true';
});
