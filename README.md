# PrepNest AI Tutor

An intelligent AI-powered tutoring platform designed for **USAT & HAT exam preparation**. PrepNest combines a modern React frontend with a FastAPI backend featuring advanced agents for adaptive learning, document analysis, and personalized tutoring.

## 🎯 Features

- **AI Tutoring**: Intelligent conversational AI designed for exam prep
- **Multi-Agent System**: Specialized agents for retrieval, routing, memory, and live data
- **Document Support**: Upload and analyze PDFs and images
- **Chat Persistence**: Conversations auto-save and persist across sessions
- **Live Search**: Real-time web search integration
- **Visualization**: Generate diagrams and visual explanations
- **OCR Capabilities**: Extract and analyze text from images
- **Role-Based Access**: Secure authentication with user management

## � Documentation

- **End-user docs** are available in-app at [`/docs`](http://localhost:5173/docs) (also `/help`).
- **Developer docs** live in [`docs/developer/`](docs/developer/):
  - [setup.md](docs/developer/setup.md) — local install & env vars
  - [architecture.md](docs/developer/architecture.md) — repo layout & request flow
  - [api.md](docs/developer/api.md) — endpoint reference (full schema at `/docs` on the backend)
  - [testing.md](docs/developer/testing.md) — pytest, Vitest, Playwright

The user-facing markdown content rendered in the UI is in [`frontend/src/docs/user/`](frontend/src/docs/user/). Adding a new feature guide is as simple as dropping a new `NN-name.md` file in that folder — it appears in the docs sidebar automatically.

## �📁 Project Structure

```
PrepNest/
├── frontend/                 # React + TypeScript UI
│   ├── src/
│   │   ├── pages/          # Dashboard, AITutor, Login, etc.
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   └── services/       # API client and utilities
│   └── package.json
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/            # API routes (auth, chat, files, etc.)
│   │   ├── agents/         # AI agents (tutor, router, retriever, etc.)
│   │   ├── services/       # Business logic services
│   │   ├── db/             # Database models and repositories
│   │   ├── core/           # Config, security, logging
│   │   ├── rag/            # Retrieval-Augmented Generation
│   │   ├── tools/          # External tools (PDF, OCR, search, etc.)
│   │   └── workers/        # Celery async tasks
│   ├── requirements.txt
│   └── Dockerfile
└── README.md
```

## 🚀 Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **React Router v6+** - Client-side routing
- **Framer Motion** - Smooth animations
- **Vite Test** - Unit testing

### Backend
- **FastAPI** - Modern async Python web framework
- **SQLAlchemy** - ORM for database operations
- **Pydantic** - Data validation
- **Celery** - Async task queue
- **LangChain** - LLM agent orchestration
- **CORS** - Cross-origin resource sharing

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.9+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

The backend will be available at `http://127.0.0.1:8001`

**Health Check**: `curl http://127.0.0.1:8001/health`

**Database Health Check**: `curl http://127.0.0.1:8001/health/db`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

The frontend will be available at `http://127.0.0.1:5173`

## 📝 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user

### USAT Preparation
- `GET /api/v1/usat/categories` - List USAT categories (USAT-E, USAT-M, USAT-CS, USAT-GS, USAT-A)
- `GET /api/v1/usat/{category}/subjects` - Subjects for a selected USAT category
- `GET /api/v1/subjects/{id}/topics` - Subject topics
- `GET /api/v1/topics/{id}/mcqs` - Topic MCQs
- `GET /api/v1/subjects/{id}/materials` - Subject notes/resources
- `GET /api/v1/subjects/{id}/past-papers` - Subject past papers
- `GET /api/v1/subjects/{id}/tips` - Subject tips and tricks

### Admin Content Upload
- `POST /api/v1/admin/topics` - Create topic
- `POST /api/v1/admin/mcqs` - Create MCQ
- `POST /api/v1/admin/materials` - Create note or generic material
- `POST /api/v1/admin/past-papers` - Create past paper with year tagging
- `POST /api/v1/admin/tips` - Create tips & tricks

### Chat
- `POST /api/v1/chat/stream` - Stream AI response (WebSocket compatible)

### Conversations
- `GET /api/v1/conversations` - List user conversations
- `GET /api/v1/conversations/{id}` - Get conversation details
- `DELETE /api/v1/conversations/{id}` - Delete conversation

### Files
- `POST /api/v1/files/upload` - Upload PDF or image
- `GET /api/v1/files/{id}` - Retrieve file

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update user profile

## 🤖 AI Agents

The backend includes specialized agents:

- **Router Agent**: Routes queries to appropriate handlers
- **Tutor Agent**: Provides educational explanations
- **Retriever Agent**: Fetches relevant information from documents
- **Memory Agent**: Manages conversation context and history
- **Live Data Agent**: Fetches real-time information
- **Visualization Agent**: Generates diagrams and visual content

## 🧪 Development

### Run Tests

**Frontend**:
```bash
cd frontend
npm run test
```

**Backend**:
```bash
cd backend
pytest
```

### Build for Production

**Frontend**:
```bash
cd frontend
npm run build
npm run preview  # Preview production build
```

**Backend**:
```bash
cd backend
# Build Docker image
docker build -t prepnest:latest .
docker run -p 8001:8001 prepnest:latest
```

## 🔐 Authentication

DEV MODE: The backend supports a dev mode that skips database authentication for rapid development. Check `backend/app/api/deps.py` for dev mode configuration.

## 📚 Key Files

- `frontend/src/pages/AITutor.tsx` - Main chat interface with scroll persistence and streaming
- `backend/app/main.py` - FastAPI app initialization
- `backend/app/agents/orchestrator.py` - Agent orchestration
- `backend/app/services/chat_service.py` - Chat business logic
- `backend/app/rag/retriever.py` - Document retrieval logic

## 🎨 UI Components

Reusable components from Radix UI + custom components:
- Buttons, Cards, Modals, Toasts
- Custom chat message components
- File upload dropzone
- Conversation sidebar

## 🛡️ Security

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Input validation with Pydantic
- Secure session management

## 📦 Docker (Full Stack)

Run frontend, backend, and PostgreSQL together from the project root.

### Modes

- **Default mode** (auto reload): `docker-compose.yml`

### 1. Build and start everything (auto reload)

```bash
docker compose up --build -d
```
In default mode:
- Backend reloads automatically on Python changes (`uvicorn --reload`)
- Frontend runs Vite dev server with live reload

### 2. Open the app

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`
- DB health check: `http://127.0.0.1:8000/health/db`
- PostgreSQL is internal to Docker network (not published to host)

### 3. Check running services

```bash
docker compose ps
```

### 4. View logs

```bash
docker compose logs -f
```

Or per service:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### 5. Stop everything

```bash
docker compose stop
```

### 6. Start again (without rebuild)

```bash
docker compose start
```

### 7. Stop and remove containers/network

```bash
docker compose down
```

### 8. Full reset (also removes PostgreSQL volume/data)

```bash
docker compose down -v
```

### 9. Rebuild after code changes

```bash
docker compose up --build -d
```

### 10. Open a shell inside containers

```bash
docker compose exec backend sh
docker compose exec frontend sh
docker compose exec db psql -U admin -d myapp
```

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test thoroughly
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`

## 📄 License

[Add your license here]

## 📞 Support

For issues or questions, please open a GitHub issue or contact the development team.
