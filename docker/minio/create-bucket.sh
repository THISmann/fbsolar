#!/bin/sh
set -eu

echo "[minio-init] Waiting for MinIO..."
i=0
until mc alias set local "http://${MINIO_HOST:-minio}:9000" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[minio-init] MinIO not reachable" >&2
    exit 1
  fi
  sleep 2
done

BUCKET="${MINIO_BUCKET:-solar-assets}"
echo "[minio-init] Ensuring bucket '${BUCKET}' exists..."
mc mb -p "local/${BUCKET}" || true
mc anonymous set download "local/${BUCKET}" || true
echo "[minio-init] Done."
