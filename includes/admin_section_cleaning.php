<?php
/*
 * includes/admin_section_cleaning.php
 * Généré le 2026-09-07
 * Section 3 : configuration du planning nettoyage VSAV et gestion des équipes
 */
?>

    <!-- SECTION 3 : Nettoyage VSAV -->
    <section id="section-cleaning" class="admin-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-spray-can-sparkles"></i> Nettoyage VSAV</h2>
        </div>
        <div class="admin-card" id="cleaning-card">
            <form id="cleaning-config-form" style="display:flex; flex-direction:column; gap:1rem;">
                <div class="form-group">
                    <label for="cleaning-date">Semaine du prochain nettoyage (Vendredi) :</label>
                    <input type="date" id="cleaning-date" required>
                </div>
                <div class="form-group">
                    <button type="button" id="btn-export-cleaning-pdf" class="btn btn-primary btn-sm">
                        <i class="fa-solid fa-file-pdf"></i> Exporter le planning PDF
                    </button>
                </div>
                <div class="form-group">
                    <label for="cleaning-team">Équipe actuellement assignée :</label>
                    <select id="cleaning-team"></select>
                </div>
                <div>
                    <button type="submit" class="btn btn-primary btn-sm">
                        <i class="fa-solid fa-save"></i> Enregistrer configuration
                    </button>
                </div>
            </form>
            <hr style="margin:1.5rem 0; border:none; border-top:1px solid var(--border-color);">
            <h4>Gestion des équipes de nettoyage</h4>
            <div id="cleaning-teams-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;"></div>
            <button id="btn-add-cleaning-team" class="btn btn-outline btn-sm" style="margin-top:1rem;">
                <i class="fa-solid fa-plus"></i> Ajouter une équipe
            </button>
        </div>
    </section>
