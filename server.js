// --- Importações de Módulos e Configuração ---
const express = require('express');
const { Sequelize } = require('sequelize'); // Importa Sequelize para usar o Op.gte
const cors = require('cors'); // Necessário para permitir que o React aceda à API
const { connectDB, Leitura, Sensor, sequelize } = require('./db/sequelize'); 
const { runIngestion } = require('./Ingestion'); // Script que recolhe e processa os dados

// --- Constantes e Inicialização do Servidor ---
const app = express();
const PORT = process.env.PORT || 3000;
// Intervalo de execução do script de ingestão (ex: a cada 10 minutos)
const INGESTION_INTERVAL_MS = 10 * 60 * 1000; 

// --- Configuração de Middleware ---
// 1. CORS: Permite que o frontend (React) aceda a esta API.
//    Em produção, deve limitar a origem (ex: origin: 'http://localhost:3001')
app.use(cors()); 
app.use(express.json());

// ===============================================
// === 1. ROTAS DE SAÚDE E STATUS DA APLICAÇÃO ===
// ===============================================

// Rota Base
app.get('/', (req, res) => {
    res.send('Flow Index API a correr. Utilize /api/realtime ou /api/history/:id');
});

// Rota de Status (Verificação de DB)
app.get('/status', async (req, res) => {
    try {
        const numSensores = await Sensor.count();
        const numLeituras = await Leitura.count();
        res.json({
            status: 'OK',
            db_connected: true,
            sensores_count: numSensores,
            leituras_count: numLeituras,
            message: `Servidor e MySQL OK. ${numSensores} sensores, ${numLeituras} leituras.`
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: 'Erro ao consultar a DB.', error: error.message });
    }
});

// ========================================
// === 2. ROTAS DA API DE DADOS (REACT) ===
// ========================================

// Rota 1: Dados em Tempo Real (Última Leitura de Todos os Sensores)
app.get('/api/realtime', async (req, res) => {
    try {
        const [rows] = await sequelize.query(`
            SELECT
                sensor_id,
                flow_index,
                alerta_status,
                co2_eq,
                ruido_avg,
                temp_ar,
                pmv,
                timestamp,
                nome,
                latitude,
                longitude
            FROM (
                SELECT
                    l.sensor_id,
                    l.flow_index,
                    l.alerta_status,
                    l.co2_eq,
                    l.ruido_avg,
                    l.temp_ar,
                    l.pmv,
                    l.timestamp,
                    s.nome,
                    s.latitude,
                    s.longitude,
                    ROW_NUMBER() OVER (
                        PARTITION BY l.sensor_id
                        ORDER BY l.timestamp DESC, l.id DESC
                    ) AS rn
                FROM leituras l
                INNER JOIN sensors s
                    ON s.id = l.sensor_id
            ) ranked
            WHERE rn = 1
            ORDER BY sensor_id ASC
        `);

        if (!rows.length) {
            return res.status(404).json({ message: 'Nenhuma leitura encontrada na DB.' });
        }

        const latestTimestamp = rows.reduce((latest, row) => {
            if (!latest || new Date(row.timestamp) > new Date(latest)) {
                return row.timestamp;
            }
            return latest;
        }, null);

        const formattedData = rows.map(item => ({
            id: item.sensor_id,
            nome: item.nome,
            flow_index: item.flow_index,
            status: item.alerta_status,
            co2_eq: item.co2_eq,
            ruido_avg: item.ruido_avg,
            temp_ar: item.temp_ar,
            pmv: item.pmv,
            latitude: item.latitude,
            longitude: item.longitude,
            timestamp: item.timestamp
        }));

        res.json({
            timestamp: latestTimestamp,
            data: formattedData
        });

    } catch (error) {
        console.error('Erro na rota /api/realtime:', error.message);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar dados em tempo real.' });
    }
});

// Rota 2: Histórico de um Sensor Específico
app.get('/api/history/:sensorId', async (req, res) => {
    const { sensorId } = req.params;
    const { limit = 24 } = req.query; // Query param opcional: buscar N horas

    // Define um limite de tempo (ex: últimas N horas)
    const timeLimit = new Date(Date.now() - limit * 60 * 60 * 1000); 

    try {
        const historyData = await Leitura.findAll({
            where: {
                sensor_id: sensorId,
                timestamp: { 
                    [Sequelize.Op.gte]: timeLimit // MySQL: Busca leituras MAIORES OU IGUAIS ao timeLimit
                }
            },
            order: [['timestamp', 'ASC']], 
            attributes: [
                'timestamp',
                'flow_index',
                'co2_eq',
                'ruido_avg',
                'pmv'
            ]
        });

        if (historyData.length === 0) {
            return res.status(404).json({ message: `Nenhum histórico encontrado para o sensor ID: ${sensorId} nas últimas ${limit} horas.` });
        }

        res.json({
            sensor_id: sensorId,
            sensor_name: historyData[0]?.Sensor?.nome, // Tenta obter o nome (pode ser null se não for incluído)
            data: historyData
        });

    } catch (error) {
        console.error(`Erro na rota /api/history/${sensorId}:`, error.message);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' });
    }
});


// =====================================
// === 3. INICIALIZAÇÃO DA APLICAÇÃO ===
// =====================================

connectDB().then(() => {
    // 1. Corre a ingestão uma vez ao iniciar para alimentar a DB
    runIngestion(); 
    
    // 2. Agenda a ingestão para correr periodicamente (a cada 10 minutos)
    setInterval(runIngestion, INGESTION_INTERVAL_MS);

    app.listen(PORT, () => {
        console.log(`🚀 Servidor Express (Flow Index API) a correr em http://localhost:${PORT}`);
        console.log(`⏱️ Ingestão agendada a cada ${INGESTION_INTERVAL_MS / 1000 / 60} minutos.`);
    });
});


