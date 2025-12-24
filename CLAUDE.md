# CLAUDE.md

This file provides guidance to Claude Code when working with this monorepo.

## Project Overview

**Foil Lab** is a GPS track analysis platform for wingfoil/sailing sessions:
- Parse GPX files and detect sailing segments
- Estimate wind direction using iterative algorithm
- Calculate performance metrics (VMG, angles, speeds)
- Visualize tracks and compare sessions

## Monorepo Structure

```
foil-lab/
├── backend/              # Python FastAPI API
└── frontend/             # Next.js React app  <-- THE FRONTEND IS HERE
```

Each subdirectory has its own CLAUDE.md with detailed guidance:
- [backend/CLAUDE.md](backend/CLAUDE.md) - API development, algorithms, services
- [frontend/CLAUDE.md](frontend/CLAUDE.md) - React components, state, styling

**Note**: There is a deprecated `foil-lab-web` repo that is ONLY a redirect stub.
Do NOT develop there. All frontend work happens in `foil-lab/frontend/`.

## Quick Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python run_api.py              # Dev server at :8000
python -m pytest tests/        # Run tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev                    # Dev server at :3000
npm run build                  # Production build
npm run lint                   # Linting
```

## Development Workflow

### Making Changes
1. **Backend-only**: Work in `backend/`, test with `pytest`
2. **Frontend-only**: Work in `frontend/`, test with local backend
3. **Both**: Make atomic commits that touch both as needed

### API Contract
- Backend defines API in `backend/api/main.py`
- Frontend consumes in `frontend/lib/api-client.ts`
- Keep these in sync when changing endpoints

### Testing Locally
```bash
# Terminal 1: Backend
cd backend && python run_api.py

# Terminal 2: Frontend
cd frontend && npm run dev
# Set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local
```

## Key Technical Decisions

### Wind Estimation
The **iterative algorithm** (`backend/core/wind/algorithms.py`) is production:
1. Classify segments as port/starboard tack
2. Calculate median angles for each tack
3. Adjust wind to balance angles
4. Reclassify segments with new wind
5. Repeat until convergence

### Architecture Layers
- **core/**: Pure algorithms, no framework dependencies
- **services/**: Business logic orchestration
- **api/**: HTTP endpoints, request/response handling

### State Management
- Frontend uses Zustand stores (`frontend/stores/`)
- API client with React Query (`frontend/hooks/useApi.ts`)

## Deployment

| Service | Platform | Deploys From |
|---------|----------|--------------|
| Backend | Railway | `main` branch, `backend/` directory |
| Frontend | Vercel | `main` branch, `frontend/` directory |

Both platforms support subdirectory deploys natively.

## Common Tasks

### Adding an API Parameter
1. Add default to `backend/config/settings.py`
2. Update `GET /api/config` ranges in `backend/api/main.py`
3. Frontend fetches dynamically (no changes needed)

### Adding a New Endpoint
1. Add route in `backend/api/main.py`
2. Add types in `frontend/lib/api-client.ts`
3. Consume in React components
