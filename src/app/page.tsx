import Link from 'next/link';
import { BrandSignature } from '@/components/marketing/wordmark';
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
        <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28">
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
      <section className="mx-auto max-w-5xl px-6 py-12">
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
      <section className="mx-auto max-w-5xl px-6 py-12">
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-3 font-display text-base text-ink sm:text-xl">
          {['Seu perfil', 'Seu jogo', 'Análise técnica', 'Seu setup'].map((step, i) => (
            <li key={step} className="flex items-center gap-4">
              {i > 0 && (
                <span className="text-lg text-clay sm:text-xl" aria-hidden>
                  →
                </span>
              )}
              <span className={i === 3 ? 'font-bold text-clay' : 'font-medium'}>{step}</span>
            </li>
          ))}
        </ol>
      </section>


      {/* ── COMO FUNCIONA (§41) ────────────────────────────────────────────────── */}
      <section id="como-funciona" className="mx-auto max-w-5xl px-6 py-16">
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
      <section className="relative overflow-hidden bg-court text-paper">
        <div className="blueprint-grid absolute inset-0 text-white" aria-hidden />
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
            <li
              key={item}
              className="rounded border border-paper/20 bg-white/5 px-3 py-3 text-sm font-medium"
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
        <p className="mt-3 text-sm text-graphite">
          O questionário e a análise são gratuitos. Você decide se quer o relatório depois de ver o
          resultado da análise.
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
