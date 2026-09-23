<?php
/*
 * admin.php
 * Généré le 2026-09-07
 * Point d'entrée admin — orchestre les includes, vérifie le cookie et la session
 * Modifié le 2026-09-02 — Ajout des rôles chef_caserne et adjoint dans la sidebar
 * Modifié le 2026-09-04 — Bouton "Envoyer les alertes" dans section-ct
 * Sections exposées : Véhicules, ASUP, Contr. Technique (périmètre contributeur + resp_veh + pharmacie)
 */

if (!isset($_COOKIE['site_autorise']) || $_COOKIE['site_autorise'] !== 'oui') {
    header('HTTP/1.0 403 Forbidden');
    echo "<h1>Accès réservé - Administration</h1><p>Veuillez scanner le QR code officiel pour accéder à cet espace.</p>";
    exit();
}

require_once __DIR__ . '/api/config.php';

$cle_acces = envVar('CLE_SECRETE_ACCES', '');
$url_acces = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
           . '://' . $_SERVER['HTTP_HOST']
           . rtrim(dirname($_SERVER['PHP_SELF']), '/\\') . '/verifier.php?cle=' . urlencode($cle_acces);
?>
<!DOCTYPE html>
<html lang="fr">
<?php require __DIR__ . '/includes/admin_head.php'; ?>
<body class="admin-layout">
	<?php if (defined('SANDBOX_MODE') && SANDBOX_MODE): ?>
	<div style="background:#f59e0b; color:#000; text-align:center; padding:0.5rem 1rem; font-weight:700; font-size:0.95rem; letter-spacing:0.05em; position:sticky; top:0; z-index:9999;">
    ⚠️ ENVIRONNEMENT SANDBOX — Les données sont fictives
	</div>
	<?php endif; ?>
	
<?php require __DIR__ . '/includes/admin_header.php'; ?>

<!-- ═══════════════ LAYOUT ═══════════════ -->
<div class="admin-body">

    <?php require __DIR__ . '/includes/admin_sidebar.php'; ?>

    <!-- CONTENU PRINCIPAL -->
    <main class="admin-main" id="admin-main">

        <?php require __DIR__ . '/includes/admin_section_users.php'; ?>
        <?php require __DIR__ . '/includes/admin_section_vehicles.php'; ?>
        <?php require __DIR__ . '/includes/admin_section_cleaning.php'; ?>
        <?php require __DIR__ . '/includes/admin_section_asup.php'; ?>
        <?php require __DIR__ . '/includes/admin_section_ct.php'; ?>
        <?php require __DIR__ . '/includes/admin_section_alerts.php'; ?>
        <?php require __DIR__ . '/includes/admin_section_history.php'; ?>

        <?php require __DIR__ . '/includes/admin_editor_view.php'; ?>

    </main>
</div>

<?php require __DIR__ . '/includes/admin_modals.php'; ?>
<?php require __DIR__ . '/includes/admin_scripts.php'; ?>

</body>
</html>
