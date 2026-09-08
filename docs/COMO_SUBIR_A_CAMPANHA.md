# COMO_SUBIR_A_CAMPANHA.md — passo a passo

> Companheiro do `TRAFEGO_PAGO.md`. Lá está **por que** cada decisão foi tomada; aqui está **onde
> clicar**. Escrito para quem nunca abriu o Gerenciador de Anúncios.
>
> **Aviso honesto:** o Meta renomeia e reorganiza esses menus com frequência. Os nomes abaixo são os
> de setembro de 2026. Se um botão não estiver com o nome exato, procure pelo que faz a mesma coisa
> — a estrutura (campanha → conjunto → anúncio) não muda.

---

## Parte 1 — Criar o pixel

**Onde:** `business.facebook.com/events_manager`

1. Entre com a conta do Facebook que administra o Instagram do Tennis Engineer.
2. Se pedir para criar uma **conta comercial** (Business Manager), crie. Nome: `Tennis Engineer`.
3. No Gerenciador de Eventos, clique em **"Conectar fontes de dados"** → **"Web"** → **"Conectar"**.
4. Dê um nome: `Tennis Engineer — site`.
5. Ele vai perguntar como você quer instalar. Escolha **"Instalar código manualmente"**.
   Não precisa copiar o código que ele mostra — ele já está no site.
6. **Copie o número do pixel.** São ~15 dígitos, aparece no topo da tela. É isso que você precisa.

> Se ele insistir em verificar a instalação, pule. O pixel só vai responder depois da Parte 2.

---

## Parte 2 — Ligar o pixel no site

**Onde:** `vercel.com`

1. Entre e abra o projeto do Tennis Engineer.
2. Menu de cima: **Settings** → menu da esquerda: **Environment Variables**.
3. Clique em **Add New** e preencha:

   | Campo | O que por |
   |---|---|
   | Key (nome) | `NEXT_PUBLIC_META_PIXEL_ID` |
   | Value (valor) | o número que você copiou na Parte 1 |
   | Environments | deixe as três marcadas |

4. **Save**.
5. **⚠️ Agora o passo que quase todo mundo esquece:** variável nova só vale depois de um novo
   deploy. Vá em **Deployments**, ache o mais recente no topo, clique nos três pontinhos (`···`) e
   escolha **Redeploy**.
6. Espere terminar (uns 2 minutos).

**Enquanto essa variável estiver vazia, o pixel fica desligado** — inclusive para quem aceitar o
banner. É de propósito: o padrão seguro é não rastrear.

---

## Parte 3 — Conferir que funcionou

1. No Chrome, instale a extensão **Meta Pixel Helper** (busque por esse nome na Chrome Web Store).
2. Abra `tennisengineer.com.br` **numa aba anônima** (para o banner aparecer do zero).
3. Clique em **Aceitar** no banner de cookies.
4. Clique no ícone da extensão. Deve aparecer o seu pixel e o evento **PageView**.
5. Comece o questionário. Volte na extensão: agora deve aparecer também **Lead**.

**Se não aparecer nada:** o mais provável é que faltou o redeploy do passo 5 da Parte 2. O segundo
mais provável é bloqueador de anúncio ligado no seu navegador.

**Teste também a recusa**, que é o que precisa funcionar de verdade: abra outra aba anônima, clique
em **Recusar**, e confira na extensão que **nada** é carregado.

---

## Parte 4 — Criar a campanha

**Onde:** `adsmanager.facebook.com`

### 4.1 A campanha

1. Botão verde **"+ Criar"**.
2. Objetivo: **Vendas**. (Não é "Tráfego" — tráfego compra cliques, e cliques são baratos justamente
   porque não valem nada.)
3. Nome da campanha: `teste-set-01`
4. **Orçamento da campanha (CBO): DESLIGADO.** Vamos por o orçamento no conjunto.
5. Continuar.

### 4.2 O conjunto de anúncios

| Campo | O que escolher | Por quê |
|---|---|---|
| Nome | `teste-criativo` | — |
| Local de conversão | **Site** | — |
| Evento de conversão | **Lead** | ⚠️ **não** use "Compra" — ver abaixo |
| Orçamento | **Diário, R$ 35** | 14 dias = R$ 490 |
| Programação | começa amanhã, termina em 14 dias | — |
| Público — Local | Brasil | — |
| Público — Idade | 25 a 55 | — |
| Público — Detalhamento | **Tênis** (interesse) | e só isso |
| Advantage+ / público avançado | pode deixar ligado | dá espaço para o algoritmo achar quem responde |
| Posicionamentos | **Automático** | — |

> **Por que "Lead" e não "Compra".** O Meta precisa de umas 50 conversões por semana para aprender.
> A R$ 48 de ticket, 50 compras semanais seriam R$ 2.400 de receita — muito acima de R$ 490 de
> verba. Com "Compra" ele nunca junta exemplos suficientes e entrega no escuro. "Lead" é o início do
> questionário, que acontece muito mais vezes e já exige intenção real.

### 4.3 Os dois anúncios

Crie **dois anúncios dentro do mesmo conjunto** (não crie um segundo conjunto).

**Anúncio 1 — o reel:**
- Formato: vídeo único
- Mídia: o reel escolhido
- Texto principal e título: os da pauta
- **URL do site:**
  ```
  https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=reel-3-erros
  ```
- Chamada para ação: **Saiba mais**

**Anúncio 2 — o estático:**
- Formato: imagem única
- **URL do site:**
  ```
  https://tennisengineer.com.br/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=estatico-4-7
  ```

> ⚠️ **O `utm_content` diferente em cada um é o que faz o teste existir.** Se os dois anúncios
> tiverem a mesma URL, eles viram uma linha só na coluna "Criativo" do `/admin/funil` e não há como
> saber qual funcionou. É o único passo desta lista que, se você errar, não dá para consertar
> depois — o dado do clique só existe no instante do clique.

### 4.4 Publicar

Revise e publique. O Meta leva algumas horas para aprovar.

---

## Parte 5 — Depois de ligar

### Os primeiros 4 dias: não toque em nada

Qualquer alteração — orçamento, público, criativo, texto — **reinicia a fase de aprendizado**, e com
R$ 35/dia não há verba para reaprender. A vontade de mexer no dia 2 é o erro mais caro que existe em
campanha pequena.

Se o resultado do dia 1 parecer horrível, é normal. O algoritmo está explorando.

### A partir do dia 7

Abra `tennisengineer.com.br/admin/funil`, janela de 7 dias, e olhe a tabela de baixo — a que tem a
coluna **Criativo**. Anote por criativo:

- **Chegaram** (visitantes)
- **Terminaram** (o questionário)
- **Pagaram**

E no Gerenciador de Anúncios, anote o **valor gasto por anúncio**.

Com esses dois lados dá para fechar a conta:

```
custo por início  =  valor gasto  ÷  pessoas que chegaram
```

**Compare com R$ 11,08**, que é o teto calculado a partir da sua conversão real de 24,3%
(`TRAFEGO_PAGO.md` §3). Abaixo disso, a campanha se paga.

### Quando parar

Escrito antes de começar, porque depois de gastar é tarde para ser imparcial:

- **Custo por início abaixo de R$ 5** → funcionou. Escale devagar (+20% de orçamento por semana,
  nunca dobrando).
- **Entre R$ 5 e R$ 11** → funciona, mas apertado. Vale mais consertar o degrau da prévia
  (`TRAFEGO_PAGO.md` §5-bis) do que por mais verba.
- **Acima de R$ 11** → tráfego frio não fecha a conta com este funil. A saída não é mais verba: é
  ticket maior, funil mais curto, ou outro canal.
- **Ninguém inicia o questionário** → o problema é a home, não o anúncio. Pause e conserte antes de
  gastar o resto.

---

## Resumo em uma tela

| # | Onde | O quê |
|---|---|---|
| 1 | business.facebook.com/events_manager | criar o pixel, copiar o número |
| 2 | vercel.com | `NEXT_PUBLIC_META_PIXEL_ID` + **redeploy** |
| 3 | seu site, aba anônima | conferir com o Meta Pixel Helper (aceitar **e** recusar) |
| 4 | adsmanager.facebook.com | campanha Vendas → conjunto com evento **Lead** → 2 anúncios com `utm_content` diferente |
| 5 | — | **não mexer por 4 dias** |
| 6 | /admin/funil + Gerenciador | do dia 7: custo por início vs. R$ 11,08 |
