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
export async function writeReading(slaveId: string, temp: number, densidade: number): Promise<void> {
  const pointTemp = new Point("sensors")
    .tag("slave_id", slaveId)
    .floatField("temperature", temp);

  const pointDens = new Point("sensors")
    .tag("slave_id", slaveId)
    .floatField("od", densidade);

  writeApi.writePoint(pointTemp);
  writeApi.writePoint(pointDens);
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
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> last()
  `;

  try {
    const rows = await queryApi.collectRows<any>(fluxQuery);
    if (rows && rows.length > 0) {
      const row = rows[0];
      return {
        temperature: typeof row.temperature === "number" ? row.temperature : 0,
        od: typeof row.od === "number" ? row.od : 0,
        timestamp: row._time,
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
