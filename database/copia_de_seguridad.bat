@echo off
REM RNF07: copia de seguridad semanal de la base de datos MediCita (Windows)
REM Cambiar la ruta si PostgreSQL esta instalado en otra carpeta o version.
set PGBIN="C:\Program Files\PostgreSQL\18\bin"
set FECHA=%date:~-4%-%date:~3,2%-%date:~0,2%
if not exist respaldos mkdir respaldos
%PGBIN%\pg_dump.exe -U postgres -h localhost -F c -f "respaldos\medicita_%FECHA%.backup" medicita
echo Copia guardada en respaldos\medicita_%FECHA%.backup
pause
