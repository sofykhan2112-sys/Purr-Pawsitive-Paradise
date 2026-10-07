# Deployment Guide

This document describes how to prepare and deploy Purr-Pawsitive Paradise.

## 1. Production prerequisites

Install and configure:

- Node.js
- npm
- PostgreSQL
- HTTPS-capable reverse proxy or hosting platform
- Secure environment variable storage

The application has:

- React + TypeScript frontend
- Express + TypeScript backend
- PostgreSQL database
- Prisma ORM

## 2. Environment variables

The backend requires environment variables including:

```text
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
DATABASE_URL
SESSION_SECRET
MFA_ENCRYPTION_KEY