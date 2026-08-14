# DESIGN.md — Tennis Engineer

Status: `v1` · Mobile-first (§43) · pt-BR

---

## 1. Direção

Uma **ferramenta premium de performance esportiva** (§1). Referência mental: instrumento de engenharia
e diagrama técnico, não loja e não blog.

| Transmitir | Evitar |
|---|---|
| engenharia · precisão · tecnologia | quiz genérico |
| personalização · confiança | loja virtual barata |
| performance · conhecimento técnico | site de afiliados / chatbot |

---

## 2. Tokens — paleta oficial do brand book

```css
/* ── Marca ─────────────────────────────────────────────────────────────────────── */
--court:      #0E3D2E;   /* verde profundo — cor institucional, fundos de destaque  */
--court-mid:  #3A7D63;   /* verde médio — superfícies secundárias, gráficos, sucesso */
--clay:       #D85A2B;   /* laranja — acento primário de AÇÃO (CTA, resultado)       */
--signal:     #1491E6;   /* azul — informação técnica, links, dados de referência    */
--ball:       #FFC62E;   /* amarelo bola — realce pontual, badges, progresso         */

/* ── Neutros ───────────────────────────────────────────────────────────────────── */
--ink:        #0B0F14;   /* quase preto azulado — tipografia e fundos escuros        */
--paper:      #FAFAF8;   /* off-white, muito espaço em branco (§39)                  */
--graphite:   #5A6472;   /* texto secundário                                         */
--line:       #E4E6E3;   /* linhas de quadra, divisórias                             */
--warn:       #B45309;   /* pontos de atenção                                        */
```

**Uma cor de acento por tela.** A paleta é ampla para dar vocabulário aos gráficos e aos estados, não
para colorir tudo ao mesmo tempo. Cada tela elege um acento; os demais aparecem no máximo como
detalhe. Sem gradientes coloridos, sem sombras difusas.

Divisão de papéis, para que a escolha nunca seja estética:

| Cor | Papel | Onde aparece |
|---|---|---|
| `--court` | institucional | hero, cabeçalhos, rodapé, fundos escuros |
| `--clay` | ação | CTA principal, destaque do resultado |
| `--signal` | informação | links, referências técnicas, eixos de gráfico |
| `--ball` | realce | badges, progresso, seleção de texto |
| `--court-mid` | apoio | superfícies secundárias, estados de sucesso |

### Tipografia

- **Display — Sora**, peso 600–700, `letter-spacing: -0.02em` nos números grandes. Títulos e o `94%`,
  que é o elemento gráfico principal do relatório.
- **Texto — Inter**, 16 px base, `line-height: 1.6`, largura máxima de 68 caracteres.
- **Dados:** variante tabular para specs — números alinham em colunas, como em ficha técnica.

Ambas carregadas por `next/font` com `display: swap` e variáveis CSS (`--font-display`,
`--font-sans`), com fallback de sistema declarado para o caso de a fonte não carregar.

### Espaço e forma

Muito branco. Raio de canto pequeno (4–8 px) — quanto mais arredondado, mais "app de consumo" e menos
instrumento. Bordas de 1 px em `--line` no lugar de sombras. Grid de 8 px.

### Motivos gráficos (§39)

Linhas de quadra como divisórias e enquadramentos; malha de encordoamento como textura sutil (opacidade
≤ 0.06); arco de trajetória da bola para progresso e transições; diagramas técnicos para comparação de
specs. Sempre funcionais — nada de ornamento puro.

---

## 3. Marca

```
TENNIS ENGINEER
Seu jogo. Seu setup. Sob medida.

Precisão técnica aplicada ao seu jogo.        ← linha de conceito
SUA EVOLUÇÃO É O NOSSO PROJETO.               ← assinatura de rodapé
```

Wordmark em caixa alta, tracking aberto, com o subtítulo sempre presente na home e no cabeçalho do
relatório (§39, §64). Nunca abreviar para "TE".

### Regra da marca — inegociável

> **"A marca Tennis Engineer deve ser aplicada sempre em preto ou branco.
> Cores de destaque nunca são aplicadas à marca."**

Verde, laranja, azul e amarelo vestem a **interface** — fundos, gráficos, estados, acentos. Nunca o
logotipo. Sobre fundo claro a marca é preta; sobre fundo escuro, branca. Não há terceira opção.

Isto é aplicado em código, não confiado à disciplina: o componente `<Wordmark>` só aceita
`tone="light" | "dark"`, que resolvem para `--ink` e branco. Não existe prop, classe ou caminho que
pinte o logotipo de uma cor de acento. `<BrandSignature>` segue a mesma regra.

---

## 4. Componentes-chave

**Card de questionário** — uma pergunta por tela, alvos de toque ≥ 56 px de altura, seleção com borda de
2 px em `--court` (nunca preenchimento chapado), progress bar como linha fina no topo com marcadores de
etapa.

**Pódio (§29)** — 1º central, maior, mais alto; 2º e 3º laterais e menores. Bloqueados recebem
`filter: blur(10px)` **sobre um placeholder**, jamais sobre o dado real (que nem chega ao cliente, §32),
com o Fit Score legível por cima e um cadeado discreto.

**Card de match** — o número grande (`94%`) como herói tipográfico, `MATCH` em caixa alta pequena
abaixo, marca/modelo em display, e as barras de índice:

```
CONTROLE      ████████████████░░░░  92
SPIN          ██████████████░░░░░░  88
POTÊNCIA      ████████████░░░░░░░░  79
CONFORTO      ██████████████░░░░░░  84
```

Legenda obrigatória logo abaixo (§64): *"Índices Tennis Engineer (0–100). Não são especificações do
fabricante."*

**Comparativo atual × recomendada (§22)** — duas colunas com setas de direção e magnitude; o que piora
aparece com o mesmo destaque do que melhora. Trade-off exibido é credibilidade.

**Selo de empate técnico** — quando `|Δfit| < 2`: *"empate técnico — a escolha aqui é de preferência"*.

**Estado de processamento (§63)** — mensagens reais, uma por linha, marcadas conforme concluem:
*Analisando seu perfil técnico… · Interpretando seu estilo de jogo… · Comparando especificações de
frames… · Avaliando potência, controle e spin… · Calculando compatibilidade…* (e, no setup completo:
*Analisando comportamento das cordas… · Calculando tensão inicial…*), terminando em **"Seu Tennis
Engineer está pronto."** Duração mínima de 2,8 s apenas para legibilidade — sem loading falso longo.

---

## 5. Mobile-first (§43)

Desenhar em 390 px e escalar para cima. Tráfego virá de Instagram, WhatsApp e Google.

- Um cartão por dobra no questionário; texto curto por tela.
- CTA fixo no rodapé em telas de decisão, com `env(safe-area-inset-bottom)`.
- Zero hover como único canal de informação.
- O pódio empilha verticalmente no mobile mantendo a hierarquia 1 → 2 → 3.
- Tabela comparativa do Top 3 vira cards deslizáveis com a coluna de atributo fixa.

---

## 6. Acessibilidade

Contraste AA mínimo (AAA no corpo de texto). Foco visível em tudo. Nada comunicado só por cor — as barras
de índice trazem o número. `prefers-reduced-motion` desliga a animação de processamento e mostra as
mensagens de uma vez. Todo controle do questionário é operável por teclado e rotulado para leitor de tela.

---

## 7. Open Graph (§53)

Card de compartilhamento com wordmark, `94% MATCH` e o modelo — **apenas** o que o usuário já
desbloqueou. Sem entitlement, o card mostra "Descubra o seu setup" sem revelar produto algum.
