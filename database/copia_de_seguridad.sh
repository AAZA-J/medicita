#!/bin/sh
# RNF07: copia de seguridad semanal de la base de datos MediCita (Linux o Mac)
mkdir -p respaldos
pg_dump -U postgres -h localhost -F c -f "respaldos/medicita_$(date +%F).backup" medicita
echo "Copia guardada en respaldos/medicita_$(date +%F).backup"
# Para restaurar: pg_restore -U postgres -h localhost -d medicita_restaurada respaldos/ARCHIVO.backup
