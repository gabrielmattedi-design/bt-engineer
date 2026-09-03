import { cn } from '@/lib/cn';
import type { PodiumEntry } from '@/payments/entitlements';
import type { PodiumSeparation, PodiumTieGroup } from '@/payments/podium-tie';

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
      <h2 className="font-display text-2xl font-bold">O pódio da sua análise</h2>
      <p className="mt-2 text-sm text-graphite">
        As três raquetes com maior compatibilidade com o perfil que você informou.
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
        <p className="mt-3 text-sm leading-relaxed text-graphite">{separation.message}</p>
      )}

      {/*
        ═══ DEGRAU DESCENDENTE, EM ORDEM 1-2-3 ════════════════════════════════════════════

        O arranjo olímpico — 2º à esquerda, 1º ao centro, 3º à direita — só funciona quando as
        alturas são desenhadas. Aqui elas vinham do CONTEÚDO, e o conteúdo não colabora: um nome de
        produto comprido ou a frase de empate faziam a 3ª colocada crescer acima da 1ª. O resultado
        era um pódio em que o degrau mais alto ficava na ponta, e a leitura saía ao contrário do
        ranking.

        Agora as três vêm na ordem do ranking, com o TOPO escalonado por um recuo fixo e altura
        mínima decrescente. Quem lê da esquerda para a direita lê 1, 2, 3, que é a mesma ordem em
        que os números aparecem.

        ─── AS BASES SÃO ALINHADAS; SÓ OS TOPOS ESCALONAM ──────────────────────────────────────

        Este bloco já teve as duas formas erradas, uma de cada lado, e vale registrar as duas.

        1. ALINHADO PELA BASE, com o degrau confiado só a alturas mínimas. Funciona enquanto o texto
           couber nelas e some quando não cabe: os três crescem além do próprio mínimo, empatam de
           altura e o pódio sai reto. Apareceu em dois testes com o mesmo empate de 88% — num o
           degrau existia, no outro virava uma faixa plana.

        2. ALINHADO PELO TOPO (`items-start`), com recuo fixo somado à altura mínima para que os
           três somassem 23rem. Isso conserta o degrau e quebra a base: `min-height` é um MÍNIMO, e
           basta um card estourar o dele para a base dele descer sozinha. Foi o que o usuário viu —
           três caixas com o topo em escada e o pé em três alturas diferentes, o que lê como
           desalinhamento, não como pódio.

        A forma que satisfaz as duas coisas é alinhar pela BASE e escalonar a ALTURA. Com
        `items-end`, o pé das três encosta na mesma linha por construção — não por coincidência de
        conteúdo. O degrau vem das alturas decrescentes, e é por isso que elas são `h-` e não
        `min-h-`: uma altura fixa não cede quando o texto cresce, que era exatamente a falha de (2).

        O conteúdo que sobrar rola dentro do próprio card (`overflow-y-auto`) em vez de empurrar a
        base. Na prática isso quase nunca acontece — o card tem nome, percentual, uma frase curta e
        as tags —, e as alturas abaixo foram medidas contra o card mais cheio que o produto gera.

        E a hierarquia é real mesmo quando os percentuais exibidos empatam: se uma raquete está em
        1º, venceu por alguma margem — nem que seja na casa decimal que o arredondamento esconde.

        Abaixo de `sm` tudo isso some: empilhadas, as caixas produziriam sobras diferentes de espaço
        vazio, sem nenhum degrau para justificar.
      */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:items-end">
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
 * Alturas FIXAS e decrescentes, com o grid alinhando pela base (`items-end`). Fixas, e não mínimas,
 * porque um mínimo cede quando o texto cresce e leva a base junto — ver a nota longa acima.
 *
 * Os 3rem de diferença entre um degrau e o seguinte são o menor passo que ainda se lê como degrau
 * numa tela de 1280 px, e o card mais alto tem folga sobre o conteúdo mais cheio que o produto
 * gera (nome longo em duas linhas + frase de distinção + três tags).
 */
const STEPS = {
  tall: 'sm:h-[26rem]',
  mid: 'sm:h-[23rem]',
  short: 'sm:h-[20rem]',
} as const;

function PodiumCard({ entry, step }: { entry: PodiumEntry; step: keyof typeof STEPS }) {
  const isFirst = entry.rank === 1;

  return (
    <article
      className={cn(
        // `overflow-y-auto` é a válvula: se algum card estourar a altura, o excedente rola dentro
        // dele em vez de empurrar a base e desfazer o alinhamento.
        'flex flex-col overflow-y-auto rounded border bg-white p-5',
        STEPS[step],
        isFirst ? 'border-2 border-ink sm:p-7' : 'border-line',
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
            'flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold',
            isFirst ? 'bg-court text-paper' : 'border border-line text-graphite',
          )}
          aria-label={`${entry.rank}º lugar`}
        >
          {entry.rank}
        </span>
        <div className="text-right">
          <div className={cn('display-number leading-none', isFirst ? 'text-5xl' : 'text-3xl')}>
            {entry.fit_score}%
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-graphite">match</div>
        </div>
      </div>

      {entry.locked ? (
        <div className="mt-5">
          {/* Placeholder borrado — não há dado real sob o blur. */}
          <div className="relative h-16 overflow-hidden rounded bg-line/60">
            <div className="string-bed absolute inset-0 blur-[6px]" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-graphite">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
          <div className="text-xs uppercase tracking-wider text-graphite">{entry.brand}</div>
          <h3
            className={cn(
              'mt-1 font-display font-bold leading-tight',
              isFirst ? 'text-2xl' : 'text-lg',
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
                Empate técnico com a anterior — a escolha aqui é de preferência pessoal.
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
  );
}
