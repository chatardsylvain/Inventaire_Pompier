<?php
/*
 * includes/admin_section_ct.php
 * Généré le 2026-09-07
 * Section 5 : statut global des contrôles techniques (dates gérées depuis la fiche véhicule)
 */
?>

    <!-- SECTION 5 : Contrôle Technique -->
    <section id="section-ct" class="admin-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-car-burst"></i> Contrôle Technique</h2>
            <div class="section-actions">
                <button id="ct-send-alerts-btn" class="btn btn-secondary" style="display:none;">
                    <i class="fa-solid fa-bell"></i> Envoyer les alertes
                </button>
            </div>
        </div>
        <div class="admin-card">
            <p style="color:var(--text-secondary); font-size:0.9rem; margin:0 0 1rem 0;">
                <i class="fa-solid fa-circle-info"></i>
                Les dates CT se gèrent depuis la fiche véhicule (section Véhicules). Ce panneau affiche le statut global.
            </p>
            <div class="table-container desktop-only">
                <table class="admin-table">
                    <thead><tr>
                        <th>Véhicule</th><th>Date CT</th><th>Statut</th><th>Alertes notifiées</th>
                        <th class="text-right">Actions</th>
                    </tr></thead>
                    <tbody id="ct-list-tbody"></tbody>
                </table>
            </div>
            <div id="ct-cards-list" class="mobile-cards-list mobile-only"></div>
        </div>
    </section>
