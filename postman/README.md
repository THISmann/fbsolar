# Collection Postman — Solar API

## Import

1. Postman → **Import**
2. Fichiers :
   - `Solar.API.postman_collection.json`
   - `Solar.local.postman_environment.json`
3. Environnement **Solar Local**

## Compte seed (ALLOW_DEV_SEED)

| Champ | Valeur |
|-------|--------|
| email | `admin@solar.local` |
| password | valeur de `BOOTSTRAP_ADMIN_PASSWORD` (ex. `Admin123!Secure`) |

## Newman (CI / local)

```powershell
npm.cmd exec --yes newman -- run postman/Solar.API.postman_collection.json `
  -e postman/Solar.local.postman_environment.json `
  --working-dir postman `
  --delay-request 200
```

Le `--working-dir postman` est requis pour l’upload `fixtures/test.png`.

## Ordre de test

1. Health
2. Auth (login → me → register → refresh)
3. Catalog / Media / Interaction
4. Logout (dernier)

## Routes Traefik

`http://localhost/api/{auth|catalog|media|interaction}/...`
