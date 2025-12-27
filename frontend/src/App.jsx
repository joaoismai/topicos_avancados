import { useEffect, useMemo, useState } from 'react';
import zonaNorte from './assets/zona-norte.png';
import zonaCentro from './assets/zona-centro.png';
import zonaSul from './assets/zona-sul.png';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

function normalizeRange(value, min, max) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const normalized = clamp((value - min) / (max - min), 0, 1);
  return normalized * 100;
}

function MultiChart({ data, selectedMetric, onHoverIndex }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">Sem dados</div>;
  }

  const pointsFor = (values) =>
    values
      .map((value, index) => {
        if (value === null || value === undefined || Number.isNaN(value)) {
          return null;
        }
        const x = (index / (values.length - 1 || 1)) * 100;
        const y = 100 - value;
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(' ');

  const flowValues = data.map((item) => item.flow_index ?? null);
  const co2Values = data.map((item) => normalizeRange(item.co2_eq, 400, 1500));
  const noiseValues = data.map((item) => normalizeRange(item.ruido_avg, 30, 70));
  const tempValues = data.map((item) => normalizeRange(item.temp_ar, 18, 26));
  const lightValues = data.map((item) => normalizeRange(item.light_lux, 0, 500));

  const flowPoints = pointsFor(flowValues);
  const co2Points = pointsFor(co2Values);
  const noisePoints = pointsFor(noiseValues);
  const tempPoints = pointsFor(tempValues);
  const lightPoints = pointsFor(lightValues);

  const showAll = selectedMetric === 'all';

  const handleMove = (event) => {
    if (!data.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const index = Math.round(ratio * (data.length - 1));
    onHoverIndex(index);
  };

  const handleLeave = () => onHoverIndex(null);

  return (
    <svg
      className="chart"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <rect className="band-bad" x="0" y="45" width="100" height="55" />
      <rect className="band-warn" x="0" y="25" width="100" height="20" />
      <rect className="band-good" x="0" y="0" width="100" height="25" />
      {(showAll || selectedMetric === 'flow') && flowPoints && (
        <polyline className="line-flow" points={flowPoints} />
      )}
      {(showAll || selectedMetric === 'co2') && co2Points && (
        <polyline className="line-co2" points={co2Points} />
      )}
      {(showAll || selectedMetric === 'noise') && noisePoints && (
        <polyline className="line-noise" points={noisePoints} />
      )}
      {(showAll || selectedMetric === 'temp') && tempPoints && (
        <polyline className="line-temp" points={tempPoints} />
      )}
      {(showAll || selectedMetric === 'light') && lightPoints && (
        <polyline className="line-light" points={lightPoints} />
      )}
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
  const [showActions, setShowActions] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('all');
  const [hoverIndex, setHoverIndex] = useState(null);

  const LIMITS = {
    co2: { ideal: '< 800', acceptable: '800-1000', critical: '> 1000' },
    noise: { ideal: '< 45', acceptable: '45-60', critical: '> 60' },
    temp: { ideal: '21-24', acceptable: '18-26', critical: '< 18 | > 26' },
    light: { ideal: '300-500', acceptable: '200-1000', critical: '< 200 | > 1000' },
  };

  const sensors = realtime?.data || [];
  const zoneMap = {
    1: { name: 'Open Space - Zona Norte', image: zonaNorte },
    2: { name: 'Open Space - Zona Sul', image: zonaSul },
    3: { name: 'Open Space - Centro', image: zonaCentro },
  };
  const filteredSensors = sensors
    .filter((sensor) => zoneMap[sensor.id])
    .map((sensor) => ({
      ...sensor,
      nome: zoneMap[sensor.id].name,
      zoneImage: zoneMap[sensor.id].image,
    }));

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

  const criticalSensors = useMemo(() => {
    return filteredSensors.filter((sensor) => (sensor.flow_index ?? 0) < 55);
  }, [filteredSensors]);

  const actionsByZone = useMemo(() => {
    const targets = criticalSensors.length ? criticalSensors : worstSensor ? [worstSensor] : [];
    if (!targets.length) return [];

    return targets.map((sensor) => {
      const items = [];
      if ((sensor.co2_eq ?? 0) >= 1000) {
        items.push('Abrir janelas ou aumentar a ventilacao durante 10 a 15 minutos.');
        items.push('Verificar se o sistema de renovacao de ar esta ativo.');
      }
      if ((sensor.ruido_avg ?? 0) >= 60) {
        items.push('Identificar a fonte de ruido e reduzir conversas na zona.');
        items.push('Sugerir uso de salas fechadas para chamadas longas.');
      }
      if ((sensor.temp_ar ?? 0) >= 26) {
        items.push('Reduzir 1 a 2°C no AC ou reforcar ventilacao.');
      }
      if ((sensor.temp_ar ?? 0) <= 18) {
        items.push('Aumentar 1 a 2°C no AC ou reduzir correntes de ar.');
      }
      if ((sensor.light_lux ?? 0) >= 1000) {
        items.push('Reduzir a iluminacao direta ou ajustar persianas para evitar encandeamento.');
      }
      if ((sensor.light_lux ?? 0) > 0 && (sensor.light_lux ?? 0) <= 200) {
        items.push('Aumentar a iluminacao ambiente ou abrir estores para subir a luz.');
      }

      if (!items.length) {
        items.push('Ambiente controlado. Manter a monitorizacao ativa.');
      }

      return { sensor, items };
    });
  }, [criticalSensors, worstSensor]);

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
                  <img src={sensor.zoneImage} alt={sensor.nome} className="zone-thumb" />
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
                <div className="detail-card">
                  <p className="label">Luminosidade (lux)</p>
                  <p className="big-score neutral">
                    {filteredSensors.find((s) => s.id === selectedId)?.light_lux ?? '—'}
                  </p>
                </div>
              </div>
              <div className="chart-wrap">
                <div className="chart-legend">
                  <button
                    type="button"
                    className={`legend flow ${selectedMetric === 'flow' ? 'active' : ''}`}
                    onClick={() => setSelectedMetric(selectedMetric === 'flow' ? 'all' : 'flow')}
                  >
                    Flow Index
                  </button>
                  <button
                    type="button"
                    className={`legend co2 ${selectedMetric === 'co2' ? 'active' : ''}`}
                    onClick={() => setSelectedMetric(selectedMetric === 'co2' ? 'all' : 'co2')}
                  >
                    CO2
                  </button>
                  <button
                    type="button"
                    className={`legend noise ${selectedMetric === 'noise' ? 'active' : ''}`}
                    onClick={() => setSelectedMetric(selectedMetric === 'noise' ? 'all' : 'noise')}
                  >
                    Ruido
                  </button>
                  <button
                    type="button"
                    className={`legend temp ${selectedMetric === 'temp' ? 'active' : ''}`}
                    onClick={() => setSelectedMetric(selectedMetric === 'temp' ? 'all' : 'temp')}
                  >
                    Temperatura
                  </button>
                  <button
                    type="button"
                    className={`legend light ${selectedMetric === 'light' ? 'active' : ''}`}
                    onClick={() => setSelectedMetric(selectedMetric === 'light' ? 'all' : 'light')}
                  >
                    Luz
                  </button>
                </div>
                <div className="chart-area">
                  <MultiChart
                    data={history}
                    selectedMetric={selectedMetric}
                    onHoverIndex={setHoverIndex}
                  />
                  {hoverIndex !== null && history[hoverIndex] && (
                    <div className="chart-tooltip">
                      <p className="label">Leitura</p>
                      <p className="value strong">
                        {new Date(history[hoverIndex].timestamp).toLocaleString()}
                      </p>
                      {(selectedMetric === 'all' || selectedMetric === 'flow') && (
                        <p className="value">Flow: {history[hoverIndex].flow_index ?? '-'}</p>
                      )}
                      {(selectedMetric === 'all' || selectedMetric === 'co2') && (
                        <p className="value">CO2: {history[hoverIndex].co2_eq ?? '-'}</p>
                      )}
                      {(selectedMetric === 'all' || selectedMetric === 'noise') && (
                        <p className="value">Ruido: {history[hoverIndex].ruido_avg ?? '-'}</p>
                      )}
                      {(selectedMetric === 'all' || selectedMetric === 'temp') && (
                        <p className="value">Temp: {history[hoverIndex].temp_ar ?? '-'} C</p>
                      )}
                      {(selectedMetric === 'all' || selectedMetric === 'light') && (
                        <p className="value">Luz: {history[hoverIndex].light_lux ?? '-'} lux</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="chart-limits">
                  <p className="label">Limites</p>
                  {(selectedMetric === 'all' || selectedMetric === 'co2') && (
                    <div className="limit-block">
                      <p className="value strong">CO2 (ppm)</p>
                      <p className="value">Ideal: {LIMITS.co2.ideal}</p>
                      <p className="value">Aceitavel: {LIMITS.co2.acceptable}</p>
                      <p className="value">Critico: {LIMITS.co2.critical}</p>
                    </div>
                  )}
                  {(selectedMetric === 'all' || selectedMetric === 'noise') && (
                    <div className="limit-block">
                      <p className="value strong">Ruido (dB)</p>
                      <p className="value">Ideal: {LIMITS.noise.ideal}</p>
                      <p className="value">Aceitavel: {LIMITS.noise.acceptable}</p>
                      <p className="value">Critico: {LIMITS.noise.critical}</p>
                    </div>
                  )}
                  {(selectedMetric === 'all' || selectedMetric === 'temp') && (
                    <div className="limit-block">
                      <p className="value strong">Temperatura</p>
                      <p className="value">Ideal: {LIMITS.temp.ideal}</p>
                      <p className="value">Aceitavel: {LIMITS.temp.acceptable}</p>
                      <p className="value">Critico: {LIMITS.temp.critical}</p>
                    </div>
                  )}
                  {(selectedMetric === 'all' || selectedMetric === 'light') && (
                    <div className="limit-block">
                      <p className="value strong">Luz (lux)</p>
                      <p className="value">Ideal: {LIMITS.light.ideal}</p>
                      <p className="value">Aceitavel: {LIMITS.light.acceptable}</p>
                      <p className="value">Critico: {LIMITS.light.critical}</p>
                    </div>
                  )}
                </div>
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
            <button
              type="button"
              className={`spotlight-card ${showActions ? 'expanded' : ''}`}
              onClick={() => setShowActions((prev) => !prev)}
            >
              <div>
                <p className="label">Zonas criticas</p>
                <p className="value strong">
                  {criticalSensors.length
                    ? criticalSensors.map((sensor) => sensor.nome).join(', ')
                    : worstSensor.nome}
                </p>
                <p className="value muted">
                  {criticalSensors.length
                    ? `Total: ${criticalSensors.length}`
                    : summarizeAlert(worstSensor.status)}
                </p>
              </div>
              <div className={`score-badge ${flowColor(worstSensor.flow_index)}`}>
                {worstSensor.flow_index ?? '—'}
              </div>
            </button>
          ) : (
            <p className="empty">Sem dados para destacar.</p>
          )}
          {worstSensor && showActions && (
            <div className="actions">
              <p className="label">Acoes corretivas sugeridas</p>
              {actionsByZone.map(({ sensor, items }) => (
                <div className="zone-actions" key={sensor.id}>
                  <p className="value strong">{sensor.nome}</p>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
