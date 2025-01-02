import fs from 'fs';
import { promisify } from 'util';
import { parseString } from 'xml2js';
import { getClient } from './clickhouse';
import { config } from './config';
import { calculateActivityMetrics } from './statistics';
import {
  formatDateTime,
  formatLog,
  logActivity,
  logError,
  logProcess,
  logTrackPoints,
} from './utils';

import { GpxData, TrackPoint } from './types';

export async function processGpxFile(
  filePath: string,
  userId: string,
  activityType: string
): Promise<void> {
  logProcess(formatLog('gpx:process', 'Processing GPX file', { filePath }));
  const parseXmlString = promisify(parseString);

  try {
    const gpxContent = await fs.promises.readFile(filePath, 'utf-8');
    const gpxData = (await parseXmlString(gpxContent)) as GpxData;

    if (!gpxData?.gpx?.trk?.[0]?.trkseg) {
      logError(
        formatLog('gpx:error', 'Invalid GPX file format', {
          error: 'missing required track segments',
          filePath,
        })
      );
      throw new Error('Invalid GPX file format: missing required track segments');
    }

    if (activityType !== 'running') {
      logProcess('Skipping non-run activity: %s', activityType);
      return;
    }

    const trackPoints = extractTrackPoints(gpxData);
    if (trackPoints.length === 0) {
      logProcess('No valid track points found in GPX file, skipping');
      return;
    }

    const activity = calculateActivityMetrics(trackPoints, userId, activityType, filePath);
    const activityRecord = {
      activity_id: activity.id,
      user_id: activity.userId,
      start_time: formatDateTime(activity.startTime),
      end_time: formatDateTime(activity.endTime),
      activity_type: activity.activityType,
      distance_meters: activity.distanceMeters,
      distance_miles: activity.distanceMeters * 0.000621371,
      duration_seconds: activity.durationSeconds,
      avg_pace_minutes_per_mile: activity.avgPaceMinutesPerMile,
      total_elevation_gain_meters: activity.totalElevationGainMeters,
    };

    logActivity(
      formatLog('gpx:activity', 'Activity record prepared', {
        activityId: activityRecord.activity_id,
        record: activityRecord,
      })
    );

    await getClient().insert({
      table: 'activities',
      values: [activityRecord],
      format: 'JSONEachRow',
    });

    const totalBatches = Math.ceil(trackPoints.length / config.processing.batchSize);

    for (let i = 0; i < trackPoints.length; i += config.processing.batchSize) {
      const batch = trackPoints.slice(i, i + config.processing.batchSize).map((point) => ({
        activity_id: activity.id,
        timestamp: formatDateTime(point.timestamp),
        latitude: point.latitude,
        longitude: point.longitude,
        elevation_meters: point.elevation || 0,
        heart_rate: point.heartRate || 0,
        cadence: point.cadence || 0,
      }));

      const batchNumber = Math.floor(i / config.processing.batchSize) + 1;
      logTrackPoints(
        formatLog('gpx:trackpoints', 'Processing track points batch', {
          batchNumber,
          totalBatches,
          pointCount: batch.length,
          activityId: activity.id,
        })
      );

      if (i === 0) {
        logTrackPoints('Sample of first batch: %O', batch.slice(0, 2));
      }

      await getClient().insert({
        table: 'track_points',
        values: batch,
        format: 'JSONEachRow',
      });
    }
  } catch (error) {
    logError(
      formatLog('gpx:error', 'Failed to process GPX file', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
    throw error;
  }
}

function extractTrackPoints(gpxData: GpxData): TrackPoint[] {
  const trackPoints: TrackPoint[] = [];

  const tracks = gpxData.gpx.trk;

  for (const track of tracks) {
    if (track.type?.[0] !== 'running') {
      logActivity(
        formatLog('gpx:activity', 'Skipping non-run activity', {
          activityType: track.type?.[0],
        })
      );
      return [];
    }

    if (process.env.DEBUG) {
      logActivity(
        formatLog('gpx:activity', 'Track data', {
          name: track.name?.[0] || 'Unnamed',
          type: track.type?.[0] || 'Unknown',
          segmentCount: track.trkseg?.length || 0,
        })
      );
    }

    const segments = track.trkseg;

    for (const segment of segments) {
      for (const point of segment.trkpt) {
        const trackPoint: TrackPoint = {
          timestamp: new Date(point.time[0]),
          latitude: parseFloat(point.$.lat),
          longitude: parseFloat(point.$.lon),
          elevation: point.ele ? parseFloat(point.ele[0]) : undefined,
        };

        if (point.extensions && point.extensions[0]) {
          const ext = point.extensions[0];
          if (ext['gpxtpx:TrackPointExtension']) {
            const tpx = ext['gpxtpx:TrackPointExtension'][0];
            trackPoint.heartRate = tpx['gpxtpx:hr'] ? parseInt(tpx['gpxtpx:hr'][0]) : undefined;
            trackPoint.cadence = tpx['gpxtpx:cad'] ? parseInt(tpx['gpxtpx:cad'][0]) : undefined;
          }
        }

        trackPoints.push(trackPoint);
      }
    }
  }

  return trackPoints;
}
