import { createClient } from '@clickhouse/client';
import { config } from './config';
let client: ReturnType<typeof createClient>;

export function getClient() {
  if (!client) {
    client = createClient(config.clickhouse);
  }
  return client;
}

export function closeClient() {
  if (client) {
    client.close();
  }
}

export async function createTables() {
  await getClient().query({
    query: `
      CREATE TABLE IF NOT EXISTS activities (
        activity_id UUID,
        user_id UUID,
        start_time DateTime64(3),
        end_time DateTime64(3),
        activity_type String,
        distance_meters Decimal64(2),
        distance_miles Decimal64(2),
        duration_seconds UInt32,
        avg_heart_rate UInt8,
        avg_pace_seconds_per_km Decimal32(2),
        avg_pace_minutes_per_mile Decimal32(2),
        max_heart_rate UInt8,
        max_pace_seconds_per_km Decimal32(2),
        total_elevation_gain_meters Decimal32(2),
        created_at DateTime64(3) DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (user_id, start_time)
    `,
  });

  await getClient().query({
    query: `
      CREATE TABLE IF NOT EXISTS track_points (
        activity_id UUID,
        timestamp DateTime64(3),
        latitude Decimal64(6),
        longitude Decimal64(6),
        elevation_meters Decimal32(2),
        heart_rate UInt8,
        cadence UInt8,
      )
      ENGINE = MergeTree()
      ORDER BY (activity_id, timestamp)
    `,
  });
}
