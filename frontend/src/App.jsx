import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function flowColor(value) {
  if (value >= 75) return 'good';
  if (value >= 55) return 'warn';
  return 'bad';
}

function summarizeAlert(status) {
  if (!status || status === 'OK') return 'Sem alertas';
  return status.replace('ALERT_', '').replaceAll('_', ' + ');
}

function MiniChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">Sem dados</div>;
  }

  const values = data.map((item) => item.flow_index ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={points} />
    </svg>
  );
}

function App() {
  const [realtime, setRealtime] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  const sensors = realtime?.data || [];
  const zoneMap = {
    1: 'Open Space - Zona Norte',
    2: 'Open Space - Zona Sul',
    3: 'Open Space - Centro',
  };
  const filteredSensors = sensors
    .filter((sensor) => zoneMap[sensor.id])
    .map((sensor) => ({ ...sensor, nome: zoneMap[sensor.id] }));

  const averageFlow = useMemo(() => {
    if (!filteredSensors.length) return 0;
    const total = filteredSensors.reduce((sum, item) => sum + (item.flow_index || 0), 0);
    return Math.round(total / filteredSensors.length);
  }, [filteredSensors]);

  const worstSensor = useMemo(() => {
    if (!filteredSensors.length) return null;
    return filteredSensors.reduce((worst, sensor) => {
      if (!worst) return sensor;
      return sensor.flow_index < worst.flow_index ? sensor : worst;
    }, null);
  }, [filteredSensors]);

  useEffect(() => {
    let timer;

    async function loadRealtime() {
      setLoadingRealtime(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/realtime`);
        if (!response.ok) {
          throw new Error('Falha ao obter dados em tempo real.');
        }
        const data = await response.json();
        setRealtime(data);
        const candidates = (data?.data || []).filter((sensor) => zoneMap[sensor.id]);
        if (!selectedId && candidates.length) {
          setSelectedId(candidates[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingRealtime(false);
      }
    }

    loadRealtime();
    timer = setInterval(loadRealtime, 30000);

    return () => clearInterval(timer);
  }, [selectedId]);

  useEffect(() => {
    async function loadHistory() {
      if (!selectedId) return;
      setLoadingHistory(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/history/${selectedId}?limit=24`);
        if (!response.ok) {
          throw new Error('Falha ao obter historico do sensor.');
        }
        const data = await response.json();
        setHistory(data.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadHistory();
  }, [selectedId]);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Flow Index</p>
          <h1>Produtividade visivel, conforto mensuravel.</h1>
          <p className="subtitle">
            Monitorizacao em tempo real do open office com foco em CO2, ruido e conforto termico.
          </p>
        </div>
        <div className="hero-card">
          <div>
            <p className="label">Indice medio</p>
            <p className={`big-score ${flowColor(averageFlow)}`}>{averageFlow}</p>
          </div>
          <div>
            <p className="label">Sensores ativos</p>
            <p className="big-score neutral">{filteredSensors.length}</p>
          </div>
          <div>
            <p className="label">Ultima leitura</p>
            <p className="value">{formatTimestamp(realtime?.timestamp)}</p>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Mapa de zonas</h2>
            <span className="hint">
              {loadingRealtime ? 'A atualizar...' : 'Atualiza a cada 30s'}
            </span>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="sensor-list">
            {filteredSensors.map((sensor) => (
              <button
                key={sensor.id}
                type="button"
                className={`sensor-tile ${selectedId === sensor.id ? 'active' : ''}`}
                onClick={() => setSelectedId(sensor.id)}
              >
                <div>
                  <p className="sensor-name">{sensor.nome}</p>
                  <p className="sensor-meta">ID {sensor.id}</p>
                </div>
                <div className={`score-badge ${flowColor(sensor.flow_index)}`}>
                    {sensor.flow_index ?? '—'}
                  </div>
                </button>
            ))}
          </div>
        </section>

        <section className="panel detail">
          <div className="panel-header">
            <h2>Detalhe do sensor</h2>
            <span className="hint">
              {loadingHistory ? 'A carregar historico...' : 'Ultimas 24 horas'}
            </span>
          </div>
          {selectedId ? (
            <>
              <div className="detail-grid">
                <div className="detail-card">
                  <p className="label">Flow Index</p>
                  <p className={`big-score ${flowColor(filteredSensors.find((s) => s.id === selectedId)?.flow_index || 0)}`}>
                    {filteredSensors.find((s) => s.id === selectedId)?.flow_index ?? '—'}
                  </p>
                  <p className="value">
                    {summarizeAlert(filteredSensors.find((s) => s.id === selectedId)?.status)}
                  </p>
                </div>
                <div className="detail-card">
                  <p className="label">CO2 (ppm)</p>
                  <p className="big-score neutral">
                    {filteredSensors.find((s) => s.id === selectedId)?.co2_eq ?? '—'}
                  </p>
                </div>
                <div className="detail-card">
                  <p className="label">Ruido (dB)</p>
                  <p className="big-score neutral">
                    {filteredSensors.find((s) => s.id === selectedId)?.ruido_avg ?? '—'}
                  </p>
                </div>
                <div className="detail-card">
                  <p className="label">Temperatura</p>
                  <p className="big-score neutral">
                    {filteredSensors.find((s) => s.id === selectedId)?.temp_ar ?? '—'}°C
                  </p>
                </div>
              </div>
              <div className="chart-wrap">
                <MiniChart data={history} />
              </div>
            </>
          ) : (
            <p className="empty">Escolhe um sensor para ver detalhes.</p>
          )}
        </section>

        <section className="panel spotlight">
          <div className="panel-header">
            <h2>Alerta principal</h2>
            <span className="hint">Prioridade atual</span>
          </div>
          {worstSensor ? (
            <div className="spotlight-card">
              <div>
                <p className="label">Zona critica</p>
                <p className="value strong">{worstSensor.nome}</p>
                <p className="value muted">{summarizeAlert(worstSensor.status)}</p>
              </div>
              <div className={`score-badge ${flowColor(worstSensor.flow_index)}`}>
                {worstSensor.flow_index ?? '—'}
              </div>
            </div>
          ) : (
            <p className="empty">Sem dados para destacar.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
