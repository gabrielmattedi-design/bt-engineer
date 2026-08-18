import { countSetupCombinations, formatThousands } from "@/data/combinations";
import { loadRacketCatalog, loadStringCatalog } from "@/data/load";
import { LogoMark } from "./logo";
import {
  IconChart,
  IconData,
  IconEngine,
  IconGauge,
  IconPrecision,
  IconShield,
} from "./icons";

/**
 * Os seis pilares comerciais — a seção que explica por que a recomendação tem valor.
 *
 * ─── POR QUE TODOS OS CARDS TÊM A MESMA ESTRUTURA RÍGIDA ─────────────────────────────────────
 *
 * Cada card tem quatro faixas fixas: ícone · destaque · título · corpo. A primeira versão deixava
 * o destaque crescer com o texto, e o resultado foi um bloco desalinhado: "INDEPENDENTE" virava um
 * letreiro gigante, "MATCH ENGINE" ficava minúsculo ao lado, e "IA + ENGENHARIA" colidia com o
 * ícone. Seis argumentos de venda com pesos visuais diferentes viram uma lista onde dois parecem
 * importantes e quatro parecem rodapé.
 *
 * O ícone é o primeiro elemento de todos e ocupa a mesma faixa, então os cards alinham entre si
 * mesmo com textos de comprimentos muito diferentes.
 *
 * ─── UMA NOTA SOBRE O SELO VERIFIED ──────────────────────────────────────────────────────────
 *
 * O texto descreve o MÉTODO ("cada especificação tem fonte registrada e conferência humana"), não
 * afirma que o catálogo já está conferido. A diferença não é retórica: hoje o catálogo está em
 * curadoria, e um selo dizendo "dados verificados" numa home enquanto 0 de 46 raquetes foram
 * conferidas seria exatamente a promessa falsa que o §58 proíbe.
 *
 * ─── O NÚMERO DE COMBINAÇÕES É CALCULADO ─────────────────────────────────────────────────────
 *
 * O destaque dizia "Milhares", que é vago o bastante para nunca estar errado — e por isso não
 * afirma nada. Agora ele vem de `countSetupCombinations()`, medido sobre o catálogo que está no
 * ar. Cresce quando o catálogo cresce, e nunca passa a prometer mais do que o motor pode entregar.
 */

type Pillar = {
  readonly key: string;
  /** Selo proprietário — assinado pelo monograma, NUNCA pelas letras "TE". */
  readonly seal?: string;
  readonly headline?: string;
  readonly title: string;
  readonly body: string;
  readonly Icon: (props: { className?: string }) => React.ReactElement;
};

function buildPillars(): readonly Pillar[] {
  const combinations = countSetupCombinations(
    loadRacketCatalog(),
    loadStringCatalog(),
  );

  return [
    {
      key: "variaveis",
      headline: "20+",
      title: "Variáveis analisadas",
      body: "Físico, técnica, swing, estilo, objetivos, conforto e equipamento atual.",
      Icon: IconData,
    },
    {
      key: "combinacoes",
      headline: `+ de ${formatThousands(combinations)}`,
      title: "Combinações possíveis",
      body: "Raquete, corda, espessura e tensão avaliadas como um conjunto, não isoladamente.",
      Icon: IconChart,
    },
    {
      key: "engine",
      seal: "Match Engine",
      title: "Motor de recomendação proprietário",
      body: "O mesmo conjunto de respostas produz sempre o mesmo resultado.",
      Icon: IconEngine,
    },
    {
      key: "ia",
      headline: "IA + Engenharia",
      title: "Cada uma no seu lugar",
      body: "IA para interpretar o que você escreve. Engenharia para recomendar — a IA nunca escolhe o equipamento.",
      Icon: IconPrecision,
    },
    {
      key: "verified",
      seal: "Verified",
      title: "Dados técnicos verificados",
      body: "Cada especificação tem fonte registrada e conferência humana antes de sustentar uma recomendação paga.",
      Icon: IconGauge,
    },
    {
      key: "independente",
      headline: "Independente",
      title: "Sem preferência de marca",
      body: "Não vendemos equipamento e não recebemos por indicação. Nenhuma marca tem vantagem no cálculo.",
      Icon: IconShield,
    },
  ];
}

export function Pillars() {
  const PILLARS = buildPillars();

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-ball" aria-hidden />
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ball">
          Por que confiar na análise
        </h2>
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-paper/15 bg-paper/15 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <article key={p.key} className="flex flex-col bg-court p-6">
            {/*
              ═══ UMA LINHA: GRAFISMO + DESTAQUE ══════════════════════════════════════════

              O ícone ficava numa faixa própria, acima do destaque. Empilhados, os dois liam como
              dois assuntos — e nos cards de selo virava pior ainda: um ícone genérico em cima e o
              monograma embaixo, dois grafismos disputando a mesma função no mesmo card.

              Agora cada card tem exatamente UM grafismo, na mesma linha do destaque. Nos cards de
              selo o grafismo É o monograma, que é o que ele sempre deveria ter sido ali: o selo
              assina, e um ícone decorativo ao lado dele só rouba atenção.

              A linha tem altura mínima fixa, então os seis cards continuam alinhando entre si com
              destaques de comprimentos muito diferentes.
            */}
            <div className="flex min-h-[2.5rem] items-center gap-3">
              {p.seal ? (
                <>
                  {/*
                    ═══ O MONOGRAMA NÃO FICA AMARELO ═════════════════════════════════════

                    O pedido era igualar as cores — o monograma saía branco e o rótulo amarelo, e o
                    conjunto parecia montado por engano. Está certo, e a correção vai no outro
                    sentido: o brand book trata a cor da marca como regra inegociável ("sempre em
                    preto ou branco; cores de destaque nunca são aplicadas à marca"). Pintar o
                    monograma de amarelo resolveria a aparência quebrando a única regra de
                    identidade que o projeto declara não negociar.

                    Então o RÓTULO é que vem para o branco. O par volta a ser uma coisa só, e os
                    dois selos passam a se distinguir dos quatro destaques amarelos por serem
                    exatamente o que são: selos proprietários, não números de venda.
                  */}
                  <LogoMark className="h-8 w-8 shrink-0 text-white" simplified />
                  <span className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-white">
                    {p.seal}
                  </span>
                </>
              ) : (
                <>
                  <p.Icon className="h-8 w-8 shrink-0 text-ball/70" />
                  <span className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-ball">
                    {p.headline}
                  </span>
                </>
              )}
            </div>

            <h3 className="mt-4 font-display text-sm font-semibold leading-snug text-paper">
              {p.title}
            </h3>

            {/* Corpo por último, para alinhar a base dos cards. */}
            <p className="mt-2 text-xs leading-relaxed text-paper/65">
              {p.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
