# Indicador de PNR — J&T Express

Dashboard web em tema preto para acompanhamento do PNR, preparado para rodar localmente ou no Railway com PostgreSQL compartilhado.

## O que já está implementado

- Filtro global de **data** aplicado a todos os indicadores e rankings.
- Filtros de **Regional, Supervisor, RM, Tipo de Estação, Estação/Base e Atendimento**.
- Atalhos de período: **Último dia, 7 dias, 30 dias e Todo período**.
- Ranking por RM com PNR total, Base Própria, Franquia e participação.
- Quadro **Base Própria x Franquia**.
- **Top 10 Bases** mais ofensoras no período filtrado.
- **Top 10 Motoristas** ofensores.
- **Top 10 Origens do Pedido**.
- Evolução diária do PNR.
- Upload de nova planilha diretamente no dashboard.
- Aba **Editar base** com edição inline dos registros, inclusão e exclusão de linhas, filtros próprios, busca e paginação.
- Toda edição salva recalcula os indicadores e incrementa a versão compartilhada do banco.
- **Sincronização automática entre usuários**: o navegador verifica uma versão compartilhada do banco a cada 3 segundos e atualiza os indicadores quando outra pessoa publica dados novos.
- Banco local SQLite para testes e **PostgreSQL no Railway** para produção.
- Logo J&T Express + Maomao no canto superior direito.

## Rodar localmente no Windows

1. Extraia a pasta.
2. Dê duplo clique em `INICIAR_LOCAL.bat`.
3. O site abre em `http://127.0.0.1:5000`.

Na primeira execução, o sistema importa `data/pnr_seed.xlsx` para o banco local.

## Publicar no Railway

### 1. Envie o projeto

Suba estes arquivos para um repositório GitHub e crie um novo serviço no Railway a partir do repositório. Também é possível usar o fluxo de deploy do Railway compatível com seu ambiente.

### 2. Adicione PostgreSQL

No mesmo projeto Railway:

1. Clique em **+ New**.
2. Selecione **Database > PostgreSQL**.
3. Volte ao serviço do dashboard e abra **Variables**.
4. Crie:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Se o seu serviço de banco tiver outro nome, substitua `Postgres` pelo nome exibido no Railway.

### 3. Opcional: proteja a atualização da base

No serviço do dashboard, adicione uma variável:

```text
ADMIN_KEY=sua-chave-aqui
```

Quando essa variável existe, somente quem informar a mesma chave no modal **Atualizar dados** ou na aba **Editar base** consegue alterar os registros.

Se `ADMIN_KEY` não existir, o upload e a edição ficam liberados para qualquer pessoa com acesso ao dashboard.

### 4. Gere o domínio

No serviço web, use **Settings > Networking > Generate Domain**.

## Atualização simultânea

A planilha enviada pelo botão **Atualizar dados** é importada para o PostgreSQL. Alterações feitas na aba **Editar base** usam o mesmo banco. Ao concluir qualquer alteração:

1. O banco incrementa uma versão global.
2. Todos os navegadores abertos consultam essa versão a cada 3 segundos.
3. Quando detectam mudança, recarregam os filtros e todos os rankings automaticamente.

Assim, nenhuma pessoa precisa atualizar a página manualmente.

## Planilha esperada

A importação procura os cabeçalhos da base atual, especialmente:

- `Data`
- `Filial`
- `Número do ticket`
- `Origem do Pedido`
- `Base`
- `Motorista`
- `RM`
- `Supervisor`
- `Estação`
- `Atendimento`

Espaços extras no nome dos cabeçalhos são normalizados automaticamente.

### Base Própria x Franquia

O campo `Estação` da planilha é normalizado para `Própria` ou `Franquia`. Quando esse campo está inválido ou ausente, bases iniciadas por `F ` são tratadas como franquia; as demais bases válidas são tratadas como próprias.

## Estrutura principal

```text
indicador_pnr_railway/
├── app.py
├── requirements.txt
├── railway.json
├── Procfile
├── .python-version
├── INICIAR_LOCAL.bat
├── data/
│   └── pnr_seed.xlsx
├── static/
│   ├── css/app.css
│   ├── js/app.js
│   └── img/
│       ├── jt-logo-white.svg
│       └── maomao.png
└── templates/
    └── index.html
```
