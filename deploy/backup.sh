#!/usr/bin/env bash
# Copia de seguridad de la base de datos (mesas, reservas, clientes, faltas).
# Cópialo al cron:  0 4 * * *  /srv/el-liron/deploy/backup.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGEN="$RAIZ/server/data/liron.db"
DESTINO="${LIRON_BACKUP_DIR:-$RAIZ/backups}"
DIAS="${LIRON_BACKUP_DAYS:-30}"

mkdir -p "$DESTINO"
FECHA="$(date +%Y-%m-%d_%H%M)"

# .backup copia en caliente sin corromper nada aunque la web esté en uso
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$ORIGEN" ".backup '$DESTINO/liron-$FECHA.db'"
else
  node -e "
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.argv[1]);
    db.exec(\`VACUUM INTO '\${process.argv[2]}'\`);
  " "$ORIGEN" "$DESTINO/liron-$FECHA.db"
fi

gzip -f "$DESTINO/liron-$FECHA.db"
find "$DESTINO" -name 'liron-*.db.gz' -mtime "+$DIAS" -delete

echo "Copia guardada en $DESTINO/liron-$FECHA.db.gz"
