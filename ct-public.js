/**
 * ct-public.js
 * Affichage public des informations de Contrôle Technique sur les cartes véhicules.
 *
 * Chargé dans index.php APRÈS script.js.
 * Écoute l'événement personnalisé 'gridRendered' dispatché par script.js,
 * ou s'exécute après un court délai si la grille est déjà construite.
 *
 * N'affiche PAS la date exacte : seulement un indicateur coloré discret
 * (ex: "CT dans 45 j." ou "CT DÉPASSÉ") pour informer les utilisateurs terrain.
 */

(function () {
    'use strict';

    /**
     * Génère le HTML du bandeau CT à insérer dans une card véhicule.
     */
    function buildCtBanner(ctInfo) {
        if (!ctInfo || !ctInfo.ct_date) return null;

        // Si alertes désactivées (RDV pris) : bandeau neutre
        if (ctInfo.ct_alert_disabled) {
            return null; // RDV pris = pas d'affichage public nécessaire
        }

        var days   = ctInfo.days_remaining;
        var color, icon, text;

        if (days === null) return null;

        if (days < 0) {
            color = '#ef4444';
            icon  = 'fa-triangle-exclamation';
            text  = 'CT DÉPASSÉ';
        } else if (days <= 7) {
            color = '#ef4444';
            icon  = 'fa-clock';
            text  = 'CT dans ' + days + ' j.';
        } else if (days <= 30) {
            color = '#f97316';
            icon  = 'fa-clock';
            text  = 'CT dans ' + days + ' j.';
        } else if (days <= 60) {
            color = '#eab308';
            icon  = 'fa-clock';
            text  = 'CT dans ' + days + ' j.';
        } else {
            // Plus de 60 jours → pas de bandeau pour ne pas encombrer
            return null;
        }

        var banner = document.createElement('div');
        banner.className = 'card-ct-banner';
        banner.style.cssText = [
            'background-color:' + color + ';',
            'color:#fff;',
            'font-size:0.75rem;',
            'font-weight:700;',
            'padding:0.25rem 0.75rem;',
            'display:flex;',
            'align-items:center;',
            'gap:0.35rem;',
            'letter-spacing:0.02em;',
        ].join('');
        banner.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + text;
        return banner;
    }

    /**
     * Injecte les bandeaux CT dans les cartes de la grille d'accueil.
     * Doit être appelée après que renderGrid() ait peuplé #vehicles-grid.
     */
    function injectCtBanners(ctList) {
        if (!ctList || ctList.length === 0) return;

        // Index par vehicle_id pour accès O(1)
        var ctIndex = {};
        ctList.forEach(function (ct) { ctIndex[ct.id] = ct; });

        var cards = document.querySelectorAll('#vehicles-grid .card[data-id]');
        cards.forEach(function (card) {
            var vehicleId = card.dataset.id;
            var ct        = ctIndex[vehicleId];
            if (!ct) return;

            var banner = buildCtBanner(ct);
            if (!banner) return;

            // Insère le bandeau entre l'image et le contenu texte
            var cardContent = card.querySelector('.card-content');
            if (cardContent) {
                card.insertBefore(banner, cardContent);
            }
        });
    }

    /**
     * Charge les données CT publiques et injecte les bandeaux.
     * Appel non bloquant — si l'API échoue, aucun effet visible.
     */
    function loadAndInject() {
        fetch('api/ct.php?action=public_status', { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('CT status unavailable');
                return r.json();
            })
            .then(function (data) {
                injectCtBanners(data);
            })
            .catch(function () {
                // Silencieux : le CT est une info secondaire
            });
    }

    // Démarre après le chargement complet du DOM + grille
    // script.js appelle init() dans DOMContentLoaded → la grille est prête
    // quelques ms après ; on attend via requestIdleCallback ou setTimeout.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(loadAndInject, 800);
        });
    } else {
        setTimeout(loadAndInject, 800);
    }

})();
