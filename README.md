# Indicador de PNR — J&T Express

Dashboard web em **tema claro**, preparado para rodar localmente ou no Railway com PostgreSQL compartilhado.

## O que está implementado

- Filtro global exibido como **Data inicial / Data final** em todo o site.
- Na importação, esse filtro usa prioritariamente a coluna **Hora de Envio** da planilha. A coluna `Data` fica apenas como fallback para compatibilidade com a base seed antiga.
- Filtros de **Regional, Supervisor, RM, Tipo de Estação, Estação/Base e Atendimento**.
- Atalhos de período: **Último dia, 7 dias, 30 dias e Todo período**.
- Ranking por RM com PNR total, Base Própria, Franquia e participação.
- Tabela específica **Base Própria x Franquia**.
- **Top 10 Bases** mais ofensoras.
- **Top 10 Motoristas** ofensores.
- **Top 10 Origens do Pedido**.
- Evolução diária do PNR.
- **Cross-filter por clique**: cartões de Base Própria/Franquia, ranking por RM, Top 10 de bases, motoristas, origens e barras diárias podem ser clicados para filtrar os demais indicadores; clicar novamente no mesmo item remove o recorte quando aplicável.
- Botão **Exportar tabelas XLSX**, respeitando os filtros ativos.
- Upload de nova planilha diretamente no dashboard.
- Aba separada **Editar planilha**, com edição inline, inclusão e exclusão de linhas, filtros próprios, busca e paginação.
- Alterações salvas recalculam os indicadores e incrementam a versão compartilhada do banco.
- **Senha obrigatória para qualquer alteração persistida:** `3264542`.
- **PT-BR ⇄ Chinês Simplificado** por botão no topo, incluindo textos, filtros, mensagens e editor.
- **Sincronização automática entre usuários**: o navegador consulta a versão do banco a cada 3 segundos e atualiza os indicadores quando outra pessoa altera os dados.
- Banco local SQLite para testes e **PostgreSQL no Railway** para produção.
- Logo J&T Express + Maomao no canto superior direito.

## Rodar localmente no Windows

1. Extraia a pasta.
2. Dê duplo clique em `INICIAR_LOCAL.bat`.
3. Acesse `http://127.0.0.1:5000`.

Na primeira execução, o sistema importa `data/pnr_seed.xlsx` para o banco local.

## Publicar no Railway

### 1. Envie o projeto

Suba os arquivos para um repositório GitHub e crie um serviço no Railway a partir dele.

### 2. Adicione PostgreSQL

No mesmo projeto Railway:

1. Clique em **+ New**.
2. Selecione **Database > PostgreSQL**.
3. Volte ao serviço do dashboard e abra **Variables**.
4. Crie:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Se o serviço de banco tiver outro nome, substitua `Postgres` pelo nome mostrado no Railway.

### 3. Gere o domínio

No serviço web, use **Settings > Networking > Generate Domain**.

## Senha de edição

A senha exigida pelo backend para:

- importar uma nova planilha;
- salvar alterações na aba de edição;
- excluir registros;

é:

```text
3264542
```

Sem a senha correta, o backend rejeita a operação e nenhuma alteração é aplicada.

## Atualização simultânea

A planilha enviada pelo botão **Atualizar dados** e as alterações feitas na aba **Editar planilha** usam o mesmo banco. Após uma alteração válida:

1. o banco incrementa uma versão global;
2. todos os navegadores abertos consultam essa versão a cada 3 segundos;
3. ao detectar mudança, os filtros, rankings e indicadores são recarregados automaticamente.

## Planilha esperada

A importação procura principalmente:

- `Hora de Envio` — fonte prioritária do filtro de data;
- `Data` — fallback para bases antigas;
- `Filial`;
- `Número do ticket`;
- `Origem do Pedido`;
- `Base`;
- `Motorista`;
- `RM`;
- `Supervisor`;
- `Estação`;
- `Atendimento`.

Espaços extras nos cabeçalhos são normalizados automaticamente.

### Base Própria x Franquia

O campo `Estação` é normalizado para `Própria` ou `Franquia`. Se o campo estiver inválido ou ausente, bases iniciadas por `F ` ou `F-` são tratadas como franquia; as demais bases válidas são tratadas como próprias.

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
