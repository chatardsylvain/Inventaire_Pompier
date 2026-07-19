<?php
$logFile = __DIR__ . '/debug_mobiles.txt';
$userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : 'Inconnu';
$ip = $_SERVER['REMOTE_ADDR'];
$date = date('Y-m-d H:i:s');
$cookieState = isset($_COOKIE['site_autorise']) ? $_COOKIE['site_autorise'] : 'ABSENT';

// NOUVELLES INFOS RETROUVÉES
$langue = isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? explode(',', $_SERVER['HTTP_ACCEPT_LANGUAGE'])[0] : 'Inconnue';
$provenance = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : 'Direct/QR-Code';

// Structure mise à jour
$line = "[$date] IP: $ip | Cookie: $cookieState | Langue: $langue | Origine: $provenance | UA: $userAgent\n";
file_put_contents($logFile, $line, FILE_APPEND);

// Vérification stricte du cookie d'accès de la caserne
if (!isset($_COOKIE['site_autorise']) || $_COOKIE['site_autorise'] !== 'oui') {
    header('HTTP/1.0 403 Forbidden');
    echo "<h1>Accès réservé - CT Taluyers / Montagny / Chassagny</h1><p>Veuillez scanner le QR code officiel pour accéder à l'inventaire.</p>";
    exit();
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inventaire CT Taluyers / Montagny / Chassagny</title>
    <!-- Chargement de la police moderne 'Inter' depuis Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
	<link href="css/all.min.css" rel="stylesheet">
    <link rel="stylesheet" href="styles.css?v=1.6">
    <!-- PWA / Compatibilité mobile -->
    <meta name="theme-color" content="#ef4444">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Inventaire TMC">
    <link rel="apple-touch-icon" href="./images/logo.webp">
</head>
<body>
    <!-- En-tête globale de l'application -->
    <header class="app-header">
        <div class="header-container">
            <!-- Zone Logo & Titre de la Caserne -->
            <div class="logo">
                <img src="./images/logo.webp" alt="Logo Caserne" id="header-logo-img" style="height: 45px; width: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);">
                <i class="fa-solid fa-truck-fire" style="display: none;"></i>
                <h1>CT Taluyers / Montagny / Chassagny</h1>
            </div>
            <!-- Zone des actions de navigation (Bouton Accueil / Accès Admin) -->
            <div class="header-actions">
                <!-- Lien vers le portail d'administration modifié vers admin.php -->
                <a href="admin.php" id="admin-btn" class="btn btn-outline">
                    <i class="fa-solid fa-user-gear"></i> Administration
                </a>
                <!-- Bouton Accueil masqué par défaut, géré par script.js dans la vue inventaire -->
                <button id="home-btn" class="btn btn-outline" style="display: none;">
                    <i class="fa-solid fa-home"></i> Accueil
                </button>
            </div>
        </div>
    </header>

    <!-- Conteneur principal (SPA - Changement de vue dynamique) -->
    <main id="app-content">
        
        <!-- =================================================================== -->
        <!-- VUE 1 : ACCUEIL (Grille de tous les véhicules, remorques et lots) -->
        <!-- =================================================================== -->
        <div id="home-view" class="view active">
            <div class="view-header">
                <h2>Parc Roulant & Lots</h2>
                <p>Sélectionnez un véhicule ou un lot pour consulter son inventaire.</p>
            </div>
            <!-- Conteneur injecté dynamiquement par script.js avec les cartes des véhicules -->
            <div class="grid-container" id="vehicles-grid">
                <!-- Les cartes de véhicules seront injectées ici par Javascript -->
            </div>
        </div>

        <!-- =================================================================== -->
        <!-- VUE 2 : INVENTAIRE (Détails d'un véhicule sélectionné) -->
        <!-- =================================================================== -->
        <div id="inventory-view" class="view">
            <!-- En-tête de l'inventaire avec bouton de retour, titre et badge de type -->
            <div class="inventory-header">
                <button id="back-btn" class="btn btn-text">
                    <i class="fa-solid fa-arrow-left"></i> Retour
                </button>
                <h2 id="current-item-title">Nom du Véhicule</h2>
                <span id="current-item-type" class="badge">Type</span>
                <div id="inventory-process-actions" class="inventory-process-actions">
                    <button id="btn-start-inventory" class="btn btn-primary btn-sm">
                        <i class="fa-solid fa-clipboard-check"></i> Démarrer l'inventaire
                    </button>
                    <div id="inventory-progress-badge" class="inventory-progress-badge" style="display: none;"></div>
                    <button id="btn-finish-inventory" class="btn btn-primary btn-sm" style="display: none;">
                        <i class="fa-solid fa-flag-checkered"></i> Fin de l'inventaire
                    </button>
                    <button id="btn-cancel-inventory" class="btn btn-text btn-sm" style="display: none; color: var(--text-secondary);">
                        Annuler
                    </button>
                </div>
            </div>

            <!-- Grille d'inventaire : localisations à gauche (sidebar), liste du matériel à droite -->
            <div class="inventory-container">
                <!-- Sidebar : Emplacements physiques du matériel (ex: Coffre 1, Sac PS...) -->
                <div class="locations-sidebar">
                    <h3><i class="fa-solid fa-map-location-dot"></i> Emplacements</h3>
                    <select id="locations-list" class="locations-select">
                        <!-- Les options d'emplacements seront injectées ici par script.js -->
                    </select>
                </div>

                <!-- Section de droite : Liste des équipements de l'emplacement sélectionné -->
                <div class="equipment-content">
                    <!-- En-tête de la zone d'équipements avec titre de localisation et barre de recherche -->
                    <div class="equipment-header">
                        <h3 id="current-location-title">Sélectionnez un emplacement</h3>
                        <div class="search-bar">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="search-input" placeholder="Rechercher du matériel...">
                        </div>
                    </div>
                    
                    <!-- Tableau affichant la liste du matériel et les quantités -->
                    <div class="table-container">
                        <table class="equipment-table">
                            <thead>
                                <tr>
                                    <th id="inventory-check-header" style="display: none; width: 40px;"><i class="fa-solid fa-check"></i></th>
                                    <th>Matériel</th>
                                    <th class="text-right">Qté Requise</th>
                                </tr>
                            </thead>
                            <tbody id="equipment-tbody">
                                <!-- Les lignes de matériel seront injectées ici par script.js -->
                            </tbody>
                        </table>
                        
                        <!-- État vide (Empty State) s'affiche s'il n'y a pas de matériel ou si aucun résultat ne correspond -->
                        <div id="empty-state" class="empty-state" style="display: none;">
                            <i class="fa-solid fa-box-open"></i>
                            <p>Aucun matériel trouvé dans cet emplacement.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Bouton flottant "Retour en haut" -->
    <button id="scroll-top-btn" aria-label="Retour en haut"><i class="fa-solid fa-arrow-up"></i></button>

    <!-- Optimiseur d'images : charge WebP si supporté, sinon fallback JPEG
         ⚠️ DOIT être chargé AVANT script.js pour optimiser les images au démarrage -->
    <script src="image-optimizer.js?v=1.0" defer></script>

    <!-- Chargement du script principal de l'application publique.
         Le suffixe ?v=1.9 force le rechargement du fichier par le navigateur en cas de modification. -->
    <script src="script.js?v=1.9" defer></script>

</body>
</html>
