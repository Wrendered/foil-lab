'use client';

import { Button } from '@/components/ui/button';
import { useUploadStore } from '@/stores/uploadStore';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useQuery } from '@tanstack/react-query';
import { ClientOnly } from '@/components/ClientOnly';

export default function TestComponents() {
  // Test Zustand stores
  const uploadStore = useUploadStore();
  const analysisStore = useAnalysisStore();

  // Test React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['test'],
    queryFn: async () => {
      return { message: 'React Query is working!' };
    },
  });

  const testFile = new File(['test content'], 'test.gpx', {
    type: 'application/gpx+xml',
  });

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Component Test Page</h1>

      {/* Test Button Variants */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Button Components</h2>
        <div className="flex gap-4 flex-wrap">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      {/* Test Zustand Stores */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">State Management (Zustand)</h2>
        
        <ClientOnly fallback={<div className="p-4 bg-gray-100 rounded">Loading state...</div>}>
          <div className="mb-6">
            <h3 className="font-medium mb-2">Upload Store</h3>
            <div className="space-y-2">
              <p>Files: {uploadStore.files.length}</p>
              <p>Is Uploading: {uploadStore.isUploading ? 'Yes' : 'No'}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => uploadStore.addFile(testFile)}
                  size="sm"
                >
                  Add Test File
                </Button>
                <Button
                  onClick={() => uploadStore.reset()}
                  size="sm"
                  variant="outline"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium mb-2">Analysis Store (Global Settings)</h3>
            <div className="space-y-2">
              <p>Wind Direction: {analysisStore.parameters.windDirection}°</p>
              <p>Angle Tolerance: {analysisStore.parameters.angleTolerance}°</p>
              <p>Min Speed: {analysisStore.parameters.minSpeed} kts</p>
              <p>Is Analyzing: {analysisStore.isAnalyzing ? 'Yes' : 'No'}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    analysisStore.updateParameters({ windDirection: 270 })
                  }
                  size="sm"
                >
                  Set Wind 270°
                </Button>
                <Button
                  onClick={() => analysisStore.reset()}
                  size="sm"
                  variant="outline"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </ClientOnly>
      </section>

      {/* Test React Query */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">React Query</h2>
        <div className="p-4 bg-gray-50 rounded">
          {isLoading && <p>Loading...</p>}
          {error && <p className="text-red-600">Error: {String(error)}</p>}
          {data && <p className="text-green-600">{data.message}</p>}
        </div>
      </section>

      {/* Environment Variables */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Environment</h2>
        <div className="space-y-1 font-mono text-sm">
          <p>API URL: {process.env.NEXT_PUBLIC_API_URL || 'not set'}</p>
          <p>App Environment: {process.env.NEXT_PUBLIC_APP_ENV || 'not set'}</p>
          <p>Wind Lines: {process.env.NEXT_PUBLIC_ENABLE_WIND_LINES || 'not set'}</p>
          <p>VMG Highlight: {process.env.NEXT_PUBLIC_ENABLE_VMG_HIGHLIGHT || 'not set'}</p>
        </div>
      </section>

      {/* Design System Colors */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Design System</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-primary text-primary-foreground rounded">
            Primary
          </div>
          <div className="p-4 bg-secondary text-secondary-foreground rounded">
            Secondary
          </div>
          <div className="p-4 bg-destructive text-destructive-foreground rounded">
            Destructive
          </div>
          <div className="p-4 bg-muted text-muted-foreground rounded">
            Muted
          </div>
        </div>
      </section>
    </div>
  );
}