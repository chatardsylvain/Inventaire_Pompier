/**
 * cleaning-admin.js
 * Moteur JavaScript du module de Planning de Nettoyage / Désinfection VSAV.
 * Gère les actions spécifiques (export PDF, etc.).
 */

window.cleaningModule = (function() {
    'use strict';

    // ====================================================================
    // ÉLÉMENTS DOM
    // ====================================================================
    const btnExportPdf = document.getElementById('btn-export-cleaning-pdf');

    // ====================================================================
    // INITIALISATION
    // ====================================================================
    function init() {
        setupEventListeners();
    }

    // ====================================================================
    // EVENT LISTENERS
    // ====================================================================
    function setupEventListeners() {
        if (btnExportPdf) {
            btnExportPdf.addEventListener('click', () => {
                window.open('api/cleaning.php?action=export_pdf', '_blank');
            });
        }
    }

    // ====================================================================
    // PUBLIC API
    // ====================================================================
    return {
        init: init
    };
})();

// Initialisation automatique au chargement si nécessaire
document.addEventListener('DOMContentLoaded', () => {
    if (window.cleaningModule && typeof window.cleaningModule.init === 'function') {
        window.cleaningModule.init();
    }
});