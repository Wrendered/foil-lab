export interface GPSPoint {
  latitude: number;
  longitude: number;
  time?: string;
  elevation?: number;
  speed?: number;
}

export interface GPXMetadata {
  name?: string;
  description?: string;
  time?: string;
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  points: number;
}

export async function parseGPXFile(file: File): Promise<{ gpsPoints: GPSPoint[]; metadata: GPXMetadata }> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid GPX file format');
  }

  // Extract metadata
  const metadata: GPXMetadata = {
    points: 0
  };

  const nameElement = doc.querySelector('metadata name, trk name');
  if (nameElement) {
    metadata.name = nameElement.textContent || undefined;
  }

  const descElement = doc.querySelector('metadata desc, trk desc');
  if (descElement) {
    metadata.description = descElement.textContent || undefined;
  }

  const timeElement = doc.querySelector('metadata time, trk time');
  if (timeElement) {
    metadata.time = timeElement.textContent || undefined;
  }

  // Extract track points
  const trackPoints = doc.querySelectorAll('trkpt');
  const gpsPoints: GPSPoint[] = [];
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  trackPoints.forEach(point => {
    const lat = parseFloat(point.getAttribute('lat') || '0');
    const lon = parseFloat(point.getAttribute('lon') || '0');
    
    if (isNaN(lat) || isNaN(lon)) return;

    // Update bounds
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);

    const gpsPoint: GPSPoint = {
      latitude: lat,
      longitude: lon
    };

    // Extract time
    const timeElem = point.querySelector('time');
    if (timeElem?.textContent) {
      gpsPoint.time = timeElem.textContent;
    }

    // Extract elevation
    const eleElem = point.querySelector('ele');
    if (eleElem?.textContent) {
      const elevation = parseFloat(eleElem.textContent);
      if (!isNaN(elevation)) {
        gpsPoint.elevation = elevation;
      }
    }

    // Extract speed from extensions
    const speedElem = point.querySelector('extensions gpxtpx\\:speed, extensions speed');
    if (speedElem?.textContent) {
      const speed = parseFloat(speedElem.textContent);
      if (!isNaN(speed)) {
        gpsPoint.speed = speed;
      }
    }

    gpsPoints.push(gpsPoint);
  });

  // Set bounds and point count
  if (gpsPoints.length > 0) {
    metadata.bounds = { minLat, maxLat, minLon, maxLon };
  }
  metadata.points = gpsPoints.length;

  return { gpsPoints, metadata };
}