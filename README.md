# Inventaire

Application de gestion d'inventaire.

## Configuration de l'environnement

Pour des raisons de sécurité, cette application utilise un fichier `.env` pour charger les variables d'environnement, et stocke certains fichiers sensibles en dehors du répertoire web accessible au public.

### 1. Fichier `.env`

Le fichier `.env` doit être placé **deux niveaux au-dessus** du dossier `api/`, c'est-à-dire un niveau au-dessus de la racine de ce projet (en dehors de la racine servie par votre serveur web comme Apache ou Nginx).

Par exemple, si votre projet est dans `/var/www/html/Inventaire_TMC`, le fichier doit se trouver dans `/var/www/.env`.

**Exemple de contenu pour le fichier `.env` :**

```ini
# Configuration SMTP (Exemple)
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_USER="contact@example.com"
SMTP_PASS="votre_mot_de_passe"
SMTP_NAME="Inventaire"
```

L'application chargera automatiquement ces variables via le fichier `api/env.php`.

### 2. Fichiers de configuration sensibles

Certains fichiers sont codés en dur dans `api/config.php` pour être stockés dans un répertoire sécurisé sur le serveur (par exemple `/volume1/Secrets/`). Vous devez soit créer ce dossier et lui attribuer les bonnes permissions (pour que PHP puisse y lire et écrire), soit modifier les chemins dans `api/config.php` pour les adapter à votre serveur.

- **Fichier des utilisateurs** : Défini par `USERS_FILE` (par défaut : `/volume1/Secrets/users.json`). Il stocke les identifiants de connexion.
- **Fichier de limitation de requêtes (Rate Limit)** : Défini par `RATE_LIMIT_FILE` (par défaut : `/volume1/Secrets/rate_limit.json`). Il protège l'application contre les attaques par force brute.

**Note :** Assurez-vous que l'utilisateur exécutant PHP (ex: `www-data`) possède les droits de lecture et d'écriture sur ces fichiers.

## Installation

1. Clonez ce dépôt dans le répertoire web de votre serveur.
2. Créez votre fichier `.env` au-dessus de la racine du projet comme expliqué ci-dessus.
3. Configurez les chemins de `USERS_FILE` et `RATE_LIMIT_FILE` dans `api/config.php` (ou créez les dossiers correspondants sur votre serveur).
4. Assurez-vous que le répertoire `data/` et ses sous-dossiers (notamment `inventory_sessions/` et les fichiers `.json`) ont les permissions nécessaires pour être modifiés par PHP (droits en écriture).
