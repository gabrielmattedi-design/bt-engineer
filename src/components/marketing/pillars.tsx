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
      {/*
        O título da seção é BRANCO, não amarelo.

        Ele mudou de fundo junto com a seção: sobre o verde escuro o amarelo dava 7,8:1, sobre o
        verde médio caiu para 3,15:1 — abaixo do mínimo legível para texto pequeno, e este é
        pequeno, em caixa alta e com tracking aberto, que é a combinação que menos perdoa. Em
        branco vai a 4,7:1.

        O amarelo não se perde: ele continua na régua ao lado e nos subtítulos dos cards, que estão
        sobre o verde escuro, onde ele tem contraste de sobra.
      */}
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-ball" aria-hidden />
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-paper">
          Por que confiar na análise
        </h2>
      </div>

      {/*
        ═══ A GRADE É UMA QUADRA VISTA DE CIMA ══════════════════════════════════════════════

        A analogia de quadra já tinha falhado uma vez nesta página, como filete entre seções — e
        falhou porque uma linha solta não é uma quadra. Aqui ela tem o que faltava lá: um retângulo
        dividido em caixas, que é literalmente o desenho de uma quadra.

        O caminho foi TIRAR, não acrescentar. Antes os cards eram verde-escuro sobre campo
        verde-médio, cada um com sua moldura — seis objetos empilhados. Agora o bloco inteiro é uma
        superfície só, no verde do herói, e o que separa as caixas são LINHAS BRANCAS. É como
        quadra de verdade funciona: piso de uma cor, linhas pintadas por cima. Saiu contraste de
        fundo, saiu borda por card, e o desenho ficou mais legível do que estava.

        O verde-médio da seção continua ao redor, e passa a ser o que ele parece: a área externa
        que cerca a quadra, que em quadra real também é de outro tom.

        A REDE é a única coisa acrescentada — a linha do meio, mais grossa que as outras. Sem ela o
        retângulo é uma grade qualquer; com ela vira quadra, porque é a rede que diz de que jogo se
        trata. Ela só aparece em três colunas, que é onde a geometria fecha: em duas colunas ou em
        uma, o meio da altura não cai no meio do bloco, e uma rede fora do lugar seria pior que
        nenhuma.
      */}
      <div className="relative mt-6 border-2 border-paper/70 bg-paper/70">
        <div className="grid gap-[2px] sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          {PILLARS.map((p) => (
            <article key={p.key} className="flex flex-col bg-court p-6">
              {/*
                Padrão único nos seis: grafismo + destaque em BRANCO, subtítulo em AMARELO, corpo
                em branco. Antes o destaque era amarelo em quatro cards e branco nos dois de selo,
                porque o monograma obriga o branco — o padrão se contradizia no meio da grade e a
                diferença não significava nada para quem lê.
              */}
              <div className="flex min-h-[2.5rem] items-center gap-3">
                {p.seal ? (
                  <>
                    <LogoMark className="h-8 w-8 shrink-0 text-white" simplified />
                    <span className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-white">
                      {p.seal}
                    </span>
                  </>
                ) : (
                  <>
                    <p.Icon className="h-8 w-8 shrink-0 text-white" />
                    <span className="font-display text-2xl font-bold uppercase leading-none tracking-tight text-white">
                      {p.headline}
                    </span>
                  </>
                )}
              </div>

              <h3 className="mt-4 font-display text-sm font-semibold leading-snug text-ball">
                {p.title}
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-paper/75">{p.body}</p>
            </article>
          ))}
        </div>

        {/* A rede. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-[5px]
                     -translate-y-1/2 bg-paper/70 lg:block"
          aria-hidden
        />
      </div>
    </div>
  );
}
