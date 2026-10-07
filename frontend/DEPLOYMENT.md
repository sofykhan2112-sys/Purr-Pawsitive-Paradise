Deployment Guide
This document describes the current deployment readiness of Purr-Pawsitive-Paradise and the steps still required before production launch.
Current status
The project currently has:
Frontend
Production build command:
npm.cmd run build
Preview command:
npm.cmd run preview
Backend
Development command:
npm.cmd run dev
Current backend script:
"dev": "tsx watch src/server.ts"
The backend package.json currently does not contain a production build script or production start script.
Therefore, do not document or claim the backend as production-deployed yet.
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
Use:
backend/.env.example
as the reference template.
The real:
backend/.env
must never be committed.
Local pre-deployment verification
Backend
cd C:\Users\Lenovo\Desktop\Purr-Pawsitive-Paradise\backend
Install:
npm.cmd install
Validate Prisma:
npx.cmd prisma validate
Check migration status:
npx.cmd prisma migrate status
Generate Prisma:
npx.cmd prisma generate
Check the database:
npm.cmd run db:check
Start the current development server:
npm.cmd run dev
Frontend
cd C:\Users\Lenovo\Desktop\Purr-Pawsitive-Paradise\frontend
Install:
npm.cmd install
Lint:
npm.cmd run lint
Build:
npm.cmd run build
Preview the built frontend if required:
npm.cmd run preview
Database migrations in deployment
Development migration creation uses:
npx.cmd prisma migrate dev --name migration_name
A production deployment should apply already-created migrations rather than creating new migrations on the production server.
The production migration workflow should use:
npx.cmd prisma migrate deploy
Do not use prisma migrate dev against the production database.
Do not accept a database reset on production.
Frontend hosting
The Vite frontend produces:
frontend/dist/
after:
npm.cmd run build
That directory can be served by an appropriate static hosting platform or web server.
The production host must route frontend API requests correctly to the backend.
Because the frontend currently uses relative /api/... requests, production should either:
1. Serve frontend and backend behind the same public origin, or
2. Use a reverse proxy that forwards /api to the backend.
Do not change the frontend to an arbitrary hard-coded production API URL without updating the deployment design.
Backend hosting requirements
A backend host must provide:
- Supported Node.js runtime
- PostgreSQL connectivity
- Persistent production environment variables/secrets
- HTTPS through the hosting platform or reverse proxy
- Secure session cookie configuration
- Stable process management/restarts
- Logs without sensitive credentials
- Database migration execution during deployment
- Backup and restore procedures
Production secrets
Generate independent production values for:
SESSION_SECRET
MFA_ENCRYPTION_KEY
PGPASSWORD
DATABASE_URL
Do not reuse development secrets in production.
Do not paste production secrets into:
- Git
- README files
- screenshots
- issue trackers
- chat messages
- frontend code
PostgreSQL
Before production deployment:
1. Create a production PostgreSQL database.
2. Create a least-privilege application database role.
3. Set a strong unique password.
4. Configure DATABASE_URL.
5. Apply migrations with:
npx.cmd prisma migrate deploy
6. Generate Prisma client:
npx.cmd prisma generate
7. Run an application database connection check.
Sessions
The application uses server-side sessions backed by PostgreSQL.
For production:
- Use HTTPS.
- Configure production-safe cookie settings.
- Use a strong SESSION_SECRET.
- Do not expose session contents to the browser.
- Confirm session expiration behaviour.
- Confirm logout invalidates the session as intended.
Administrator MFA
Administrator MFA secrets are encrypted at rest.
Before production:
- Generate a strong production MFA_ENCRYPTION_KEY.
- Protect it separately from the database.
- Confirm admin MFA setup works.
- Confirm admin privileged routes require MFA verification.
- Define a secure admin MFA recovery/reset procedure before launch.
The current application should not claim complete MFA recovery readiness until that recovery procedure is implemented and tested.
Content release checks
Before public launch:
- Draft articles are never public.
- Archived articles disappear from public search.
- Health and Rapid Relief content has qualified review metadata.
- Published clinical content has at least one traceable source.
- Review-due logic removes or blocks overdue critical content as designed.
- Article image URL, alternative text, and rights metadata are recorded together when an image is used.
- Breed/species records have stable public URLs.
- Breed/species-linked article filtering works.
- Content coverage matrix has no unexplained applicable gaps.
Provider launch checks
Before enabling live veterinary booking:
- Vet is verified.
- Provider account is correctly assigned.
- Supported species are accurate.
- Availability is configured.
- Provider can access only their own queue.
- Request, confirmation, decline, reschedule, cancellation, and completion states work.
- Duplicate and slot-conflict protections are verified.
Before enabling live ambulance requests:
- Provider is verified.
- Service area is correct.
- Provider is currently eligible to receive requests.
- Availability handling works.
- Request does not falsely imply dispatch before provider acceptance.
- Requested → Accepted → En route → Arrived → Completed works.
- Expiry/unavailable fallback works.
If real provider participation is not available, keep those flows clearly identified as demonstration/pilot flows.
Backup gate
Complete the procedure in:
BACKUP_RESTORE.md
A successful dump alone is not enough.
A separate restore test must pass.
Mobile and accessibility gate
Before release, manually verify core flows at phone widths:
- Home/navigation
- Pet guides
- Breed/species pages
- Article search and article reader
- Signup/login/account
- Pet profiles
- Vet directory
- Appointment request/history
- Ambulance directory
- Transport request/history
- Rapid Relief
- Chatbot
- Notifications
- Admin workflows where appropriate
Also verify:
- Keyboard navigation
- Visible focus
- Form labels
- Error messages
- Alternative text
- Heading structure
- Dialog/button semantics
- Colour contrast
- No essential action depends only on colour
Security gate
Before production:
- Production HTTPS enabled
- Secrets excluded from Git
- MFA enforced for administrator privileged operations
- Role-based access tested
- Owner record isolation tested
- Provider queue isolation tested
- Write-request origin protections verified
- Rate limits verified
- Input validation verified
- Passwords use Argon2 hashes
- No sensitive values are logged
- Dependency audit reviewed
- No unresolved critical/high-severity defect
Remaining backend production-script task
Before actual hosting, add and verify production backend scripts rather than using the development watcher.
A typical target will be conceptually:
build TypeScript
start compiled server
However, these scripts should be added only after checking the backend TypeScript configuration and the actual compiled output directory.
Do not copy a guessed production script into package.json without verifying those files first.
Final release checklist
[ ] Frontend lint passes
[ ] Frontend production build passes
[ ] Backend production build/start procedure exists and passes
[ ] Prisma schema validates
[ ] Prisma migration status is clean
[ ] Production migration procedure documented
[ ] Database backup created
[ ] Backup restored into separate database
[ ] Restored data verified
[ ] Authentication tested
[ ] Authorization tested
[ ] Administrator MFA tested
[ ] Admin MFA recovery procedure addressed
[ ] Content review workflow tested
[ ] Provider workflows tested
[ ] Ambulance workflow tested
[ ] Mobile checks passed
[ ] Accessibility checks passed
[ ] Critical/high security defects resolved
[ ] Production secrets configured securely
[ ] Deployment environment documented