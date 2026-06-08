# Backend Garde-Manger — Supabase auto-hébergé sur NAS UGREEN

On installe **Supabase** (Postgres + Auth + API + Studio) avec son compose officiel,
et on met **Caddy** devant pour le HTTPS. Domaine requis (tu en as un).

> Le code de l'app (`SupabaseRepository`) marchera ensuite à l'identique, et resterait
> compatible avec Supabase Cloud si tu migrais un jour.

---

## 1. Pré-requis

- NAS UGREEN, **Docker** activé, **≥ 4 Go de RAM libres** (tu as 8 Go : OK).
- **Git** dispo (ou téléchargement zip du dépôt Supabase).
- Domaine `gardemanger.tondomaine.fr` → ton **IP publique** (DNS/DDNS).
- Box : rediriger **TCP 80 + 443** vers l'IP locale du NAS.

## 2. Installer Supabase (compose officiel)

En SSH sur le NAS, dans un dossier de travail (ex. `/volume1/docker/`) :

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

## 3. Régler le `.env` de Supabase

Édite `supabase/docker/.env` et **remplace** ces valeurs par celles de
`secrets.generated.env` (que je t'ai préparées) :

```
POSTGRES_PASSWORD=...        # depuis secrets.generated.env
JWT_SECRET=...
ANON_KEY=...
SERVICE_ROLE_KEY=...
SECRET_KEY_BASE=...
VAULT_ENC_KEY=...
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=...
```

Puis règle les URLs publiques et les redirections d'auth :

```
API_EXTERNAL_URL=https://gardemanger.tondomaine.fr
SUPABASE_PUBLIC_URL=https://gardemanger.tondomaine.fr
# URL de l'app (où le lien magique renvoie l'utilisateur) :
SITE_URL=https://melju.github.io/garde-manger/
ADDITIONAL_REDIRECT_URLS=http://localhost:5173,https://<ton-app>.vercel.app
```

Et le **SMTP** (pour les liens magiques), ex. Brevo :

```
SMTP_ADMIN_EMAIL=ton@email
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<login SMTP Brevo>
SMTP_PASS=<clé SMTP Brevo>
SMTP_SENDER_NAME=Garde-Manger
ENABLE_EMAIL_AUTOCONFIRM=false
```

## 4. Démarrer Supabase

```bash
docker compose pull
docker compose up -d
docker compose ps      # tout doit être "healthy" (laisse 1-2 min)
```

> Si le conteneur **analytics**/**vector** pose problème (RAM/clé Logflare), dis-le-moi :
> on peut le retirer du compose, Supabase fonctionne sans.

## 5. Démarrer Caddy (ce dossier `nas/`)

1. Copie ce dossier `nas/` sur le NAS (ex. `/volume1/docker/garde-manger-caddy/`).
2. Vérifie le **nom du réseau** Supabase : `docker network ls` (souvent `supabase_default`).
3. `cp .env.example .env` puis renseigne `GM_DOMAIN`, `GM_EMAIL`, `SUPABASE_NETWORK`.
4. Lance :

```bash
docker compose up -d
```

Vérifie (depuis l'extérieur) :

```
https://gardemanger.tondomaine.fr/auth/v1/health   →  doit répondre OK
```

Le **Studio** (admin Supabase) est sur `https://gardemanger.tondomaine.fr`
(identifiants = DASHBOARD_USERNAME / DASHBOARD_PASSWORD).

## 6. Me transmettre

- l'**URL** : `https://gardemanger.tondomaine.fr`
- la confirmation que **Studio s'ouvre** et que le **SMTP** est testé (Studio → Authentication → Emails).

Je créerai alors le schéma (foyers + code d'invitation, produits, recettes, famille…) avec
la **RLS** par foyer, puis je brancherai l'app et je déploierai. L'`ANON_KEY` (publique)
ira dans la config de l'app.

---

### Sauvegardes
Les données Postgres sont dans `supabase/docker/volumes/db/`. Sauvegarde régulière
recommandée (ou `pg_dump` planifié).
