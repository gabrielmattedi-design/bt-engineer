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

## Os três arquétipos

| | Arquétipo | Fundo | Para |
|---|---|---|---|
| **A** | Ficha técnica | `paper` | P2 Física, P4 Caso |
| **B** | Editorial | `ink` | P1 Diagnóstico, P3 Mito, P6 Story |
| **C** | Diagrama | `court` | P5 Comparação, P7 Bastidor |

**A · Ficha técnica** — papel milimetrado, cotas, anotação de desenho técnico. Vocabulário de
engenharia, que ninguém no tênis usa.

**B · Editorial** — tipografia enorme sobre preto, quase nada além dela. Para o que precisa parar o
scroll na emoção, não no dado.

**C · Diagrama** — o dado é a arte. Verde institucional, tipo menor, gráfico que se entende sem
legenda.

---

## Templates prontos

| Arquétipo | Brand template | Campos |
|---|---|---|
| **B · Editorial** | `EAHUMKDtV1o` | `titulo` · `destaque` · `apoio` · `rodape` |
| A · Ficha técnica | *a montar* | — |
| C · Diagrama | *a montar* | — |

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

**`publish-brand-template` devolve erro e mesmo assim publica.** Ao publicar o Editorial, a
resposta foi *"Not allowed to access brand template with id EAHUMKDtV1o"* — mas o template tinha
sido criado, com os quatro campos registrados. O erro é da leitura de volta, não da publicação.
Ao publicar um arquétipo novo: **anote o id que aparece na mensagem de erro** e confirme com
`get-brand-template-dataset` antes de concluir que falhou.
