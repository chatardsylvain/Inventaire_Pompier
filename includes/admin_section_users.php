<?php
/*
 * includes/admin_section_users.php
 * Généré le 2026-09-07
 * Vue connexion (login-view) + section Utilisateurs + QR code d'accès
 */
?>

<!-- ── VUE CONNEXION ── -->
<div id="login-view" class="admin-view active">
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <i class="fa-solid fa-shield-halved login-icon"></i>
                <h2>Connexion requise</h2>
                <p>Veuillez vous authentifier pour accéder à l'interface d'administration.</p>
            </div>
            <form id="login-form">
                <div class="form-group">
                    <label for="login-username">Identifiant (nom_prenom) :</label>
                    <input type="text" id="login-username" required placeholder="Exemple: chatard_sylvain">
                </div>
                <div class="form-group">
                    <label for="login-password">Mot de passe (Matricule) :</label>
                    <input type="password" id="login-password" required placeholder="Votre matricule">
                </div>
                <div id="login-error" class="alert alert-danger" style="display:none;"></div>
                <button type="submit" class="btn btn-primary btn-block">
                    <i class="fa-solid fa-lock-open"></i> Se connecter
                </button>
            </form>
        </div>
    </div>
</div>

<!-- ── VUE DASHBOARD ── -->
<div id="dashboard-view" class="admin-view">

    <!-- SECTION 1 : Utilisateurs -->
    <section id="section-users" class="admin-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-users"></i> Utilisateurs</h2>
            <div class="section-actions">
                <button id="btn-save-user-roles" class="btn btn-outline btn-sm" disabled>
                    <i class="fa-solid fa-check"></i> Valider les modifications
                </button>
                <button id="btn-add-user" class="btn btn-primary btn-sm">
                    <i class="fa-solid fa-plus"></i> Ajouter
                </button>
            </div>
        </div>
        <div class="admin-card">
            <div class="table-container desktop-only">
                <table class="admin-table roles-matrix-table">
                    <thead id="users-list-thead"></thead>
                    <tbody id="users-list-tbody"></tbody>
                </table>
            </div>
            <div id="users-cards-list" class="mobile-cards-list mobile-only"></div>
        </div>
        <div class="admin-card" style="margin-top:1.5rem;">
            <div class="admin-card-header">
                <h3><i class="fa-solid fa-qrcode"></i> QR Code d'accès au site</h3>
            </div>
            <div style="padding:1rem 0; display:flex; flex-direction:column; gap:1rem;">
                <p style="color:var(--text-secondary); margin:0; font-size:0.9rem;">
                    <i class="fa-solid fa-circle-info"></i>
                    Ce QR code permet aux utilisateurs d'accéder au site en déposant le cookie d'autorisation dans leur navigateur.
                </p>
                <button id="btn-show-access-qrcode" class="btn btn-outline">
                    <i class="fa-solid fa-qrcode"></i> Générer le QR Code d'accès
                </button>
                <div id="access-qrcode-container" style="display:none; flex-direction:column; align-items:center; gap:0.75rem; width:100%;">
                    <div id="access-qrcode-img" style="background:#fff; padding:12px; border-radius:8px; border:1px solid var(--border-color); display:inline-block;"></div>
                    <p id="access-qrcode-url" style="font-size:0.75rem; color:var(--text-secondary); word-break:break-all; text-align:center; max-width:300px;"></p>
                    <button id="btn-print-access-qrcode" class="btn btn-outline btn-sm">
                        <i class="fa-solid fa-print"></i> Imprimer
                    </button>
                </div>
            </div>
        </div>
    </section>
