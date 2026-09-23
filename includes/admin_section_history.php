<?php
/*
 * includes/admin_section_history.php
 * Généré le 2026-09-07
 * Section 7 : historique des inventaires, filtre par véhicule
 */
?>

    <!-- SECTION 7 : Historique inventaires -->
    <section id="section-history" class="admin-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-clock-rotate-left"></i> Historique des Inventaires</h2>
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
                Véhicule :
                <select id="inventory-history-filter" style="padding:0.4rem 0.6rem; border-radius:var(--radius-md); background-color:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:var(--text-primary); font-family:inherit;">
                    <option value="">Tous les véhicules</option>
                </select>
            </label>
        </div>
        <div class="admin-card">
            <div class="table-container desktop-only">
                <table class="admin-table">
                    <thead><tr>
                        <th>Véhicule</th><th>Agent(s)</th><th>Début</th><th>Fin</th>
                        <th>Pointage</th><th>Matériel non vérifié</th><th class="text-right">Actions</th>
                    </tr></thead>
                    <tbody id="inventory-history-tbody"></tbody>
                </table>
            </div>
            <div id="inventory-history-cards-list" class="mobile-cards-list mobile-only"></div>
        </div>
    </section>

</div><!-- fin dashboard-view -->
