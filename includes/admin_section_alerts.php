<?php
/*
 * includes/admin_section_alerts.php
 * Généré le 2026-09-07
 * Section 6 : alertes matériel (tableau desktop + cartes mobile)
 */
?>

    <!-- SECTION 6 : Alertes mail -->
    <section id="section-alerts" class="admin-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-bell"></i> Alertes Matériel</h2>
        </div>
        <div class="admin-card" id="alerts-card">
            <div class="table-container desktop-only">
                <table class="admin-table">
                    <thead><tr>
                        <th>Date</th><th>Véhicule & Emplacement</th><th>Matériel</th>
                        <th>Type</th><th>Commentaire</th><th class="text-right">Actions</th>
                    </tr></thead>
                    <tbody id="alerts-list-tbody"></tbody>
                </table>
            </div>
            <div id="alerts-cards-list" class="mobile-cards-list mobile-only"></div>
        </div>
    </section>
