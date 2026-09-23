<?php
/*
 * includes/admin_modals.php
 * Généré le 2026-09-07
 * Modales : création/édition utilisateur, clonage véhicule + divs impression
 */
?>

<!-- ═══════════════ MODALES ═══════════════ -->
<div id="user-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="user-modal-title">Nouvel Administrateur</h3>
            <span class="close-modal">&times;</span>
        </div>
        <form id="user-form">
            <input type="hidden" id="user-id" value="">
            <div class="form-row-2">
                <div class="form-group">
                    <label for="user-last-name">Nom :</label>
                    <input type="text" id="user-last-name" required placeholder="Ex: Chatard" autocomplete="family-name">
                </div>
                <div class="form-group">
                    <label for="user-first-name">Prénom :</label>
                    <input type="text" id="user-first-name" required placeholder="Ex: Sylvain" autocomplete="given-name">
                </div>
            </div>
            <div class="form-group">
                <label for="user-login">Identifiant (nom_prenom) :</label>
                <input type="text" id="user-login" required placeholder="Ex: chatard_sylvain">
            </div>
            <div class="form-group">
                <label for="user-email">Adresse e-mail (alertes) :</label>
                <input type="email" id="user-email" placeholder="Ex: responsable@caserne.fr">
            </div>
            <div class="form-group">
                <label for="user-password" id="user-password-label">Mot de passe (Matricule) :</label>
                <input type="password" id="user-password" placeholder="Saisir le matricule">
                <small id="user-password-hint" style="color:var(--text-secondary); display:none; margin-top:0.25rem; font-size:0.8rem;">
                    <i class="fa-solid fa-circle-info"></i> Laisser vide pour conserver le mot de passe actuel.
                </small>
            </div>
            <div class="form-group" id="user-roles-group">
                <label>Rôles :</label>
                <div id="user-roles-checkboxes" class="roles-checkboxes"></div>
                <small style="color:var(--text-secondary); display:block; margin-top:0.35rem; font-size:0.8rem;">
                    Le rôle par défaut est Contributeur. Cocher Super admin ou Admin coche tous les rôles.
                </small>
            </div>
            <div id="user-error" class="alert alert-danger" style="display:none;"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline close-modal-btn">Annuler</button>
                <button type="submit" id="user-submit-btn" class="btn btn-primary">Créer le compte</button>
            </div>
        </form>
    </div>
</div>

<div id="clone-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="clone-modal-title"><i class="fa-solid fa-copy"></i> Cloner le véhicule</h3>
            <span class="close-modal" id="clone-modal-close">&times;</span>
        </div>
        <p id="clone-modal-desc" style="color:var(--text-secondary); font-size:0.9rem; margin:0 0 1.25rem 0;">
            Une copie complète du véhicule et de tout son inventaire sera créée. Les vignettes de matériel existantes seront reprises dans le clone.
        </p>
        <form id="clone-form">
            <input type="hidden" id="clone-source-id" value="">
            <div class="form-group">
                <label for="clone-new-id">Identifiant unique du clone :</label>
                <input type="text" id="clone-new-id" required placeholder="Ex: vsav-2" pattern="[a-zA-Z0-9\-]+" title="Lettres, chiffres et tirets uniquement">
            </div>
            <div class="form-group">
                <label for="clone-new-name">Nom du véhicule cloné :</label>
                <input type="text" id="clone-new-name" required placeholder="Ex: VSAV 2">
            </div>
            <div id="clone-error" class="alert alert-danger" style="display:none;"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="clone-modal-cancel">Annuler</button>
                <button type="submit" id="clone-submit-btn" class="btn btn-primary">
                    <i class="fa-solid fa-copy"></i> Confirmer le clonage
                </button>
            </div>
        </form>
    </div>
</div>

<div id="print-section"></div>
<div id="print-booklet-section"></div>
