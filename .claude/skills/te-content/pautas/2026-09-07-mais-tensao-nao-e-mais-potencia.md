# 07/09/2026 · Mais tensão não é mais potência

**Pilar** P3 Mito ou verdade + P2 Física aplicada · **Formato** 3 stories · **Arte** Story (fundo ink) ·
**CTA** engajamento → curiosidade · **Status** `gerado`

**➡️ Projeto único: [`DAHUUnd5-9s`](https://www.canva.com/design/DAHUUnd5-9s/edit)** — 3 páginas,
1080 × 1920. Pasta `04 · Segunda 07/09 (stories)`.

**Feriado de 7 de setembro.** Segunda sem expediente: mais gente em quadra de manhã e mais gente no
celular à tarde. É o dia da semana com melhor chance para uma peça que pede discordância — e esta
pede.

---

## As três páginas

| | Arte | Sticker por cima |
|---|---|---|
| 1 | **Mais tensão não é mais potência.** | **Enquete:** Já sabia / Achava o contrário |
| 2 | **Então por que parece o contrário?** | nenhum — é a página da reparação |
| 3 | **O fabricante te dá 4 kg de margem.** | link para o site |

### Página 1 — o mito

> **Mais tensão não é mais potência.**
> É menos. Quem devolve energia é o leito de cordas: quanto menos ele cede, mais quem se deforma é
> a bola — e a bola devolve bem menos do que recebe.
>
> `Responde aí ↓`

### Página 2 — a metade que falta

> **Então por que parece o contrário?**
> Porque tensão alta dá uma resposta mais seca e mais previsível — e com mais controle você acelera
> com mais confiança. A potência que aparece vem do seu swing, não do leito.
>
> `E tem um detalhe →`

### Página 3 — a curiosidade que o leitor confere sozinho

> **O fabricante te dá 4 kg de margem.**
> Está escrito na sua raquete. Essa é a menor faixa do nosso catálogo — algumas passam de 6,8 kg.
> Alguém escolhe um número lá dentro; a gente chega nele por 12 ajustes.
>
> `Onde a sua está? ↓`

---

## Por que a página 2 existe, e por que ela não é opcional

`pilares.md` §P3 traz o aviso que decidiu o formato desta peça:

> *"O veredicto raramente é um mito limpo. Quase sempre é **verdade pela metade, e a metade que
> falta é a que importa**. Forçar mito/verdade binário é onde este pilar vira clickbait."*

A versão de duas páginas desta pauta era o mito e o número. Funciona como gancho e **corrige o
leitor sem explicar por que ele acreditava naquilo** — que é a diferença entre desmentir e ensinar.
Quem sente mais potência com corda mais dura não está delirando: está sentindo controle, e
convertendo controle em aceleração. A página 2 diz isso, e é ela que transforma a peça de "você
está errado" em "você estava sentindo a coisa certa pelo motivo errado".

Sem ela, o post ganha comentário de discordância e perde a razão. Com ela, o comentário vira
conversa.

---

## Conferência técnica

| Afirmação | Etiqueta | Origem | Onde |
|---|---|---|---|
| tensão maior reduz a potência do leito | `[física]` + `[motor]` | consenso amplo; e `tension.ts` ajuste `necessidade_de_potencia` = `-(power−50)/50 × 3.0`, com o texto "tensão menor aumenta o efeito trampolim" | página 1 |
| a corda devolve mais energia que a bola | `[física]` | mecanismo, sem número e sem citar estudo | página 1 |
| tensão maior aumenta previsibilidade | `[motor]` | `tension.ts` ajuste `necessidade_de_controle` = `+(control−50)/50 × 3.0` | página 2 |
| nenhuma raquete do catálogo tem faixa menor que 9 lbs (4,1 kg) | `[catálogo]` | `fatos.ts tensaoDoFabricante()` | página 3 |
| algumas passam de 6,8 kg (15 lbs) | `[catálogo]` | idem — `largura_maxima_kg` | página 3 |
| são 12 ajustes | `[motor]` | `fatos.ts tensao` — varredura de 300 perfis, união dos `factor` emitidos | página 3 |

Medição de hoje, contra o catálogo no ar:

```
tensao_do_fabricante: 47 de 47 raquetes têm faixa
  largura mínima  9 lbs / 4,1 kg      largura máxima 15 lbs / 6,8 kg
  largura média   10,4 lbs            extremos do catálogo 40–60 lbs
tensao (300 perfis): 12 fatores distintos, amplitude devolvida 41–56 lbs
```

**Nenhuma raquete é citada pelo nome, e nenhuma especificação de modelo aparece** — a faixa é do
CONJUNTO, que é o que `limites.md` §5 autoriza. A §2 continua travada.

### Por que publicamos o MÍNIMO e não a média

A média (10,4 lbs) é o número mais impressionante e o mais frágil: quem tiver em casa justamente um
quadro de faixa estreita vai concluir que o número foi inflado, e terá razão sobre a própria
raquete. O mínimo é o único que **nenhum leitor consegue desmentir olhando o próprio equipamento** —
e esta peça vive exatamente disso, porque é a rara vez em que o dado do produto está impresso na
raquete de quem está lendo.

### Por que os dois números novos entraram em `fatos.ts` antes da arte

O "12 ajustes" estava escrito à mão no cabeçalho de `tension.ts`. Levá-lo daí para a arte seria
repetir passo a passo o erro do **"26 das 47 · 10 g"**: número num comentário, carregado para fora
sem remedição, que fica errado em silêncio no dia em que o 13º ajuste entrar.

Agora ele é **observado**, não lido — a varredura roda o motor sobre 300 perfis sintéticos e recolhe
a união dos `factor` efetivamente emitidos, usando o mesmo gerador de `tests/helpers/varredura.ts`
(um segundo gerador divergiria dos testes, e a skill passaria a publicar sobre um produto que
ninguém confere). Se um ajuste for acrescentado, a contagem sobe sozinha.

A amplitude **41–56 lbs** é o brinde da varredura, e vale registrar mesmo sem ter ido para a arte:
ela é a prova de que a margem do fabricante não é decorativa — perfis reais caem nos dois extremos.

---

## O que ficou de fora

**Uma quarta página** com o método (os 12 ajustes em destaque e a amplitude 41–56 lbs como prova)
chegou a ser desenhada e não entrou. Com três páginas o arco fecha melhor — mito, reparação,
número — e o método cabe na última linha da página 3 sem virar aula.

**Quiz em vez de enquete.** A pergunta "o que acontece com a potência quando você sobe a tensão?"
seria um quiz legítimo, e a resposta certa é medível. Ficou de fora por `limites.md` §2-bis: o
Instagram marca a resposta como errada na tela de quem responde, e marcar "errado" para a maioria
logo na primeira página desta série é o oposto do que a página 2 existe para fazer. Enquete não tem
veredicto — quem achava o contrário responde sem levar carimbo.

---

## Próxima pauta que esta abre

Se a enquete da página 1 vier majoritariamente em *"achava o contrário"*, a sequência natural é
**P7 Bastidor sobre o eixo `gauge`** — a reclamação real do usuário ("sempre ponho que nunca estouro
corda, e sempre me recomendam 1.30 mm"), a medição que lhe deu razão (1,206 mm → 1,242 mm, com
"semanalmente" saindo mais FINO que "mensalmente") e o eixo que nasceu disso.

Continua bloqueada pela mesma condição de sempre: **esses milímetros precisam entrar em `fatos.ts`
antes**. Hoje moram num comentário de código, e a regra que este arquivo inteiro serve é que número
não remedido no momento de gerar é o caminho conhecido para o erro.
