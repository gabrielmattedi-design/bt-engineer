/**
 * Navegação do painel.
 *
 * ═══ POR QUE ISTO VIROU COMPONENTE ═══════════════════════════════════════════════════════════
 *
 * Cada tela do admin tinha a própria cópia da lista de links, com a tela atual em negrito e as
 * outras como link. Quatro cópias que precisavam concordar entre si — e a primeira vez que
 * discordaram foi ao acrescentar o funil: a tela nova existia e não havia como chegar nela por
 * nenhuma das outras, que é o mesmo defeito de `/entrar` e `/minhas-analises` repetido dentro do
 * painel.
 *
 * Com uma lista só, uma tela nova entra em todas as telas de uma vez, ou em nenhuma.
 */
const TELAS = [
  { href: '/admin/verificacao', key: 'verificacao', label: 'Curadoria' },
  { href: '/admin/funil', key: 'funil', label: 'Funil' },
  { href: '/admin/vendas', key: 'vendas', label: 'Vendas' },
  { href: '/admin/financeiro', key: 'financeiro', label: 'Financeiro' },
  { href: '/admin/pesquisa', key: 'pesquisa', label: 'Pesquisa' },
  { href: '/admin/analises', key: 'analises', label: 'Atendimento' },
  { href: '/admin/codigos', key: 'codigos', label: 'Códigos de acesso' },
  { href: '/admin/setup', key: 'setup', label: 'Preparar o sistema' },
] as const;

export type AdminScreen = (typeof TELAS)[number]['key'];

export function AdminNav({ current }: { current: AdminScreen }) {
  return (
    <nav className="border-b border-line bg-white" aria-label="Painel">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-6 py-3 text-sm">
        {TELAS.map((tela) =>
          tela.key === current ? (
            // A tela atual não é link: um link para onde já se está não leva a lugar nenhum e
            // custa um clique perdido para descobrir isso.
            <span key={tela.key} className="font-semibold">
              {tela.label}
            </span>
          ) : (
            <a key={tela.key} href={tela.href} className="text-graphite underline">
              {tela.label}
            </a>
          ),
        )}
      </div>
    </nav>
  );
}
