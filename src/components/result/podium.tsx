import { cn } from "@/lib/cn";
import type { PodiumEntry } from "@/payments/entitlements";
import type { PodiumSeparation, PodiumTieGroup } from "@/payments/podium-tie";

/**
 * Pódio — §28, §29.
 *
 * 1º central, maior, mais alto; 2º e 3º laterais. No mobile empilha mantendo a hierarquia.
 *
 * O bloqueio é de SERVIDOR: as entradas bloqueadas chegam aqui já sem marca, modelo ou foto
 * (§32). O blur é aplicado sobre um PLACEHOLDER, não sobre o dado real — o dado real nunca
 * chegou ao navegador.
 */
export function Podium({
  entries,
  tie,
  separation,
  onUnlock,
}: {
  entries: readonly PodiumEntry[];
  tie?: PodiumTieGroup | null;
  separation?: PodiumSeparation | null;
  onUnlock?: React.ReactNode;
}) {
  const [first, ...rest] = entries;
  if (!first) return null;

  return (
    <section>
      <h2 className="font-display text-2xl font-bold">
        O pódio da sua análise
      </h2>
      <p className="mt-2 text-sm text-graphite">
        As três raquetes com maior compatibilidade com o perfil que você
        informou.
      </p>

      {/*
        O empate é ANUNCIADO, não disfarçado.

        Três cards marcando o mesmo número e nada escrito ao lado é o que fazia o relatório parecer
        indeciso. Acrescentar uma casa decimal resolveria a aparência inventando uma resolução que
        seis especificações publicadas não têm — e no caso mais comum, o de duas gerações com as
        mesmas medidas, nem casa decimal separa. Então o empate vem dito, e o que diferencia cada
        uma vem escrito no próprio card.
      */}
      {tie && (
        <p className="mt-4 rounded border-l-2 border-clay bg-line/30 px-4 py-3 text-sm leading-relaxed text-graphite">
          {tie.message}
        </p>
      )}

      {/*
        Quantas do catálogo INTEIRO empataram — a resposta para "parece que qualquer uma serve".

        Às vezes qualquer uma serve mesmo, e esconder isso é que seria desonesto. O que o produto
        não pode fazer é deixar a pessoa deduzir sozinha, de três números iguais, que o motor não
        decidiu nada. Aqui o empate largo vira o que ele de fato é: uma conclusão sobre o jogador,
        com o encaminhamento que decorre dela.
      */}
      {separation && (
        <p className="mt-3 text-sm leading-relaxed text-graphite">
          {separation.message}
        </p>
      )}

      {/*
        ═══ DEGRAU DESCENDENTE, EM ORDEM 1-2-3 ════════════════════════════════════════════

        O arranjo olímpico — 2º à esquerda, 1º ao centro, 3º à direita — só funciona quando as
        alturas são desenhadas. Aqui elas vinham do CONTEÚDO, e o conteúdo não colabora: um nome de
        produto comprido ou a frase de empate faziam a 3ª colocada crescer acima da 1ª. O resultado
        era um pódio em que o degrau mais alto ficava na ponta, e a leitura saía ao contrário do
        ranking.

        Agora as três vêm na ordem do ranking, com a BASE alinhada e o TOPO escalonado. Quem lê da
        esquerda para a direita lê 1, 2, 3, que é a mesma ordem em que os números aparecem.

        ─── AS TRÊS FORMAS QUE ISTO JÁ TEVE ────────────────────────────────────────────────────

        Cada conserto abaixo parecia óbvio e produziu o defeito seguinte. Os três ficam registrados
        porque quem for mexer aqui precisa saber o que já foi tentado.

        1. BASE alinhada + altura MÍNIMA decrescente. O degrau some quando o texto cresce: os três
           passam do próprio mínimo, empatam de altura e o pódio sai reto. Apareceu em dois testes
           com o mesmo empate de 88% — num o degrau existia, no outro virava uma faixa plana.

        2. TOPO alinhado (`items-start`) + recuo fixo somado à altura mínima, os três somando 23rem.
           Conserta o degrau e quebra a base: `min-height` é um MÍNIMO, e basta um card estourar o
           dele para o pé descer sozinho. Três caixas com o topo em escada e o pé em três alturas
           diferentes leem como desalinhamento, não como pódio.

        3. BASE alinhada + altura FIXA decrescente, com `overflow-y-auto` como válvula. Na tela o
           excedente rolava; no PAPEL não existe rolagem, e a válvula virou tesoura. Foi o que
           apareceu no PDF: a terceira tag do 1º card cortada ao meio e o texto do 3º truncado. Uma
           tag pela metade é pior do que qualquer desalinhamento.

        ─── A FORMA QUE FUNCIONA ───────────────────────────────────────────────────────────────

        Não medir a caixa por fora, e sim empurrá-la por dentro: as três ESTICAM até a mesma altura
        (`items-stretch`) e o degrau vem de um recuo ACIMA de cada uma — 0, 3rem, 6rem. O recuo é
        fixo, então o topo escalona sempre; a caixa cresce com o conteúdo, então a base continua
        alinhada e nada é cortado. A altura da linha passa a ser ditada pelo card mais cheio, que é
        como deveria ter sido desde o começo.

        Verificado num navegador, em modo de impressão, sobre os 10 perfis simulados: bases
        idênticas, topos estritamente decrescentes e nenhum dos 30 cards escondendo conteúdo.

        E a hierarquia é real mesmo quando os percentuais exibidos empatam: se uma raquete está em
        1º, venceu por alguma margem — nem que seja na casa decimal que o arredondamento esconde.

        Abaixo de `sm` tudo isso some: empilhadas, as caixas produziriam sobras diferentes de espaço
        vazio, sem nenhum degrau para justificar.
      */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:items-stretch">
        <PodiumCard entry={first} step="tall" />
        {rest[0] && <PodiumCard entry={rest[0]} step="mid" />}
        {rest[1] && <PodiumCard entry={rest[1]} step="short" />}
      </div>

      {onUnlock}
    </section>
  );
}

/**
 * O degrau, só a partir de `sm` — onde os três ficam lado a lado.
 *
 * É um RECUO ACIMA da caixa, não uma altura da caixa. A diferença é tudo: uma altura precisa
 * adivinhar o tamanho do conteúdo e corta quando erra; um recuo não tem opinião sobre o conteúdo.
 *
 * Os 3rem entre um degrau e o seguinte são o menor passo que ainda se lê como degrau numa tela de
 * 1280 px. Como o recuo é padding do invólucro e a caixa é `flex-1`, os três pés encostam na mesma
 * linha por construção, e o topo de cada uma fica exatamente 3rem abaixo do topo da anterior.
 */
const STEPS = {
  tall: "sm:pt-0",
  mid: "sm:pt-12",
  short: "sm:pt-24",
} as const;

function PodiumCard({
  entry,
  step,
}: {
  entry: PodiumEntry;
  step: keyof typeof STEPS;
}) {
  const isFirst = entry.rank === 1;

  return (
    <div className={cn("flex flex-col", STEPS[step])}>
      <article
        className={cn(
          // `flex-1` faz a caixa ocupar tudo o que sobra abaixo do recuo — é o que alinha as bases.
          // Sem altura fixa e sem `overflow`, porque o conteúdo é que manda na altura da linha.
          "flex flex-1 flex-col rounded border bg-white p-5",
          isFirst ? "border-2 border-ink sm:p-7" : "border-line",
        )}
      >
        <div className="flex items-baseline justify-between">
          {/*
          Posição em tipografia, não em emoji de medalha.
          Emojis de pódio são renderizados pelo SISTEMA: mudam de desenho entre Android, iOS e
          Windows, chegam coloridos — o que contraria a paleta — e trazem um tom de gamificação
          que briga com "instrumento técnico". Um numeral tem aparência idêntica em todo aparelho.
        */}
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold",
              isFirst
                ? "bg-court text-paper"
                : "border border-line text-graphite",
            )}
            aria-label={`${entry.rank}º lugar`}
          >
            {entry.rank}
          </span>
          <div className="text-right">
            <div
              className={cn(
                "display-number leading-none",
                isFirst ? "text-5xl" : "text-3xl",
              )}
            >
              {entry.fit_score}%
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-graphite">
              match
            </div>
          </div>
        </div>

        {entry.locked ? (
          <div className="mt-5">
            {/* Placeholder borrado — não há dado real sob o blur. */}
            <div className="relative h-16 overflow-hidden rounded bg-line/60">
              <div
                className="string-bed absolute inset-0 blur-[6px]"
                aria-hidden
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-graphite">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M 8 10 V 7 a 4 4 0 0 1 8 0 v 3" />
                </svg>
                Modelo bloqueado
              </div>
            </div>
            <p className="mt-3 text-sm text-graphite">{entry.teaser}</p>
            {/*
            O aviso vem ANTES do pagamento, junto do preço, e não depois no relatório.
            É a única posição em que ele faz diferença para a decisão.
          */}
            {entry.quality_note && (
              <p className="mt-2 text-xs text-warn">{entry.quality_note}</p>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wider text-graphite">
              {entry.brand}
            </div>
            <h3
              className={cn(
                "mt-1 font-display font-bold leading-tight",
                isFirst ? "text-2xl" : "text-lg",
              )}
            >
              {entry.product_name}
            </h3>

            {/*
            O que ESTA opção faz de diferente das outras empatadas.

            Substitui o antigo "empate técnico com a anterior", que dizia que não havia diferença
            sem dizer o que havia no lugar dela. A frase aqui sai dos componentes reais do score:
            em que ela se destaca entre as empatadas e em que ela cede — ou, quando o vetor de
            atributos é o mesmo, que são gêmeas e a escolha é de preço e disponibilidade.
          */}
            {entry.distinction ? (
              <p className="mt-3 rounded bg-line/50 px-3 py-2 text-xs leading-relaxed text-graphite">
                {entry.distinction.headline}
              </p>
            ) : (
              entry.technical_tie_with_previous && (
                <p className="mt-3 rounded bg-line/50 px-3 py-2 text-xs text-graphite">
                  Empate técnico com a anterior — a escolha aqui é de
                  preferência pessoal.
                </p>
              )
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-line px-2 py-1 text-[10px] font-semibold
                           uppercase tracking-wider text-graphite"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/*
            A leitura técnica NÃO fica aqui. No pódio cada card ocupa ~200px, e uma escala
            graduada nessa largura vira um risco: as marcas de 25/50/75 colapsam e o ponteiro fica
            indistinguível do trilho. Ela vive na seção principal do relatório, em largura cheia.
          */}
          </div>
        )}
      </article>
    </div>
  );
}
