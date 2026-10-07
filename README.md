# Purr-Pawsitive Paradise

Purr-Pawsitive Paradise is a full-stack pet-care information and service platform for cat, dog, and turtle owners.

The project combines reviewed pet-care content, pet profiles, veterinary appointment requests, animal transport requests, emergency guidance, provider management, administrative moderation, notifications, issue reporting, and a safety-aware pet-care chatbot.

---

## Project status

The application includes the core P0 software requirements defined for the project.

Some clinical and preventive-care content remains subject to qualified professional review before it should be considered release-ready public guidance.

---

## Main features

### Pet-care library

- Separate cat, dog, and turtle guide areas
- Breed/species records
- Topic-based article browsing
- Keyword search
- Breed/species filtering
- Public article summaries
- Related articles
- Species applicability labels
- Article sources
- Review metadata
- Image alternative text
- Image-rights metadata

### Editorial workflow

Articles support:

- Draft
- In review
- Published
- Archived

Health, preventive-care, and Rapid Relief material requires review metadata before it can be displayed publicly.

Administrative article actions are recorded in the audit trail.

### User accounts

Supported roles:

- Owner
- Vet
- Ambulance Provider
- Administrator

Features include:

- Registration
- Login and logout
- Password reset
- Session-based authentication
- Account status controls
- Owner pet profiles
- Server-side authorization
- Administrator MFA

### Veterinary services

Owners can:

- Search verified vets
- Search manually by area/postcode
- Use optional device location
- Filter by supported species
- View clinic information
- View available appointment slots
- Submit appointment requests
- Track appointment status
- Accept or reject proposed rescheduling
- Cancel eligible appointments
- Receive in-app notifications

Vet providers can:

- Maintain their profile
- Manage supported species
- Manage working hours
- Manage blocked dates
- Activate availability
- View their own appointment queue
- Accept requests
- Decline requests
- Propose another time
- Complete appointments
- Cancel appointments

The application prevents duplicate submissions and conflicting confirmed appointment slots.

### Animal transport

The transport system includes:

- Verified ambulance/provider directory
- Service-area filtering
- Species restrictions
- Availability controls
- Direct contact details
- Owner transport requests
- Provider acceptance
- Request expiry
- Status tracking

Supported tracked states include:

- Requested
- Accepted
- En route
- Arrived
- Completed
- Cancelled
- Expired / unavailable where applicable

The application does not fabricate vehicle GPS positions or arrival-time estimates.

### Rapid Relief

Rapid Relief provides species-specific urgent-care navigation using reviewed content.

It is designed to:

- Highlight professional help
- Link to vets and transport services
- Avoid unsupported diagnosis
- Avoid unsupported medication or dosage instructions
- Keep escalation actions visible

### Chatbot

The chatbot:

- Uses approved project content
- Links users to supporting articles
- Supports pet-specific personalization with consent
- Identifies relevant species
- Avoids retrieving another user's pet data
- Allows personalization context to be cleared
- Refuses unsupported diagnosis and medication requests
- Escalates urgent situations to professional help
- Supports issue reporting

### Notifications

In-app notifications are available for appointment workflow changes.

Examples include:

- New appointment request
- Confirmation
- Decline
- Reschedule proposal
- Reschedule response
- Cancellation
- Completion

Notifications support read/unread status and filtering.

### Reports and corrections

Users can report issues with:

- Articles
- Vet listings
- Ambulance listings
- Chatbot responses

Administrators can:

- Review reports
- Resolve reports
- Dismiss reports
- Record internal review notes
- Provide reporter-visible resolution summaries
- View report history

---

## Technology stack

### Frontend

- React
- TypeScript
- Vite
- React Router

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM

### Database

- PostgreSQL

### Authentication and security

- Express sessions
- PostgreSQL-backed session storage
- Argon2 password hashing
- Rate limiting
- Role-based authorization
- Administrator TOTP MFA
- Server-side validation
- Origin checks for sensitive write operations

---

## Project structure

```text
Purr-Pawsitive-Paradise/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
│
├── backups/
│
└── README.md