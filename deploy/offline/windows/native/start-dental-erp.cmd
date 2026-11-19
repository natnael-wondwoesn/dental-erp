@echo off
rem Starts the Dental ERP web app (no Docker). Runs from C:\DentalERP.
rem C:\DentalERP\secrets.cmd (created during install) sets DB_PASSWORD and AUTH_SECRET.
call C:\DentalERP\secrets.cmd
set NODE_ENV=production
set PORT=80
set HOSTNAME=127.0.0.1
set SITE_ID=default
set PRODUCT_TIER=full
set LICENSE_ENFORCEMENT=disabled
set SAAS_ENFORCEMENT=disabled
set NEXT_TELEMETRY_DISABLED=1
set NEXTAUTH_SECRET=%AUTH_SECRET%
set DATABASE_URL=mysql://dental:%DB_PASSWORD%@127.0.0.1:3306/dental_erp?connection_limit=5^&pool_timeout=20
set PRISMA_QUERY_ENGINE_LIBRARY=C:\DentalERP\app\node_modules\.prisma\client\query_engine-windows.dll.node
set PRISMA_SCHEMA_ENGINE_BINARY=C:\DentalERP\app\node_modules\@prisma\engines\schema-engine-windows.exe
cd /d C:\DentalERP\app
:loop
C:\DentalERP\node\node.exe server.js >> C:\DentalERP\app.log 2>&1
timeout /t 5 /nobreak >nul
goto loop
