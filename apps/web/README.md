# Solar Web — site vitrine + admin

Frontend React (Vite) connecté à l’API Traefik Solar.

## Docker (recommandé)

Le service `web` est dans `docker-compose.yml` (nginx + build Vite).

```powershell
docker compose up -d --build web
```

- Site : http://localhost:5173  
- Via Traefik (hors `/api`) : http://localhost/

## Dev local (hot reload)

Prérequis : backend Docker + Traefik sur `http://localhost`.

```powershell
cd apps/web
pnpm install
pnpm dev
```

Ouvrir http://localhost:5173

## Variables

| Variable | Défaut | Rôle |
|----------|--------|------|
| `VITE_API_BASE` | `http://localhost` | Base Traefik (build arg Docker) |
| `WEB_PORT` | `5173` | Port hôte du container nginx |

## Pages (vitrine)

- `/` — Accueil (hero, expertises, projets API)
- `/projets` — Réalisations
- `/produits` — Catalogue + filtres
- `/produits/:slug` — Fiche produit
- `/a-propos` · `/expertises` · `/contact`
- `/admin` — Administration
