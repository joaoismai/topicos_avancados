CREATE TABLE IF NOT EXISTS sensors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6)
);

CREATE TABLE IF NOT EXISTS leituras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sensor_id INT NOT NULL,
  timestamp DATETIME NOT NULL,
  co2_eq FLOAT,
  ruido_avg FLOAT,
  temp_ar FLOAT,
  humidade FLOAT,
  light_lux FLOAT,
  pmv FLOAT,
  flow_index FLOAT,
  alerta_status VARCHAR(64),
  CONSTRAINT fk_leituras_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(id)
);
