# Inventaire Pompier

Une application web sur-mesure de **gestion d'inventaire et de suivi de flotte** développée pour les Centres d'Incendie et de Secours (Caserne).
Elle permet d'effectuer et de tracer les inventaires des véhicules (VSAV, FPTLHR, VTUTP, VFI, etc.), les lots matériels, ainsi que le suivi des armoires médicales (ASUP) et autres contrôles spécifiques.

## 🚀 Fonctionnalités
- **Inventaire du Parc Roulant et Lots :** Vérification détaillée des emplacements dans les véhicules.
- **Accès sécurisé :** Par système de cookie et authentification PIN pour l'administration.
- **Modules Spécifiques :** ASUP, Contrôles Techniques (CT), Nettoyage, et génération de rapports PDF.
- **Progressive Web App (PWA) :** Installable sur mobile / tablette pour un usage hors ligne.
- **Léger & Sans Base de Données SQL :** Utilise des fichiers JSON pour une portabilité et une sauvegarde simplifiée.

👉 **Consulter le [Mode Opératoire (Fonctionnement détaillé)](MODE_OPERATOIRE.md)** pour comprendre l'utilisation au quotidien des modules (Inventaires, Médicaments, Alertes, etc).

## 🛠 Prérequis
- Un serveur web (Apache/Nginx).
- **PHP 7.4 ou supérieur** (idéalement 8.0+).
- Extensions PHP requises : `json`, `mbstring` (pour la génération des PDF, assurez-vous d'avoir Python 3 installé si vous générez des PDF via les scripts Python).

## ⚙️ Installation & Configuration

1. **Cloner le dépôt :**
   ```bash
   git clone https://github.com/votre-nom/Inventaire_Pompier.git
   cd Inventaire_Pompier
   ```

2. **Configuration de l'Environnement (.env) :**
   Copiez le fichier d'exemple pour créer votre propre fichier `.env`. Ce fichier contient notamment les accès SMTP pour l'envoi d'e-mails.
   ```bash
   cp .env.example .env
   ```
   *Ouvrez le fichier `.env` et remplissez vos identifiants SMTP (host, port, user, mot de passe).*

3. **Configuration des Utilisateurs / Administrateurs :**
   Les accès (avec codes PIN) sont stockés dans le fichier `data/users.json`. Un modèle est fourni.
   ```bash
   cp data/users.example.json data/users.json
   ```
   *Ce fichier crée automatiquement deux comptes par défaut pour votre première connexion :*
   - **Admin Système** (Superadmin) - PIN : `0000`
   - **Chef Caserne** - PIN : `1234`

   ⚠️ **Important :** Connectez-vous avec le code `0000` lors de votre première visite, puis allez dans l'interface d'administration pour créer vos vrais comptes et supprimer ces comptes par défaut pour des raisons de sécurité.

4. **Droits des Dossiers (Permissions) :**
   Assurez-vous que le serveur web (ex: `www-data` pour Apache/Nginx sous Linux) possède les droits d'écriture sur le dossier `data/` afin de pouvoir enregistrer les inventaires et logs.
   ```bash
   chmod -R 775 data/
   chown -R www-data:www-data data/
   ```
   *(Adaptez les commandes selon votre OS et utilisateur serveur).*

5. **Sécurisation :**
   Le projet inclut un fichier `.htaccess` à la racine qui interdit automatiquement l'accès direct aux fichiers sensibles (`.env`, `*.json`). Veillez à ce que votre serveur (ex: Apache) autorise la surcharge via `.htaccess` (`AllowOverride All`).

## 🔑 Accès & QR Codes (Protection par Cookie)
L'application n'est pas accessible publiquement par défaut (Erreur 403). L'accès nécessite la pose d'un cookie valide sur l'appareil de l'utilisateur.

1. Définissez un mot de passe dans votre fichier `.env` :
   ```env
   CLE_SECRETE_ACCES=mon_mot_de_passe_secret
   ```
2. Un QR Code officiel doit être affiché à la caserne, pointant vers :
   `https://votre-domaine.com/verifier.php?cle=mon_mot_de_passe_secret`
3. Lorsqu'un pompier scanne ce QR Code, le script `verifier.php` valide la clé secrète, pose le cookie d'autorisation (`site_autorise=oui`) sur son téléphone pour 30 jours, et le redirige vers l'application.

*Astuce : Vous pouvez générer ces QR codes (ainsi que les étiquettes pour les véhicules) en exécutant le script `generate_qrcodes.py` (nécessite Python avec les modules `qrcode` et `Pillow`) ou en allant dans la section QR Codes de l'interface d'administration.*

## 💡 Personnalisation
### Matériel et Véhicules
Toutes les données d'inventaires des véhicules sont gérées par des fichiers `.json` situés dans le dossier `data/`. Par exemple, `vsav.json`, `vfi.json`, etc.
Pour adapter la liste du matériel de la caserne, il suffit d'éditer ou de remplacer ces fichiers JSON depuis l'interface d'administration ou en modifiant les fichiers directement.

### Visuels et Logos
Les logos originaux ont été remplacés par des images transparentes pour des raisons de confidentialité. Pour afficher le blason de votre caserne et le logo de votre SDIS :
- Remplacez `images/logo.webp` par le logo de votre Centre de Secours.
- Remplacez `images/sdis_logo.webp` par le logo de votre département.

## 🤝 Contribution
Ce projet a été initialement conçu pour les besoins du CT Taluyers / Montagny / Chassagny. Les contributions pour l'améliorer sont les bienvenues !
