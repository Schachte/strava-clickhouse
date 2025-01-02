export interface GpxSegment {
  trkpt: GpxPoint[];
}

export interface GpxTrack {
  trkseg: GpxSegment[];
  name?: string[];
  type?: string[];
}

export interface GpxData {
  gpx: {
    trk: GpxTrack[];
  };
}

export interface TrackPoint {
  timestamp: Date;
  latitude: number;
  longitude: number;
  elevation?: number;
  heartRate?: number;
  cadence?: number;
}

export interface Activity {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  activityType: string;
  distanceMeters: number;
  durationSeconds: number;
  avgPaceMinutesPerMile?: number;
  totalElevationGainMeters?: number;
}

export interface GpxPoint {
  $: {
    lat: string;
    lon: string;
  };
  time: string[];
  ele?: string[];
  extensions?: [
    {
      'gpxtpx:TrackPointExtension'?: [
        {
          'gpxtpx:hr'?: string[];
          'gpxtpx:cad'?: string[];
          'gpxtpx:atemp'?: string[];
        },
      ];
    },
  ];
}
