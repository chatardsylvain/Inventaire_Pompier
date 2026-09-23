<?php
/*
 * includes/admin_section_vehicles.php
 * Généré le 2026-09-07
 * Section 2 : liste des véhicules (tableau desktop + cartes mobile)
 */
?>

    <!-- SECTION 2 : Véhicules -->
    <section id="section-vehicles" class="admin-section">
        <div class="section-header">
            <h2><i class="fa-solid fa-truck-medical"></i> Véhicules & Lots</h2>
            <div class="section-actions">
                <button id="btn-print-all-qrcodes" class="btn btn-outline btn-sm">
                    <i class="fa-solid fa-print"></i> QR-Codes
                </button>
                <button id="btn-regenerate-qrcodes" class="btn btn-outline btn-sm">
                    <i class="fa-solid fa-rotate-right"></i> Regénérer
                </button>
                <button id="btn-add-vehicle" class="btn btn-primary btn-sm">
                    <i class="fa-solid fa-plus"></i> Ajouter
                </button>
            </div>
        </div>
        <div class="admin-card">
            <div class="table-container desktop-only">
                <table class="admin-table">
                    <thead><tr>
                        <th>Nom</th><th>Type</th><th>Description</th>
                        <th class="text-right">Actions</th>
                    </tr></thead>
                    <tbody id="vehicles-list-tbody"></tbody>
                </table>
            </div>
            <div id="vehicles-cards-list" class="mobile-cards-list mobile-only"></div>
        </div>
    </section>
