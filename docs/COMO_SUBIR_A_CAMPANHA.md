# COMO_SUBIR_A_CAMPANHA.md — passo a passo

> Companheiro do `TRAFEGO_PAGO.md`. Lá está **por que** cada decisão foi tomada; aqui está **onde
> clicar**. Escrito para quem nunca abriu o Gerenciador de Anúncios.
>
> **Aviso honesto:** o Meta renomeia e reorganiza esses menus com frequência. Os nomes abaixo são os
> de setembro de 2026. Se um botão não estiver com o nome exato, procure pelo que faz a mesma coisa
> — a estrutura (campanha → conjunto → anúncio) não muda.

---

## Parte 0 — Criar o portfólio empresarial do Tennis Engineer

> **Esta parte foi escrita depois, em 08/09/2026, porque a Parte 1 original assumia que o negócio já
> existia no Meta.** O dono abriu o Gerenciador e caiu numa tela de escolha de "ativo de negócios"
> com dois portfólios de OUTROS negócios dele e a conta pessoal — e nenhum Tennis Engineer.
>
> A confusão é razoável e vale nomear: **aquela tela não lista o que existe do seu produto, ela
> pergunta debaixo de qual negócio você quer criar as coisas.** O Tennis Engineer não aparece
> porque ninguém criou. Não há nada quebrado.

**Onde:** `business.facebook.com`

1. Na tela de escolha, clique em **"Criar um portfólio empresarial"** (canto inferior esquerdo).
2. Nome: `Tennis Engineer`. Seu nome e seu e-mail de trabalho.
3. Dentro do portfólio novo, vá em **Configurações** (engrenagem) → **Contas**, e faça os três na
   ordem abaixo. Cada um é um item do menu da esquerda.

#### 3.1 Contas do Instagram

`+ Adicionar` → entrar com o login do Instagram do Tennis Engineer.

#### 3.2 Páginas

`+ Adicionar` abre um menu de três opções, e **duas delas causam problema**:

| Opção | O que faz | |
|---|---|---|
| **Adicionar uma Página** | traz para o portfólio a Página que você já criou | ✅ |
| Solicitar acesso a uma Página | pede permissão ao dono — você pediria a você mesmo | ❌ |
| Criar uma nova Página | cria uma **segunda** Página com o mesmo nome | ❌ o erro mais comum |

Como a Página foi criada pelo seu perfil pessoal, ela aparece na busca e entra sem aprovação de
ninguém. **Isso transfere a POSSE da Página para o portfólio** — é o que se quer aqui, mas não é um
vínculo solto e desfazer é trabalhoso.

#### 3.3 Contas de anúncios

`+ Adicionar` → **Criar uma nova conta de anúncios**.

| Campo | Valor |
|---|---|
| Nome | `Tennis Engineer` |
| Fuso horário | `América/São_Paulo (Brasília)` |
| Moeda | `BRL` |

> ⚠️ **Fuso e moeda não podem ser alterados depois da criação.** Uma conta em fuso errado reporta
> "gasto de ontem" com um recorte de dia que não é o seu, e o número nunca bate com o do
> `/admin/funil`. Conferir aqui custa dez segundos; corrigir depois exige criar outra conta e perder
> o histórico.

Adicione a forma de pagamento nessa mesma tela.

### ⚠️ A Página do Facebook — confirmado em 08/09: não existia

Para anunciar no Instagram, o Meta em geral exige uma **Página do Facebook** vinculada, mesmo que
você nunca vá publicar nada nela. O Tennis Engineer não tinha, e é o bloqueio mais comum de quem só
mantém Instagram.

**Onde:** `facebook.com/pages/create`

| Campo | O que por |
|---|---|
| Nome da Página | `Tennis Engineer` — **igual ao Instagram**, sem variação |
| Categoria | `Produto/serviço` (ou `Site de esportes`) |
| Bio | `Seu jogo. Seu setup. Sob medida.` |
| Site | `tennisengineer.com.br` |
| Foto de perfil | `fb-perfil.png` — 1024×1024 |
| Capa | `fb-capa.png` — 1640×856 |

Depois de criar: **Configurações da Página → Contas vinculadas → conectar o Instagram.**

**Sobre as imagens.** A logo do produto é um componente React (`components/marketing/logo.tsx`), não
um arquivo — então não havia nada para subir. As duas imagens foram geradas extraindo o SVG do
monograma do próprio site em execução e compondo sobre o verde da marca. Não foram redesenhadas, e
por isso não divergem do que está no ar. Se precisar refazer, o caminho é esse: renderizar o site e
capturar `svg[aria-label="Tennis Engineer"]`.

O brand book manda a marca ser aplicada só em preto ou branco (nunca colorida) — as duas peças usam
branco sobre o `court #0E3D2E`, que é aplicação de fundo e não coloração da marca.

**Uma ressalva:** a Página nasce vazia, e uma Página sem nenhuma publicação às vezes chama revisão
do Meta na primeira campanha. Vale publicar duas ou três coisas nela antes — pode ser o mesmo
conteúdo do Instagram. Não precisa manter depois.

### E se o Instagram não for conta profissional

Para anunciar, o Instagram precisa ser **Conta Comercial** ou **Criador de Conteúdo**, não pessoal.
No app: Configurações → Tipo de conta e ferramentas → Mudar para conta profissional. É gratuito e
não muda nada para quem já te segue.

### Por que um portfólio novo, e não os que já existem

Você já tem "Lupo Aracruz" e "Porquês do Mercado". **Não coloque o Tennis Engineer dentro deles.**
Pixel, conta de anúncios e página ficam amarrados ao portfólio, e misturar negócios diferentes cria
uma bagunça que só aparece quando você quiser separar — dar acesso a alguém, vender, encerrar um.
Dois minutos agora evitam isso.

**Um risco real a conhecer:** conta de anúncios recém-criada não tem histórico, e o Meta às vezes
limita ou revisa a primeira entrega. Se a conta nova travar, use a sua conta pessoal
(`890049998322150`) só para este teste de R$ 490 — é um teste, não uma estrutura definitiva. Não
faça o contrário (mover a conta pessoal para dentro do portfólio): essa mudança é difícil de
desfazer.

---

## Parte 1 — Criar o pixel

**Onde:** `business.facebook.com/events_manager`

> ### ⚠️ "Pixel" agora se chama "conjunto de dados"
>
> O Meta renomeou, e a palavra "pixel" quase sumiu da interface. **Criar um conjunto de dados É
> criar o pixel** — não são coisas diferentes, e não existe um botão "criar pixel" para procurar.
>
> Foi o que travou o dono em 08/09: ele chegou na tela certa, viu "Conjuntos de dados e pixels" e
> não reconheceu que era ali.

Dois caminhos chegam no mesmo lugar. O segundo é o que você já tem aberto se veio das Configurações:

**Caminho A — pelo Gerenciador de Eventos:** `business.facebook.com/events_manager` →
**"Conectar fontes de dados"** → **"Web"** → **"Conectar"**.

**Caminho B — pelas Configurações do portfólio:** **Fontes de dados** → **Conjuntos de dados e
pixels** → botão **`+ Adicionar`**.

Depois, nos dois:

1. Confira no alto da tela que você está **dentro do portfólio Tennis Engineer** — não na conta
   pessoal nem em outro negócio. É onde erra quem tem mais de um, e um pixel no portfólio errado só
   se revela quando a campanha não otimiza.
2. Nome: `Tennis Engineer — site`.
3. Se ele oferecer método de instalação, escolha **"Instalar código manualmente"** — ou feche. **Não
   copie o código que ele mostra**: ele já está no site, e colar de novo faria o pixel disparar
   duas vezes por página.
4. **Copie o ID**, ~15 dígitos. Ele aparece na listagem logo abaixo do nome do conjunto; se não
   aparecer, clique no conjunto e ele fica no topo da tela de detalhes.

> Se ele insistir em verificar a instalação, pule. O pixel só vai responder depois da Parte 2 — o
> site ainda não sabe o número.

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
| 0 | business.facebook.com | criar o portfólio **Tennis Engineer**, conectar Instagram + Página do Facebook + conta de anúncios |
| 1 | business.facebook.com/events_manager | **dentro do portfólio novo**: criar o pixel, copiar o número |
| 2 | vercel.com | `NEXT_PUBLIC_META_PIXEL_ID` + **redeploy** |
| 3 | seu site, aba anônima | conferir com o Meta Pixel Helper (aceitar **e** recusar) |
| 4 | adsmanager.facebook.com | campanha Vendas → conjunto com evento **Lead** → 2 anúncios com `utm_content` diferente |
| 5 | — | **não mexer por 4 dias** |
| 6 | /admin/funil + Gerenciador | do dia 7: custo por início vs. R$ 11,08 |
