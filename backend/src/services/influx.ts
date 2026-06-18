import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { config } from "../config/env";

const influxDB = new InfluxDB({ url: config.influxUrl, token: config.influxToken });
const writeApi = influxDB.getWriteApi(config.influxOrg, config.influxBucket, "ns");
const queryApi = influxDB.getQueryApi(config.influxOrg);

export interface LastReading {
  temperature: number;
  od: number;
  timestamp: string;
}

export interface HistoryPoint {
  timestamp: string;
  value: number;
}

export interface SensorHistories {
  temperature: HistoryPoint[];
  od: HistoryPoint[];
}

/**
 * Writes temperature and OD measurements to InfluxDB
 */
export async function writeReading(
  slaveId: string,
  temp: number,
  densidade: number,
  rotacao?: number
): Promise<void> {
  const point = new Point("sensors")
    .tag("slave_id", slaveId)
    .floatField("temperature", temp)
    .floatField("od", densidade);

  // RPM/agitação só é gravado a partir de agora (dados antigos não têm este field)
  if (typeof rotacao === "number" && !Number.isNaN(rotacao)) {
    point.floatField("rotacao", rotacao);
  }

  writeApi.writePoint(point);
  await writeApi.flush();
}

/**
 * Retrieves the latest reading from InfluxDB
 */
export async function getLatestReading(slaveId: string): Promise<LastReading | null> {
  const fluxQuery = `
    from(bucket: "${config.influxBucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "sensors" and r["slave_id"] == "${slaveId}")
      |> filter(fn: (r) => r["_field"] == "temperature" or r["_field"] == "od")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  try {
    const rows = await queryApi.collectRows<any>(fluxQuery);
    if (rows && rows.length > 0) {
      let temperature = 0;
      let od = 0;
      let latestTime = "";

      for (const row of rows) {
        if (typeof row.temperature === "number") {
          temperature = row.temperature;
        }
        if (typeof row.od === "number") {
          od = row.od;
        }
        if (row._time && (!latestTime || row._time > latestTime)) {
          latestTime = row._time;
        }
      }

      return {
        temperature,
        od,
        timestamp: latestTime,
      };
    }
  } catch (error) {
    console.error(`❌ [InfluxDB Service] Error fetching latest reading for ${slaveId}:`, error);
  }
  return null;
}

/**
 * Retrieves the last 20 sensor points from InfluxDB for a slave
 */
export async function getSensorHistory(slaveId: string): Promise<SensorHistories> {
  const fluxQuery = `
    from(bucket: "${config.influxBucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "sensors" and r["slave_id"] == "${slaveId}")
      |> filter(fn: (r) => r["_field"] == "temperature" or r["_field"] == "od")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: false)
      |> tail(n: 20)
  `;

  const histories: SensorHistories = {
    temperature: [],
    od: [],
  };

  try {
    const rows = await queryApi.collectRows<any>(fluxQuery);
    if (rows && rows.length > 0) {
      rows.forEach((row) => {
        const time = row._time;
        if (typeof row.temperature === "number") {
          histories.temperature.push({ timestamp: time, value: row.temperature });
        }
        if (typeof row.od === "number") {
          histories.od.push({ timestamp: time, value: row.od });
        }
      });
    }
  } catch (error) {
    console.error(`❌ [InfluxDB Service] Error fetching sensor history for ${slaveId}:`, error);
  }

  return histories;
}

/**
 * Retrieves the history of a single field ("temperature" | "od" | "rotacao") for a slave.
 * Usado pela rota GET /api/experiments/:id/data?category=tp|do|rpm.
 * Para "rotacao", dados antigos não possuem o field — o retorno será vazio (sem erro).
 */
export async function getHistoryByField(slaveId: string, field: string): Promise<HistoryPoint[]> {
  const points: HistoryPoint[] = [];

  const fluxQuery = `
    from(bucket: "${config.influxBucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "sensors" and r["slave_id"] == "${slaveId}")
      |> filter(fn: (r) => r["_field"] == "${field}")
      |> sort(columns: ["_time"], desc: false)
      |> tail(n: 200)
  `;

  try {
    const rows = await queryApi.collectRows<any>(fluxQuery);
    if (rows && rows.length > 0) {
      rows.forEach((row) => {
        if (typeof row._value === "number") {
          points.push({ timestamp: row._time, value: row._value });
        }
      });
    }
  } catch (error) {
    console.error(`❌ [InfluxDB Service] Error fetching field "${field}" for ${slaveId}:`, error);
  }

  return points;
}
