export const config = {
  clickhouse: {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'schachte',
    password: process.env.CLICKHOUSE_PASSWORD || 'password',
  },
  processing: {
    batchSize: parseInt(process.env.BATCH_SIZE || '10000'),
    activitiesDir: process.env.ACTIVITIES_DIR || './activities',
  },
};
