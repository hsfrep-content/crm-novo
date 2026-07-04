// Servidor fake da API Tecimob para testar a sincronização SEM chave real.
//
// Uso:
//   node scripts/mock-tecimob.js                 # feliz: 3 páginas, 7 imóveis, 1 registro inválido
//   MOCK_MODE=auth node scripts/mock-tecimob.js  # sempre 401 (testa o banner de chave inválida)
//   MOCK_MODE=rate node scripts/mock-tecimob.js  # 429 nas 2 primeiras chamadas (testa o backoff)
//   MOCK_MODE=server node scripts/mock-tecimob.js# sempre 500 (testa o aviso de instabilidade)
//   MOCK_MODE=slow node scripts/mock-tecimob.js  # demora 12s (testa o timeout de 10s)
//
// Depois aponte o CRM para ele no server/.env:
//   TECIMOB_BASE_URL=http://localhost:5050

import http from 'node:http';

const PORT = process.env.MOCK_PORT || 5050;
const MODE = process.env.MOCK_MODE || 'ok';

const PROPERTIES = [
  { id: 'T-101', title: 'Apto 3 quartos beira-mar', neighborhood: 'Boa Viagem', type: 'Apartamento', price: 950000, url: 'https://exemplo.tecimob.com.br/imovel/T-101' },
  { id: 'T-102', title: 'Cobertura duplex vista mar', neighborhood: 'Pina', type: 'Cobertura', price: 1800000, url: 'https://exemplo.tecimob.com.br/imovel/T-102' },
  { id: 'T-103', title: 'Casa em condomínio no Paiva', neighborhood: 'Paiva', type: 'Casa', price: 2200000, url: 'https://exemplo.tecimob.com.br/imovel/T-103' },
  { id: 'T-104', title: 'Apto 2 quartos em Piedade', neighborhood: 'Piedade', type: 'Apartamento', price: 420000, url: 'https://exemplo.tecimob.com.br/imovel/T-104' },
  { title: 'REGISTRO INVÁLIDO SEM ID (deve ser ignorado pelo zod)' },
  { id: 'T-105', title: 'Flat mobiliado em Boa Viagem', neighborhood: 'Boa Viagem', type: 'Flat', price: 380000, url: 'https://exemplo.tecimob.com.br/imovel/T-105' },
  { id: 'T-106', title: 'Terreno em Candeias', neighborhood: 'Candeias', type: 'Terreno', price: 600000, url: 'https://exemplo.tecimob.com.br/imovel/T-106' },
  { id: 'T-107', title: 'Apto garden no Pina', neighborhood: 'Pina', type: 'Apartamento', price: 1100000, url: 'https://exemplo.tecimob.com.br/imovel/T-107' },
];

const PER_PAGE = 3;
let requestCount = 0;

http
  .createServer(async (req, res) => {
    requestCount += 1;
    const url = new URL(req.url, `http://localhost:${PORT}`);
    console.log(`[mock-tecimob] #${requestCount} ${req.method} ${url.pathname}${url.search} (modo: ${MODE})`);

    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return send(401, { error: 'missing token' });
    }
    if (MODE === 'auth') return send(401, { error: 'invalid token' });
    if (MODE === 'server') return send(500, { error: 'internal error' });
    if (MODE === 'rate' && requestCount <= 2) {
      console.log('[mock-tecimob] respondendo 429 — o CRM deve tentar de novo com backoff');
      return send(429, { error: 'too many requests' });
    }
    if (MODE === 'slow') {
      await new Promise((r) => setTimeout(r, 12_000)); // maior que o timeout de 10s do CRM
    }

    if (url.pathname === '/api/properties') {
      const page = Number(url.searchParams.get('page') || 1);
      const lastPage = Math.ceil(PROPERTIES.length / PER_PAGE);
      const data = PROPERTIES.slice((page - 1) * PER_PAGE, page * PER_PAGE);
      return send(200, { data, meta: { current_page: page, last_page: lastPage } });
    }
    send(404, { error: 'not found' });
  })
  .listen(PORT, () => {
    console.log(`Mock da API Tecimob em http://localhost:${PORT} (modo: ${MODE})`);
    console.log(`Aponte o CRM com TECIMOB_BASE_URL=http://localhost:${PORT}`);
  });
