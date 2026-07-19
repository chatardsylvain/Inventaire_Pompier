<?php
// Vérification stricte du cookie d'accès pour l'administration
if (!isset($_COOKIE['site_autorise']) || $_COOKIE['site_autorise'] !== 'oui') {
    header('HTTP/1.0 403 Forbidden');
    echo "<h1>Accès réservé - Administration</h1><p>Veuillez scanner le QR code officiel pour accéder à cet espace.</p>";
    exit();
}

// Lecture de la clé secrète depuis le fichier .env (via api/config.php)
require_once __DIR__ . '/api/config.php';
$cle_acces = envVar('CLE_SECRETE_ACCES', '');
$url_acces = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
           . '://' . $_SERVER['HTTP_HOST']
           . rtrim(dirname($_SERVER['PHP_SELF']), '/\\') . '/verifier.php?cle=' . urlencode($cle_acces);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Administration - Inventaire TMC</title>
    <!-- Chargement des polices et icônes -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
	<link href="css/all.min.css" rel="stylesheet">
    <!-- styles.css contient la charte graphique commune, admin.css contient le style spécifique de l'administration -->
    <link rel="stylesheet" href="styles.css?v=1.5">
    <link rel="stylesheet" href="admin.css?v=1.5">
    <!-- PWA / Compatibilité mobile -->
    <meta name="theme-color" content="#ef4444">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Admin — Inventaire TMC">
    <link rel="apple-touch-icon" href="./images/logo.webp">
</head>
<body>
    <!-- En-tête globale de l'interface d'administration -->
    <header class="app-header">
        <div class="header-container">
            <div class="logo">
                <!-- Image du logo de la caserne avec fallback en icône si absente -->
                <img src="./images/logo.webp" alt="Logo Caserne" id="header-logo-img" style="height: 45px; width: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);">
                <i class="fa-solid fa-truck-fire" style="display: none;"></i>
                <h1>Administration - Inventaire TMC</h1>
            </div>
            <div class="header-actions">
                <!-- Affiche le nom de l'administrateur connecté, géré par admin.js -->
                <span id="user-display" class="auth-badge" style="display: none;">
                    <i class="fa-solid fa-user"></i> <span id="username-span">Utilisateur</span>
                </span>
                <!-- Bouton de déconnexion, s'affiche si connecté -->
                <button id="logout-btn" class="btn btn-outline" style="display: none;">
                    <i class="fa-solid fa-right-from-bracket"></i> Déconnexion
                </button>
                <!-- Bouton retour rapide vers le portail public -->
                <a href="index.php" class="btn btn-outline">
                    <i class="fa-solid fa-arrow-left"></i> Retour au site
                </a>
            </div>
        </div>
    </header>

    <!-- Conteneur principal (Single Page Application - Affichage par vue active) -->
    <main>
        <!-- =================================================================== -->
        <!-- VUE 1 : FORMULAIRE DE CONNEXION (S'affiche si non connecté) -->
        <!-- =================================================================== -->
        <div id="login-view" class="view active">
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <i class="fa-solid fa-shield-halved login-icon"></i>
                        <h2>Connexion requise</h2>
                        <p>Veuillez vous authentifier pour accéder à l'interface d'administration.</p>
                    </div>
                    <form id="login-form">
                        <!-- Champ Identifiant (nom_prenom) -->
                        <div class="form-group">
                            <label for="login-username">Identifiant (nom_prenom) :</label>
                            <input type="text" id="login-username" required placeholder="Exemple: chatard_sylvain">
                        </div>
                        <!-- Champ Mot de passe (Matricule) -->
                        <div class="form-group">
                            <label for="login-password">Mot de passe (Matricule) :</label>
                            <input type="password" id="login-password" required placeholder="Votre matricule">
                        </div>
                        <!-- Alerte en cas d'erreur de connexion -->
                        <div id="login-error" class="alert alert-danger" style="display: none;"></div>
                        <button type="submit" class="btn btn-primary btn-block">
                            <i class="fa-solid fa-lock-open"></i> Se connecter
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <!-- =================================================================== -->
        <!-- VUE 2 : TABLEAU DE BORD (S'affiche après connexion réussie) -->
        <!-- =================================================================== -->
        <div id="dashboard-view" class="view">
            <div class="dashboard-header">
                <h2>Tableau de Bord</h2>
                <p>Gerez le parc de véhicules, les lots et les comptes administrateurs.</p>
            </div>

            <!-- Barre d'onglets -->
            <div class="dash-tabs">
                <button class="dash-tab active" data-tab="tab-alerts">
                    <i class="fa-solid fa-bell"></i>
                    <span>Alertes</span>
                    <span id="alerts-badge" class="tab-badge" style="display:none;"></span>
                </button>
                <button class="dash-tab" data-tab="tab-admins">
                    <i class="fa-solid fa-users-gear"></i>
                    <span>Admins</span>
                </button>
                <button class="dash-tab" data-tab="tab-vehicles">
                    <i class="fa-solid fa-truck-medical"></i>
                    <span>Véhicules</span>
                </button>
                <button class="dash-tab" data-tab="tab-inventory-history">
                    <i class="fa-solid fa-clipboard-check"></i>
                    <span>Historique Inventaires</span>
                </button>
            </div>

            <!-- ONGLET 1 : Alertes -->
            <div id="tab-alerts" class="dash-tab-panel active">
                <div class="admin-card" id="alerts-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-bell"></i> Alertes Matériel (En cours)</h3>
                    </div>
                    <!-- Vue tableau (desktop) -->
                    <div class="table-container desktop-only">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Véhicule & Emplacement</th>
                                    <th>Matériel</th>
                                    <th>Type</th>
                                    <th>Commentaire</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="alerts-list-tbody">
                                <!-- Lignes injectées dynamiquement par admin.js -->
                            </tbody>
                        </table>
                    </div>
                    <!-- Vue cards (mobile) -->
                    <div id="alerts-cards-list" class="mobile-cards-list mobile-only"></div>
                </div>
            </div>

            <!-- ONGLET 2 : Administrateurs -->
            <div id="tab-admins" class="dash-tab-panel">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-users-gear"></i> Administrateurs</h3>
                        <button id="btn-add-user" class="btn btn-primary btn-sm">
                            <i class="fa-solid fa-plus"></i> Ajouter un compte
                        </button>
                    </div>
                    <!-- Vue tableau (desktop) -->
                    <div class="table-container desktop-only">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Identifiant</th>
                                    <th>E-mail</th>
				    <th>Rôle</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="users-list-tbody">
                                <!-- Lignes injectées dynamiquement par admin.js -->
                            </tbody>
                        </table>
                    </div>
                    <!-- Vue cards (mobile) -->
                    <div id="users-cards-list" class="mobile-cards-list mobile-only"></div>
                </div>

                <!-- Card QR Code d'accès au site -->
                <div class="admin-card" style="margin-top: 1.5rem;">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-qrcode"></i> QR Code d'accès au site</h3>
                    </div>
                    <div style="padding: 1rem 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1rem;">
                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
                            <i class="fa-solid fa-circle-info"></i>
                            Ce QR code permet aux utilisateurs d'accéder au site en déposant le cookie d'autorisation dans leur navigateur.
                        </p>
                        <button id="btn-show-access-qrcode" class="btn btn-outline">
                            <i class="fa-solid fa-qrcode"></i> Générer le QR Code d'accès
                        </button>
                        <div id="access-qrcode-container" style="display: none; flex-direction: column; align-items: center; gap: 0.75rem; width: 100%;">
                            <div id="access-qrcode-img" style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); display: inline-block;"></div>
                            <p id="access-qrcode-url" style="font-size: 0.75rem; color: var(--text-secondary); word-break: break-all; text-align: center; max-width: 300px;"></p>
                            <button id="btn-print-access-qrcode" class="btn btn-outline btn-sm">
                                <i class="fa-solid fa-print"></i> Imprimer
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ONGLET 3 : Véhicules -->
            <div id="tab-vehicles" class="dash-tab-panel">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-truck-medical"></i> Véhicules et Lots</h3>
                        <div class="admin-card-actions">
                            <button id="btn-print-all-qrcodes" class="btn btn-outline btn-sm">
                                <i class="fa-solid fa-print"></i> Imprimer QR-Codes
                            </button>
                            <button id="btn-regenerate-qrcodes" class="btn btn-outline btn-sm">
                                <i class="fa-solid fa-rotate-right"></i> Regénérer
                            </button>
                            <button id="btn-add-vehicle" class="btn btn-primary btn-sm">
                                <i class="fa-solid fa-plus"></i> Ajouter
                            </button>
                        </div>
                    </div>
                    <!-- Vue tableau (desktop) -->
                    <div class="table-container desktop-only">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="vehicles-list-tbody">
                                <!-- Lignes injectées dynamiquement par admin.js -->
                            </tbody>
                        </table>
                    </div>
                    <!-- Vue cards (mobile) -->
                    <div id="vehicles-cards-list" class="mobile-cards-list mobile-only"></div>
                </div>
            </div>

            <!-- ONGLET 4 : Historique des inventaires (traçabilité du processus de vérification) -->
            <div id="tab-inventory-history" class="dash-tab-panel">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-clipboard-check"></i> Historique des Inventaires</h3>
                        <div class="admin-card-actions">
                            <label for="inventory-history-filter" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color: var(--text-secondary);">
                                Véhicule :
                                <select id="inventory-history-filter" style="padding: 0.4rem 0.6rem; border-radius: var(--radius-md); background-color: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-primary); font-family: inherit;">
                                    <option value="">Tous les véhicules</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <!-- Vue tableau (desktop) -->
                    <div class="table-container desktop-only">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Véhicule</th>
                                    <th>Agent(s)</th>
                                    <th>Début</th>
                                    <th>Fin</th>
                                    <th>Pointage</th>
                                    <th>Matériel non vérifié</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="inventory-history-tbody">
                                <!-- Lignes injectées dynamiquement par admin.js -->
                            </tbody>
                        </table>
                    </div>
                    <!-- Vue cards (mobile) -->
                    <div id="inventory-history-cards-list" class="mobile-cards-list mobile-only"></div>
                </div>
            </div>

        </div>

        <!-- =================================================================== -->
        <!-- VUE 3 : ÉDITEUR D'INVENTAIRE DE VÉHICULE (Création / Modification) -->
        <!-- =================================================================== -->
        <div id="editor-view" class="view">
            <div class="editor-header">
                <!-- Annulation sécurisée avec demande de confirmation -->
                <button id="btn-editor-back" class="btn btn-text">
                    <i class="fa-solid fa-arrow-left"></i> Annuler et Retour
                </button>
                <h2 id="editor-title">Édition du véhicule</h2>
            </div>

            <div class="editor-container">
                <!-- Panneau de gauche : Métadonnées du véhicule (nom, image, description) -->
                <div class="editor-sidebar">
                    <div class="admin-card">
                        <h3>Informations Générales</h3>
                        <!-- Formulaire métadonnées (soumission interceptée par admin.js pour éviter le rechargement) -->
                        <form id="vehicle-meta-form" style="margin-top: 1rem;">
                            <div class="form-group">
                                <label for="edit-vehicle-id">Identifiant unique (minuscules, chiffres, tirets) :</label>
                                <input type="text" id="edit-vehicle-id" required placeholder="Exemple: vsav-2">
                            </div>
                            <div class="form-group">
                                <label for="edit-vehicle-name">Nom du véhicule :</label>
                                <input type="text" id="edit-vehicle-name" required placeholder="Exemple: VSAV 2">
                            </div>
                            <div class="form-group">
                                <label for="edit-vehicle-type">Type :</label>
                                <select id="edit-vehicle-type" required>
                                    <option value="Véhicule">Véhicule</option>
                                    <option value="Remorque">Remorque</option>
                                    <option value="Lot">Lot</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="edit-vehicle-responsible">Responsable Matériel :</label>
                                <select id="edit-vehicle-responsible">
                                    <option value="">-- Aucun responsable assigné --</option>
                                    <!-- Options injectées par admin.js -->
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="edit-vehicle-desc">Description :</label>
                                <textarea id="edit-vehicle-desc" rows="3" placeholder="Description courte..."></textarea>
                            </div>
                            <div class="form-group">
                                <label for="edit-vehicle-icon">Icône FontAwesome :</label>
                                <input type="text" id="edit-vehicle-icon" placeholder="Ex: fa-ambulance">
                            </div>
                            <div class="form-group">
                                <label for="edit-vehicle-image">Chemin de l'image (URL/Local) :</label>
                                <input type="text" id="edit-vehicle-image" placeholder="Ex: ./images/vsav.jpg">
                                
                                <!-- Zone de téléversement (Upload) AJAX d'images -->
                                <div class="upload-wrapper" style="margin-top: 0.5rem;">
                                    <label class="btn btn-outline btn-block text-center" style="cursor: pointer;">
                                        <i class="fa-solid fa-upload"></i> Envoyer une image (.png, .jpg)
                                        <input type="file" id="image-upload-input" accept="image/*" style="display: none;">
                                    </label>
                                    <div id="upload-status" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-secondary);"></div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Panneau de droite : Éditeur des emplacements et du matériel associé -->
                <div class="editor-main">
                    <div class="admin-card">
                        <div class="admin-card-header">
                            <h3>Localisations physiques</h3>
                            <button id="btn-add-location" class="btn btn-outline btn-sm">
                                <i class="fa-solid fa-plus"></i> Nouvelle localisation
                            </button>
                        </div>
                        <!-- Zone peuplée dynamiquement avec les emplacements (locBox) par admin.js -->
                        <div id="locations-editor-list" style="margin-top: 1rem;">
                            <!-- Injecté par renderEditorLocations() -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Barre d'action fixe collée en bas de l'écran pour la sauvegarde globale -->
            <div class="save-action-bar">
                <button id="btn-save-all" class="btn btn-primary btn-lg">
                    <i class="fa-solid fa-save"></i> Enregistrer toutes les modifications du véhicule
                </button>
            </div>
        </div>

        <!-- =================================================================== -->
        <!-- 4. FENÊTRES MODALES (Création d'administrateurs) -->
        <!-- =================================================================== -->
        <div id="user-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="user-modal-title">Nouvel Administrateur</h3>
                    <!-- Bouton croix pour fermer -->
                    <span class="close-modal">&times;</span>
                </div>
                <form id="user-form">
                    <!-- Champ caché pour stocker l'ID lors d'une modification -->
                    <input type="hidden" id="user-id" value="">
                    <div class="form-group">
                        <label for="user-login">Identifiant de connexion (nom_prenom) :</label>
                        <input type="text" id="user-login" required placeholder="Ex: chatard_sylvain">
                    </div>
                    <div class="form-group">
                        <label for="user-name">Nom complet à afficher :</label>
                        <input type="text" id="user-name" required placeholder="Ex: Sylvain Chatard">
                    </div>
                    <div class="form-group">
                        <label for="user-email">Adresse e-mail (pour alertes) :</label>
                        <input type="email" id="user-email" placeholder="Ex: responsable@caserne.fr">
                    </div>
		    <div class="form-group">
    			<label for="user-role">Rôle :</label>
    			<select id="user-role">
                            <option value="admin">Administrateur</option>
                            <option value="infirmier">Infirmier (PISU)</option>
    			</select>
		    </div>
                    <div class="form-group">
                        <label for="user-password" id="user-password-label">Mot de passe (N° de Matricule) :</label>
                        <input type="password" id="user-password" placeholder="Saisir le matricule">
                        <small id="user-password-hint" style="color: var(--text-secondary); display: none; margin-top: 0.25rem; font-size: 0.8rem;">
                            <i class="fa-solid fa-circle-info"></i> Laisser vide pour conserver le mot de passe actuel.
                        </small>
                    </div>
                    <!-- Zone d'erreur -->
                    <div id="user-error" class="alert alert-danger" style="display: none;"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline close-modal-btn">Annuler</button>
                        <button type="submit" id="user-submit-btn" class="btn btn-primary">Créer le compte</button>
                    </div>
                </form>
            </div>
        </div>
    </main>

    <!-- =================================================================== -->
    <!-- 5. MODALE DE CLONAGE DE VÉHICULE                                    -->
    <!-- =================================================================== -->
    <div id="clone-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="clone-modal-title"><i class="fa-solid fa-copy"></i> Cloner le véhicule</h3>
                <span class="close-modal" id="clone-modal-close">&times;</span>
            </div>
            <p id="clone-modal-desc" style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 1.25rem 0;">
                Une copie complète du véhicule et de tout son inventaire sera créée.
                Les vignettes de matériel existantes seront reprises dans le clone.
            </p>
            <form id="clone-form">
                <input type="hidden" id="clone-source-id" value="">
                <div class="form-group">
                    <label for="clone-new-id">Identifiant unique du clone (minuscules, chiffres, tirets) :</label>
                    <input type="text" id="clone-new-id" required placeholder="Ex: vsav-2" pattern="[a-zA-Z0-9\-]+" title="Lettres, chiffres et tirets uniquement">
                </div>
                <div class="form-group">
                    <label for="clone-new-name">Nom du véhicule cloné :</label>
                    <input type="text" id="clone-new-name" required placeholder="Ex: VSAV 2">
                </div>
                <div id="clone-error" class="alert alert-danger" style="display: none;"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" id="clone-modal-cancel">Annuler</button>
                    <button type="submit" id="clone-submit-btn" class="btn btn-primary">
                        <i class="fa-solid fa-copy"></i> Confirmer le clonage
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Zone d'impression dédiée aux QR-Codes (masquée par défaut à l'écran, affichée lors du print) -->
    <div id="print-section"></div>

    <!-- Zone d'impression dédiée aux livrets d'inventaire plastifiables (masquée par défaut à l'écran) -->
    <div id="print-booklet-section"></div>

    <!-- Chargement du moteur JavaScript d'administration -->
    <script src="admin.js?v=1.6"></script>
    <!-- Bibliothèque QRCode.js pour la génération du QR code d'accès -->
    <script src="qrcode.min.js?v1.0"></script>

    <!-- URL d'accès injectée par PHP, sous forme de données (non exécutable, donc non concerné
         par la Content-Security-Policy script-src) plutôt que dans un <script> classique.
         admin-qrcode.js la lit et génère le QR code. -->
    <script type="application/json" id="access-url-data"><?php echo json_encode($url_acces); ?></script>
    <script src="admin-qrcode.js?v=1.0"></script>
</body>
</html>