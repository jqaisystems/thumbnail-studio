@echo off
rem Weekly backup of Thumbnail Studio to OneDrive.
rem Run by Windows Task Scheduler, or run manually anytime by double-clicking.
rem
rem Register the scheduled task (once, from this folder):
rem   schtasks /Create /TN "ThumbnailStudio Backup" /TR "\"%~f0\"" /SC WEEKLY /D SUN /ST 09:11 /F
rem Remove it again with:
rem   schtasks /Delete /TN "ThumbnailStudio Backup" /F
rem
rem Writes to %OneDrive%\Backups\thumbnail-studio and keeps the 3 newest.
rem Override with: backup.cmd --dest "D:\somewhere" --keep 5
cd /d "%~dp0.."
node scripts\backup.mjs %* >> scripts\backup.log 2>&1
