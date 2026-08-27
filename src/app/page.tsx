import Link from 'next/link';
import { BrandSignature } from '@/components/marketing/wordmark';
import { AccountLink } from '@/components/marketing/site-header';
import { Logo } from '@/components/marketing/logo';
import { Pillars } from '@/components/marketing/pillars';
import { BrandWall } from '@/components/marketing/brand-wall';
import { catalogStats } from '@/data/load';

/**
 * Home — §40, §41, §42.
 *
 * Mobile-first (§43): desenhada em 390px e escalada para cima. Sem cronômetro, sem escassez, sem
 * desconto fictício (§58).
 *
 * ─── DIREÇÃO VISUAL: BRAND BOOK ──────────────────────────────────────────────────────────────
 *
 * O DESIGN.md original pedia "muito branco". O brand book pede o oposto no herói: superfícies em
 * Grand Slam Green, fundo de blueprint, aparência premium e técnica ("texturas reais de quadra",
 * "fundos escuros premium"). Onde os dois divergem, vale o brand book — ele é a identidade real da
 * marca. O branco continua valendo no corpo do conteúdo, onde legibilidade manda.
 *
 * Papéis de cor, conforme a pág. 01 do book, seção "uso das cores":
 *   Grand Slam Green  superfícies e fundos     Clay Orange   detalhes e destaques
 *   Wimbledon Green   gráficos e análises      AO Blue       dados e tecnologia
 *   Court Yellow      performance e energia
 */
export default function HomePage() {
  const stats = catalogStats();

  return (
    <main className="min-h-screen">
      {/* ── HERO (§40) ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-court text-paper">
        <div className="blueprint-grid absolute inset-0 text-white" aria-hidden />
        {/* Profundidade sutil, sem gradiente colorido: o book pede limpeza, não efeito. */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30"
          aria-hidden
        />
        {/*
          O caminho de volta para quem já comprou.

          A home não usa `SiteHeader` — o herói já traz a marca em grande, e um cabeçalho por cima
          repetiria o logo na mesma dobra. O efeito colateral era que a home, por onde quase todo
          mundo entra, era a ÚNICA tela sem nenhum caminho para as análises já pagas: quem fechasse
          o e-mail do relatório só voltaria adivinhando `/resultado/<id>`.

          Fica alinhado à direita, acima do herói, em corpo pequeno: é a ação de uma minoria dos
          visitantes, e competir com "Descobrir meu setup" seria trocar a conversão pela
          conveniência de quem já converteu.
        */}
        <div className="relative mx-auto flex max-w-5xl justify-end px-6 pt-6">
          <AccountLink tone="dark" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-10 sm:pb-28 sm:pt-14">
          {/* Marca em BRANCO sobre o verde institucional — nunca colorida (brand book pág. 04). */}
          <Logo size="lg" tone="dark" withTagline={false} />

          <p className="mt-8 font-display text-xl leading-tight text-paper sm:text-3xl">
            Seu jogo. Seu setup. Sob medida.
          </p>

          {/* Linha de conceito do book, em Court Yellow — "performance e energia". */}
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ball">
            <span className="h-px w-8 bg-ball" aria-hidden />
            Precisão técnica aplicada ao seu jogo.
          </p>

          <p className="mt-10 max-w-prose text-base text-paper/80 sm:text-lg">
            Responda algumas perguntas sobre seu jogo e descubra quais equipamentos realmente
            combinam com você.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/questionario"
              className="inline-flex min-h-[56px] items-center justify-center rounded bg-clay px-8
                         font-semibold text-white transition-opacity hover:opacity-90"
            >
              Descobrir meu setup
            </Link>
            {/*
              Botão sólido claro, não contorno sobre o verde.

              O contorno se apoiava no fundo para existir, e sobre o verde-quadra quase
              desaparecia: lido de relance, o herói parecia ter um caminho só. Preenchido em papel
              com texto court, o secundário fica visível sem competir — quem manda continua sendo o
              laranja, a cor de AÇÃO da paleta.
            */}
            <Link
              href="#como-funciona"
              className="inline-flex min-h-[56px] items-center justify-center rounded bg-paper
                         px-8 font-medium text-court transition-opacity hover:opacity-90"
            >
              Como funciona
            </Link>
          </div>

          <p className="mt-6 text-sm text-paper/50">
            Questionário gratuito · 3 a 5 minutos · sem cadastro
          </p>
        </div>
      </section>

      {/*
        ═══ AS LINHAS DE QUADRA SAÍRAM DAQUI ══════════════════════════════════════════════

        A ideia era ler a página como uma quadra vista de cima, separando as seções com linha de
        fundo, corredor de duplas e linha de saque. Na tela a analogia não se sustentou: fora do
        contexto de uma quadra inteira, uma linha horizontal fina é só uma linha horizontal fina —
        e três variações dela ao longo da página viravam ruído que ninguém decodifica.

        O que separa seção de seção é FUNDO e ESPAÇO, e é isso que passa a fazer o trabalho. O
        motivo de quadra continua onde ele funciona de verdade: como TEXTURA — o quadriculado de
        prancha no herói e a malha de encordoamento nos blocos bloqueados, que o brand book pede em
        opacidade baixa e que ninguém precisa decifrar para entender.
      */}
      {/* ── SEIS PILARES (selos proprietários + iconografia do brand book) ─────── */}
      {/*
        ═══ SEPARAR SEM SAIR DO VERDE ═════════════════════════════════════════════════════

        O herói é verde-quadra e esta seção também era: dois blocos da mesma cor colados, sem
        fronteira nenhuma depois que as linhas saíram.

        A primeira tentativa foi `ink`. Separou, e desafinou: quase-preto entre o verde do herói e o
        off-white da seção seguinte introduz um terceiro registro no meio de uma página que só tinha
        dois, e o corte lê como buraco em vez de transição.

        `court-mid` é o verde médio que o brand book reserva para SUPERFÍCIES SECUNDÁRIAS — que é
        literalmente esta. Ele dá o degrau de valor que faltava sem trocar de família: o campo
        clareia, os cards seguem no verde escuro do herói, e a grade ganha relevo de bloco apoiado
        sobre a superfície em vez de recorte no fundo.
      */}
      <section className="bg-court-mid">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <Pillars />
        </div>
      </section>


      {/* ── ECOSSISTEMA ANALISADO ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <BrandWall />
      </section>


      {/* ── FLUXO CONCEITUAL (§2) ──────────────────────────────────────────────── */}
      {/*
        As setas estavam em `line` — a cor das DIVISÓRIAS, sobre um fundo off-white.

        Contraste perto de 1,2:1: elas existiam no código e não na tela, e o que restava eram quatro
        palavras cinzas soltas, sem nada dizendo que uma leva à outra. Justamente o oposto do que a
        faixa existe para dizer.

        Agora a seta é `clay`, e a exceção se justifica: aqui ela não é ornamento, é o operador que
        transforma quatro rótulos numa sequência — o próprio conteúdo da linha. As palavras sobem de
        tamanho e vão para `ink`; a última fica em `clay` também, porque é onde a sequência chega.
      */}
      {/*
        ═══ POR QUE A FAIXA VIRA UM BLOCO, E NÃO GANHA UM RISCO ANTES E DEPOIS ═════════════

        Três seções brancas empilhadas — logos, esta linha e "Como funciona" — corriam juntas como
        uma coisa só. Separá-las com filete voltaria a pôr traço decorativo na página, que é o que
        acabou de sair dela, e ainda cobraria dois riscos para separar três blocos.

        Este é o bloco do meio e o mais fraco dos três: uma única linha de texto entre dois blocos
        densos. Dar a ele um fundo próprio resolve as duas coisas de uma vez — ele deixa de ser
        órfão, e as fronteiras de cima e de baixo nascem do contraste, sem nenhum elemento novo.

        A lavagem é `court/5`: verde institucional a 5%, claro o bastante para a seção continuar
        sendo a parte branca da página, que é o que o brand book pede aqui (§39), e escuro o
        bastante para o olho registrar onde um bloco termina.
      */}
      <section className="border-y border-line bg-court/5">
        <div className="mx-auto max-w-5xl px-6 py-14">
        {/*
          UMA LINHA SÓ, inclusive no celular.

          Quebrada em duas, a sequência deixa de ser sequência: "Análise técnica" reaparecia na
          linha de baixo precedida de uma seta órfã, como se o fluxo recomeçasse ali. É o oposto do
          que a faixa existe para dizer.

          Cabe porque o tipo encolhe onde o espaço encolhe. Em 390 px, os quatro rótulos e as três
          setas somam ~48 caracteres — a 12 px com folga curta entre eles, sobra margem; a partir de
          `sm` tudo volta ao tamanho de leitura confortável.
        */}
        <ol className="flex flex-nowrap items-center gap-x-1.5 font-display text-xs text-ink sm:gap-x-4 sm:text-xl">
          {['Seu perfil', 'Seu jogo', 'Análise técnica', 'Seu setup'].map((step, i) => (
            <li key={step} className="flex items-center gap-1.5 whitespace-nowrap sm:gap-4">
              {i > 0 && (
                <span className="text-clay" aria-hidden>
                  →
                </span>
              )}
              <span className={i === 3 ? 'font-bold text-clay' : 'font-medium'}>{step}</span>
            </li>
          ))}
        </ol>
        </div>
      </section>


      {/* ── COMO FUNCIONA (§41) ────────────────────────────────────────────────── */}
      <section id="como-funciona" className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Como funciona</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {[
            {
              n: '1',
              title: 'Conte sobre seu jogo',
              body:
                'Analisamos suas características físicas, técnicas, equipamento atual e objetivos.',
            },
            {
              n: '2',
              title: 'Cruzamos seu perfil com os equipamentos',
              body:
                'Nosso sistema compara seu perfil com especificações técnicas de raquetes e cordas.',
            },
            {
              n: '3',
              title: 'Receba seu setup',
              body: 'Descubra sua raquete, corda e tensão recomendadas.',
            },
          ].map((step) => (
            <div key={step.n}>
              <div className="display-number text-5xl text-court-mid/40">{step.n}</div>
              <h3 className="mt-3 font-display text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-graphite">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CREDIBILIDADE (§42) ────────────────────────────────────────────────── */}
      {/*
        ═══ ESTA É A SEÇÃO DE PRANCHA TÉCNICA, E ELA É AZUL ═══════════════════════════════

        O quadriculado aqui é o que dá o ar de engenharia, e ele funciona. O que não funcionava era
        a companhia: os números vêm em AO Blue porque o brand book reserva o azul para "dados e
        tecnologia", e azul sobre verde-quadra é um encontro que nenhuma das duas cores pede.

        Sobre `ink` o azul volta a ser o que é numa planta: traço claro sobre fundo escuro neutro. O
        quadriculado passa a ser azul também, e a seção inteira lê como o documento técnico que ela
        está afirmando existir.

        Não é contradição com a decisão de tirar o `ink` da seção dos pilares. Lá ele entrava entre
        o verde do herói e o off-white seguinte, criando um terceiro registro no meio de uma
        transição — aqui ele está cercado de branco dos dois lados, e o registro novo é o ponto:
        esta é a única seção da home que fala de MEDIDA, e ela se destaca por dizer isso.
      */}
      <section className="relative overflow-hidden bg-ink text-paper">
        {/*
          Lavagem de AO Blue sobre o `ink` — o azul-marinho de prancha, não preto.

          `ink` puro (#0B0F14) tem só 9 pontos de diferença entre o canal azul e o vermelho: no
          papel é "quase preto azulado", na tela é preto. A seção ficava neutra justamente onde ela
          precisa parecer um documento técnico, e o quadriculado azul não tinha de onde nascer.

          O tom vem COMPOSTO de dois tokens que já existem, em vez de um hexadecimal novo: 18% de
          `signal` sobre `ink` resulta em algo perto de #0D263A. Assim a cor continua rastreável ao
          brand book — é literalmente "o azul de dados sobre o fundo escuro" — e se um dos dois
          mudar, esta seção acompanha sozinha.

          A proporção já subiu uma vez: a 12% o resultado ainda lia como preto na tela, e o ponto
          desta seção é justamente não ser neutra.
        */}
        <div className="absolute inset-0 bg-signal/[0.18]" aria-hidden />
        <div className="blueprint-grid absolute inset-0 text-signal" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Não recomendamos por nível, idade ou marca favorita.
        </h2>
        <p className="mt-4 max-w-prose text-paper/75">
          A análise cruza múltiplas variáveis do seu jogo com as especificações técnicas de cada
          equipamento. O mesmo conjunto de respostas produz sempre o mesmo resultado — e cada
          recomendação registra quais dados usou.
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            'Perfil físico',
            'Swing',
            'Nível técnico',
            'Estilo de jogo',
            'Objetivos',
            'Raquete atual',
            'Conforto',
            'Equipamento',
          ].map((item) => (
            /*
              Etiqueta sólida em papel, não vidro sobre o fundo.

              `bg-white/5` dependia do fundo para existir e mal se distinguia dele: eram oito
              retângulos fantasmas onde deviam estar as oito variáveis que sustentam a frase acima.
              Sólidas, elas viram o que a seção afirma ter — entradas de um cálculo, não decoração.
            */
            <li
              key={item}
              className="rounded bg-paper px-3 py-3 text-sm font-medium text-ink"
            >
              {item}
            </li>
          ))}
        </ul>

        <dl className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            ['Raquetes no catálogo', String(stats.rackets)],
            ['Variantes de corda', String(stats.stringVariants)],
            ['Variáveis analisadas', '28'],
          ].map(([label, value]) => (
            <div key={label} className="border-l-2 border-signal/40 pl-4">
              <dt className="text-xs uppercase tracking-wider text-paper/60">{label}</dt>
              {/* Números são dado técnico — AO Blue, "dados e tecnologia" (book pág. 01). */}
              <dd className="display-number mt-1 text-4xl text-signal">{value}</dd>
            </div>
          ))}
        </dl>
        </div>
      </section>

      {/* ── O QUE VOCÊ RECEBE (§25, §26) — sem falsa promoção (§58) ────────────── */}

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">O que você recebe</h2>
        {/*
          A frase anterior dizia que a ANÁLISE era gratuita e que você decidia "depois de ver o
          resultado" — e não é isso que acontece. Sem pagar você vê o pódio com as três
          compatibilidades, a confiança e quantas raquetes foram avaliadas; o que fica coberto são
          os modelos e o raciocínio. Prometer o resultado e entregar o placar é a promessa falsa que
          o §58 proíbe, ainda que por descuido de redação.
        */}
        <p className="mt-3 max-w-prose text-sm text-graphite">
          O questionário é gratuito e a análise roda inteira antes de qualquer pagamento: você vê
          quantas raquetes foram avaliadas, a confiança do resultado e o quanto cada uma das três
          finalistas combina com você. O relatório é o que revela os modelos e o porquê de cada
          escolha.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-line bg-white p-6">
            <h3 className="font-display text-lg font-semibold">Descubra sua raquete ideal</h3>
            <p className="display-number mt-2 text-2xl">R$ 19,99</p>
            <ul className="mt-4 space-y-2 text-sm text-graphite">
              <li>Análise completa do seu perfil</li>
              <li>Raquete recomendada e Fit Score</li>
              <li>Por que ela combina com você</li>
              <li>Pontos de atenção</li>
              <li>Comparação com sua raquete atual</li>
            </ul>
          </div>

          <div className="relative corner-marks rounded border-2 border-court bg-white p-6 text-court">
            {/* Clay Orange marca o destaque — "detalhes e destaques" (brand book pág. 01). */}
            <div className="text-xs font-semibold uppercase tracking-wider text-clay">
              Análise completa
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold text-ink">
              Descubra seu setup completo
            </h3>
            <p className="display-number mt-2 text-3xl text-ink">R$ 49,99</p>
            <ul className="mt-4 space-y-2 text-sm text-graphite">
              <li>Tudo do plano anterior</li>
              <li>Corda e espessura recomendadas</li>
              <li>Tensão inicial e faixa sugerida</li>
              <li>Por que essa combinação funciona</li>
              <li>Como ajustar no próximo encordoamento</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="court-line mx-auto max-w-5xl px-6 py-12">
        <Logo size="sm" />
        <BrandSignature className="mt-6" />
        <p className="mt-6 max-w-prose text-xs text-graphite">
          Os índices Tennis Engineer são métricas internas da nossa análise, não especificações do
          fabricante. Equipamento adequado ajuda, mas não substitui a avaliação de um profissional
          de saúde.
        </p>
      </footer>
    </main>
  );
}
