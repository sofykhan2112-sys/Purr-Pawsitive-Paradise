Purr-Pawsitive-Paradise
Purr-Pawsitive-Paradise is a full-stack pet-care information and service-request application for cats, dogs, and turtles.
The project includes:
- Public pet-care guides and reviewed articles
- Breed/species records
- Article search by pet group, topic, keyword, and breed/species
- Owner accounts and pet profiles
- Nearby veterinary discovery
- Veterinary appointment requests and provider workflows
- Animal ambulance discovery and transport requests
- Rapid Relief guidance
- Article-grounded care assistant/chatbot
- In-app notifications
- Issue reporting and admin review
- Administrator MFA
- Editorial review, publication, archiving, audit history, content coverage, and image-rights metadata
Technology
Frontend
- React 19
- TypeScript
- Vite
- React Router
Backend
- Node.js
- Express 5
- TypeScript
- Prisma 7
- PostgreSQL
- Argon2
- Express Session
- PostgreSQL-backed sessions
- Express Rate Limit


Purr-Pawsitive-Paradise/
├─ backend/
│  ├─ prisma/
│  │  ├─ migrations/
│  │  └─ schema.prisma
│  ├─ src/
│  ├─ .env
│  ├─ .env.example
│  ├─ package.json
│  └─ prisma7.config.ts
│
├─ frontend/
│  ├─ src/
│  ├─ package.json
│  └─ vite.config.ts
│
├─ README.md
├─ BACKUP_RESTORE.md
└─ DEPLOYMENT.md

Requirements
Install:
- Node.js
- npm
- PostgreSQL
- Git
The local PostgreSQL database used during development is:
purr_pawsitive

The local application database role is:
purr_app
Do not commit database passwords, session secrets, MFA encryption keys, or other credentials.
Backend setup
Open PowerShell:
cd C:\Users\Lenovo\Desktop\Purr-Pawsitive-Paradise\backend
Install dependencies:
npm.cmd install
Create:
backend/.env
Use backend/.env.example as the template and place the real credentials only in .env.
Validate the Prisma schema:
npx.cmd prisma validate
Apply existing development migrations:
npx.cmd prisma migrate dev
Generate the Prisma client:
npx.cmd prisma generate
Check the database connection:
npm.cmd run db:check
Start the backend development server:
npm.cmd run dev
The backend currently uses:
"dev": "tsx watch src/server.ts"
There is currently no production build or start script in backend/package.json. See DEPLOYMENT.md before treating the backend as production-ready.
Frontend setup
Open another PowerShell terminal:
cd C:\Users\Lenovo\Desktop\Purr-Pawsitive-Paradise\frontend
Install dependencies:
npm.cmd install
Start the development server:
npm.cmd run dev
The local Vite address is normally:
http://localhost:5173
Use the exact address printed by Vite if it differs.
Frontend verification
Run:
npm.cmd run lint
Then:
npm.cmd run build
Optional local production preview:
npm.cmd run preview
Useful backend commands
Database connection check:
npm.cmd run db:check
Seed article data:
npm.cmd run seed:articles
Create/promote an administrator using the existing project utility:
npm.cmd run make-admin
Breed/species seed data is currently run directly with tsx:
npx.cmd tsx src/seed-breed-records.ts
Prisma workflow
After changing backend/prisma/schema.prisma:
npx.cmd prisma format
npx.cmd prisma validate
Create a development migration:
npx.cmd prisma migrate dev --name describe_the_change
Regenerate the client:
npx.cmd prisma generate
If Prisma asks to reset a database containing data that must be preserved, stop and investigate before accepting the reset.
Environment variables
The backend currently uses:
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
DATABASE_URL
SESSION_SECRET
MFA_ENCRYPTION_KEY
Never commit the real values.
Backup and restore
See:
BACKUP_RESTORE.md
A release should not claim backup restoration has been tested until a backup has actually been restored into a separate database and verified.
Deployment
See:
DEPLOYMENT.md
The current frontend already has a production build command.
The current backend is still configured primarily for development with tsx watch, so production build/start scripts and production hosting configuration must be completed before deployment.
Release checks
Before release:
- Backend can connect to PostgreSQL
- Prisma migrations are current
- Frontend lint passes
- Frontend production build passes
- Owner/provider/admin access checks pass
- Admin MFA works
- Draft and archived articles are not publicly visible
- Published health/urgent-care articles have valid review metadata and sources
- Article image rights metadata is recorded whenever an article image is used
- Core pages work on mobile
- Backup restoration has been tested
- Production secrets are not committed
- Deployment instructions match the actual hosting environment