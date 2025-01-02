import fs from 'fs';
import debug from 'debug';

export const logActivity = debug('gpx:activity');
export const logTrackPoints = debug('gpx:trackpoints');
export const logProcess = debug('gpx:process');
export const logError = debug('gpx:error');

export function timeDifferenceInMinutes(t1: Date, t2: Date): number {
  return (t2.getTime() - t1.getTime()) / 60000;
}

export function formatLog(level: string, namespace: string, message: any, data?: any): object {
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

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.access(dirPath);
  } catch (error) {
    console.log(`Creating directory: ${dirPath}`);
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
}

export function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}
