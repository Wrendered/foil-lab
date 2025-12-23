# Foil Lab

GPS track analysis platform for wingfoil and sailing sessions. Parses GPX files, estimates wind direction, and calculates performance metrics.

## Quick Start

### Backend (Python/FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run_api.py
# API at http://localhost:8000
```

### Frontend (Next.js/React)
```bash
cd frontend
npm install
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
# App at http://localhost:3000
```

## Repository Structure

```
foil-lab/
├── backend/                 # Python FastAPI API
│   ├── api/                # REST endpoints
│   ├── core/               # Core algorithms
│   ├── services/           # Business logic
│   └── docs/               # Backend documentation
├── frontend/               # Next.js React app
│   ├── app/                # Next.js pages
│   ├── components/         # React components
│   ├── lib/                # Utilities
│   └── stores/             # State management
└── README.md               # This file
```

## Features

- **GPX Parsing**: Load tracks from Strava or other GPS sources
- **Wind Estimation**: Iterative algorithm that balances port/starboard tack angles
- **Performance Metrics**: VMG, upwind angles, speeds
- **Interactive Maps**: Visualize tracks with Leaflet
- **Multi-track Comparison**: Compare sessions side-by-side

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Backend | Railway | https://foil-lab-production.up.railway.app |
| Frontend | Railway | https://gracious-love-production-ec22.up.railway.app |

Both auto-deploy from `main` branch.

## Documentation

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [API Documentation](backend/docs/API-DOCUMENTATION.md)
- [Architecture](backend/docs/architecture.md)
- [Deployment Guide](backend/docs/DEPLOYMENT-GUIDE.md)

## License

MIT
