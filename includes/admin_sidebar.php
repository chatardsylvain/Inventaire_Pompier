<?php
/*
 * includes/admin_sidebar.php
 * Généré le 2026-09-07
 * Sidebar de navigation : liste des sections avec rôles autorisés
 */
?>
<nav class="admin-sidebar" id="admin-sidebar">
    <ul class="sidebar-nav">
        <li class="sidebar-item" data-section="section-users" data-roles='["superadmin","admin"]'>
            <i class="fa-solid fa-users"></i>
            <span class="sidebar-label">Utilisateurs</span>
        </li>
        <li class="sidebar-item" data-section="section-vehicles" data-roles='["superadmin","admin","chef_caserne","adjoint","responsable_vehicule","contributeur"]'>
            <i class="fa-solid fa-truck-medical"></i>
            <span class="sidebar-label">Véhicules</span>
        </li>
        <li class="sidebar-item" data-section="section-cleaning" data-roles='["superadmin","admin"]'>
            <i class="fa-solid fa-spray-can-sparkles"></i>
            <span class="sidebar-label">Nettoyage VSAV</span>
        </li>
        <li class="sidebar-item" data-section="section-asup" data-roles='["superadmin","admin","chef_caserne","adjoint","correspondant_pharmacie"]'>
            <i class="fa-solid fa-kit-medical"></i>
            <span class="sidebar-label">ASUP</span>
            <span class="sidebar-badge" id="asup-sidebar-badge" style="display:none;"></span>
        </li>
        <li class="sidebar-item" data-section="section-ct" data-roles='["superadmin","admin","chef_caserne","adjoint","responsable_vehicule"]'>
            <i class="fa-solid fa-car-burst"></i>
            <span class="sidebar-label">Contr. Technique</span>
        </li>
        <li class="sidebar-item" data-section="section-alerts" data-roles='["superadmin","admin"]'>
            <i class="fa-solid fa-bell"></i>
            <span class="sidebar-label">Alertes mail</span>
            <span class="sidebar-badge" id="alerts-sidebar-badge" style="display:none;"></span>
        </li>
        <li class="sidebar-item" data-section="section-history" data-roles='["superadmin","admin"]'>
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span class="sidebar-label">Historique</span>
        </li>
    </ul>
</nav>
