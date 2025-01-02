import { Activity, GpxData, TrackPoint } from '@types';
import { v4 as uuidv4 } from 'uuid';
import { formatLog, logActivity, timeDifferenceInMinutes } from './utils';

export function calculateActivityMetrics(
  trackPoints: TrackPoint[],
  userId: string,
  activityType: string,
  filePath: string
): Activity {
  const startTime = trackPoints[0].timestamp;
  const endTime = trackPoints[trackPoints.length - 1].timestamp;
  const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

  let distanceMeters = 0;
  let totalElevationGain = 0;

  for (let i = 1; i < trackPoints.length; i++) {
    const prev = trackPoints[i - 1];
    const curr = trackPoints[i];

    const latDiff = curr.latitude - prev.latitude;
    const lonDiff = curr.longitude - prev.longitude;
    const approxDistanceMeters = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111319.9;
    distanceMeters += approxDistanceMeters;

    if (curr.elevation && prev.elevation && curr.elevation > prev.elevation) {
      totalElevationGain += curr.elevation - prev.elevation;
    }
  }

  const avgPaceMinutesPerMile = calculatePace(trackPoints);

  return {
    id: uuidv4(),
    userId,
    startTime,
    endTime,
    activityType,
    distanceMeters,
    durationSeconds,
    avgPaceMinutesPerMile,
    totalElevationGainMeters: totalElevationGain,
  };
}

export function extractTrackPoints(gpxData: GpxData): TrackPoint[] {
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

export function calculatePace(trackPoints: TrackPoint[]): number | null {
  logActivity(
    formatLog('gpx:activity', 'Calculating pace', {
      pointCount: trackPoints.length,
    })
  );

  if (trackPoints.length < 2) {
    logActivity(
      formatLog('gpx:activity', 'Insufficient track points for pace calculation', {
        pointCount: trackPoints.length,
      })
    );
    return null;
  }

  let totalDistance = 0;
  let totalTime = 0;

  const PAUSE_THRESHOLD_MINUTES = 0.1;

  for (let i = 1; i < trackPoints.length; i++) {
    const prevPoint = trackPoints[i - 1];
    const currPoint = trackPoints[i];

    const timeDiff = timeDifferenceInMinutes(prevPoint.timestamp, currPoint.timestamp);

    if (timeDiff > PAUSE_THRESHOLD_MINUTES) {
      logActivity(
        formatLog('gpx:activity', 'Skipping paused time', {
          start: prevPoint.timestamp,
          end: currPoint.timestamp,
          timeDiff,
        })
      );
      continue;
    }

    const distance = haversineDistance(
      prevPoint.latitude,
      prevPoint.longitude,
      currPoint.latitude,
      currPoint.longitude
    );

    totalDistance += distance;
    totalTime += timeDiff;
  }

  const pace = totalDistance > 0 ? totalTime / totalDistance : null;

  logActivity(
    formatLog('gpx:activity', 'Pace calculation complete', {
      totalDistance: totalDistance.toFixed(2),
      totalTime: totalTime.toFixed(2),
      pace: pace ? pace.toFixed(2) : null,
    })
  );

  return pace;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance * 0.621371;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
