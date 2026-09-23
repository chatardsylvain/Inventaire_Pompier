<?php
/*
 * includes/admin_section_asup.php
 * Généré le 2026-09-07
 * Section 4 : contrôle mensuel ASUP, pointage médicaments, historique des contrôles
 */
?>

    <!-- SECTION 4 : ASUP -->
    <section id="section-asup" class="admin-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-kit-medical"></i> ASUP</h2>
            <button id="btn-asup-gen-report" class="btn btn-outline btn-sm">
                <i class="fa-solid fa-file-pdf"></i> Rapport annuel
            </button>
            <button id="btn-asup-print-inventory" class="btn btn-outline btn-sm">
                <i class="fa-solid fa-print"></i> Imprimer l'inventaire
            </button>
            <button id="btn-asup-send-alerts" class="btn btn-outline btn-sm">
                <i class="fa-solid fa-paper-plane"></i> Tester alertes mail
            </button>
        </div>
        <div class="admin-card" style="margin-bottom:1.5rem;">
            <div class="admin-card-header">
                <h3><i class="fa-solid fa-pills"></i> Contrôle Mensuel ASUP — VSAV</h3>
            </div>
            <div id="asup-status-banner" style="margin:1rem 0; padding:1rem 1.25rem; border-radius:var(--radius-md); display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
                <div id="asup-status-icon" style="font-size:1.5rem;"></div>
                <div style="flex:1;">
                    <div id="asup-status-text" style="font-weight:700; font-size:1rem;"></div>
                    <div id="asup-status-sub" style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;"></div>
                </div>
                <div id="asup-status-actions"></div>
            </div>
        </div>
        <div id="asup-check-panel" class="admin-card" style="margin-bottom:1.5rem; display:none;">
            <div class="admin-card-header">
                <h3><i class="fa-solid fa-list-check"></i> Pointage des médicaments</h3>
                <div class="admin-card-actions">
                    <span id="asup-check-progress" style="font-size:0.85rem; color:var(--text-secondary);"></span>
                    <button id="btn-asup-finish" class="btn btn-primary btn-sm">
                        <i class="fa-solid fa-flag-checkered"></i> Valider le contrôle
                    </button>
                    <button id="btn-asup-cancel" class="btn btn-outline btn-sm" style="color:var(--text-secondary);">Annuler</button>
                </div>
            </div>
            <div id="asup-medications-list" style="padding:0.5rem 0;"></div>
        </div>
        <div class="admin-card">
            <div class="admin-card-header">
                <h3><i class="fa-solid fa-clock-rotate-left"></i> Historique des Contrôles ASUP</h3>
                <div class="admin-card-actions">
                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
                        Année :
                        <select id="asup-history-year-filter" style="padding:0.4rem 0.6rem; border-radius:var(--radius-md); background-color:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:var(--text-primary); font-family:inherit;"></select>
                    </label>
                </div>
            </div>
            <div class="table-container desktop-only">
                <table class="admin-table">
                    <thead><tr>
                        <th>Date de contrôle</th><th>Agent</th><th>Durée</th>
                        <th>Pointage</th><th>Non vérifié(s)</th><th class="text-right">Actions</th>
                    </tr></thead>
                    <tbody id="asup-history-tbody"></tbody>
                </table>
            </div>
            <div id="asup-history-cards-list" class="mobile-cards-list mobile-only"></div>
        </div>
    </section>
