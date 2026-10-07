PostgreSQL Backup and Restore
This document defines the backup and restore procedure for the local PostgreSQL database used by Purr-Pawsitive-Paradise.
Important
A backup is not considered verified merely because pg_dump completed successfully.
The release requirement should be marked complete only after:
1. A backup is created.
2. It is restored into a separate test database.
3. The restored database can be queried successfully.
4. The application or Prisma can connect to the restored database.
5. Important records are checked.
Do not restore over the active development database when testing this process.
Current local database
Database: purr_pawsitive
Host:     127.0.0.1
Port:     5432
Role:     purr_app
Do not place the real password in this document.
1. Create a backup folder
From the project root:
cd C:\Users\Lenovo\Desktop\Purr-Pawsitive-Paradise
Create a local backup folder if it does not already exist:
New-Item -ItemType Directory -Force .\backups
The backups directory should not be committed if it contains real database data.
Recommended root .gitignore entry:
backups/
2. Create a PostgreSQL custom-format backup
Run:
pg_dump -h 127.0.0.1 -p 5432 -U purr_app -d purr_pawsitive -F c -f ".\backups\purr_pawsitive.backup"
PostgreSQL may prompt for the purr_app password.
Do not put the password directly in the command.
After completion, confirm the file exists:
Get-Item ".\backups\purr_pawsitive.backup"
3. Optional timestamped backup
PowerShell example:
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
pg_dump -h 127.0.0.1 -p 5432 -U purr_app -d purr_pawsitive -F c -f ".\backups\purr_pawsitive-$stamp.backup"
4. Create a separate restore-test database
Use a PostgreSQL administrator account that is permitted to create databases.
For example:
createdb -h 127.0.0.1 -p 5432 -U postgres -O purr_app purr_pawsitive_restore_test
If the restore-test database already exists and can be safely discarded:
dropdb -h 127.0.0.1 -p 5432 -U postgres purr_pawsitive_restore_test
Then create it again:
createdb -h 127.0.0.1 -p 5432 -U postgres -O purr_app purr_pawsitive_restore_test
Do not run dropdb against purr_pawsitive.
5. Restore the backup
Run:
pg_restore -h 127.0.0.1 -p 5432 -U purr_app -d purr_pawsitive_restore_test --no-owner ".\backups\purr_pawsitive.backup"
If PostgreSQL reports ownership or privilege statements from another environment, keep the restore isolated to the restore-test database and review the errors before using the backup operationally.
6. Verify the restored database
Connect:
psql -h 127.0.0.1 -p 5432 -U purr_app -d purr_pawsitive_restore_test
Inside psql, check tables:
\dt
Check representative record counts:
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM articles;
SELECT COUNT(*) FROM breed_species_records;
SELECT COUNT(*) FROM vet_listings;
SELECT COUNT(*) FROM ambulance_listings;
SELECT COUNT(*) FROM appointments;
SELECT COUNT(*) FROM transport_requests;
SELECT COUNT(*) FROM issue_reports;
Exit:
\q
7. Verify Prisma against the restored database
Do not overwrite the normal .env.
Open a temporary PowerShell session in:
cd C:\Users\Lenovo\Desktop\Purr-Pawsitive-Paradise\backend
Temporarily set the process-level connection string:
$env:DATABASE_URL="postgresql://purr_app:YOUR_PASSWORD@127.0.0.1:5432/purr_pawsitive_restore_test?schema=public"
Do not paste the real password into screenshots or documentation.
Then run:
npx.cmd prisma migrate status
If your db:check utility reads DATABASE_URL, also run:
npm.cmd run db:check
When finished, close that PowerShell terminal so the temporary process environment is discarded.
8. Restore-test acceptance checklist
Record the date and result below after actually performing the test.
Backup file created:                  [ ]
Backup file is non-empty:             [ ]
Restore-test database created:        [ ]
pg_restore completed:                 [ ]
Expected tables exist:                [ ]
Representative record counts checked: [ ]
Prisma migration status checked:      [ ]
Backend DB check succeeded:           [ ]
Restore-test database removed:        [ ]

Test date:
Tester:
Backup filename:
Result: PASS / FAIL
Notes:
Do not mark the release backup requirement as passed until these checks have actually been completed.
9. Remove the restore-test database
After verification:
dropdb -h 127.0.0.1 -p 5432 -U postgres purr_pawsitive_restore_test
Again, verify the database name carefully before pressing Enter.
10. Production backup policy
For a real deployment, define:
- Backup frequency
- Backup retention period
- Encrypted backup storage
- Who can access backups
- Restore-test frequency
- Recovery Point Objective (RPO)
- Recovery Time Objective (RTO)
- Incident escalation procedure
Do not store production backups only on the same machine as the production database.