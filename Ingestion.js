const axios = require('axios');
const dotenv = require('dotenv');
const { Sensor, Leitura } = require('./db/sequelize');

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL;
const API_EMAIL = process.env.API_EMAIL;
const API_PASSWORD = process.env.API_PASSWORD;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreLowerIsBetter(value, min, max) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 100;
  }
  const normalized = clamp((value - min) / (max - min), 0, 1);
  return 100 * (1 - normalized);
}

function scoreComfortTemp(temp) {
  if (temp === null || temp === undefined || Number.isNaN(temp)) {
    return 100;
  }
  const delta = Math.abs(temp - 22);
  const normalized = clamp(delta / 6, 0, 1);
  return 100 * (1 - normalized);
}

function computeFlowIndex({ co2, noise, temp }) {
  const co2Score = scoreLowerIsBetter(co2, 400, 1500);
  const noiseScore = scoreLowerIsBetter(noise, 30, 70);
  const thermalScore = scoreComfortTemp(temp);

  const flowIndex = (0.4 * co2Score) + (0.3 * noiseScore) + (0.3 * thermalScore);
  return Math.round(flowIndex);
}

function computeAlertStatus({ co2, noise, temp }) {
  const alerts = [];

  if (co2 >= 1000) {
    alerts.push('CO2');
  }
  if (noise >= 60) {
    alerts.push('NOISE');
  }
  if (temp >= 26 || temp <= 18) {
    alerts.push('THERMAL');
  }

  if (alerts.length === 0) {
    return 'OK';
  }
  return `ALERT_${alerts.join('_')}`;
}

async function apiLogin() {
  const response = await axios.post(`${API_BASE_URL}/login`, {
    email: API_EMAIL,
    password: API_PASSWORD,
    clientType: 'web',
  });
  return response.data?.data?.token;
}

async function fetchDevices(token) {
  const response = await axios.get(`${API_BASE_URL}/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data?.data || [];
}

async function fetchClassifications(token, deviceId, dateFrom, dateTo) {
  const response = await axios.get(`${API_BASE_URL}/data-classifications`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      deviceId,
      includeData: true,
      dateFrom,
      dateTo,
    },
  });
  return response.data?.data || [];
}

async function upsertSensor(device) {
  const [sensor] = await Sensor.findOrCreate({
    where: { device_id: device.id },
    defaults: {
      device_id: device.id,
      nome: device.name || `Device ${device.number || device.id}`,
      latitude: device.latitude ? Number(device.latitude) : null,
      longitude: device.longitude ? Number(device.longitude) : null,
    },
  });

  if (
    sensor.nome !== (device.name || `Device ${device.number || device.id}`) ||
    sensor.latitude !== (device.latitude ? Number(device.latitude) : null) ||
    sensor.longitude !== (device.longitude ? Number(device.longitude) : null)
  ) {
    await sensor.update({
      nome: device.name || `Device ${device.number || device.id}`,
      latitude: device.latitude ? Number(device.latitude) : null,
      longitude: device.longitude ? Number(device.longitude) : null,
    });
  }

  return sensor;
}

async function runIngestion() {
  try {
    const token = await apiLogin();
    if (!token) {
      console.error('Token de autenticacao nao foi obtido.');
      return;
    }

    const devices = await fetchDevices(token);
    const now = new Date();

    for (const device of devices) {
      const sensor = await upsertSensor(device);

      const lastTimestamp = await Leitura.max('timestamp', {
        where: { sensor_id: sensor.id },
      });

      const dateFrom = lastTimestamp ? new Date(lastTimestamp).toISOString() : undefined;
      const dateTo = now.toISOString();

      const items = await fetchClassifications(token, device.id, dateFrom, dateTo);

      if (!items.length) {
        continue;
      }

      const rows = items.map((item) => {
        const raw = item.data || {};
        const co2 = raw.ccs811Eco2 ?? null;
        const noise = raw.ics43434DbAvg ?? null;
        const temp = raw.si7021Temp ?? null;
        const humidity = raw.si7021Humidity ?? null;
        const discomfortIndex = item.discomfortIndex ?? null;

        const flowIndex = computeFlowIndex({
          co2,
          noise,
          temp,
        });

        const alertStatus = computeAlertStatus({
          co2,
          noise,
          temp,
        });

        return {
          sensor_id: sensor.id,
          timestamp: new Date(item.createdAt),
          co2_eq: co2,
          ruido_avg: noise,
          temp_ar: temp,
          humidade: humidity,
          pmv: discomfortIndex,
          flow_index: flowIndex,
          alerta_status: alertStatus,
        };
      });

      await Leitura.bulkCreate(rows);
    }
  } catch (error) {
    console.error('Erro na ingestao:', error.message);
  }
}

module.exports = {
  runIngestion,
};
