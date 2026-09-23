<?php
/*
 * includes/admin_header.php
 * Généré le 2026-09-07
 * Barre de navigation haute : logo, titre, boutons utilisateur/déconnexion/retour
 */
?>
<header class="admin-header">
    <div class="admin-header-left">
        <img src="./images/logo.webp" alt="Logo" id="header-logo-img">
        <span class="admin-header-title">Administration Caserne</span>
    </div>
    <div class="admin-header-right">
        <span id="user-display" class="admin-user-badge" style="display:none;">
            <i class="fa-solid fa-user-shield"></i>
            <span id="username-span">Utilisateur</span>
        </span>
        <button id="logout-btn" class="admin-header-btn" style="display:none;" title="Déconnexion">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span class="admin-header-btn-label"> Déconnexion</span>
        </button>
        <a href="index.php" class="admin-header-btn" title="Retour au site">
            <i class="fa-solid fa-arrow-left"></i>
            <span class="admin-header-btn-label"> Retour</span>
        </a>
    </div>
</header>
