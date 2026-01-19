/**
 * Utility to load sample GPX files for demo purposes
 */

export async function loadSampleGPX(): Promise<File[]> {
  const samples = [
    { path: '/samples/sample-session-1.gpx', name: 'Sample Session 1.gpx' },
    { path: '/samples/sample-session-2.gpx', name: 'Sample Session 2.gpx' },
  ];

  const files = await Promise.all(
    samples.map(async ({ path, name }) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${name}`);
      }
      const blob = await response.blob();
      return new File([blob], name, { type: 'application/gpx+xml' });
    })
  );

  return files;
}
