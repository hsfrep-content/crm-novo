# A&L Advant — CRM Imobiliário

CRM da **A&L Negócios Imobiliários**, estilo SaaS (referências: Linear, Notion, Pipedrive), com funil Kanban,
integração com a **API Tecimob** e recebimento de leads por webhook do
**Canal Pro (Grupo OLX / ZAP / Viva Real)** e do **Chaves na Mão**.

> 🧪 **Quer testar as integrações sem conta nos portais?** Veja o [TESTING.md](TESTING.md) —
> inclui um mock da API Tecimob e os comandos `curl` que simulam os webhooks.

<p>
  <b>Stack:</b> React + Vite + Tailwind (frontend) · Node.js + Express + SQLite (backend) · Zod (validação)
</p>

## Funcionalidades

- **Funil Kanban** com drag-and-drop: Novo Lead → Contato Feito → Visita Agendada → Proposta → Contrato → Fechado/Perdido
- **Ficha de contato** completa (nome, telefone, WhatsApp com link direto, e-mail, origem)
- **Vínculo do lead a imóveis** (bairro, tipo, faixa de preço) — manual ou sincronizados da Tecimob
- **Tarefas/lembretes** por contato com alerta visual de atrasados (no card do Kanban e na lista)
- **Timeline de interações** por contato (notas, mudanças de etapa, leads recebidos)
- **Dashboard**: leads por etapa, taxa de conversão, leads por origem e por tipo de contato do Canal Pro
- **Tags/filtros por bairro**: Pina, Boa Viagem, Piedade, Candeias, Paiva
- **Exportação CSV** de todos os leads
- **Dark mode** e layout mobile-responsivo
- **Status das Integrações**: última sync Tecimob, leads das últimas 24h via Canal Pro, fila de erros para revisão

## Estrutura

```
crm-novo/
├── server/          # API Express + SQLite (hospeda o webhook do Canal Pro)
│   └── src/
│       ├── index.js             # bootstrap + serve o build do frontend em produção
│       ├── db.js                # schema SQLite (WAL) e helpers
│       ├── crypto.js            # AES-256-GCM para a chave Tecimob
│       ├── routes/              # leads, properties, dashboard, settings, webhooks
│       └── services/
│           ├── tecimob.js       # cliente HTTP único da Tecimob (retry, timeout, zod, upsert)
│           ├── canalPro.js      # processamento assíncrono e idempotente (Canal Pro)
│           └── chavesNaMao.js   # processamento assíncrono e idempotente (Chaves na Mão)
│   └── scripts/
│       └── mock-tecimob.js      # API Tecimob fake para testes (ver TESTING.md)
└── web/             # React + Vite + Tailwind
```

## Rodando localmente

Requisitos: Node.js >= 20.

```bash
# 1. Backend
cd server
cp .env.example .env        # edite o APP_SECRET (obrigatório)
npm install
npm run dev                 # http://localhost:4000

# 2. Frontend (outro terminal)
cd web
npm install
npm run dev                 # http://localhost:5173 (proxy para o backend)
```

Em produção o backend serve o build do frontend no mesmo processo:

```bash
cd web && npm install && npm run build
cd ../server && npm install && npm start   # tudo em http://localhost:4000
```

## Variáveis de ambiente (`server/.env`)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `APP_SECRET` | ✅ | Segredo usado para criptografar a chave Tecimob no banco (AES-256-GCM). Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | — | Porta do servidor (padrão `4000`) |
| `TECIMOB_BASE_URL` | — | URL base da API Tecimob (padrão `https://api.tecimob.com.br`) |
| `DATA_DIR` | — | Diretório do SQLite (padrão `server/data`). Em deploys com volume persistente, aponte para o volume (ex.: `/data`) |

Nenhum segredo fica hardcoded: a chave Tecimob entra pela tela de **Configurações**, é
criptografada e nunca volta ao navegador.

## Deploy do backend

O webhook do Canal Pro precisa de uma **URL pública** — o backend deve rodar em um serviço
com servidor persistente e disco para o SQLite.

> ⚠️ **Vercel não é recomendada para este backend**: funções serverless não mantêm o SQLite em
> disco entre invocações. Prefira **Railway** (ou Render/Fly.io), que têm volume persistente.

### Railway (recomendado)

O repositório já traz `Dockerfile` e `railway.json` — o Railway detecta tudo sozinho
(build do frontend, backend, healthcheck em `/health` e restart automático).

1. Crie uma conta em [railway.app](https://railway.app) (login com GitHub) e clique em
   **New Project → Deploy from GitHub repo**, apontando para este repositório.
2. Em **Variables**, adicione apenas:
   - `APP_SECRET` — gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. No serviço, clique com o botão direito (ou **⌘K → Create Volume**) e monte um **Volume**
   em **`/data`** — o Dockerfile já define `DATA_DIR=/data`, então nenhuma variável extra é
   necessária; sem o volume o banco zera a cada redeploy.
4. Em **Settings → Networking → Generate Domain**, gere o domínio público. Você terá algo
   como `https://seu-app.up.railway.app` — abra e o CRM já estará no ar.

### Domínio próprio (crm.aelimoveis.com.br)

1. No Railway, em **Settings → Networking → Custom Domain**, adicione `crm.aelimoveis.com.br`.
2. O Railway mostrará um destino CNAME (algo como `xxxx.up.railway.app`).
3. No painel DNS do domínio `aelimoveis.com.br` (Registro.br, Cloudflare, HostGator etc.),
   crie um registro **CNAME** com nome `crm` apontando para esse destino.
4. Aguarde a propagação (minutos a algumas horas). O certificado HTTPS é emitido
   automaticamente. Depois, use `https://crm.aelimoveis.com.br/webhooks/canal-pro` e
   `https://crm.aelimoveis.com.br/webhooks/chaves-na-mao` nos portais.

> A identidade visual (navy, creme e o vermelho da marca) fica em `web/src/index.css`;
> o nome do produto, em `web/src/brand.js` — para renomear, altere um arquivo só.

### Registrando o webhook no Canal Pro

1. Acesse o painel do **Canal Pro** (Grupo OLX).
2. Vá em **Configurações da conta → Recebimento de leads → Integração de leads**.
3. Cadastre a URL pública do seu deploy com o caminho do webhook:

   ```
   https://seu-app.up.railway.app/webhooks/canal-pro
   ```

4. Salve. A partir daí, todo lead de OLX/ZAP/Viva Real cai automaticamente na coluna
   **Novo Lead** do funil, com a origem e o tipo de contato (WhatsApp, formulário, pedido de
   visita etc.) registrados na timeline.

### Registrando o webhook no Chaves na Mão

O Chaves na Mão não tem painel self-service de webhook — a integração de leads é feita via
suporte/parceiro comercial. Solicite o apontamento dos leads para:

```
https://seu-app.up.railway.app/webhooks/chaves-na-mao
```

O parser aceita os nomes de campo mais comuns em PT/EN (`nome`/`name`, `telefone`/`phone`,
`mensagem`/`message`, `codigoImovel`/`referencia`…). Se o payload da sua conta usar outros
nomes, ajuste apenas `server/src/services/chavesNaMao.js` — payloads não reconhecidos ficam
guardados na fila de revisão com o JSON bruto, o que facilita descobrir o formato real.

### Conectando a Tecimob

1. Gere a chave de API no painel da Tecimob.
2. No CRM, vá em **Configurações → Integração Tecimob**, cole a chave e salve.
3. Em **Integrações**, clique em **Sincronizar agora** — os imóveis ficam disponíveis para
   vincular aos leads.

## Robustez das integrações (o que já está tratado)

**Tecimob** (`server/src/services/tecimob.js` — cliente HTTP único, nada de `fetch` espalhado):

- `401/403` → banner "Chave de API inválida — reconecte em Configurações"; a tela nunca quebra
- `429` → backoff exponencial (1s, 2s, 4s) com no máximo 3 tentativas
- Timeout explícito de **10s** por chamada, com mensagem amigável
- `5xx` → o CRM continua funcional com dados locais + aviso "Sincronização indisponível, últimos dados salvos às [hora]"
- Resposta validada com **zod** registro a registro: payload malformado é logado e ignorado sem derrubar o restante da sync
- Paginação acumulativa (páginas seguintes nunca sobrescrevem as anteriores)
- **Upsert** por `tecimob_id` — sync repetida nunca duplica imóveis

**Canal Pro** (`POST /webhooks/canal-pro`):

- Responde **200 imediatamente** e processa o lead de forma assíncrona (o Grupo OLX nunca espera lógica de negócio)
- **Idempotência** por `originLeadId` com upsert transacional — os reenvios automáticos (até 3x, por até 14 dias) atualizam o lead existente em vez de duplicar
- Payload com cara de OLX mas sem campos obrigatórios (`name`, `originLeadId`) → responde 200 (evita loop de retry) e grava na fila de **leads com erro** para revisão manual — nada é descartado
- Payload que não bate com a estrutura do Grupo OLX → `400` (proteção do endpoint público contra spam)
- Concorrência: transação no SQLite garante que dois webhooks simultâneos do mesmo lead não criam duplicata
- **Log de auditoria**: todo webhook (payload bruto + timestamp) fica registrado por no mínimo 30 dias

## API (resumo)

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/webhooks/canal-pro` | Webhook público do Canal Pro |
| `POST` | `/webhooks/chaves-na-mao` | Webhook público do Chaves na Mão |
| `GET/POST/PATCH/DELETE` | `/api/leads[/:id]` | CRUD de leads (filtros: `stage`, `tag`, `source`, `q`) |
| `GET` | `/api/leads/export.csv` | Exportação CSV |
| `POST/PATCH/DELETE` | `/api/leads/:id/tasks[/:taskId]` | Tarefas do lead |
| `POST` | `/api/leads/:id/interactions` | Nota na timeline |
| `POST/DELETE` | `/api/leads/:id/properties/:propertyId` | Vincular/desvincular imóvel |
| `GET/POST` | `/api/properties` | Catálogo de imóveis |
| `GET` | `/api/dashboard` | Métricas do dashboard |
| `POST/DELETE` | `/api/settings/tecimob-key` | Salvar/remover chave Tecimob (criptografada) |
| `POST` | `/api/settings/integrations/tecimob/sync` | Disparar sincronização |
| `GET` | `/api/settings/integrations/status` | Status das integrações |
| `GET/POST` | `/api/settings/integrations/error-leads[/:id/review]` | Fila de leads com erro |
