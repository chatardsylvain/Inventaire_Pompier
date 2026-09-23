<?php
/**
 * pisu.php �?" version multi-infirmiers
 * Flow : sélection infirmier �?' login �?' dashboard médicaments
 */

session_start();

if (!isset($_COOKIE['site_autorise']) || $_COOKIE['site_autorise'] !== 'oui') {
    header('HTTP/1.0 403 Forbidden');
    echo "<h1>Accès réservé - Nom du Centre de Secours</h1><p>Veuillez scanner le QR code officiel pour accéder au site.</p>";
    exit();
}

$isAuthenticated = (isset($_SESSION['pisu_logged_in']) && $_SESSION['pisu_logged_in'] === true)
                || (isset($_SESSION['logged_in'])      && $_SESSION['logged_in']      === true
                    && isset($_SESSION['pisu_user_login']));

$userName  = isset($_SESSION['pisu_user_name'])  ? $_SESSION['pisu_user_name']  : '';
$userLogin = isset($_SESSION['pisu_user_login']) ? $_SESSION['pisu_user_login'] : '';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PISU - Inventaire Pompier</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="css/all.min.css?v=<?= filemtime(__DIR__ . '/css/all.min.css') ?>" rel="stylesheet">
    <link rel="stylesheet" href="styles.css?v=<?= filemtime('styles.css') ?>">
    <link rel="stylesheet" href="admin.css?v=<?= filemtime('admin.css') ?>">
    <meta name="theme-color" content="#ef4444">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="PISU Caserne">
    <link rel="apple-touch-icon" href="./images/logo.webp">
    <style>
        /* �"?�"? Sélection infirmier �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */
        .infirmier-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1.5rem;
        }
        .infirmier-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
            padding: 1.5rem 1rem;
            background: var(--card-bg, #1e293b);
            border: 2px solid var(--border-color, #334155);
            border-radius: 12px;
            cursor: pointer;
            transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
            text-align: center;
            user-select: none;
        }
        .infirmier-card:hover {
            border-color: #ef4444;
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(239,68,68,0.2);
        }
        .infirmier-card:active {
            transform: translateY(0);
        }
        .infirmier-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ef4444, #b91c1c);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: #fff;
            font-weight: 700;
            flex-shrink: 0;
        }
        .infirmier-name {
            font-weight: 600;
            font-size: 0.95rem;
            color: var(--text-primary, #f1f5f9);
            line-height: 1.3;
        }
        .infirmier-card-loading {
            opacity: 0.5;
            pointer-events: none;
        }
        /* �"?�"? �?tape badge �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */
        .step-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
            font-size: 0.85rem;
            color: var(--text-secondary, #94a3b8);
        }
        .step-indicator .step-sep { margin: 0 0.25rem; }
        .step-indicator .step-active { color: #ef4444; font-weight: 600; }
        /* �"?�"? Login avec contexte infirmier �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */
        .selected-infirmier-badge {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: var(--card-bg, #1e293b);
            border: 1px solid var(--border-color, #334155);
            border-radius: 10px;
            padding: 0.75rem 1rem;
            margin-bottom: 1.25rem;
        }
        .selected-infirmier-badge .avatar-sm {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ef4444, #b91c1c);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 700;
            font-size: 0.9rem;
            flex-shrink: 0;
        }
        .selected-infirmier-badge .inf-info { flex: 1; min-width: 0; }
        .selected-infirmier-badge .inf-info strong {
            display: block;
            font-size: 0.95rem;
            color: var(--text-primary, #f1f5f9);
        }
        .selected-infirmier-badge .inf-info small {
            color: var(--text-secondary, #94a3b8);
            font-size: 0.78rem;
        }
        .btn-change-infirmier {
            background: none;
            border: none;
            color: #ef4444;
            cursor: pointer;
            font-size: 0.82rem;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            white-space: nowrap;
            transition: background 0.15s;
        }
        .btn-change-infirmier:hover { background: rgba(239,68,68,0.1); }
        /* �"?�"? Loading spinner �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */
        .pisu-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 1rem;
            gap: 1rem;
            color: var(--text-secondary, #94a3b8);
        }
        .pisu-loading i { font-size: 2rem; color: #ef4444; }
    </style>
</head>
<body>
    <header class="app-header">
        <div class="header-container">
            <div class="logo">
                <img src="./images/logo.webp" alt="Logo" id="pisu-logo"
                     style="height:45px;width:45px;border-radius:50%;object-fit:cover;border:2px solid var(--border-color);">
                <i class="fa-solid fa-briefcase-medical" id="pisu-logo-fallback" style="display:none;"></i>
                <h1>PISU - Inventaire Pompier</h1>
            </div>
            <div class="header-actions">
                <?php if ($isAuthenticated): ?>
                    <span id="user-display" class="auth-badge">
                        <i class="fa-solid fa-user-nurse"></i>
                        <span id="username-span"><?= htmlspecialchars($userName) ?></span>
                    </span>
                    <button id="logout-btn" class="btn btn-outline">
                        <i class="fa-solid fa-right-from-bracket"></i> Déconnexion
                    </button>
                <?php else: ?>
                    <span id="user-display" class="auth-badge" style="display:none;">
                        <i class="fa-solid fa-user-nurse"></i>
                        <span id="username-span"></span>
                    </span>
                    <button id="logout-btn" class="btn btn-outline" style="display:none;">
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

        <!-- �.��.��.� VUE 1 : S�?LECTION INFIRMIER �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� -->
        <div id="select-view" class="view <?= $isAuthenticated ? '' : 'active' ?>">
            <div class="login-container">
                <div class="login-card" style="max-width:560px;">
                    <div class="login-header">
                        <i class="fa-solid fa-briefcase-medical login-icon"></i>
                        <h2>PISU �?" Espace Infirmier</h2>
                        <p>Sélectionnez votre compte pour accéder à votre inventaire de médicaments.</p>
                    </div>
                    <div id="infirmier-loading" class="pisu-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <span>Chargement des comptes�?�</span>
                    </div>
                    <div id="infirmier-grid" class="infirmier-grid" style="display:none;"></div>
                    <div id="infirmier-error" class="alert alert-danger" style="display:none;margin-top:1rem;"></div>
                </div>
            </div>
        </div>

        <!-- �.��.��.� VUE 2 : LOGIN �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� -->
        <div id="login-view" class="view">
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <i class="fa-solid fa-lock login-icon"></i>
                        <h2>Connexion</h2>
                    </div>

                    <!-- Badge infirmier sélectionné -->
                    <div id="selected-infirmier-badge" class="selected-infirmier-badge" style="display:none;">
                        <div class="avatar-sm" id="badge-avatar"></div>
                        <div class="inf-info">
                            <strong id="badge-name"></strong>
                            <small>Entrez votre mot de passe pour continuer</small>
                        </div>
                        <button type="button" class="btn-change-infirmier" id="btn-change-infirmier">
                            <i class="fa-solid fa-arrow-left"></i> Changer
                        </button>
                    </div>

                    <form id="login-form">
                        <input type="hidden" id="login-username" value="">
                        <div class="form-group">
                            <label for="login-password">Mot de passe :</label>
                            <input type="password" id="login-password" required placeholder="Votre mot de passe" autocomplete="current-password">
                        </div>
                        <div id="login-error" class="alert alert-danger" style="display:none;"></div>
                        <button type="submit" class="btn btn-primary btn-block">
                            <i class="fa-solid fa-lock-open"></i> Se connecter
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <!-- �.��.��.� VUE 3 : DASHBOARD �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� -->
        <div id="dashboard-view" class="view <?= $isAuthenticated ? 'active' : '' ?>">
            <div class="dashboard-header">
                <h2><i class="fa-solid fa-pills"></i> Gestion des Médicaments</h2>
                <p id="dashboard-subtitle">Inventaire PISU �?" Protocole Infirmier de Soins d'Urgence.</p>
            </div>

            <div class="dash-tabs">
                <button class="dash-tab active" data-tab="tab-medicines">
                    <i class="fa-solid fa-pills"></i> Médicaments
                </button>
                <button class="dash-tab" data-tab="tab-config">
                    <i class="fa-solid fa-cog"></i> Configuration
                </button>
            </div>

            <!-- Onglet Médicaments -->
            <div id="tab-medicines" class="dash-tab-panel active">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-pill"></i> Médicaments du PISU</h3>
                        <button id="btn-add-medicine" class="btn btn-primary btn-sm">
                            <i class="fa-solid fa-plus"></i> Ajouter
                        </button>
                    </div>
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
                            <tbody id="medicines-tbody"></tbody>
                        </table>
                    </div>
                    <div id="medicines-cards" class="mobile-cards-list mobile-only"></div>
                </div>
            </div>

            <!-- Onglet Config -->
            <div id="tab-config" class="dash-tab-panel">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3><i class="fa-solid fa-cog"></i> Configuration des Alertes</h3>
                    </div>
                    <form id="config-form" style="padding:1rem 0;">
                        <div class="form-group">
                            <label for="config-alert-days">Nombre de jours avant expiration (alerte) :</label>
                            <input type="number" id="config-alert-days" min="1" max="365" value="30" required>
                            <small style="color:var(--text-secondary);display:block;margin-top:0.5rem;">
                                <i class="fa-solid fa-info-circle"></i> Vous recevrez un e-mail si des médicaments expirent dans ce délai.
                            </small>
                        </div>
                        <div class="form-group">
                            <label for="config-email">Adresse e-mail pour les alertes :</label>
                            <input type="email" id="config-email" placeholder="votre.email@caserne.fr">
                            <small style="color:var(--text-secondary);display:block;margin-top:0.5rem;">
                                <i class="fa-solid fa-info-circle"></i> Les alertes d'expiration seront envoyées à cette adresse.
                            </small>
                        </div>
                        <div style="display:flex;gap:1rem;margin-top:1.5rem;">
                            <button type="button" id="btn-save-config" class="btn btn-primary">
                                <i class="fa-solid fa-save"></i> Enregistrer
                            </button>
                            <button type="button" id="btn-send-alerts-now" class="btn btn-outline">
                                <i class="fa-solid fa-envelope"></i> Tester l'envoi (maintenant)
                            </button>
                        </div>
                        <div id="config-message" style="margin-top:1rem;display:none;"></div>
                    </form>
                </div>
            </div>
        </div>

    </main>

    <!-- Modale ajout/modification médicament -->
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
                    <label for="medicine-expiry">Date de péremption :</label>
                    <input type="date" id="medicine-expiry">
                </div>
                <div class="form-group">
                    <label for="medicine-notes">Notes :</label>
                    <textarea id="medicine-notes" rows="2" placeholder="Remarques particulières�?�"></textarea>
                </div>
                <div id="medicine-error" class="alert alert-danger" style="display:none;"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline close-modal-btn">Annuler</button>
                    <button type="submit" id="medicine-submit-btn" class="btn btn-primary">Ajouter</button>
                </div>
            </form>
        </div>
    </div>

    <script>
    // Données PHP �?' JS
    const PISU_IS_AUTH   = <?= $isAuthenticated ? 'true' : 'false' ?>;
    const PISU_USER_NAME = <?= json_encode($userName) ?>;
    const PISU_USER_LOGIN= <?= json_encode($userLogin) ?>;
    </script>
    <script src="pisu.js?v=<?= filemtime('pisu.js') ?>"></script>
</body>
</html>
