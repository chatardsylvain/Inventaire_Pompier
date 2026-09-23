<?php
/*
 * includes/admin_editor_view.php
 * Généré le 2026-09-07
 * Vue éditeur véhicule : formulaire métadonnées, localisations physiques
 */
?>

<!-- ── VUE ÉDITEUR ── -->
<div id="editor-view" class="admin-view">
    <div class="editor-header">
        <button id="btn-editor-back" class="btn btn-text">
            <i class="fa-solid fa-arrow-left"></i> Annuler et Retour
        </button>
        <h2 id="editor-title">Édition du véhicule</h2>
        <button id="btn-save-all" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-save"></i> Enregistrer
        </button>
    </div>
    <div class="editor-container">
        <div class="editor-sidebar">
            <div class="admin-card">
                <h3>Informations Générales</h3>
                <form id="vehicle-meta-form" style="margin-top:0.75rem;">
                    <div class="veh-form-grid">
                        <div class="form-group">
                            <label for="edit-vehicle-id">Identifiant :</label>
                            <input type="text" id="edit-vehicle-id" required placeholder="Ex: vsav-2">
                        </div>
                        <div class="form-group">
                            <label for="edit-vehicle-name">Nom :</label>
                            <input type="text" id="edit-vehicle-name" required placeholder="Ex: VSAV 2">
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
                            <label for="edit-vehicle-responsible">Responsable :</label>
                            <select id="edit-vehicle-responsible">
                                <option value="">-- Aucun --</option>
                            </select>
                        </div>
                        <div class="form-group veh-form-full">
                            <label for="edit-vehicle-desc">Description :</label>
                            <textarea id="edit-vehicle-desc" rows="2" placeholder="Description courte..."></textarea>
                        </div>
                        <div class="form-group">
                            <label for="edit-vehicle-icon">Icône FA :</label>
                            <input type="text" id="edit-vehicle-icon" placeholder="fa-ambulance">
                        </div>
                        <div class="form-group">
                            <label for="edit-vehicle-image">Chemin image :</label>
                            <input type="text" id="edit-vehicle-image" placeholder="./images/vsav.jpg">
                        </div>
                        <div class="form-group veh-form-full">
                            <div class="upload-wrapper">
                                <label class="btn btn-outline btn-block text-center" style="cursor:pointer;">
                                    <i class="fa-solid fa-upload"></i> Envoyer une image
                                    <input type="file" id="image-upload-input" accept="image/*" style="display:none;">
                                </label>
                                <div id="upload-status" style="margin-top:0.2rem; font-size:0.78rem; color:var(--text-secondary);"></div>
                            </div>
                        </div>
                        <div class="form-group veh-form-full veh-form-ct">
                            <label for="edit-vehicle-next-ct"><i class="fa-solid fa-car-burst"></i> Prochain CT :</label>
                            <input type="date" id="edit-vehicle-next-ct">
                        </div>
                    </div>
                </form>
            </div>
        </div>
        <div class="editor-main">
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Localisations physiques</h3>
                    <button id="btn-add-location" class="btn btn-outline btn-sm">
                        <i class="fa-solid fa-plus"></i> Nouvelle localisation
                    </button>
                </div>
                <div id="locations-editor-list" style="margin-top:1rem;"></div>
            </div>
        </div>
    </div>
</div>
