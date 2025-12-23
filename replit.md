# SmartPantry AI

## Overview
A full-stack AI-powered pantry management application with Replit Auth for authentication.

## Project Architecture
- **Backend**: Express.js with TypeScript (serves API + static files)
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (via CDN)
- **Routing**: React Router DOM
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (Google, Apple, GitHub, Email)
- **State Management**: React Query + Context API
- **Charts**: Recharts
- **AI Integration**: Google GenAI (@google/genai)
- **Icons**: Lucide React

## Project Structure
```
/
├── server/             # Backend Express server
│   ├── index.ts        # Server entry point
│   ├── routes.ts       # API routes
│   ├── replitAuth.ts   # Replit Auth setup
│   ├── storage.ts      # Database storage layer
│   └── vite.ts         # Vite dev server integration
├── shared/             # Shared code between frontend/backend
│   └── schema.ts       # Drizzle ORM schema (users, sessions)
├── components/         # Reusable UI components
│   └── NavBar.tsx
├── contexts/           # React context providers
│   └── AuthContext.tsx
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── MealPlanner.tsx
│   ├── PantryList.tsx
│   ├── Profile.tsx
│   ├── Recipes.tsx
│   ├── Scanner.tsx
│   ├── Settings.tsx
│   └── ShoppingList.tsx
├── services/           # Service modules
│   ├── authService.ts
│   ├── geminiService.ts
│   └── storageService.ts
├── App.tsx             # Main app component
├── index.tsx           # App entry point
├── index.html          # HTML template
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration
├── drizzle.config.ts   # Drizzle ORM configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies
```

## Running the Application
- Development: `npm run build && npm run dev` (builds, then runs Express on port 5000)
- Build only: `npm run build`
- Database push: `npm run db:push`

## Authentication
The app uses Replit Auth which provides:
- **Google Sign-In**: OAuth with Google accounts
- **Apple Sign-In**: OAuth with Apple ID
- **GitHub Sign-In**: OAuth with GitHub accounts
- **Email/Password**: Traditional email authentication
- **Guest Mode**: Local-only access without account (uses localStorage flag)

Authentication flow:
1. User clicks "Sign In" → redirects to Replit Auth
2. After authentication, user is redirected back to the app
3. Session is stored in PostgreSQL database
4. Guest mode bypasses auth and stores flag in localStorage

## API Endpoints
### Authentication
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/login` - Redirect to Replit Auth login
- `POST /api/logout` - Log out current user
- `DELETE /api/auth/user` - Delete user account

### AI/Gemini (server-side, uses GEMINI_API_KEY secret)
- `POST /api/gemini/suggest-recipes` - Generate recipe suggestions from pantry items
- `POST /api/gemini/generate-recipe` - Generate specific recipe by dish name
- `POST /api/gemini/generate-meal-plan` - Generate 7-day meal plan
- `POST /api/gemini/analyze-image` - Analyze food image for pantry entry

## Database Schema
- **users**: id, email, name (optional), createdAt
- **sessions**: sid, sess, expire (managed by connect-pg-simple)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Replit)
- `REPLIT_DOMAINS` - Domain for auth redirects (auto-provided)
- `SESSION_SECRET` - Session encryption key (auto-generated if missing)
- `GEMINI_API_KEY` - Google Gemini API key for AI features (server-side secret)

## Configuration Notes
- Express server runs on port 5000 and serves both API and static files
- Vite builds to `dist/` directory which Express serves
- Session middleware uses PostgreSQL for session storage
- CORS is configured to allow credentials from any origin

## Deployment
The app is configured for autoscale deployment:
- Build: `npm run build`
- Run: `npm run dev`
- Type: autoscale (stateless, uses external PostgreSQL for sessions)
