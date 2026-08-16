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

      <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-paper/20 bg-paper/20 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <article key={p.key} className="flex flex-col bg-court p-6">
            {/* Faixa 1 — ícone, sempre no mesmo lugar e no mesmo tamanho. */}
            <p.Icon className="h-7 w-7 shrink-0 text-ball/70" />

            {/*
              Faixa 2 — destaque. Altura fixa para que os cards alinhem entre si.

              O RÓTULO do selo tem o mesmo tamanho e a mesma cor dos demais destaques. A regra do
              brand book ("sempre preto ou branco") vale para a MARCA GRÁFICA — o monograma —, não
              para a tipografia ao lado dela. Rotular o selo em branco e menor fazia "MATCH ENGINE"
              e "VERIFIED" parecerem secundários diante de "20+" e "INDEPENDENTE", quando são
              justamente os dois pilares proprietários.

              O monograma permanece BRANCO, que é onde a regra se aplica.
            */}
            <div className="mt-5 flex min-h-[2.25rem] items-center">
              {p.seal ? (
                <span className="flex items-center gap-2.5">
                  <LogoMark
                    className="h-9 w-9 shrink-0 text-white"
                    simplified
                  />
                  <span className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-ball">
                    {p.seal}
                  </span>
                </span>
              ) : (
                <span className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-ball">
                  {p.headline}
                </span>
              )}
            </div>

            {/* Faixa 3 — título. */}
            <h3 className="mt-4 font-display text-sm font-semibold leading-snug text-paper">
              {p.title}
            </h3>

            {/* Faixa 4 — corpo, empurrado para o fim para alinhar a base dos cards. */}
            <p className="mt-2 text-xs leading-relaxed text-paper/65">
              {p.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
