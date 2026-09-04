# Marca e Canva

## O sistema: identidade fixa, arte variável

As oito peças `TE · Anúncio` que existiam eram a mesma arte oito vezes — fundo verde, headline
branca, ênfase amarela, botão laranja. O dono apontou o problema:

> "Não quero tudo com a mesma cara igual os primeiros já criados no Canva, fundo verde, escrita,
> etc. manter uma identidade visual, mas com artes fodas."

A saída não é achar uma direção melhor. É separar o que fica fixo do que varia — as peças antigas
fixavam as duas coisas.

### Fixo — a identidade

- **Sora** (títulos, números) + **Inter** (texto). Nunca outra fonte.
- **Paleta**, e nada fora dela:
  `court #0E3D2E` · `court-mid #3A7D63` · `clay #D85A2B` · `ball #FFC62E` ·
  `signal #1491E6` · `paper #FAFAF8` · `ink #0B0F14`
- **Wordmark** sempre em `top 62, left 72`, 56 px, em preto ou branco. O brand book proíbe cor na
  marca — as cores vestem a peça, nunca o logotipo.
- **Rodapé** em `top 1250`: domínio à esquerda, contador de slide ou rótulo da série à direita.
- **Vocabulário de engenharia** — cota, faixa, eixo, percentil, escala. É o que faz três artes
  diferentes parecerem do mesmo lugar.

### Varia — a arte

- **O fundo:** papel, preto ou verde. Era sempre verde, e era o maior responsável pela mesmice.
- **O arquétipo:** os três abaixo.
- **A escala do tipo:** de 56 px a 118 px, conforme o peso da frase.
- **O elemento gráfico:** cota, régua, barra, curva, ficha.

Três fundos × três arquétipos dá nove combinações reconhecíveis entre si. Quem vê o feed de cima
percebe uma marca; quem passa post a post não vê o mesmo layout duas vezes seguidas.

---

## Os arquétipos

| | Arquétipo | Formato | Fundo | Para |
|---|---|---|---|---|
| **A** | Ficha técnica | 1080×1350 | `paper` | P2 Física, P4 Caso |
| **B** | Editorial | 1080×1350 | `ink` | P1 Diagnóstico, P3 Mito |
| **C** | Diagrama | 1080×1350 | `court` | P5 Comparação, P7 Bastidor |
| **D** | Story | 1080×1920 | `ink` | P6 Story — enquete, caixa de pergunta, chamada para o post |

**A · Ficha técnica** — papel milimetrado, cotas, anotação de desenho técnico. Vocabulário de
engenharia, que ninguém no tênis usa.

**B · Editorial** — tipografia enorme sobre preto, quase nada além dela. Para o que precisa parar o
scroll na emoção, não no dado.

**C · Diagrama** — o dado é a arte. Verde institucional, tipo menor, gráfico que se entende sem
legenda.

**D · Story** — o Editorial esticado para 9:16, com o miolo VAZIO de propósito. A arte é fundo: quem
ocupa o centro da tela é o sticker nativo do Instagram (enquete, caixa de pergunta, link, post).

---

## Templates prontos

| Arquétipo | Brand template | Campos |
|---|---|---|
| **A · Ficha técnica** | `EAHUMHdg-_0` | `etiqueta` · `titulo` · `apoio` · `rodape` |
| **B · Editorial** | `EAHUMKDtV1o` | `titulo` · `destaque` · `apoio` · `rodape` |
| **C · Diagrama** | `EAHUMD6CggM` | `etiqueta` · `titulo` · `valor_a` · `rotulo_a` · `valor_b` · `rotulo_b` · `legenda` · `rodape` |
| **D · Story** | `EAHUMDWWwI4` | `titulo` · `destaque` · `apoio` · `rodape` |

### Anatomia do Editorial (1080 × 1350)

| Elemento | `locator_id` | Posição | Formato |
|---|---|---|---|
| Fundo | `PB217X2Lkn1WJxbg-LBC2MCT4fVnQV1d4` | 0,0 · 1080×1350 | `#0B0F14` |
| Grade fina | `…-LBfXcw80DqNBnMbc` | — | branco, 3,5% |
| Grade larga | `…-LB4NWhdRKzv2mKKT` | — | branco, 5% |
| **`titulo`** | `…-LBQSc0v6WnMJgCfM` | 470,72 · larg. 940 | Sora bold 104, `#F7F8F6` |
| **`destaque`** | `…-LBZs6t5v57hntdd9` | 586,72 · larg. 940 | Sora bold 104, `#FFC62E` |
| Régua | `…-LB4bYJyP3YDdSsyM` | 872,72 · 156×8 | `#D85A2B` |
| **`apoio`** | `…-LBYcJhfXGDMZ0KM7` | 928,72 · larg. 820 | Inter 30, `#A8B2AD` |
| **`rodape`** | `…-LBMzL3mdm3W7NkSj` | 1250,598 · alin. dir. | Inter 20, `#6E7A74` |

**Limites de texto** — o layout é ancorado no topo, não centralizado, porque texto de tamanho
variável em composição centralizada estoura de forma imprevisível. Em troca, o texto precisa caber:

- `titulo`: **1 linha**, até ~15 caracteres em 104 px
- `destaque`: **1 a 2 linhas**, até ~20 caracteres por linha
- `apoio`: **até 2 linhas**, ~95 caracteres

Passou disso, encurte a copy. Reduzir o corpo da fonte descaracteriza o arquétipo — a tipografia
grande *é* o arquétipo.

### Anatomia da Ficha técnica (1080 × 1350)

Fundo `paper`, grade em `court` visível, wordmark em `ink`. A assinatura do arquétipo é a **linha
de cota** — um traço com barras nas pontas, o jeito como um desenho técnico marca uma medida.

| Elemento | `locator_id` | Posição | Formato |
|---|---|---|---|
| Fundo | `PBCQjcqhG1QsQkTS-LBC2MCT4fVnQV1d4` | 0,0 | `#FAFAF8` |
| Grade fina | `…-LBfXcw80DqNBnMbc` | — | `court`, 7% |
| Grade larga | `…-LB4NWhdRKzv2mKKT` | — | `court`, 12% |
| **`etiqueta`** | `…-LBQSc0v6WnMJgCfM` | 300,72 · larg. 700 | Sora bold 24, `#D85A2B` |
| **`titulo`** | `…-LBZs6t5v57hntdd9` | 356,72 · larg. 900 | Sora bold 78, `#0B0F14` |
| Linha de cota | `…-LB4bYJyP3YDdSsyM` | 720,72 · 936×16 | `#D85A2B` |
| **`apoio`** | `…-LBYcJhfXGDMZ0KM7` | 780,72 · larg. 860 | Inter 31, `#3F4A54` |
| **`rodape`** | `…-LBMzL3mdm3W7NkSj` | 1250,598 · alin. dir. | Inter 20, `#5A6472` |

Limites: `etiqueta` 1 linha curta · `titulo` até 3 linhas, ~26 caracteres por linha ·
`apoio` até 3 linhas, ~150 caracteres.

### Anatomia do Diagrama (1080 × 1350)

Fundo `court`. O gráfico é o conteúdo — o título é menor de propósito. Duas barras comparativas; a
skill **redimensiona e reposiciona** as barras conforme o dado, e as barras não são campos de texto.

| Elemento | `locator_id` | Posição | Formato |
|---|---|---|---|
| **`etiqueta`** | `PBgdWT7pYtRRpSbb-LBQSc0v6WnMJgCfM` | 290,72 | Sora bold 24, `#FFC62E` |
| **`titulo`** | `…-LBZs6t5v57hntdd9` | 344,72 · larg. 900 | Sora bold 62, `#F3F6F3` |
| **`valor_a`** | `…-LBjFk9xcc9hV4x4C` | 646,150 · larg. 300 | Inter 26 centro, `#FFC62E` |
| **`valor_b`** | `…-LBhCG921PppYM8fV` | 766,630 · larg. 300 | Inter 26 centro, `#FFC62E` |
| Barra A | `…-LB3S0f9JQKLTbnB6` | 700,150 · 300×300 | `#3A7D63` |
| Barra B | `…-LBvDqrrVk559lGC1` | 820,630 · 300×180 | `#D85A2B` |
| Linha de base | `…-LB4bYJyP3YDdSsyM` | 1000,72 · 936×2 | `#F3F6F3` a 32% |
| **`rotulo_a`** | `…-LBf1vt7dJZbdHwR3` | 1018,150 · larg. 300 | Sora bold 27 centro, `#F3F6F3` |
| **`rotulo_b`** | `…-LByw9CRcgtnhhb0w` | 1018,630 · larg. 300 | Sora bold 27 centro, `#F3F6F3` |
| **`legenda`** | `…-LBYcJhfXGDMZ0KM7` | 1090,72 · larg. 860 | Inter 27, `#B8C9C1` |
| **`rodape`** | `…-LBMzL3mdm3W7NkSj` | 1250,598 · alin. dir. | Inter 20 |

**Como desenhar as barras.** A base fica em `top 1000`. Uma barra de altura `h` vai em
`top = 1000 − h`, e o valor acima dela em `top = 1000 − h − 54`. Altura máxima 340 (senão encosta
no título). As duas barras precisam usar a MESMA escala — barra maior = valor maior, sempre. Uma
comparação em que a barra menor representa o número maior é um gráfico que mente.

**O gráfico precisa dizer algo verdadeiro.** Se a pauta não tem duas quantidades comparáveis, use
outro arquétipo. Barra sem dado por trás é enfeite fingindo ser informação — e é justamente o que
`limites.md` existe para impedir.

### Anatomia do Story (1080 × 1920)

Mesmos elementos do Editorial, redistribuídos em 9:16. Os `locator_id` são os MESMOS — o Story
nasceu de um `resize-design` do Editorial, então a tabela de ids serve para os dois.

| Elemento | `locator_id` | Posição | Formato |
|---|---|---|---|
| Fundo | `PB217X2Lkn1WJxbg-LBC2MCT4fVnQV1d4` | 0,0 · 1080×1920 | `#0B0F14` |
| Grades | `…-LBfXcw80DqNBnMbc` · `…-LB4NWhdRKzv2mKKT` | 0,0 · 1080×1920 | branco, 3,5% e 5% |
| Wordmark (anel + E) | `…-LBVBVDm79D6T6Jzw` · `…-LBD9z5kNljWcxcDY` | 200,80 · 56×56 | `#FAFAF8` |
| Wordmark (texto) | `…-LBdCPd1swnV3PJRN` · `…-LB5wf59W8zfB9z7b` | 196,154 e 240,154 | Sora bold 30 · Inter 17 |
| **`titulo`** | `…-LBQSc0v6WnMJgCfM` | 440,80 · larg. 920 | Sora bold 92, `#F7F8F6` |
| **`destaque`** | `…-LBZs6t5v57hntdd9` | 552,80 · larg. 920 | Sora bold 92, `#FFC62E` |
| Régua | `…-LB4bYJyP3YDdSsyM` | 830,80 · 156×8 | `#D85A2B` |
| **`apoio`** | `…-LBYcJhfXGDMZ0KM7` | 886,80 · larg. 800 | Inter 32, `#A8B2AD` |
| Domínio | `…-LBpNk92RQHKjR2xH` | 1700,80 | Inter 22, `#6E7A74` |
| **`rodape`** | `…-LBMzL3mdm3W7NkSj` | 1700,580 · alin. dir. | Inter 22, `#6E7A74` |

**As três faixas que mandam no layout.** O 9:16 do Instagram não é uma tela livre — a interface come
as pontas e o sticker come o meio:

- **0 a 190** — barra de perfil, avatar e "×". Nada da arte pode entrar aqui. Por isso o wordmark
  começa em 200, e não nos 62 do formato 4:5.
- **1000 a 1650** — **zona livre, e ela é o ponto do arquétipo.** É onde o dono cola a enquete, a
  caixa de pergunta, o link ou o sticker do post. Texto nosso aqui vira texto atrás de sticker.
- **1650 a 1920** — campo "Enviar mensagem" e barra de compartilhar. O rodapé em 1700 fica no limite
  de cima dessa faixa, discreto por definição, e é o único elemento que aceita conviver com ela.

Quando o `apoio` passa de duas linhas, ele invade a zona livre. Nesse caso suba a régua e o `apoio`
juntos (foi o que o Story 2 fez: régua 760, `apoio` 816) em vez de reduzir a fonte.

**O `rodape` do Story diz o que fazer, não onde estamos.** No 4:5 ele é contador de slide; aqui ele
é a instrução da interação — "Responde aí ↓", "Toca no post ↑", "Caixa de pergunta ↓". A seta aponta
para onde o sticker vai ficar.

---

## O fluxo diário

### Não existe autofill nesta integração

A proposta previa `autofill-design`. **Ele não existe** no conjunto de ferramentas disponível —
verificado em 04/09/2026. O que existe é criar a partir do template e substituir o texto, que dá o
mesmo resultado com uma chamada a mais e mais controle: dá para ajustar o corpo da fonte quando a
frase é longa, o que o autofill não permitiria.

A etiquetagem com `autofill_field_label` continua valendo a pena: ela documenta quais elementos são
campos de conteúdo e é o que faz o esquema do template ser legível por
`get-brand-template-dataset`.

### Os cinco passos

1. **`create-design-from-brand-template`** com o id do arquétipo. Devolve um design novo com o
   conteúdo do template.
2. **`read-design`** com `open_transaction: true`. Os `locator_id` são os MESMOS do template — a
   tabela acima vale para todo post gerado —, mas a leitura devolve o `transaction_id`, que é
   obrigatório.
3. **`edit-design`** com um `replace_text` por campo, mais `update_title` com o nome da pauta.
4. **`edit-design`** com `finalize: "commit"`. Operações e commit **não podem ir na mesma chamada**.
5. **`get-export-formats`** e então **`export-design`** em PNG 1080×1350.

Entregar ao dono o `edit_url` e o PNG. **A skill nunca publica.**

### Duas armadilhas medidas

**`search-brand-templates` devolve lista vazia** mesmo com o template existindo — a permissão de
leitura da busca não está concedida nesta conexão. Por isso os ids ficam anotados na tabela acima:
procurar não funciona, guardar funciona. `get-brand-template-dataset` com o id direto funciona
normalmente.

**`publish-brand-template` devolve erro e mesmo assim publica.** Aconteceu nos TRÊS arquétipos —
*"Not allowed to access brand template with id …"* —, e nos três o template estava criado com os
campos registrados. O erro é da leitura de volta, não da publicação. Ao publicar um arquétipo novo:
**anote o id que aparece na mensagem de erro** e confirme com `get-brand-template-dataset` antes de
concluir que falhou.

**Texto novo nasce preto, 16 px, alinhado à esquerda.** `add_text` ignora a identidade da peça: no
Diagrama os quatro rótulos do gráfico saíram invisíveis sobre o verde. Todo `add_text` precisa de um
`format_text` em seguida — e o `locator_id` do texto novo só existe na RESPOSTA, então isso custa
uma segunda chamada.

**`update_stroke_properties` falhou com erro interno** ao tentar mudar a cor do anel do wordmark na
Ficha técnica. A volta que funcionou foi `replace_shape` com um anel PREENCHIDO (círculo externo no
sentido horário, interno no anti-horário) seguido de `recolor_element`.

**`resize-design` não adapta o layout — ele empilha.** Ao levar o Editorial de 1080×1350 para
1080×1920, o "magic resize" enfiou todos os elementos numa caixa flutuante no meio da tela, com o
fundo e as grades ainda em 1350 de altura. Nada quebra, e é justamente por isso que engana: o
arquivo abre, os ids continuam válidos, e a peça está errada.

O caminho que funcionou foi tratar o resize como ponto de partida e reconstruir o layout inteiro num
único `edit-design`: `resize_element` no fundo e nas duas grades para 1080×1920, e
`position_element` em cada elemento de texto. Vale a pena fazer numa chamada só — cada `edit-design`
devolve o documento inteiro, e o Story tem duas grades cujo `path` SVG ocupa milhares de caracteres.
