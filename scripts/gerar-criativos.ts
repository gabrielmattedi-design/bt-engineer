/**
 * Gera criativos de anúncio a partir da marca REAL, em vez de descrevê-la para uma IA de design.
 *
 *   npx tsx scripts/gerar-criativos.ts
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * A primeira tentativa foi pedir os criativos à geração de design do Canva, descrevendo a paleta,
 * a tipografia e o desenho da marca no texto do pedido. Os quatro resultados vieram com fonte
 * errada, cor aproximada, logo inventado e o bloco técnico central vazio de conteúdo.
 *
 * Não é defeito da ferramenta — é o que ela faz: trata a marca como INSPIRAÇÃO. Para um produto
 * cujo argumento inteiro é precisão técnica, "parecido com a marca" é o oposto do que se quer.
 *
 * Aqui não há interpretação. As cores são os mesmos literais do `tailwind.config.ts`, as fontes
 * são Sora e Inter de verdade, o monograma são os mesmos caminhos SVG do `LogoMark`, e os números
 * saem do catálogo. O que sai é a marca, não uma leitura dela.
 *
 * ─── O QUE ESTE SCRIPT NÃO É ─────────────────────────────────────────────────────────────────
 *
 * Não substitui o Canva. Ele produz a BASE exata; o ajuste fino — trocar uma palavra, testar outro
 * título, montar variações para um teste A/B — continua muito mais rápido no editor visual. O
 * fluxo é: gerar aqui, subir lá, iterar lá.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

import { catalogStats, loadRacketCatalog, loadStringCatalog } from '../src/data/load';
import { SITE_DOMAIN } from '../src/lib/site';
import { countSetupCombinations, formatThousands } from '../src/data/combinations';

const OUT = join(process.cwd(), 'criativos');

/** Os mesmos literais de `tailwind.config.ts`. Nada aqui é "parecido com". */
const C = {
  court: '#0E3D2E',
  courtMid: '#3A7D63',
  clay: '#D85A2B',
  ball: '#FFC62E',
  ink: '#0B0F14',
  paper: '#FAFAF8',
  graphite: '#5A6472',
} as const;

/** Formatos de anúncio. 4:5 ocupa mais tela em feed; 9:16 é story e reels; 1:1 é o quadrado. */
const FORMATOS = {
  '4x5': { w: 1080, h: 1350 },
  '1x1': { w: 1080, h: 1080 },
  '9x16': { w: 1080, h: 1920 },
} as const;

/**
 * O monograma, com os mesmos caminhos de `LogoMark`.
 *
 * Copiado e não importado porque este script gera HTML puro, sem React — e o brand book é
 * inegociável nos dois lugares: a marca é preta ou branca, nunca colorida, nunca distorcida.
 */
function monograma(cor: string, tamanho: number): string {
  return `<svg viewBox="0 0 120 120" width="${tamanho}" height="${tamanho}" fill="none" style="color:${cor}">
    <g stroke="currentColor" fill="none" opacity="0.55">
      <path d="M 36 25 Q 20 62 44 95" stroke-width="1.1" />
      <path d="M 87 34 Q 95 60 88 90" stroke-width="1.6" />
    </g>
    <circle cx="60" cy="60" r="41" stroke="currentColor" stroke-width="2.6" />
    <path d="M 40 36 H 84 V 44 H 66 V 58.5 H 81.5 V 66.5 H 66 V 83 H 85 V 91 H 54 V 44 H 40 Z" fill="currentColor" />
  </svg>`;
}

/** Malha de prancha de projeto — o mesmo recurso gráfico do site e do card. */
const MALHA = `background-image:
  linear-gradient(rgba(250,250,248,0.05) 1px, transparent 1px),
  linear-gradient(90deg, rgba(250,250,248,0.05) 1px, transparent 1px);
background-size: 45px 45px;`;

function pagina(largura: number, altura: number, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${largura}px;height:${altura}px;overflow:hidden;
       font-family:Inter,sans-serif;background:${C.court};color:${C.paper};position:relative}
  .malha{position:absolute;inset:0;${MALHA}}
  .conteudo{position:relative;height:100%;display:flex;flex-direction:column;padding:72px}
  .display{font-family:Sora,sans-serif;font-weight:700;letter-spacing:-0.02em;line-height:1.05}
  .marca{font-family:Sora,sans-serif;font-weight:600;letter-spacing:0.32em;font-size:22px;color:${C.ball}}
  .rodape{margin-top:auto;display:flex;align-items:center;justify-content:space-between;
          font-size:20px;color:rgba(250,250,248,0.5)}
  .cta{display:inline-block;background:${C.clay};color:#fff;font-family:Sora,sans-serif;
       font-weight:600;font-size:30px;padding:22px 44px;border-radius:8px}
</style></head><body><div class="malha"></div><div class="conteudo">${corpo}</div></body></html>`;
}

/** Cabeçalho comum: monograma + assinatura da marca. */
function cabecalho(): string {
  return `<div style="display:flex;align-items:center;gap:18px;margin-bottom:56px">
    ${monograma(C.paper, 56)}
    <div>
      <div class="display" style="font-size:32px">Tennis Engineer</div>
      <div style="font-size:19px;color:rgba(250,250,248,0.55);margin-top:2px">Seu jogo. Seu setup. Sob medida.</div>
    </div>
  </div>`;
}

function rodape(): string {
  return `<div class="rodape">
    <span>${SITE_DOMAIN}</span>
    <span>Análise técnica independente</span>
  </div>`;
}

type Numeros = { raquetes: number; cordas: number; combinacoes: string };

/**
 * ─── CRIATIVO 1: A FICHA TÉCNICA ────────────────────────────────────────────────────────────
 *
 * O bloco central é uma ficha de especificações de verdade — o mesmo spec card do brand book, com
 * os campos que o motor realmente usa. É a resposta direta ao "o quadrado central está vago": um
 * retângulo com uma legenda genérica não comunica engenharia, uma tabela de medidas comunica.
 */
function fichaTecnica(n: Numeros): string {
  const linhas = [
    ['CABEÇA', '98 pol²'],
    ['PESO', '305 g'],
    ['BALANÇO', '315 mm'],
    ['PADRÃO', '16 × 20'],
    ['CORDA', 'Luxilon Element 1.25'],
    ['TENSÃO', '47 lbs'],
  ];

  return `${cabecalho()}
  <div class="display" style="font-size:66px;max-width:900px">Sua raquete,<br>especificada.</div>
  <div style="font-size:26px;color:rgba(250,250,248,0.6);margin-top:20px;max-width:820px">
    ${n.raquetes} raquetes e ${n.cordas} cordas avaliadas contra o seu perfil técnico.
  </div>

  <div style="margin-top:52px;border:2px solid rgba(250,250,248,0.22);border-radius:10px;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:26px 32px;background:rgba(250,250,248,0.06)">
      <div>
        <div style="font-size:18px;letter-spacing:0.18em;color:rgba(250,250,248,0.5)">RAQUETE INDICADA</div>
        <div class="display" style="font-size:38px;margin-top:6px">Babolat Pure Drive 98</div>
      </div>
      <div style="text-align:right">
        <div class="display" style="font-size:64px;color:${C.ball};line-height:1">90%</div>
        <div style="font-size:16px;letter-spacing:0.2em;color:rgba(250,250,248,0.5)">MATCH</div>
      </div>
    </div>
    ${linhas
      .map(
        ([k, v], i) => `<div style="display:flex;justify-content:space-between;padding:19px 32px;
        font-size:24px;${i < linhas.length - 1 ? 'border-bottom:1px solid rgba(250,250,248,0.12)' : ''}">
        <span style="letter-spacing:0.14em;color:rgba(250,250,248,0.55);font-size:19px">${k}</span>
        <span style="font-family:Sora,sans-serif;font-weight:600">${v}</span>
      </div>`,
      )
      .join('')}
  </div>

  <div style="margin-top:44px"><span class="cta">Descubra a sua em 5 minutos</span></div>
  ${rodape()}`;
}

/**
 * ─── CRIATIVO 2: OS NÚMEROS ─────────────────────────────────────────────────────────────────
 *
 * Três números grandes e nada mais. Funciona no feed porque é legível em miniatura — o texto que
 * exige leitura perde para o que se entende de relance.
 */
function numeros(n: Numeros): string {
  const blocos = [
    [String(n.raquetes), 'raquetes analisadas'],
    [String(n.cordas), 'cordas e espessuras'],
    [n.combinacoes, 'combinações possíveis'],
  ];

  return `${cabecalho()}
  <div class="display" style="font-size:70px;max-width:900px">Uma delas<br>é a sua.</div>
  <div style="font-size:26px;color:rgba(250,250,248,0.6);margin-top:22px;max-width:820px">
    O Tennis Engineer cruza o seu jogo com o catálogo inteiro e diz qual — e por quê.
  </div>

  <div style="flex:1;margin-top:56px;display:flex;flex-direction:column;justify-content:center;gap:40px">
    ${blocos
      .map(
        ([valor, rotulo]) => `<div style="border-left:5px solid ${C.ball};padding-left:28px">
        <div class="display" style="font-size:78px;color:${C.ball};line-height:1">${valor}</div>
        <div style="font-size:25px;color:rgba(250,250,248,0.72);margin-top:6px">${rotulo}</div>
      </div>`,
      )
      .join('')}
  </div>

  <div style="margin-top:48px"><span class="cta">Fazer minha análise</span></div>
  ${rodape()}`;
}

/**
 * ─── CRIATIVO 3: A PERGUNTA ─────────────────────────────────────────────────────────────────
 *
 * Uma pergunta que o leitor não sabe responder é o gancho mais barato que existe: ela cria a
 * lacuna que o produto fecha. Sem número, sem tabela — só a pergunta e a saída.
 */
function pergunta(): string {
  return `${cabecalho()}
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:24px;letter-spacing:0.2em;color:${C.ball};margin-bottom:32px">A PERGUNTA</div>
    <div class="display" style="font-size:82px;max-width:920px">
      Você escolheu<br>sua raquete<br>ou <span style="color:${C.ball}">herdou</span> ela?
    </div>
    <div style="font-size:28px;color:rgba(250,250,248,0.62);margin-top:36px;max-width:800px;line-height:1.45">
      A maioria joga com o que estava em promoção, com o que o amigo indicou,
      ou com o que o ídolo usa. Nenhum desses é o seu jogo.
    </div>
    <div style="margin-top:52px"><span class="cta">Descobrir a minha</span></div>
  </div>
  ${rodape()}`;
}


/**
 * ─── CRIATIVO 4: O RISCO DE ERRAR ───────────────────────────────────────────────────────────
 *
 * O ângulo comercial mais forte que este produto tem, e o mais honesto: a assimetria de preço.
 * Uma raquete errada fica anos no armário; a análise custa uma fração e resolve antes.
 *
 * NENHUM valor de raquete aparece escrito. Preço de varejo varia por modelo, loja e mês, e um
 * número que eu não posso verificar viraria a primeira mentira do anúncio — num produto cujo
 * argumento inteiro é não inventar número. A assimetria se comunica sozinha.
 */
function risco(): string {
  return `${cabecalho()}
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
    <div class="display" style="font-size:74px;max-width:920px;line-height:1.08">
      Errar a raquete<br>custa caro.
    </div>
    <div class="display" style="font-size:74px;max-width:920px;line-height:1.08;margin-top:14px;color:${C.ball}">
      Acertar custa<br>R$ 19,99.
    </div>
    <div style="font-size:27px;color:rgba(250,250,248,0.65);margin-top:38px;max-width:840px;line-height:1.45">
      Uma raquete que não combina com você não vira desconto: vira anos de jogo
      pior e uma compra que você não repete.
    </div>
    <div style="margin-top:50px"><span class="cta">Analisar antes de comprar</span></div>
  </div>
  ${rodape()}`;
}

/**
 * ─── CRIATIVO 5: O MÉTODO ───────────────────────────────────────────────────────────────────
 *
 * Contra a objeção silenciosa de todo serviço de recomendação: "isso não é chute?". Três passos
 * numerados, com o que entra e o que sai — a estrutura é a mensagem.
 */
function metodo(n: Numeros): string {
  const passos = [
    ['01', 'Você responde', 'Físico, nível, swing, estilo, objetivo e o que incomoda hoje.'],
    ['02', 'O motor calcula', `Seu perfil é cruzado com ${n.raquetes} raquetes e ${n.cordas} cordas, especificação por especificação.`],
    ['03', 'Você recebe', 'Raquete, corda, espessura e tensão — com o porquê de cada escolha.'],
  ];

  return `${cabecalho()}
  <div class="display" style="font-size:64px;max-width:900px">Não é palpite.<br>É medição.</div>

  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px;margin-top:20px">
    ${passos
      .map(
        ([num, titulo, texto]) => `<div style="display:flex;gap:26px;align-items:flex-start">
        <div class="display" style="font-size:44px;color:${C.ball};min-width:78px;line-height:1.1">${num}</div>
        <div>
          <div class="display" style="font-size:34px">${titulo}</div>
          <div style="font-size:23px;color:rgba(250,250,248,0.65);margin-top:8px;line-height:1.45;max-width:760px">${texto}</div>
        </div>
      </div>`,
      )
      .join('')}
  </div>

  <div><span class="cta">Ver como funciona</span></div>
  ${rodape()}`;
}

/**
 * ─── CRIATIVO 6: A ESCALA ───────────────────────────────────────────────────────────────────
 *
 * O número de combinações é o argumento que dispensa retórica: nenhum vendedor de loja percorre
 * vinte e nove mil possibilidades, e o leitor sabe disso sem que se diga.
 */
function escala(n: Numeros): string {
  return `${cabecalho()}
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:24px;letter-spacing:0.2em;color:rgba(250,250,248,0.5)">RAQUETE × CORDA × ESPESSURA × TENSÃO</div>
    <div class="display" style="font-size:150px;color:${C.ball};line-height:1;margin-top:22px">${n.combinacoes}</div>
    <div class="display" style="font-size:52px;margin-top:10px">combinações possíveis.</div>
    <div style="font-size:27px;color:rgba(250,250,248,0.65);margin-top:34px;max-width:860px;line-height:1.45">
      Uma delas é a sua. Testar na tentativa e erro levaria uma vida —
      e cada tentativa é uma compra.
    </div>
    <div style="margin-top:50px"><span class="cta">Encontrar a minha</span></div>
  </div>
  ${rodape()}`;
}

/**
 * ─── CRIATIVO 7: A INDEPENDÊNCIA ────────────────────────────────────────────────────────────
 *
 * O diferencial que nenhuma loja pode copiar. Aqui as três afirmações são verificáveis no próprio
 * produto — não há comissão, o catálogo é público e a metodologia é versionada —, e é justamente
 * por serem verificáveis que elas podem ser ditas.
 */
function independencia(n: Numeros): string {
  const pontos = [
    'Não vendemos raquete. Não ganhamos comissão de quem vende.',
    `As ${n.raquetes} raquetes são avaliadas pelas mesmas especificações publicadas pelo fabricante.`,
    'Cada relatório registra a versão do motor e do catálogo que o produziu.',
  ];

  return `${cabecalho()}
  <div class="display" style="font-size:64px;max-width:900px">Sem loja.<br>Sem comissão.<br>Sem achismo.</div>

  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:30px">
    ${pontos
      .map(
        (t) => `<div style="display:flex;gap:22px;align-items:flex-start">
        <div style="color:${C.ball};font-size:34px;line-height:1.2">✓</div>
        <div style="font-size:29px;line-height:1.4;max-width:820px">${t}</div>
      </div>`,
      )
      .join('')}
  </div>

  <div><span class="cta">Ver a metodologia</span></div>
  ${rodape()}`;
}

/**
 * ─── CRIATIVO 8: O MATCH MÉDIO ──────────────────────────────────────────────────────────────
 *
 * ⚠️ ATENÇÃO AO USAR ESTA PEÇA.
 *
 * 91% é a média real do primeiro colocado nas 22 PERSONAS DE VALIDAÇÃO — perfis construídos para
 * testar o motor, não clientes. Dizer "91% de match médio" sem qualificar sugere base de usuários
 * reais, e isso seria falso hoje.
 *
 * O texto abaixo qualifica: fala em "perfis de validação". Quando houver volume real, trocar a
 * fonte do número é uma linha — e aí a peça fica mais forte, não mais fraca.
 */
function matchMedio(): string {
  return `${cabecalho()}
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
    <div class="display" style="font-size:170px;color:${C.ball};line-height:1">91%</div>
    <div class="display" style="font-size:50px;margin-top:12px;max-width:900px">
      de compatibilidade média
    </div>
    <div style="font-size:26px;color:rgba(250,250,248,0.65);margin-top:28px;max-width:860px;line-height:1.45">
      É o que o motor entrega para a raquete indicada nos 22 perfis de validação
      que usamos para calibrá-lo — do iniciante ao competitivo.
    </div>
    <div style="margin-top:50px"><span class="cta">Ver o meu</span></div>
  </div>
  ${rodape()}`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });

  const stats = catalogStats();
  const n: Numeros = {
    raquetes: stats.rackets,
    cordas: stats.stringVariants,
    combinacoes: `+${formatThousands(countSetupCombinations(loadRacketCatalog(), loadStringCatalog()))}`,
  };

  const criativos = {
    'ficha-tecnica': fichaTecnica(n),
    numeros: numeros(n),
    pergunta: pergunta(),
    risco: risco(),
    metodo: metodo(n),
    escala: escala(n),
    independencia: independencia(n),
    'match-medio': matchMedio(),
  };

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });

  for (const [nome, corpo] of Object.entries(criativos)) {
    for (const [formato, { w, h }] of Object.entries(FORMATOS)) {
      const html = pagina(w, h, corpo);
      const arquivo = join(OUT, `${nome}-${formato}`);
      writeFileSync(`${arquivo}.html`, html, 'utf8');

      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.setContent(html, { waitUntil: 'networkidle' });
      // As fontes vêm da rede; sem esperar, o primeiro quadro sai com a fonte de fallback.
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${arquivo}.png` });
      await page.close();

      console.log(`  ${nome}-${formato}.png`);
    }
  }

  await browser.close();
  console.log(`\n✅ ${Object.keys(criativos).length * Object.keys(FORMATOS).length} criativos em criativos/\n`);
}

void main();
