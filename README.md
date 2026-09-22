# Solar Platform — Backend Monorepo

Plateforme backend pour entreprise d'installation solaire (catalogue, media, auth, chat temps réel).

## Stack

- Node.js 20+ / TypeScript 5 (strict)
- NestJS 10 (micro-services)
- Turborepo + pnpm workspaces
- PostgreSQL / Redis / MinIO / RabbitMQ / Traefik (Étape 2)

## Structure

```
apps/
  api-gateway/          # :3000 — routage, rate-limit, JWT
  service-auth/         # :3001 — authentification
  service-catalog/      # :3002 — produits, blog
  service-media/        # :3003 — MinIO / fichiers
  service-interaction/  # :3004 — contact + chat WebSocket
packages/
  shared/               # types & utilitaires partagés
  typescript-config/    # tsconfig partagés
  eslint-config/        # ESLint + security rules
```

## Prérequis

- Node.js >= 20
- pnpm >= 9 (`corepack enable` ou `npm i -g pnpm`)

## Docker

```powershell
# Copier les variables d'environnement
Copy-Item .env.example .env

# Build + démarrage (infra + 5 services NestJS)
docker compose up -d --build

# Statut
docker compose ps

# Logs
docker compose logs -f
```

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:3000/health |
| Auth | http://localhost:3001/health |
| Catalog | http://localhost:3002/health |
| Media | http://localhost:3003/health |
| Interaction | http://localhost:3004/health |
| Traefik proxy | http://localhost/api/auth/health |
| Traefik dashboard | http://localhost:8088 |
| MinIO console | http://localhost:9001 |
| RabbitMQ management | http://localhost:15672 |

Arrêt : `docker compose down` (ajoute `-v` pour supprimer les volumes).

## Swagger (OpenAPI)

| Service | Docs URL |
|---------|----------|
| API Gateway | http://localhost:3000/docs |
| Auth | http://localhost:3001/docs |
| Catalog | http://localhost:3002/docs |
| Media | http://localhost:3003/docs |
| Interaction | http://localhost:3004/docs |

Via Traefik : `http://localhost/api/auth/docs`, `/api/catalog/docs`, etc.

JWT : bouton **Authorize** dans Swagger (Auth / Catalog / Media) après un `POST /login`.
