# Logotipos das marcas do ecossistema

Coloque aqui os arquivos **SVG** oficiais, com estes nomes exatos:

```
head.svg        wilson.svg      babolat.svg     yonex.svg
luxilon.svg     solinco.svg     tecnifibre.svg
```

Assim que o arquivo existir, o mural na home passa a exibir o logotipo no lugar do nome. Nenhuma
outra alteração é necessária — `BrandWall` verifica a existência de cada arquivo.

## Por que não desenhamos os logotipos

São marcas registradas de terceiros. Um logotipo aproximado é um logotipo **errado**: prejudica a
credibilidade do Tennis Engineer mais do que exibir o nome em tipografia, e usa indevidamente a
identidade de outra empresa. Enquanto o arquivo oficial não estiver aqui, o nome tipográfico é a
opção honesta.

## Onde obter

Os arquivos costumam estar na área de imprensa / *brand assets* de cada fabricante, ou podem ser
solicitados ao distribuidor oficial no Brasil. Use sempre a versão **monocromática** ou a de
**uma cor** quando existir — o mural aplica a cor da marca Tennis Engineer por cima de qualquer
jeito (ver abaixo), mas versões simples produzem recorte melhor.

## Requisitos do arquivo

| Requisito | Motivo |
|---|---|
| Formato **SVG** | O mural usa `mask-image`; PNG com fundo não recorta corretamente |
| Fundo **transparente** | Um retângulo de fundo vira um bloco sólido na máscara |
| Sem margens internas grandes | O `contain` normaliza a altura; margem interna faz a marca parecer menor que as outras |
| Traço/preenchimento sólido | Gradientes viram áreas chapadas na máscara |

## Como a uniformidade é garantida

O arquivo entra como **máscara**, não como imagem: só o formato é usado, e a cor vem do CSS. Isso
significa que todas as marcas saem exatamente na mesma cor e na mesma altura — mesmo que alguém
substitua um arquivo por uma versão colorida no futuro.

É o que sustenta, visualmente, o pilar **INDEPENDENTE — sem preferência de marca**: nenhuma pode
aparecer com mais destaque que outra, nem por acidente.

## Aviso legal

A exibição é meramente informativa, indicando quais marcas são analisadas. Não existe vínculo
comercial, patrocínio ou comissão — e o aviso abaixo do mural diz isso explicitamente. Se alguma
marca solicitar a remoção, basta apagar o arquivo: o mural volta ao nome tipográfico sozinho.
