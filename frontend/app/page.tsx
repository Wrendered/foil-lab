import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 text-gray-900">
            🪂 Foil Lab
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Analyze your wingfoil sessions with advanced wind and performance metrics
          </p>
          
          {/* Prototype disclaimer banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left">
            <p className="text-gray-700 leading-relaxed">
              A prototype built in my spare time to analyze upwind performance from your GPX tracks. 
              Expect quirks, breakage, and the occasional bug — and please send feedback to my Instagram: {' '}
              <a 
                href="https://www.instagram.com/heart_wrench/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 underline"
              >
                @heart_wrench
              </a>. 
              Sharing because I love this sport and data too much to keep it to myself.
            </p>
          </div>
          <div className="space-y-4">
            <Link
              href="/analyze"
              className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Analysis
            </Link>
            <p className="text-sm text-gray-500">
              Upload a GPX file from Strava or your GPS device
            </p>
          </div>
          
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-lg mb-2">📊 Track Analysis</h3>
              <p className="text-gray-600">
                Automatic segment detection and wind direction estimation
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-lg mb-2">💨 VMG Calculation</h3>
              <p className="text-gray-600">
                Distance-weighted velocity made good for accurate performance metrics
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-lg mb-2">📈 Performance Metrics</h3>
              <p className="text-gray-600">
                Detailed analysis of your upwind angles and speed
              </p>
            </div>
          </div>
          
          {/* About section */}
          <div className="mt-16 text-left bg-white p-8 rounded-lg shadow-sm">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">About This Tool</h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Foil Lab is a side project I made to help understand how different gear, wind conditions, and technique affect upwind performance. 
                You can upload GPX tracks (like from Strava), and the tool will give you a breakdown of wind angles, tack symmetry, and more.
              </p>
              <p>
                It's not perfect — just a prototype I built in my spare time out of curiosity and obsession. 
                You might find bugs or quirks (you definitely will). But if you do, or if you have ideas for improvement, 
                I'd love to hear from you. Message me on Instagram: {' '}
                <a 
                  href="https://www.instagram.com/heart_wrench/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:text-blue-800 underline"
                >
                  @heart_wrench
                </a>.
              </p>
              <p>
                This isn't a commercial project. It's a tool I wish existed, so I built it — and I'm sharing it in the spirit of 
                learning, improvement, and foil-nerdery. 💨
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
