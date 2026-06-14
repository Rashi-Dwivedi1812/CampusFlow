# CampusFlow AI Service Setup

## Local run

1. Install Python dependencies:

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Add your Gemini API key in `ai-service/.env`:

```env
GEMINI_API_KEY=your_key_here
NODE_BACKEND_URL=http://localhost:5001
AI_SERVICE_PORT=8000
```

3. Start services:

```bash
# Terminal 1: JPortal proxy
cd backend
node proxy.js

# Terminal 2: Node backend
cd backend
npm run dev

# Terminal 3: Python AI service
cd ai-service
uvicorn main:app --reload --port 8000

# Terminal 4: Vite frontend
cd frontend
npm run dev
```

The frontend calls `http://localhost:5001/api/ai/*`. The Node backend proxies those requests to the Python FastAPI service at `http://localhost:8000/api/ai/*`.

## API keys

- Put Gemini keys only in `ai-service/.env` as `GEMINI_API_KEY`.
- Existing Google Classroom keys remain in `backend/.env`.
- Do not commit real API keys.

## Deployment

- Deploy the Node backend and expose port `5001`.
- Deploy the Python AI service separately and set:
  - `AI_SERVICE_URL` on the Node backend to the deployed Python URL.
  - `NODE_BACKEND_URL` on the Python service to the deployed Node backend URL.
  - `GEMINI_API_KEY` on the Python service.
- Keep `/api/ai` proxied through Node for authentication and existing API access.
