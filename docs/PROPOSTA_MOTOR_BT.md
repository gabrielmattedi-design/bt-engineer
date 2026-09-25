# Proposta — produtos, motor e questionário do Beach Tennis Engineer

Status: **aprovado pelo dono em 25/09/2026** · motor implementado em `src/motor/` (versão 0.1.0),
ao lado do motor de tênis, que as telas ainda usam. Questionário e relatório ainda não migraram.

A §8 registra o que a implementação mudou em relação a este desenho, e por quê.

Quando aprovado, este documento substitui `RECOMMENDATION_ENGINE.md`, `QUESTIONNAIRE.md` e
`STRING_AND_TENSION_ENGINE.md` (que descrevem o motor de tênis, ainda presente no código), e a §1
entra no `MONETIZATION.md`.

O catálogo de partida é `Rascunho_catálogo_bte.xlsx` (35 raquetes, cotação de 08/09/2026), tomado
como verdadeiro nesta fase. A varredura do catálogo vem depois.

---

## 1. Produtos

| SKU | Nome | Preço | Entrega |
|---|---|---|---|
| `racket_report` | Laudo da raquete | R$ 29,99 | a 1ª colocada + veredicto curto sobre a raquete atual |
| `full_report` | Análise completa | R$ 49,99 | as três colocadas, o comparativo entre elas e a avaliação completa da raquete atual |
| `report_upgrade` | Completar a análise | R$ 30,00 | o que o `full_report` tem e o `racket_report` não |

Sai: o setup (corda, espessura, tensão), os desbloqueios avulsos da 2ª e da 3ª (R$ 9,99 cada) e
o `setup_upgrade`. Três produtos: duas portas de entrada e um upgrade.

### 1.1 O veredicto curto está nos dois produtos

"Fique com a sua" ou "troque" aparece também no de R$ 29,99. Sem isso, quem já tem uma raquete
adequada pagaria R$ 29,99 e receberia a indicação de comprar outra — de R$ 329 a R$ 3.799 no
catálogo — sem saber que a dele servia. O veredicto "fique com a sua" nasceu de casos reais no
Tennis Engineer (`c8f02bd`) e não pode ficar atrás de um upgrade.

O que só o de R$ 49,99 tem é o PORQUÊ: onde a sua cai no mapa (§3), o que ganharia e o que perderia
em cada eixo trocando por cada uma das três, e o que vai sentir em quadra.

### 1.2 Quem não tem raquete

A avaliação da atual não aparece na oferta para quem declarou não ter raquete: é a regra "a loja só
oferece o que a pessoa consegue usar" (`597eea3`). Para essa pessoa, o de R$ 49,99 é descrito como
as três raquetes e o comparativo entre elas.

### 1.3 A escada de preço

R$ 29,99 + R$ 30,00 = R$ 59,99, contra R$ 49,99 do pacote: decidir em duas vezes custa R$ 10,01 a
mais. É a mesma escada do Tennis Engineer, onde laudo + upgrade somavam R$ 59,98, e a diferença de
R$ 9,99 foi mantida de propósito como "o preço de decidir em duas vezes, e nada além disso"
(MONETIZATION.md, `setup_upgrade`). O que aquele documento recusa é um prêmio MAIOR: o upgrade
desceu de R$ 39,99 porque ele não aparece na hora da primeira escolha. O editor de preços aceita
os R$ 30,00, porque a regra dele é só que o caminho fatiado não custe menos que o pacote.

---

## 2. O que o catálogo permite medir

Cinco variáveis por raquete entram no motor:

| Variável | Coluna | Como entra |
|---|---|---|
| Dureza do EVA | `nucleo_eva` | ordinal, ver §2.1 |
| Rigidez da face | `fibra_face` | ordinal, ver §2.1 |
| Peso | `peso_min_g`–`peso_max_g` | centro da faixa |
| Balanço | `balanco_min_mm`–`balanco_max_mm` | centro da faixa, mm a partir do cabo |
| Espessura | `espessura_mm` | direto |

`comprimento_mm` fica fora: é 500 em todas, e uma variável que não varia não informa nada.
`nivel_indicado` (do fabricante) entra como sinal auxiliar (§4.3). `perfil_jogo` e
`claim_fabricante` ficam para o texto do relatório, não para a nota.

**Sem textura da face e sem formato, não há eixo de spin nem de formato.** Por isso o questionário
não oferece "quero mais spin". O Tennis Engineer já pagou por um eixo que era pedido e o motor não
calculava (`d1b9c48`): a pessoa marca spin como prioridade 1, o motor não tem como atender, e o
relatório ignora justamente o que ela mais pediu. Quando a textura entrar no catálogo, spin entra
como terceiro eixo.

### 2.1 Escalas — **hipóteses a confirmar pelo dono**

| EVA | valor | | Face | valor |
|---|---|---|---|---|
| extra soft | 0,00 | | fibra de vidro | 0,10 |
| soft | 0,30 | | carbono 3K | 0,45 |
| medium | 0,55 | | carbono 6K | 0,55 |
| pro | 0,55 | | carbono + kevlar | 0,60 |
| hard | 0,85 | | carbono 12K | 0,70 |
| black eva | 0,85 | | carbono 18K | 0,80 |
| | | | carbono 24K | 0,90 |

Duas equivalências são decisão, não leitura:
- `pro` = medium. A única descrição de "EVA pro" no catálogo é a da Drop Shot Quantum: "densidade
  intermediária".
- `black eva` = hard. A Quicksand Kombat descreve "EVA black de alta densidade".

A ordem das faces (mais K = mais rígida) segue o que as marcas afirmam. Se o dono discordar de
alguma posição, é aqui que se muda, e tudo abaixo se recalcula.

---

## 3. O motor em dois eixos

### 3.1 A descoberta que muda o desenho

O primeiro protótipo seguiu o Tennis Engineer: cinco eixos exibidos (potência, controle,
manobrabilidade, conforto, estabilidade), com o mesmo orçamento fixo de atributos (`a3d214f`).
Medido nas 35:

| par | correlação |
|---|---|
| potência × controle | −0,98 |
| conforto × controle | −0,97 |
| potência × conforto | +0,92 |

Potência, controle e conforto são UMA medida, lida de três jeitos. Com EVA, face, peso, balanço e
espessura, o catálogo tem duas dimensões reais, e mostrar cinco seria fingir uma precisão que o dado
não tem. No relatório isso aparece como "a recomendada é ótima em potência e em conforto", o que é
verdade, e "e fraca em controle", o que é a mesma frase dita de novo.

### 3.2 Os dois eixos

```
resposta = 100 · (0,55·EVA + 0,30·face + 0,15·(1 − esp))      esp = norm(espessura, 19, 24)
inércia  = 100 · (0,50·norm(peso, 300, 350) + 0,50·norm(balanço, 235, 290))
```

| | 0 | 100 |
|---|---|---|
| **Resposta** | macia: saída de bola fácil, conforto, tolerância ao erro | firme: controle, precisão, pede swing para a bola andar |
| **Inércia** | leve na mão: reação na rede, braço poupado | pesada na mão: peso de bola, estabilidade no smash e na bola forte |

Medido nas 35: resposta de 20 a 80, inércia de 34 a 74, e **correlação entre os dois de −0,01**. São
independentes de verdade, então o mapa 2D é uma representação fiel do catálogo, não uma
simplificação dele.

Validação cruzada: o índice de exigência derivado destes eixos correlaciona **0,67** com o nível que
o próprio fabricante indica, sem que o nível do fabricante entre na conta. As maiores discordâncias
são raquetes macias vendidas como avançadas (Shark Elite 3K, Zand Z Blade), o que é coerente: macia
não é sinônimo de iniciante.

### 3.3 Os alvos ficam na escala do catálogo

A raquete mais leve na mão do catálogo tem inércia 34. Um alvo absoluto de 25 para uma iniciante
pequena nunca é alcançado, e a distância até ele pune igualmente todas as candidatas. O Tennis
Engineer tropeçou exatamente nisso e passou a trabalhar em posição de catálogo (`165310e`,
`catalog-scale.ts`). Aqui é igual: o alvo do jogador é expresso de 0 a 100 dentro da faixa real das
raquetes, e se reescala sozinho quando o catálogo muda.

A faixa vai do **percentil 5 ao 95**, e não do mínimo ao máximo (§8.1).

### 3.4 O mapa é o relatório

O relatório desenha as 35 raquetes num plano resposta × inércia, a zona ideal do jogador, as três
recomendadas e, no de R$ 49,99, a raquete atual. É a explicação inteira numa figura: "a sua está
aqui, você precisa estar ali, estas três estão lá". Os nomes que a pessoa entende (potência,
controle, conforto, manobrabilidade, peso de bola) aparecem como rótulos das pontas dos eixos.

---

## 4. Do jogador para o alvo

### 4.1 Alvo de resposta — quanto a raquete deve fazer por ele

Sobe (mais firme) com:
- swing rápido e movimento amplo (quem veio do tênis tem os dois);
- bolas que passam do fundo;
- nível calibrado alto;
- controle como prioridade.

Desce (mais macia) com:
- swing lento ou curto;
- bolas que caem curtas;
- potência, conforto ou tolerância como prioridade;
- dor.

O mecanismo: EVA macio devolve a bola sozinho em batida lenta, mas em batida forte vira trampolim e
a bola voa. Quem bate forte precisa de face que segure; quem bate devagar precisa de face que
empurre.

### 4.2 Alvo e TETO de inércia — quanto de massa ele move

A capacidade física reaproveita a do Tennis Engineer, que já lê altura, peso, força, preparo, idade
e sexo (`c8f02bd`, `8df271a`). Massa de raquete é absoluta: quem tem 50 kg move uma fração maior do
próprio peso a cada golpe.

- O alvo sobe com o papel de atacante (smash) e com estabilidade como prioridade.
- Desce com o jogo de rede e com manobrabilidade como prioridade.

A capacidade é principalmente **teto**, e não alvo (§8.2). Na distância ao alvo vale a assimetria
do motor de tênis: passar do que o braço aguenta produz atraso e lesão, ficar abaixo produz só perda
de desempenho. Inércia acima do alvo pesa 1,4, e abaixo pesa 0,8.

**A dor não mexe no teto de inércia**, só no de firmeza (§8.3).

### 4.3 Nota final

```
fit = 100 − 1,2 · distância(resposta, inércia ponderada)
          − penalidade de nível do fabricante (mais de meio degrau fora do nível calibrado)
          − penalidade de transição (se a raquete atual é conhecida e a mudança é brusca; no
            máximo 10, e zero se a atual fere a segurança — §8.4)
```

A nota fica entre 0 e 100, porque é lida como porcentagem de encaixe. Quando a 1ª colocada fica
abaixo de 50, o resultado sai marcado como **encaixe fraco** e o relatório precisa dizer isso.

**Filtros duros**, que excluem em vez de penalizar (a faixa vizinha e o 1º pedido viraram peso,
§8.7):
- a faixa de preço acima da escolhida, ou dois degraus abaixo (§4.5);
- dor atual + resposta acima do teto de conforto;
- inércia acima do teto físico;
- nível do fabricante `profissional` para iniciante.

**Premissa da 1ª prioridade**, herdada (`bc2d3ee`): quem pede controle em 1º lugar não recebe
raquete abaixo da média do catálogo em resposta. O mesmo vale para os outros pedidos. Ela só vale
se o pódio montado com ela continuar com três raquetes (§8.5).

### 4.4 O pódio

- Três modelos distintos.
- **No máximo 2 da mesma marca.** A Heroe's tem quatro raquetes na ponta firme do mapa, e sem o
  limite um atacante recebe três Heroe's que dizem a mesma coisa.
- Raquetes com especificação idêntica são **gêmeas**: AMA Kronos e Zand Z Jump caem no mesmo
  ponto. Entra a de preço mais próximo do orçamento, e o relatório nomeia a outra, como o "irmã de
  linha" do tênis (`0c299ee`).

### 4.5 Faixas de preço

No tênis, as raquetes do catálogo custam parecido e têm qualidade parecida. Aqui não: o catálogo vai
de R$ 329 a R$ 3.799, e o preço marca degraus de construção. O questionário pergunta quanto a
pessoa quer gastar, por faixa, e o motor trabalha em cima dela. O preço de referência é
`preco_min_brl`, o menor preço cotado ("a partir de").

| Faixa | Preço "a partir de" | Raquetes | Resposta | Marcas |
|---|---|---|---|---|
| 1 | até R$ 1.500 | 12 | 22–77 | 8 |
| 2 | R$ 1.500–2.200 | 10 | 20–80 | 8 |
| 3 | acima de R$ 2.200 (e "sem limite") | 10 | 36–80 | 5 |

**Três faixas, com o mesmo número de raquetes em cada uma.** Com 32 raquetes cotadas, cada faixa a
mais é menos raquete por faixa, e o pódio passa a se repetir. Medido com o protótipo em 780
perfis (alvo de resposta de 20 a 80, inércia de 30 a 75, seis níveis), contando quantas pessoas
recebem o MESMO pódio:

| Divisão | Pior faixa | Pódio mais comum nela | Pódios distintos nela |
|---|---|---|---|
| 4 faixas (1.000 / 1.800 / 2.600) | acima de R$ 2.600, 6 raquetes | 51% | 7 |
| 3 faixas (1.000 / 1.700) | até R$ 1.000, 6 raquetes | 43% | 11 |
| **3 faixas iguais (1.500 / 2.200)** | acima de R$ 2.200, 10 raquetes | **24%** | 17 |
| sem faixa, catálogo inteiro | — | 7% | 124 |

Com quatro faixas, uma em cada duas pessoas da faixa de cima recebia exatamente o mesmo pódio. O
corte em R$ 1.000 deixa a faixa de baixo com seis raquetes em qualquer divisão, e ela repete 43%.
Os cortes que igualam o tamanho são R$ 1.500 e R$ 2.200.

A repetição residual é o preço de trabalhar dentro da faixa: no catálogo inteiro a 1ª colocada
fica, em média, a 8,1 pontos do alvo do jogador; dentro da faixa, a 11 a 15. Os cortes se
recalculam quando o catálogo crescer. A regra é "três faixas do mesmo tamanho", e não os valores.

(3 raquetes sem preço — Kronos, Poison Bee e Vitória III — não entram em faixa nenhuma até
serem cotadas.)

**O preço anda junto com a firmeza.** Medido nas 32 com preço, preço × resposta dá r = 0,60, e
preço × nível do fabricante dá r = 0,68. Acima de R$ 2.600 todas são firmes (resposta de 66 a 80),
e é isso que tornou necessária a exceção abaixo.

**Piso e teto são filtros.** Decisão do dono: quem declara "sem limite" e recebe uma raquete de
R$ 800 lê que o produto não levou a resposta dele a sério, e a recomendação perde a credibilidade
justamente com quem estava disposto a gastar mais. O pódio sai de dentro da faixa escolhida.

**"Sem limite" é a faixa 3** (acima de R$ 2.200), e não o catálogo inteiro. É a leitura literal do
que a pessoa disse.

**A única exceção: quando a faixa não tem três raquetes seguras para aquela pessoa, o pódio desce
UM degrau, e só um, e diz por quê.** O caso concreto é a faixa 3. A mais macia dela é a AMA Athena
(resposta 36), e as macias de verdade (Zand Z Blade e Quicksand Alien, resposta 20) estão na faixa
2. Quem precisa de raquete muito macia (dor no cotovelo, swing lento) pode não ter três raquetes
seguras na faixa 3. Sem a exceção sobram duas saídas, e as duas são piores:
- pódio vazio, para alguém que pagou R$ 49,99;
- ou a menos inadequada de um grupo inadequado, que é recomendar uma raquete que machuca.

Com a exceção, a pessoa recebe as mais caras que servem ao braço dela, com a frase: "acima de R$ 2.200
não há raquetes macias o bastante para o seu braço; estas são as mais caras que servem ao seu jogo".
O degrau nunca vai além do vizinho: quem escolheu a faixa 3 nunca recebe uma raquete da faixa 1.

A exceção só dispara por filtro de segurança (dor, teto físico, nível) ou por falta de candidatas,
nunca por nota. Se a faixa tem três raquetes seguras, é delas o pódio, mesmo que uma mais barata
tenha nota maior.

Na tela do questionário, cada faixa mostra o que ela compra em termos de construção (fibra de
vidro, carbono 3K, 12K e acima), para a pessoa entender o degrau que está escolhendo, e não só um
valor.

### 4.6 Os jogadores, contra o motor de verdade

Os mesmos jogadores do protótipo, agora com o motor implementado e as faixas de preço.
`tests/motor/podio.test.ts` tranca o comportamento de cada um.

| Jogador | Faixa | Pódio |
|---|---|---|
| Iniciante, 1,60 m / 55 kg, dor no cotovelo | 1 | Shark Tour · Vision SuperCarbon · Adidas BT 3.0 |
| Ex-tenista, 1,85 m / 85 kg, avançado, falta controle | 3 | Zand Z Bruxo (97,6) · Heroes Rebel · AMA Proteo |
| Intermediário de rede, falta reação | 2 | Zeiq Julia Nogueira · Heroes Show · Mormaii Sunrise |
| Avançado atacante, dor no ombro agora | 3 → 2 | Vision Gold Carbon · Shark Predator · Heroes Show |
| Intermediário, swing lento, falta potência | 2 | Drop Shot Renegade · Mormaii Sunrise · Shark Predator |
| Cotovelo forte, "sem limite" | 3 → 2 | Drop Shot Renegade · Shark Predator · Vision Gold Carbon |

**Duas raquetes nunca chegam a um pódio**, em 3.000 perfis:
- **Mormaii Kicks:** macia, de iniciante, e a mais pesada do catálogo (337,5 g). Quem aguenta o
  peso não pede uma raquete de iniciante.
- **Quicksand Kombat:** balanço de 275–284 mm, 15 mm além de qualquer outra raquete. Nenhum jogo
  que o questionário descreve pede tanto.

Não é defeito do motor. É o que o catálogo diz dessas duas, e fica para a varredura do catálogo.

---

## 5. A raquete atual

Com 35 raquetes no catálogo, a maior parte dos clientes vai ter uma que não está nele. A avaliação
da atual é metade da promessa do de R$ 49,99, então ela não pode depender só do catálogo.

1. **Está no catálogo** → entra com as specs reais.
2. **Não está** → a pessoa informa o que sabe, e a raquete entra no mapa por aproximação, com
   confiança menor dita no relatório:
   - peso: pesar numa balança de cozinha leva 30 segundos e é mais preciso que a faixa do
     fabricante;
   - sensação da face: macia / média / dura;
   - material: fibra de vidro / carbono / não sei.

**Veredicto** (nos dois produtos):
- **fique com a sua** — a atual está na zona ideal, ou a diferença para a 1ª é menor que um empate
  técnico;
- **troque** — a atual está fora da zona;
- **troque já** — ela fere um filtro duro: acima do teto físico, ou firme demais para uma dor atual.

---

## 6. Questionário (~30 perguntas, 3–5 min)

Cada pergunta alimenta um alvo, um teto ou um filtro. As que não alimentam nada não entram (§11 do
Tennis Engineer).

| Etapa | Perguntas | Alimenta |
|---|---|---|
| 1. Corpo | idade · altura · peso · sexo · força · condicionamento | teto e alvo de inércia |
| 2. Dor | sente dor ao jogar? cotovelo / ombro / punho / nenhum; se sim: agora ou já passou, e intensidade | teto de firmeza e alvo de resposta — não o teto de inércia (§8.3) |
| 3. Experiência | há quanto tempo joga BT · vezes por semana · aulas · torneio e categoria (iniciante, D, C, B, A, pro) · veio de outro esporte de raquete (tênis, padel, squash, nenhum) · como se classifica | nível calibrado |
| 4. Calibração (sim / às vezes / não) | sustenta troca de 10+ bolas · smash com direção · lob defensivo até o fundo · voleio de bloqueio sob pressão · saque com intenção | nível calibrado (peso maior que a autoavaliação) |
| 5. Jogo | papel na dupla: ataco e finalizo / defendo e devolvo tudo / fico na rede / construo e coloco / ainda não sei · movimento amplo de tênis ou curto de punho · velocidade do smash | alvo de resposta e de inércia |
| 6. Bola | suas bolas costumam: cair curtas / passar do fundo / ir na rede / sair sem direção / boa profundidade (até 2) · na rede a raquete parece lenta / certa / leve demais | alvo de resposta e de inércia |
| 7. Prioridades | sente falta de, até 3 em ordem: potência · controle · reação na rede · peso de bola · conforto · objetivo: potencializar meu jogo / mudar algo / algo mais fácil / evoluir | alvos e premissa da 1ª prioridade |
| 8. Raquete atual | busca no catálogo · se não achar: peso, sensação da face, material · gosta / não gosta | veredicto, transição, avaliação |
| 9. Faixa de preço | até R$ 1.500 / R$ 1.500–2.200 / acima de R$ 2.200 ou sem limite | piso e teto como filtros; desce um degrau só por segurança (§4.5) |
| 10. Texto livre | opcional | sinais, sem sobrescrever resposta objetiva |

**Sai do questionário de tênis:** corda, tensão, arrebentamento, backhand de uma ou duas mãos, tipo
de forehand, spin.

**Entra:**
- esporte de origem, porque o ex-tenista chega com o swing amplo que o EVA macio não segura;
- papel na dupla;
- sensação na rede;
- orçamento. No tênis o catálogo ia até R$ 1.800; aqui vai de R$ 329 a R$ 3.799, e recomendar fora
  do bolso é recomendar nada.

---

## 7. Decisões

Aprovadas pelo dono:
1. As escalas de EVA e de face (§2.1), incluindo `pro` = medium e a ordem 3K < 6K < kevlar < 12K
   < 18K < 24K.
2. Dois eixos no mapa, no lugar dos cinco eixos do radar de tênis (§3).
3. No máximo 2 da mesma marca no pódio (§4.4).
4. A pergunta de preço por faixa, com degraus de construção (§4.5).

5. Piso e teto da faixa como filtros (§4.5).
6. Três faixas com o mesmo número de raquetes: até R$ 1.500, de R$ 1.500 a 2.200, e acima de
   R$ 2.200, que também é o "sem limite" (§4.5).

Proposto, a confirmar: a descida de um degrau quando a faixa não tem três raquetes seguras para a
pessoa.

---

## 8. O que a implementação mudou, e por quê

Cada item abaixo foi medido rodando o motor, e não decidido no papel.

### 8.1 A escala vai do percentil 5 ao 95

Com mínimo e máximo, a Quicksand Kombat (inércia 74, contra 55 da segunda mais pesada na mão)
definia sozinha o topo da escala, e as outras 34 raquetes se espremiam na metade de baixo. O
ex-tenista avançado recebia a Z Bruxo, que é a raquete certa para ele, com nota 58. Com percentis,
a escala é definida pelo grosso do catálogo, e a Z Bruxo sobe para 97,6. A Kombat cai acima de
100, o que é verdade sobre ela.

### 8.2 A capacidade física é teto, e não alvo

A primeira versão punha a capacidade no alvo de inércia com peso 0,55, e o jogador forte ia a alvo
96. O tênis já tinha escrito o erro: o limite existe para proteger quem tem pouco corpo, não para
dizer a quem tem muito que precisa de mais peso. A capacidade ficou com 0,10 do alvo; o resto é
potência e nível.

O teto foi calibrado contra as posições reais do catálogo:

| Capacidade | Quem é | Teto | Saem |
|---|---|---|---|
| 43 | 1,60 m / 55 kg, força abaixo | 96 | Kicks e Kombat |
| 62 | adulto médio | 121 | Kicks e Kombat |
| 92 | forte, atlético, grande | 160 | nada |

### 8.3 A dor não mexe no teto de inércia

O Tennis Engineer implementou "dor baixa o teto de peso" e retirou. A invariante "mais dor nunca
eleva um quadro mais rígido" quebrou, porque massa absorve choque: baixar o teto de quem tem dor no
cotovelo removia justamente as raquetes que protegiam o cotovelo. Aqui a dor só limita a firmeza,
que é o eixo onde estão o choque e a vibração.

A §6 dizia o contrário e foi corrigida.

### 8.4 A penalidade de transição tem limite

A varredura achou 1ªs colocadas com nota −44. A raquete atual da pessoa estava longe do alvo, e o
motor punia em até 82 pontos justamente o movimento de sair dela. Agora a penalidade vale no máximo
10 pontos, e zero quando a atual fere a segurança, porque ali a troca é obrigatória. A pior 1ª
colocada da varredura subiu de −44 para 1,9.

### 8.5 A premissa não pode custar a terceira raquete

A varredura achou 60 pódios de duas raquetes, todos na faixa 1. A premissa deixava três candidatas,
duas delas da Total, e o limite de duas por marca derrubava a terceira. Agora a premissa só vale se
o pódio montado com ela tiver três raquetes. Pódios incompletos: de 60 para 0.

### 8.6 Na descida de faixa, a ordem é pela nota

A primeira versão punha as raquetes da faixa pedida sempre na frente. O atacante avançado com dor
no ombro recebia a AMA Athena em 1º, com nota 30, à frente de raquetes da faixa 2 com nota 62. "As
mais caras que servem ao seu jogo" exige que sirvam.

### 8.7 As travas de preferência viraram peso

Decisão do dono, depois de testar na bancada: "como tem número estreito de raquetes por preço, as
travas precisam ser mais sutis, mais peso e menos cancelamento; peso relevante, mas sem anular
outras".

O caso que decidiu: ex-tenista intermediário, faixa 2, controle em 1º lugar. A faixa tem duas
raquetes firmes. A premissa, tudo-ou-nada, não fechava três e se desligava inteira, e a 3ª vaga
ia para a Heroes Show, macia, com encaixe 10: o contrário do pedido.

| Trava | Antes | Agora |
|---|---|---|
| 1º pedido | exclui as do lado errado da média, ou nada | −0,6 por ponto do lado errado, no máximo −20 |
| Faixa de preço, um degrau abaixo | só por segurança, e sempre na frente | −15, e compete com as da faixa pedida |
| Faixa de preço, acima ou dois abaixo | exclui | exclui |
| Segurança (dor, teto físico, profissional para iniciante) | exclui | exclui |

A segurança continua excluindo porque peso é justamente o que deixaria uma raquete que machuca
ganhar o pódio por ser boa em todo o resto. O teto de preço continua porque recomendar acima do que
a pessoa disse que quer gastar é recomendar nada.

Medido em 3.000 perfis sorteados:

| | Antes | Depois |
|---|---|---|
| 3ª colocada com encaixe abaixo de 30 | 370 | 85 |
| 2ª colocada com encaixe abaixo de 30 | 155 | 31 |
| 3ª colocada, percentil 5 | 17,8 | 34,7 |
| raquetes do pódio que contrariam o 1º pedido | 1.311 de 9.000 | 1.614 de 9.000 |
| pódios com alguma raquete da faixa abaixo | 172 | 1.348 |

As duas últimas linhas são o preço da troca, e a última pede decisão. Com poucas raquetes por
faixa, a raquete que encaixa melhor muitas vezes está um degrau abaixo, e a penalidade decide quão
fácil é ela entrar:

| Penalidade da faixa vizinha | 15 | 20 | 25 | 30 |
|---|---|---|---|---|
| pódios com raquete da faixa abaixo | 1.348 | 1.166 | 999 | 825 |
| 3ª colocada com encaixe abaixo de 30 | 85 | 110 | 139 | 175 |

Fica 15, provisório. O relatório precisa dizer, em cada raquete da faixa vizinha, que ela custa
menos que a faixa pedida e encaixa melhor.

