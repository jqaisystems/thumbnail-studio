@echo off
rem Monthly roadmap proposals for Thumbnail Studio.
rem Run by Windows Task Scheduler on the 1st of each month (or manually anytime).
rem Needs the Claude Code CLI on your PATH. If "claude" is not found, replace it
rem below with the full path to claude.exe.
cd /d "%~dp0.."
claude -p "You maintain the Thumbnail Studio in this folder (read README.md and docs\RUNBOOK.md for context). Review data\roadmap.json and the current state of the system, then append 3 to 5 NEW improvement proposals to data\roadmap.json following its exact schema: each item needs a unique id, title, detail (2-3 sentences, concrete value for a YouTube thumbnail workflow), category, status 'proposed', and proposedAt set to today. Do not duplicate existing items in any status, do not change existing items, do not implement anything, and only edit data\roadmap.json. No em dashes anywhere." --allowedTools "Read,Write,Edit,Glob,Grep" >> scripts\propose-improvements.log 2>&1
