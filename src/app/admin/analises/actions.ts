'use server';

import { isAuthenticated } from '../auth';
import { findAnalyses, type LookupResult } from '@/database/repositories/support-repo';
import { withAutoBootstrap } from '@/database/setup';

export type SearchResult = LookupResult | { error: string };

/**
 * Busca por POST, e não por GET com `?q=`.
 *
 * Um formulário GET colocaria o e-mail da pessoa na barra de endereço, no histórico do navegador,
 * no cabeçalho `Referer` e no log de acesso do servidor — quatro cópias de dado pessoal criadas de
 * graça, num painel cuja razão de existir é manipular esse dado com cuidado. O preço é que o
 * resultado não é linkável, e para uma tela de atendimento isso não é perda nenhuma.
 */
export async function searchAnalyses(
  _prev: unknown,
  formData: FormData,
): Promise<SearchResult | undefined> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const raw = String(formData.get('q') ?? '');

  try {
    return await withAutoBootstrap(() => findAnalyses(raw));
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao consultar.' };
  }
}
