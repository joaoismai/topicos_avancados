const dotenv = require('dotenv');
const { Sequelize, DataTypes } = require('sequelize');

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
  }
);

const Sensor = sequelize.define(
  'Sensor',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    device_id: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    nome: { type: DataTypes.STRING(255), allowNull: false },
    latitude: { type: DataTypes.DECIMAL(10, 6), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 6), allowNull: true },
  },
  {
    tableName: 'sensors',
    timestamps: false,
  }
);

const Leitura = sequelize.define(
  'Leitura',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sensor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Sensor, key: 'id' },
    },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    co2_eq: { type: DataTypes.FLOAT, allowNull: true },
    ruido_avg: { type: DataTypes.FLOAT, allowNull: true },
    temp_ar: { type: DataTypes.FLOAT, allowNull: true },
    humidade: { type: DataTypes.FLOAT, allowNull: true },
    pmv: { type: DataTypes.FLOAT, allowNull: true },
    flow_index: { type: DataTypes.FLOAT, allowNull: true },
    alerta_status: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    tableName: 'leituras',
    timestamps: false,
  }
);

Sensor.hasMany(Leitura, { foreignKey: 'sensor_id' });
Leitura.belongsTo(Sensor, { foreignKey: 'sensor_id' });

async function connectDB() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('DB conectada e sincronizada.');
  } catch (error) {
    console.error('Erro ao ligar a DB:', error.message);
    throw error;
  }
}

module.exports = {
  sequelize,
  connectDB,
  Sensor,
  Leitura,
};
