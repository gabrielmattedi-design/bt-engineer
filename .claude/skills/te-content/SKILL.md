---
name: te-content
description: Cria conteúdo diário de Instagram para o Tennis Engineer — pauta, copy, hook, legenda, CTA e arte no Canva. Use quando o usuário pedir post, carrossel, story, reels, pauta, calendário editorial ou conteúdo para a página. Confere toda afirmação técnica contra o catálogo e a metodologia do projeto antes de gerar arte.
---

# te-content

Produz conteúdo de Instagram para o Tennis Engineer. **Nunca publica** — tudo vai para aprovação do
dono.

A lógica da página: **conteúdo útil → autoridade → engajamento → conversão**. A página precisa ter
valor para alguém que nunca vá comprar nada.

---

## Antes de qualquer coisa

Leia `references/limites.md`. Ele não é referência de consulta — é pré-requisito. O maior risco
desta skill não é inventar uma raquete: é publicar como fato um dado do próprio projeto que é mais
frouxo do que parece.

Os três limites que mais mordem:

1. **Swingweight e RA não existem no catálogo.** Nunca dar esses números, nunca sugerir que o
   produto os usa.
2. **Nenhuma especificação numérica de modelo nomeado** enquanto `source_url` for nulo — hoje, todas.
   Comparação entre modelos fica em caráter e tipo de jogador, sem número, sem melhor ou pior.
3. **Heurística nossa não é lei da física.** "O teto de peso do Tennis Engineer considera porte" é
   verdade; "existe um peso máximo para o seu corpo" não é.

---

## Processo

### 1. Consultar o histórico

```bash
npx tsx .claude/skills/te-content/scripts/historico.ts
```

Mostra as últimas pautas. Depois de escolher um tema candidato, confira antes de escrever:

```bash
npx tsx .claude/skills/te-content/scripts/historico.ts <tema> <pilar> <cta>
```

`❌ BLOQUEADO` significa escolher outra pauta. As quatro regras estão em `scripts/historico.ts`.

### 2. Escolher a pauta e dizer por quê

Selecione um pilar de `references/pilares.md`, respeitando a distribuição e a alternância.
**Explique em duas frases por que essa pauta interessa ao jogador amador** — se a justificativa não
sair fácil, a pauta está fraca.

Fontes de pauta que costumam render:
- `docs/QUESTIONNAIRE.md` — cada pergunta existe porque alguém tem aquele problema;
- respostas de enquete de Stories da semana anterior;
- `docs/RECOMMENDATION_ENGINE.md` — os comentários registram defeitos reais e contra-intuições.

### 3. Escolher o formato

| Formato | Quando |
|---|---|
| Post único 4:5 | Uma ideia só, veredicto rápido. Mito, diagnóstico curto. |
| Carrossel 4:5 | Raciocínio em etapas. Física, caso, lista de sinais. 5 a 8 slides. |
| Story 9:16 | Enquete, caixa de pergunta, bastidor. Sempre com interação. |
| Reels | Só quando houver ideia real de movimento. Sem cota. |

### 4. Escrever a copy

Estrutura do carrossel:
1. **Capa** — o hook. Compreensível em menos de 2 segundos, no máximo 7 palavras.
2. **Miolo** — uma ideia por slide, no máximo 25 palavras cada.
3. **Fecho** — o que fazer com isso + CTA.

Regras de escrita:
- Especialista acessível, nunca guru.
- Sem clickbait ("ninguém te conta", "o segredo que...").
- Sem afirmação absoluta quando a evidência não permite.
- Todo equipamento tem trade-off — dizer qual.
- Nunca atacar marca.
- Explicar termo técnico na primeira vez que aparecer.

### 5. Conferir toda afirmação técnica

**Este passo vem antes da arte, e não depois.** Etiquete cada frase técnica:

`[catálogo]` `[motor]` `[física]` `[heurística]` `[opinião]`

Se algo for `[opinião]` e estiver escrito como fato, reescreva. Se for `[heurística]`, a frase tem
que dizer que a regra é nossa. Ver `references/limites.md` §6.

Números vêm daqui, sempre:

```bash
npx tsx .claude/skills/te-content/scripts/fatos.ts
```

Para o pilar P4, o caso vem do motor de verdade:

```bash
npx tsx .claude/skills/te-content/scripts/caso.ts '{"age":42,"height_cm":178,...}'
```

Idade, altura e peso são obrigatórios — o script recusa perfil que o site também recusaria.

### 6. Criar a arte no Canva

Ver `references/marca.md` — sistema visual, anatomia dos templates, ids e as duas armadilhas
medidas do Canva.

Escolha o arquétipo pelo pilar (A Ficha técnica · B Editorial · C Diagrama · D Story), depois:

1. `create-design-from-brand-template` com o id do arquétipo
2. `read-design` com `open_transaction: true` — devolve o `transaction_id`
3. `edit-design` com um `replace_text` por campo + `update_title` com o nome da pauta
4. `edit-design` com `finalize: "commit"` — operações e commit **não** vão na mesma chamada
5. `get-export-formats` e então `export-design` em PNG — 1080×1350 nos arquétipos A/B/C,
   **1080×1920 no D**

**Não existe `autofill-design` nesta integração.** O caminho acima dá o mesmo resultado com mais
controle. Respeite os limites de caracteres de `marca.md`: o layout é ancorado no topo, e reduzir a
fonte para caber descaracteriza o arquétipo.

**Os quatro estão prontos:** Ficha técnica `EAHUMHdg-_0` · Editorial `EAHUMKDtV1o` ·
Diagrama `EAHUMD6CggM` · Story `EAHUMDWWwI4`.

### 7. Legenda e CTA

A legenda **não repete** o que está na arte — ela estende. Primeira linha é o segundo hook (o feed
corta ali). 3 a 6 linhas, quebradas.

Três níveis de CTA. O padrão é engajamento; conversão é no máximo 1 a cada 8 posts do mês, e
`historico.ts` bloqueia quando passa.

Hashtags: 5 a 8, específicas (`#tenisbrasil`, `#raquetedetenis`), sem sopa de 30.

### 8. Sugerir Stories complementares

Quando fizer sentido, 2 a 3 Stories que estendem o post — enquete sobre o tema, bastidor do
raciocínio, ou a pergunta que o post levanta.

Cada um ganha arte própria no arquétipo **D · Story**, e cada arte deixa a faixa de 1000 a 1650
vazia para o sticker nativo. Diga ao dono, junto com o PNG, **qual sticker vai em cima e quando
postar** — o Story sem sticker perde a razão de existir.

### 9. Registrar

**Antes de entregar**, escreva a pauta inteira em `pautas/AAAA-MM-DD-<tema>.md`: copy de cada
slide, legenda, hashtags, os stories com o sticker de cada um, os ids do Canva e a tabela de
conferência técnica com a etiqueta de origem de cada afirmação.

Isso não é burocracia. A arte fica no Canva, mas a legenda e as hashtags só existiam na conversa —
e conversa some. Na primeira pauta foi preciso escavar o transcrito da sessão para reencontrar a
legenda de um post que ainda nem tinha ido ao ar. Um arquivo por pauta resolve isso e ainda dá o
que a próxima pauta precisa ler para não repetir o argumento.

Depois, e **só depois da aprovação do dono**, acrescente a linha em `historico/publicado.jsonl` com
o status certo: `gerado`, `aprovado` ou `publicado`. Só `publicado` bloqueia repetição futura.

---

## O que a skill NÃO faz

- **Não publica.** Nesta versão, entrega para aprovação e para.
- **Não lê o banco de produção.** Análise de cliente é dado de pessoa identificável; `caso.ts`
  produz casos igualmente verdadeiros a partir de perfis sintéticos.
- **Não usa foto de raquete.** `image_verified` é 0 de 47, e a decisão do dono é não usar.
- **Não inventa número.** Se `fatos.ts` não devolve, não vai para o post.

---

## Arquivos

| | |
|---|---|
| `references/limites.md` | O que nunca afirmar. **Leia primeiro.** |
| `references/pilares.md` | Os 7 pilares, formatos, níveis de CTA, distribuição |
| `references/marca.md` | Sistema visual e integração com o Canva |
| `scripts/fatos.ts` | Números derivados do catálogo ao vivo |
| `scripts/caso.ts` | Roda o motor de verdade para o pilar P4 |
| `scripts/historico.ts` | Lê o histórico e aplica as quatro regras |
| `historico/publicado.jsonl` | Uma linha por pauta, append-only |
| `pautas/` | Um arquivo por pauta: copy, legenda, hashtags, stories, ids do Canva |
