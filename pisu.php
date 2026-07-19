<?php
/**
 * pisu.php
 * Page de gestion du PISU (Protocole Infirmier de Soins d'Urgence).
 * Affichage et gestion des médicaments après authentification.
 * 
 * Structure :
 * - Vue 1 : Modal de connexion (si non authentifié)
 * - Vue 2 : Tableau de bord PISU (si authentifié)
 */

session_start();

// Vérification du cookie d'accès (QR-code)
if (!isset($_COOKIE['site_autorise']) || $_COOKIE['site_autorise'] !== 'oui') {
    header('HTTP/1.0 403 Forbidden');
    echo "<h1>Accès réservé - CT Taluyers / Montagny / Chassagny</h1><p>Veuillez scanner le QR code officiel pour accéder au site.</p>";
    exit();
}

$isAuthenticated = isset($_SESSION['pisu_logged_in']) && $_SESSION['pisu_logged_in'] === true;
$userName = isset($_SESSION['pisu_user_name']) ? $_SESSION['pisu_user_name'] : 'Infirmier';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PISU - Inventaire TMC</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
	<script src="https://kit.fontawesome.com/8952ed96c6.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="styles.css?v=<?= filemtime('styles.css') ?>">
    <link rel="stylesheet" href="admin.css?v=<?= filemtime('admin.css') ?>">
    <meta name="theme-color" content="#ef4444">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="PISU TMC">
    <link rel="apple-touch-icon" href="./images/logo.webp">
</head>
<body>
    <header class="app-header">
        <div class="header-container">
            <div class="logo">
                <img src="./images/logo.webp" alt="Logo" style="height: 45px; width: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
                <i class="fa-solid fa-briefcase-medical" style="display: none;"></i>
                <h1>PISU - Inventaire TMC</h1>
            </div>
            <div class="header-actions">
                <?php if ($isAuthenticated): ?>
                    <span id="user-display" class="auth-badge">
                        <i class="fa-solid fa-user-nurse"></i> <span id="username-span"><?php echo htmlspecialchars($userName); ?></span>
                    </span>
                    <button id="logout-btn" class="btn btn-outline">
                        <i class="fa-solid fa-right-from-bracket"></i> Déconnexion
                    </button>
                <?php endif; ?>
                <a href="index.php" class="btn btn-outline">
                    <i class="fa-solid fa-arrow-left"></i> Retour au site
                </a>
            </div>
        </div>
    </header>

    <main>
        <!-- VUE 1 : FORMULAIRE DE CONNEXION -->
        <div id="login-view" class="view <?php echo $isAuthenticated ? '' : 'active'; ?>">
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <i class="fa-solid fa-briefcase-medical login-icon"></i>
                        <h2>PISU - Connexion</h2>
                        <p>Identifiez-vous pour accéder à votre espace de gestion des médicaments.</p>
                    </div>
                    <form id="login-form">
                        <div class="form-group">
                            <label for="login-username">Identifiant :</label>
                            <input type="text" id="login-username" required placeholder="Votre identifiant">
                        </div>
                        <div class="form-group">
                            <label for="login-password">Mot de passe :</label>
                            <input type="password" id="login-password" required placeholder="Votre mot de passe">
                        </div>
                        <div id="login-error" class="alert alert-danger" style="display: none;"></div>
                        <button type="submit" class="btn btn-primary btn-block">
                            <i class="fa-solid fa-lock-open"></i> Se connecter
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <!-- VUE 2 : TABLEAU DE BORD PISU -->
        <div id="dashboard-view" class="view <?php echo $isAuthenticated ? 'active' : ''; ?>">
            <div class="dashboard-header">
                <h2><i class="fa-solid fa-pills"></i> Gestion des Médicaments</h2>
                <p>Suivez et gérez l'inventaire du PISU - Protocole Infirmier de Soins d'Urgence.</p>
            </div>

            <!-- Onglets -->
            <div class="dash-tabs">
                <button class="dash-tab active" data-tab="tab-medicines">
                    <i class="fa-solid fa-pills"></i> Médicaments
                </button>
                <button class="dash-tab" data-tab="tab-config">
                    <i class="fa-solid fa-cog"></i> Configuration
                </button>
            </div>

            <!-- ONGLET 1 : Médicaments -->
            <div id="tab-medicines" class="dash-tab-panel active">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-pill"></i> Médicaments du PISU</h3>
                        <button id="btn-add-medicine" class="btn btn-primary btn-sm">
                            <i class="fa-solid fa-plus"></i> Ajouter
                        </button>
                    </div>
                    <!-- Vue Tableau (Desktop) -->
                    <div class="table-container desktop-only">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Dosage</th>
                                    <th>Forme</th>
                                    <th>Quantité</th>
                                    <th>Expiration</th>
                                    <th>Statut</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="medicines-tbody">
                                <!-- Injectée dynamiquement -->
                            </tbody>
                        </table>
                    </div>
                    <!-- Vue Cards (Mobile) -->
                    <div id="medicines-cards" class="mobile-cards-list mobile-only"></div>
                </div>
            </div>

            <!-- ONGLET 2 : Configuration -->
            <div id="tab-config" class="dash-tab-panel">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-cog"></i> Configuration des Alertes</h3>
                    </div>
                    <form id="config-form" style="padding: 1rem 0;">
                        <div class="form-group">
                            <label for="config-alert-days">Nombre de jours avant expiration (alerte) :</label>
                            <input type="number" id="config-alert-days" min="1" max="365" value="30" required>
                            <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">
                                <i class="fa-solid fa-info-circle"></i> Vous recevrez un e-mail si des médicaments expirent dans ce délai.
                            </small>
                        </div>
                        <div class="form-group">
                            <label for="config-email">Adresse e-mail pour les alertes :</label>
                            <input type="email" id="config-email" placeholder="votre.email@caserne.fr">
                            <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">
                                <i class="fa-solid fa-info-circle"></i> Les alertes d'expiration seront envoyées à cette adresse.
                            </small>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                            <button type="button" id="btn-save-config" class="btn btn-primary">
                                <i class="fa-solid fa-save"></i> Enregistrer
                            </button>
                            <button type="button" id="btn-send-alerts-now" class="btn btn-outline">
                                <i class="fa-solid fa-envelope"></i> Tester l'envoi (maintenant)
                            </button>
                        </div>
                        <div id="config-message" style="margin-top: 1rem; display: none;"></div>
                    </form>
                </div>
            </div>
        </div>
    </main>

    <!-- MODALE : Ajout/Modification de médicament -->
    <div id="medicine-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="medicine-modal-title">Ajouter un médicament</h3>
                <span class="close-modal">&times;</span>
            </div>
            <form id="medicine-form">
                <input type="hidden" id="medicine-id" value="">
                <div class="form-group">
                    <label for="medicine-name">Nom du médicament :</label>
                    <input type="text" id="medicine-name" required placeholder="Ex: Paracétamol">
                </div>
                <div class="form-group">
                    <label for="medicine-dosage">Dosage :</label>
                    <input type="text" id="medicine-dosage" placeholder="Ex: 500 mg">
                </div>
                <div class="form-group">
                    <label for="medicine-pharma-form">Forme pharmaceutique :</label>
                    <select id="medicine-pharma-form">
                        <option value="">-- Sélectionner --</option>
                        <option value="Comprimé">Comprimé</option>
                        <option value="Gélule">Gélule</option>
                        <option value="Liquide">Liquide</option>
                        <option value="Injection">Injection</option>
                        <option value="Pommade">Pommade</option>
                        <option value="Spray">Spray</option>
                        <option value="Poudre">Poudre</option>
                        <option value="Autre">Autre</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="medicine-quantity">Quantité :</label>
                    <input type="number" id="medicine-quantity" min="0" value="0" required>
                </div>
                <div class="form-group">
                    <label for="medicine-expiry">Date de péremption (YYYY-MM-DD) :</label>
                    <input type="date" id="medicine-expiry">
                </div>
                <div class="form-group">
                    <label for="medicine-notes">Notes :</label>
                    <textarea id="medicine-notes" rows="2" placeholder="Remarques particulières..."></textarea>
                </div>
                <div id="medicine-error" class="alert alert-danger" style="display: none;"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline close-modal-btn">Annuler</button>
                    <button type="submit" id="medicine-submit-btn" class="btn btn-primary">Ajouter</button>
                </div>
            </form>
        </div>
    </div>

    <script src="pisu.js?v=<?= filemtime('pisu.js') ?>"></script>
</body>
</html>
