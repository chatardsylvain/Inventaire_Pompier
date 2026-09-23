<?php
/*
 * index.php
 * Généré le 2026-09-07
 * Corrections : suppression bloc debug, filemtime() sur styles.css, nettoyage fa-truck-fire
 */

if (!isset($_COOKIE['site_autorise']) || $_COOKIE['site_autorise'] !== 'oui') {
    header('HTTP/1.0 403 Forbidden');
    echo "<h1>Accès réservé - Nom du Centre de Secours</h1><p>Veuillez scanner le QR code officiel pour accéder à l'inventaire.</p>";
    exit();
}
require_once __DIR__ . '/api/config.php';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inventaire Nom du Centre de Secours</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="css/all.min.css?v=<?= filemtime(__DIR__ . '/css/all.min.css') ?>" rel="stylesheet">
    <link rel="stylesheet" href="styles.css?v=<?= filemtime(__DIR__ . '/styles.css') ?>">
    <meta name="theme-color" content="#ef4444">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Inventaire Pompier">
    <link rel="apple-touch-icon" href="./images/logo.webp">
</head>
<body>
	<?php if (defined('SANDBOX_MODE') && SANDBOX_MODE): ?>
		<div style="background:#f59e0b; color:#000; text-align:center; padding:0.5rem 1rem; font-weight:700; font-size:0.95rem; letter-spacing:0.05em; position:sticky; top:0; z-index:9999;">
			�s�️ ENVIRONNEMENT SANDBOX �?" Les données sont fictives
		</div>
	<?php endif; ?>
    <header class="app-header">
        <div class="header-container">
            <div class="logo">
                <img src="./images/logo.webp" alt="Logo Caserne" id="header-logo-img" style="height: 45px; width: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);">
                <h1>Nom du Centre de Secours</h1>
            </div>
            <div class="header-actions">
                <a href="admin.php" id="admin-btn" class="btn btn-outline">
                    <i class="fa-solid fa-user-gear"></i> Administration
                </a>
                <button id="home-btn" class="btn btn-outline" style="display: none;">
                    <i class="fa-solid fa-home"></i> Accueil
                </button>
            </div>
        </div>
    </header>

    <main id="app-content">

        <div id="home-view" class="view active">
            <div class="view-header">
                <h2>Parc Roulant & Lots</h2>
                <p>Sélectionnez un véhicule ou un lot pour consulter son inventaire.</p>
            </div>
            <div class="grid-container" id="vehicles-grid"></div>
        </div>

        <div id="inventory-view" class="view">
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
                    <button id="btn-force-restart-inventory" class="btn btn-outline btn-sm" style="display: none; border-color: var(--primary-color); color: var(--primary-color); padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                        <i class="fa-solid fa-rotate-right"></i> �?craser
                    </button>
                </div>
            </div>

            <div class="inventory-container">
                <div class="locations-sidebar">
                    <h3><i class="fa-solid fa-map-location-dot"></i> Emplacements</h3>
                    <select id="locations-list" class="locations-select"></select>
                </div>

                <div class="equipment-content">
                    <div class="equipment-header">
                        <h3 id="current-location-title">Sélectionnez un emplacement</h3>
                        <div class="search-bar">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="search-input" placeholder="Rechercher du matériel...">
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="equipment-table">
                            <thead>
                                <tr>
                                    <th id="inventory-check-header" style="display: none; width: 40px; text-align: center;">
                                        <input type="checkbox" id="inventory-check-all" title="Tout sélectionner/désélectionner" style="transform: scale(1.3); cursor: pointer;">
                                    </th>
                                    <th>Matériel</th>
                                    <th class="text-right">Qté Requise</th>
                                </tr>
                            </thead>
                            <tbody id="equipment-tbody"></tbody>
                        </table>

                        <div id="empty-state" class="empty-state" style="display: none;">
                            <i class="fa-solid fa-box-open"></i>
                            <p>Aucun matériel trouvé dans cet emplacement.</p>
                        </div>
                    </div>
                    <div id="next-location-bar" style="display:none; padding:1rem 1.5rem; border-top:1px solid var(--border-color); text-align:center;">
                        <button id="btn-next-location" class="btn btn-outline" style="width:100%; max-width:360px;">
                            <i class="fa-solid fa-arrow-right"></i> Emplacement suivant
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <button id="scroll-top-btn" aria-label="Retour en haut"><i class="fa-solid fa-arrow-up"></i></button>

    <script src="image-optimizer.js?v=<?= filemtime(__DIR__ . '/image-optimizer.js') ?>" defer></script>
    <script src="script.js?v=<?= filemtime(__DIR__ . '/script.js') ?>" defer></script>
    <!-- Module CT public : badges CT sur les cartes véhicules -->
    <script src="ct-public.js?v=<?= filemtime(__DIR__ . '/ct-public.js') ?>" defer></script>

</body>
</html>
