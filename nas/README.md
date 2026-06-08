# Backend Garde-Manger sur NAS UGREEN (PocketBase + Caddy)

Ce dossier met en place la base de données et l'API du garde-manger, auto-hébergées
sur ton NAS, accessibles depuis Internet en HTTPS.

- **PocketBase** : base de données + authentification + API REST + interface admin.
- **Caddy** : reverse-proxy qui gère le certificat HTTPS automatiquement.

---

## 1. Pré-requis

- NAS UGREEN avec **Docker** activé (UGOS Pro → app *Docker*).
- Un **nom de domaine** (tu en as un) qui pointe vers ton IP publique.
- Accès à la **box** pour rediriger les ports **80** et **443** vers le NAS.

## 2. DNS + redirection de ports

1. Crée un enregistrement **A** (ou CNAME via DDNS) :
   `gardemanger.tondomaine.fr` → ton **IP publique**.
   - Si ton IP change, configure un **DDNS** (souvent intégré au NAS UGREEN, ou via ton registrar).
2. Sur ta **box**, redirige les ports **TCP 80** et **TCP 443** vers l'**IP locale du NAS**.
   - ⚠️ Si le NAS utilise déjà 80/443 pour son interface, change ces ports d'admin du NAS,
     ou dis-le-moi (on basculera Caddy sur un challenge DNS, sans ouvrir le port 80).

## 3. Déposer les fichiers sur le NAS

Copie ce dossier `nas/` dans un dossier partagé du NAS, par ex. `/volume1/docker/garde-manger/`.
Puis crée le fichier `.env` :

```bash
cp .env.example .env
# édite .env : mets ton vrai domaine et ton e-mail
```

## 4. Lancer

Via l'app **Docker** d'UGOS (Projets → créer depuis un `docker-compose.yml`),
ou en SSH dans le dossier :

```bash
docker compose up -d
```

Caddy va demander le certificat HTTPS (quelques secondes). Vérifie ensuite :

```
https://gardemanger.tondomaine.fr/api/health   →  doit répondre {"code":200,...}
```

## 5. Créer le compte admin PocketBase

Ouvre l'interface admin :

```
https://gardemanger.tondomaine.fr/_/
```

Crée le **compte administrateur** (e-mail + mot de passe). C'est le compte technique
de gestion de la base (différent des comptes famille).

## 6. Configurer l'envoi d'e-mails (SMTP) — pour la connexion par code

Dans l'admin → **Settings → Mail settings** :

- Active **Use SMTP mail server**.
- Exemple avec **Brevo** (que tu utilises déjà) :
  - SMTP host : `smtp-relay.brevo.com`
  - Port : `587`
  - Username : ton login SMTP Brevo
  - Password : ta **clé SMTP** Brevo
  - Sender : un e-mail vérifié sur ton domaine
- Clique **Send test email** pour vérifier.

## 7. Me transmettre

Quand l'API répond en HTTPS, donne-moi :

1. l'**URL** : `https://gardemanger.tondomaine.fr`
2. confirme que le **compte admin** est créé et le **SMTP** testé.

Je créerai alors le schéma (foyers, produits, recettes, famille…) directement via l'API,
puis je brancherai l'application (connexion + synchro) et je déploierai.

---

### Sauvegardes

Toute la base tient dans le dossier **`pb_data/`**. Pour sauvegarder, il suffit de copier
ce dossier (ou d'utiliser la sauvegarde intégrée : admin → Settings → Backups).
