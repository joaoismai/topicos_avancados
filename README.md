# Flow Index - Monitorizacao do Open Office

Projeto full-stack para monitorizar a qualidade do ambiente em open office
com base em CO2, ruido, temperatura e luz. O sistema ingere dados de sensores,
calcula o Flow Index e disponibiliza uma API consumida por um dashboard web.

## Funcionalidades
- Ingestao periodica de dados e persistencia em MySQL
- Calculo de Flow Index e estado de alerta
- API com dados em tempo real e historico por sensor
- Dashboard React com indicadores, historico e acoes sugeridas

## Arquitetura
- Backend: Node.js + Express + Sequelize + MySQL
- Ingestao: integracao com API externa (login/devices/data-classifications)
- Frontend: Vite + React

## Requisitos
- Node.js 18+
- MySQL

## Instalacao
```bash
npm install
cd frontend
npm install
```

## Configuracao
Crie os ficheiros `.env` com as variaveis necessarias.

### Backend (`.env`)
```bash
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=topicos_avancados
DB_USER=root
DB_PASSWORD=senha
API_BASE_URL=https://api.exemplo.com
API_EMAIL=utilizador@exemplo.com
API_PASSWORD=senha_api
```

### Frontend (`frontend/.env`)
```bash
VITE_API_BASE=http://localhost:3000
```

## Como correr
### Backend
```bash
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

## Endpoints principais
- `GET /` - mensagem base
- `GET /status` - estado da aplicacao e contagem de registos
- `GET /api/realtime` - ultima leitura por sensor
- `GET /api/history/:sensorId?limit=24` - historico das ultimas N horas

## Estrutura do projeto
- `server.js` - API e agendamento da ingestao
- `Ingestion.js` - login na API externa, leitura e calculo do Flow Index
- `db/sequelize.js` - modelos Sequelize e ligacao a MySQL
- `frontend/` - dashboard React

## Equipa
- A044409 - António Oliveira
- A045235 - João Gomes

## Notas
- A ingestao corre uma vez no arranque e depois a cada 10 minutos.
- O Sequelize faz `sync` com `alter: true` para manter a base de dados atualizada.
