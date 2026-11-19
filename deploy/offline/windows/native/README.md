# No-Docker Windows install (fallback)

Runs the Dental ERP with Windows Node.js and Windows MySQL, no Docker or WSL. Used when Docker Desktop is a blocker or the PC has only 4 GB of RAM.

The kit folder must hold, next to `Install-Native.ps1`: `app.zip` (the app from the release image, Linux database engines replaced with the Windows ones), `node-v22.*-win-x64.zip`, `mysql-8.4.*-winx64.zip`, `vc_redist.x64.exe`, `start-dental-erp.cmd`, `my.ini`, `starting.html`, `Clinic System.url`.

Run in PowerShell as Administrator: `Set-ExecutionPolicy -Scope Process Bypass; .\Install-Native.ps1` (lifetime install: no license, no backup).
Not yet tested on a real Windows PC. Version numbers in the script must match the zip file names.
