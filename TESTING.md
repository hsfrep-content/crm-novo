# Guia de testes das integrações

Como testar as três integrações **sem depender de conta real** em nenhum portal, e como
validar com as contas reais depois do deploy.

Antes de tudo, suba o CRM localmente:

```bash
cd web && npm install && npm run build          # frontend
cd ../server && npm install
cp .env.example .env                            # edite o APP_SECRET
npm start                                       # tudo em http://localhost:4000
```

---

## 1. Canal Pro (Grupo OLX / ZAP / Viva Real)

O Canal Pro entrega leads por **webhook** — para testar, basta simular o POST que eles enviam.

**Lead válido** (deve aparecer na coluna "Novo Lead" do funil):

```bash
curl -X POST http://localhost:4000/webhooks/canal-pro \
  -H 'Content-Type: application/json' \
  -d '{
    "leadOrigin": "VivaReal",
    "timestamp": "2026-07-04T12:00:00Z",
    "originLeadId": "TESTE-001",
    "originListingId": "87027856",
    "clientListingId": "REF-1234",
    "name": "Maria Teste",
    "email": "maria@example.com",
    "ddd": "81",
    "phone": "81999990000",
    "message": "Tenho interesse no apartamento",
    "extraData": { "leadType": "VISIT_REQUEST" }
  }'
```

**Idempotência** — rode o MESMO comando de novo: o CRM deve responder 200 e **não criar
duplicata** (o Grupo OLX reenvia o mesmo lead até 3x em caso de falha). Confira no funil:
continua um lead só, com um novo evento na timeline.

**Campos obrigatórios ausentes** — sem `name`, deve responder 200 (para não entrar em loop de
retry) e o payload deve aparecer em **Integrações → Leads com erro**:

```bash
curl -X POST http://localhost:4000/webhooks/canal-pro \
  -H 'Content-Type: application/json' \
  -d '{"leadOrigin":"ZAP","originLeadId":"TESTE-002","ddd":"81","phoneNumber":"988887777","timestamp":"2026-07-04T12:05:00Z"}'
```

**Proteção contra spam** — payload que não parece do Grupo OLX deve levar **400**:

```bash
curl -i -X POST http://localhost:4000/webhooks/canal-pro \
  -H 'Content-Type: application/json' -d '{"foo":"bar"}'
```

**Teste real:** publique o backend (README → Deploy), cadastre
`https://SEU-DOMINIO/webhooks/canal-pro` no painel do Canal Pro
(*Configurações da conta → Recebimento de leads → Integração de leads*) e use o botão de
**testar integração** do próprio painel, ou gere um lead de verdade em um anúncio seu.

---

## 2. Chaves na Mão

Mesmo modelo de webhook, no endpoint `/webhooks/chaves-na-mao`. O parser aceita nomes de
campo em PT e EN (`nome`/`name`, `telefone`/`phone`, `mensagem`/`message`,
`codigoImovel`/`referencia`…).

**Lead válido:**

```bash
curl -X POST http://localhost:4000/webhooks/chaves-na-mao \
  -H 'Content-Type: application/json' \
  -d '{
    "leadId": "CNM-555",
    "nome": "Pedro Teste",
    "email": "pedro@example.com",
    "telefone": "81977776666",
    "mensagem": "Vi o anúncio no Chaves na Mão",
    "codigoImovel": "REF-1234",
    "portal": "chavesnamao"
  }'
```

Reenvie o mesmo comando para conferir a idempotência (sem duplicata). Sem `leadId`, o CRM
deriva uma chave determinística do conteúdo — reenvios idênticos também não duplicam.

**Lead sem contato** (sem telefone e sem email → fila de erros):

```bash
curl -X POST http://localhost:4000/webhooks/chaves-na-mao \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Sem Contato","mensagem":"onde fica?","portal":"chavesnamao"}'
```

**Teste real:** o Chaves na Mão não tem um painel de webhook self-service como o Canal Pro —
a integração de leads é feita via parceiro/suporte. Solicite ao seu contato comercial o
apontamento dos leads para `https://SEU-DOMINIO/webhooks/chaves-na-mao`. Quando receber o
primeiro lead real, confira o payload bruto em caso de erro (tela Integrações) e ajuste o
schema em `server/src/services/chavesNaMao.js` se os nomes de campo forem diferentes.

---

## 3. Tecimob (API de imóveis)

A Tecimob é consultada por **API com chave** — para testar sem conta, o repositório inclui um
**mock** que imita a API (paginação, registro inválido e modos de falha).

**Cenário feliz** (2 terminais):

```bash
# terminal 1 — mock da Tecimob
cd server && node scripts/mock-tecimob.js

# terminal 2 — CRM apontando para o mock
cd server && TECIMOB_BASE_URL=http://localhost:5050 npm start
```

1. Abra http://localhost:4000/configuracoes e salve qualquer chave (ex.: `chave-de-teste-123`).
2. Vá em **Integrações → Sincronizar agora**.
3. Resultado esperado: **7 imóveis atualizados, 1 registro inválido ignorado**
   (o mock tem 3 páginas com 8 registros, um deles propositalmente sem `id`).
4. Rode a sincronização de novo: mesmos 7 imóveis, **sem duplicar** (upsert por `tecimob_id`).
5. Abra um lead → aba **Imóveis → Vincular imóvel**: os imóveis do mock aparecem na busca.

**Cenários de falha** (reinicie o mock em cada modo):

| Comando do mock | O que testa | Comportamento esperado no CRM |
| --- | --- | --- |
| `MOCK_MODE=auth node scripts/mock-tecimob.js` | Chave inválida (401) | Banner vermelho "Chave de API inválida — reconecte em Configurações"; nada quebra |
| `MOCK_MODE=rate node scripts/mock-tecimob.js` | Rate limit (429) | O CRM espera 1s e 2s (backoff) e a sync **completa com sucesso** na 3ª tentativa — veja os logs do mock |
| `MOCK_MODE=server node scripts/mock-tecimob.js` | Instabilidade (500) | Aviso "Tecimob instável — o CRM segue com os dados locais"; leads e funil continuam funcionando |
| `MOCK_MODE=slow node scripts/mock-tecimob.js` | Timeout | Após 10s a chamada é abortada com "Tecimob não respondeu" |

**Teste real:** gere a chave no painel da Tecimob, salve em **Configurações** e rode a sync.
⚠️ A Tecimob não publica a especificação da API abertamente — o cliente usa
`GET {TECIMOB_BASE_URL}/api/properties?page=N` com resposta `{ data: [...], meta: {...} }`.
Se a API da sua conta usar outro caminho/formato, ajuste **um único arquivo**:
`server/src/services/tecimob.js` (endpoint no método `syncProperties` e o `propertySchema`).
Peça a documentação ao suporte da Tecimob ("documentação da API para integração externa").

---

## Conferindo o resultado

- **Funil** (`/`): leads de teste nas colunas, com badge da origem (Canal Pro / Chaves na Mão).
- **Integrações** (`/integracoes`): última sync Tecimob, leads das últimas 24h por portal e a
  fila "Leads com erro" com o payload bruto de cada rejeição.
- **Timeline do lead**: cada webhook recebido (inclusive reenvios) vira um evento.
- **Auditoria**: todo webhook fica em `webhook_logs` no SQLite por no mínimo 30 dias:
  `sqlite3 server/data/crm.db "SELECT id, source, status, received_at FROM webhook_logs ORDER BY id DESC LIMIT 20;"`
