import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { config } from './config';
import { ensureDirectoryExists, logError, logProcess } from './utils';
import { closeClient, createTables } from './clickhouse';
import { processGpxFile } from './gpx';

function formatLog(level: string, namespace: string, message: any, data?: any): object {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    namespace,
    message,
    file: 'index.ts',
    data: data || null,
  };

  return logObject;
}

async function main() {
  try {
    await ensureDirectoryExists(config.processing.activitiesDir);

    const files = await fs.promises.readdir(config.processing.activitiesDir);
    const gpxFiles = files.filter((file) => file.endsWith('.gpx'));

    if (gpxFiles.length === 0) {
      logProcess(
        formatLog('gpx:process', 'No GPX files found', {
          directory: config.processing.activitiesDir,
        })
      );
      return;
    }

    logProcess(
      formatLog('gpx:process', 'Starting GPX processing', {
        fileCount: gpxFiles.length,
      })
    );

    for (const file of gpxFiles) {
      const filePath = path.join(config.processing.activitiesDir, file);
      try {
        await processGpxFile(filePath, uuidv4(), 'running');
        logProcess(formatLog('gpx:process', 'File processed successfully', { file }));
      } catch (error) {
        logError(
          formatLog('gpx:error', 'File processing failed', {
            file,
            error: error instanceof Error ? error.message : String(error),
          })
        );
        continue;
      }
    }

    logProcess(
      formatLog('gpx:process', 'Processing complete', {
        processedFiles: gpxFiles.length,
      })
    );
  } catch (error) {
    logError(
      formatLog('gpx:error', 'Fatal error in main process', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
    process.exit(1);
  } finally {
    await closeClient();
  }
}

createTables()
  .then(() => main())
  .catch((error: Error) => {
    console.error('Failed to initialize tables:', error);
    process.exit(1);
  });
