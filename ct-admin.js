/**
 * ct-admin.js
 * Module JavaScript de gestion des Contrôles Techniques (CT) dans admin.php.
 * Modifié le 2026-09-04 — Ajout renderCtPanel() : peuplement panneau section-ct
 *   (tableau desktop + cards mobile + bouton envoi alertes admin)
 *
 * Dépendances :
 *  - admin.js (apiRequest, showToast, currentUser, vehiclesList)
 *  - admin.php (onglet Véhicules existant)
 *
 * Intégration :
 *  1. Charger ce script APRÈS admin.js dans admin.php :
 *     <script src="ct-admin.js?v=1.0"></script>
 *  2. Dans loadDashboardData() de admin.js, ajouter le chargement CT :
 *     window.ctData = await apiRequest('api/ct.php?action=status').catch(() => []);
 *     puis appeler : if (window.ctModule) window.ctModule.injectCtData();
 *  3. Dans renderVehiclesTable() de admin.js, ajouter dans chaque ligne :
 *     - une cellule CT (desktop) et un bloc CT (mobile cards)
 *     - un handler : tr.querySelector('.btn-ct').onclick = () => window.ctModule.openCtModal(v);
 *
 * Ce module gère :
 *  - L'injection des badges CT dans le tableau des véhicules
 *  - La modale de saisie/modification de la date CT
 *  - La visibilité du bouton CT selon le rôle (admin, superadmin, responsable_vehicule)
 *  - L'envoi manuel des alertes CT (admin/superadmin uniquement)
 */

window.ctModule = (function () {
    'use strict';

    // ── État ────────────────────────────────────────────────────────────────
    let ctData = []; // tableau indexé par vehicle_id

    /**
     * Reçoit les données CT déjà chargées par loadDashboardData() dans admin.js.
     * Évite un second appel API redondant.
     */
    function setData(data) {
        ctData = data || [];
    }

    /**
     * Initialisation au login. Rien à faire ici car window.currentUser est déjà
     * exposé par admin.js ; conservé pour symétrie avec asupModule.init().
     */
    function init(user) {
        // no-op : currentUser est lu via window.currentUser dans canEditCt()
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Retourne true si l'utilisateur connecté peut modifier le CT du véhicule.
     */
    function userHasRole(user, ...allowed) {
        if (!user) return false;
        const roles = Array.isArray(user.roles) && user.roles.length
            ? user.roles
            : (user.role ? [user.role] : []);
        if (roles.includes('superadmin')) return true;
        const functional = allowed.filter(id => id !== 'superadmin');
        if (roles.includes('admin') && functional.length) return true;
        return allowed.some(id => roles.includes(id));
    }

    function canEditCt(vehicle) {
        if (!window.currentUser) return false;
        const login = window.currentUser.login || '';

        if (userHasRole(window.currentUser, 'superadmin', 'admin')) return true;
        if (userHasRole(window.currentUser, 'responsable_vehicule')) {
            return (vehicle.responsible_admin || '') === login;
        }
        return false;
    }

    /**
     * Retourne les données CT d'un véhicule depuis ctData.
     */
    function getCtForVehicle(vehicleId) {
        return ctData.find(function (c) { return c.id === vehicleId; }) || null;
    }

    /**
     * Génère le HTML du badge CT selon le statut et la date.
     */
    function ctBadgeHtml(ct) {
        if (!ct || !ct.ct_date) {
            return '<span style="color:var(--text-secondary); font-size:0.8rem;">—</span>';
        }

        var dateFr = ct.ct_date.split('-').reverse().join('/');
        var days   = ct.days_remaining;

        if (ct.ct_alert_disabled) {
            return '<span style="display:inline-block; padding:2px 8px; border-radius:4px; background:rgba(99,102,241,0.15); color:#818cf8; font-size:0.78em; font-weight:600;">'
                 + '<i class="fa-solid fa-calendar-check"></i> ' + dateFr + ' — RDV pris</span>';
        }

        var color, icon, label;
        switch (ct.ct_status) {
            case 'overdue':
                color = '#ef4444'; icon = 'fa-triangle-exclamation';
                label = dateFr + ' (DÉPASSÉ)';
                break;
            case 'urgent':
                color = '#ef4444'; icon = 'fa-clock';
                label = dateFr + ' (J-' + days + ')';
                break;
            case 'warning':
                color = '#f97316'; icon = 'fa-clock';
                label = dateFr + ' (J-' + days + ')';
                break;
            case 'soon':
                color = '#eab308'; icon = 'fa-clock';
                label = dateFr + ' (J-' + days + ')';
                break;
            default:
                color = '#10b981'; icon = 'fa-circle-check';
                label = dateFr + ' (J-' + days + ')';
        }

        return '<span style="display:inline-block; padding:2px 8px; border-radius:4px; background:rgba(0,0,0,0.2); color:' + color + '; font-size:0.78em; font-weight:600;">'
             + '<i class="fa-solid ' + icon + '"></i> ' + label + '</span>';
    }

    // ── API publique ────────────────────────────────────────────────────────

    /**
     * Charge les données CT depuis l'API et les stocke en mémoire.
     * Appelée au chargement du dashboard.
     */
    async function loadCtData() {
        try {
            ctData = await apiRequest('api/ct.php?action=status');
        } catch (err) {
            ctData = [];
            console.warn('[CT] Chargement échoué :', err.message);
        }
    }

    /**
     * Injecte les badges CT dans les lignes du tableau des véhicules (desktop + mobile).
     * À appeler après renderVehiclesTable().
     */
    function injectCtData() {
        if (!ctData || ctData.length === 0) return;

        var canSeeCtTab = userHasRole(window.currentUser, 'superadmin', 'admin', 'responsable_vehicule');
        if (!canSeeCtTab) return;

        // ── Tableau desktop : ajoute colonne CT si absente ──────────────────
        var thead = document.querySelector('#tab-vehicles .admin-table thead tr');
        if (thead && !thead.querySelector('.th-ct')) {
            // Insère avant la colonne Actions (dernière th)
            var lastTh = thead.querySelector('th:last-child');
            var thCt = document.createElement('th');
            thCt.className = 'th-ct';
            thCt.textContent = 'Contrôle Technique';
            thead.insertBefore(thCt, lastTh);
        }

        // ── Lignes desktop ───────────────────────────────────────────────────
        var rows = document.querySelectorAll('#vehicles-list-tbody tr');
        rows.forEach(function (tr) {
            if (tr.querySelector('.td-ct')) return; // déjà injectée

            // Retrouve le véhicule correspondant via le bouton Modifier
            var btnEdit = tr.querySelector('.btn-edit-vehicle');
            if (!btnEdit) return;

            // Identifie le vehicule via vehiclesList (même ordre DOM = même ordre tableau)
            var idx = Array.from(document.querySelectorAll('#vehicles-list-tbody tr')).indexOf(tr);
            if (idx < 0 || idx >= vehiclesList.length) return;
            var v  = vehiclesList[idx];
            var ct = getCtForVehicle(v.id);

            // Uniquement pour les véhicules (type === 'Véhicule')
            var isVehicle = (v.type || '').toLowerCase() === 'véhicule';

            var tdCt = document.createElement('td');
            tdCt.className = 'td-ct';
            tdCt.style.whiteSpace = 'nowrap';

            if (isVehicle) {
                tdCt.innerHTML = ctBadgeHtml(ct);

                if (canEditCt(v)) {
                    var btnCt = document.createElement('button');
                    btnCt.className = 'btn btn-text btn-sm btn-ct';
                    btnCt.title = 'Gérer le CT';
                    btnCt.style.cssText = 'margin-left:0.4rem; color:var(--text-secondary); font-size:0.8rem;';
                    btnCt.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
                    btnCt.onclick = function () { openCtModal(v, ct); };
                    tdCt.appendChild(btnCt);
                }
            } else {
                tdCt.innerHTML = '<span style="color:var(--text-secondary); font-size:0.8rem;">—</span>';
            }

            // Insère avant la dernière cellule (Actions)
            var lastTd = tr.querySelector('td:last-child');
            tr.insertBefore(tdCt, lastTd);
        });

        // ── Cards mobile ─────────────────────────────────────────────────────
        var cards = document.querySelectorAll('#vehicles-cards-list .m-card');
        cards.forEach(function (card, idx) {
            if (card.querySelector('.ct-mobile-row')) return;
            if (idx >= vehiclesList.length) return;

            var v  = vehiclesList[idx];
            var ct = getCtForVehicle(v.id);
            var isVehicle = (v.type || '').toLowerCase() === 'véhicule';
            if (!isVehicle) return;

            var row = document.createElement('div');
            row.className = 'm-card-row ct-mobile-row';
            row.style.alignItems = 'center';
            row.innerHTML = '<span class="m-card-label"><i class="fa-solid fa-car-burst"></i> CT</span>'
                          + '<span class="m-card-value">' + ctBadgeHtml(ct) + '</span>';

            if (canEditCt(v)) {
                var btnCt = document.createElement('button');
                btnCt.className = 'btn btn-text btn-sm';
                btnCt.style.cssText = 'margin-left:0.5rem; color:var(--text-secondary); font-size:0.85rem;';
                btnCt.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
                btnCt.onclick = function () { openCtModal(v, ct); };
                row.querySelector('.m-card-value').appendChild(btnCt);
            }

            // Insère avant la zone d'actions
            var actions = card.querySelector('.m-card-actions');
            if (actions) card.insertBefore(row, actions);
            else card.appendChild(row);
        });
    }

    /**
     * Ouvre la modale de saisie/modification du CT d'un véhicule.
     */
    function openCtModal(vehicle, ctInfo) {
        var modal = document.getElementById('ct-modal');

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ct-modal';
            modal.className = 'modal';
            modal.innerHTML = [
                '<div class="modal-content" style="max-width:460px;">',
                '  <div class="modal-header">',
                '    <h3 id="ct-modal-title"><i class="fa-solid fa-car-burst"></i> Contrôle Technique</h3>',
                '    <span class="close-modal" id="ct-modal-close" style="cursor:pointer; font-size:1.4rem; color:var(--text-secondary);">&times;</span>',
                '  </div>',
                '  <div style="padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:1.1rem;">',
                '    <div class="form-group">',
                '      <label for="ct-date-input">Date du prochain CT :</label>',
                '      <input type="date" id="ct-date-input" style="width:100%;">',
                '    </div>',
                '    <div style="display:flex; align-items:center; gap:0.75rem; padding:0.85rem 1rem;',
                '         border-radius:var(--radius-md); background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2);">',
                '      <label class="unavailability-toggle" title="Suspendre les alertes mail (RDV pris)">',
                '        <input type="checkbox" id="ct-disabled-input">',
                '        <span class="unavailability-slider"></span>',
                '      </label>',
                '      <div>',
                '        <div style="font-weight:600; font-size:0.9rem;">Rendez-vous pris</div>',
                '        <div style="font-size:0.8rem; color:var(--text-secondary);">Suspend les alertes mail jusqu\'au prochain changement de date.</div>',
                '      </div>',
                '    </div>',
                '    <div id="ct-modal-info" style="font-size:0.82rem; color:var(--text-secondary); padding:0.6rem 0.75rem;',
                '         border-radius:var(--radius-sm); background:rgba(0,0,0,0.15);"></div>',
                '    <div id="ct-modal-error" style="display:none; color:#ef4444; font-size:0.85rem;"></div>',
                '  </div>',
                '  <div class="modal-footer" style="padding:0.75rem 1.5rem 1.25rem; display:flex; gap:0.75rem; justify-content:flex-end; flex-wrap:wrap;">',
                '    <button class="btn btn-outline btn-sm" id="ct-modal-cancel">Annuler</button>',
                '    <button class="btn btn-outline btn-sm" id="ct-btn-send-alert"',
                '            style="color:#eab308; border-color:rgba(234,179,8,0.3);">',
                '      <i class="fa-solid fa-paper-plane"></i> Tester alertes mail',
                '    </button>',
                '    <button class="btn btn-primary btn-sm" id="ct-modal-save">',
                '      <i class="fa-solid fa-save"></i> Enregistrer',
                '    </button>',
                '  </div>',
                '</div>',
            ].join('');

            document.body.appendChild(modal);

            document.getElementById('ct-modal-close').onclick  = function () { modal.classList.remove('active'); };
            document.getElementById('ct-modal-cancel').onclick = function () { modal.classList.remove('active'); };
            modal.onclick = function (e) { if (e.target === modal) modal.classList.remove('active'); };
        }

        // Remplissage
        var title = document.getElementById('ct-modal-title');
        title.innerHTML = '<i class="fa-solid fa-car-burst"></i> CT — ' + vehicle.name;

        var dateInput     = document.getElementById('ct-date-input');
        var disabledInput = document.getElementById('ct-disabled-input');
        var infoDiv       = document.getElementById('ct-modal-info');
        var errorDiv      = document.getElementById('ct-modal-error');
        var btnSendAlert  = document.getElementById('ct-btn-send-alert');

        dateInput.value     = (ctInfo && ctInfo.ct_date)           ? ctInfo.ct_date           : '';
        disabledInput.checked = (ctInfo && ctInfo.ct_alert_disabled) ? true                    : false;
        errorDiv.style.display = 'none';

        // Info seuils déjà notifiés
        var alerted = (ctInfo && ctInfo.ct_alerted_days && ctInfo.ct_alerted_days.length > 0)
            ? 'Seuils déjà notifiés : J-' + ctInfo.ct_alerted_days.join(', J-') + '.<br>Ils seront réinitialisés si vous changez la date.'
            : 'Aucune notification encore envoyée pour ce véhicule.';
        var alertSeuils = 'Alertes automatiques : J-60, J-30, J-15, J-7.';
        infoDiv.innerHTML = alertSeuils + '<br>' + alerted;

        // Visibilité bouton test alertes (admin/superadmin uniquement)
        btnSendAlert.style.display = userHasRole(window.currentUser, 'superadmin', 'admin') ? 'inline-flex' : 'none';

        // Bouton enregistrer
        var saveBtn  = document.getElementById('ct-modal-save');
        var origHtml = saveBtn.innerHTML;
        saveBtn.onclick = async function () {
            errorDiv.style.display = 'none';
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';

            try {
                await apiRequest('api/ct.php?action=update', 'POST', {
                    vehicle_id:         vehicle.id,
                    ct_date:            dateInput.value || null,
                    ct_alert_disabled:  disabledInput.checked,
                });
                modal.classList.remove('active');
                showToast('✅ CT mis à jour pour ' + vehicle.name, 'success');
                // Recharge tout pour rafraîchir les badges
                await loadCtData();
                injectCtData();
            } catch (err) {
                errorDiv.textContent   = err.message;
                errorDiv.style.display = 'block';
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = origHtml;
            }
        };

        // Bouton test alertes
        var origAlertHtml = btnSendAlert.innerHTML;
        btnSendAlert.onclick = async function () {
            btnSendAlert.disabled = true;
            btnSendAlert.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
            try {
                var res = await apiRequest('api/ct.php?action=send_alerts', 'POST', {});
                alert('Résultat :\n' + (res.log || []).join('\n') || 'Aucun mail envoyé.');
            } catch (err) {
                alert('Erreur : ' + err.message);
            } finally {
                btnSendAlert.disabled = false;
                btnSendAlert.innerHTML = origAlertHtml;
            }
        };

        modal.classList.add('active');
    }

    // ── Panneau CT dédié (section-ct) ───────────────────────────────────────

    /**
     * Peuple le panneau "Contrôle Technique" (section-ct) avec :
     *  - Un tableau desktop (#ct-list-tbody) et des cards mobile (#ct-cards-list)
     *  - Un bouton "Envoyer les alertes manuellement" (admin/superadmin uniquement)
     * Exclut les lots (type !== 'Véhicule').
     * Appeler après setData() et après que window.vehiclesList soit peuplé.
     */
    function renderCtPanel() {
        var tbody    = document.getElementById('ct-list-tbody');
        var cardList = document.getElementById('ct-cards-list');
        var sendBtn  = document.getElementById('ct-send-alerts-btn');

        if (!tbody || !cardList) return;

        var vehicles = (window.vehiclesList || []).filter(function (v) {
            return (v.type || '').toLowerCase() === 'véhicule';
        });

        // ── Bouton envoi manuel (admin/superadmin) ───────────────────────────
        if (sendBtn) {
            var user = window.currentUser;
            var isAdmin = user && (
                (user.roles || []).indexOf('superadmin') !== -1 ||
                (user.roles || []).indexOf('admin') !== -1
            );
            sendBtn.style.display = isAdmin ? '' : 'none';

            // Évite les doublons d'écouteurs en clonant le nœud
            var freshBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(freshBtn, sendBtn);
            freshBtn.addEventListener('click', async function () {
                if (!confirm('Envoyer les alertes CT manuellement pour tous les véhicules concernés ?')) return;
                var origHtml = freshBtn.innerHTML;
                freshBtn.disabled = true;
                freshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi…';
                try {
                    var res = await apiRequest('api/ct.php?action=send_alerts', 'POST', {});
                    showToast('Alertes envoyées : ' + res.sent + ' mail(s).', 'success');
                } catch (e) {
                    showToast('Erreur envoi alertes : ' + e.message, 'error');
                } finally {
                    freshBtn.disabled = false;
                    freshBtn.innerHTML = origHtml;
                }
            });
        }

        // ── Desktop ──────────────────────────────────────────────────────────
        tbody.innerHTML = '';
        if (vehicles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Aucun véhicule enregistré.</td></tr>';
        } else {
            vehicles.forEach(function (v) {
                var ct = getCtForVehicle(v.id);
                var tr = document.createElement('tr');

                // Statut textuel
                var statusLabel = '—';
                if (ct && ct.ct_date) {
                    switch (ct.ct_status) {
                        case 'overdue':  statusLabel = '<span style="color:#ef4444; font-weight:600;">DÉPASSÉ</span>'; break;
                        case 'urgent':   statusLabel = '<span style="color:#ef4444; font-weight:600;">Urgent</span>'; break;
                        case 'warning':  statusLabel = '<span style="color:#f97316; font-weight:600;">Attention</span>'; break;
                        case 'soon':     statusLabel = '<span style="color:#eab308; font-weight:600;">Bientôt</span>'; break;
                        default:         statusLabel = '<span style="color:#10b981; font-weight:600;">OK</span>';
                    }
                    if (ct.ct_alert_disabled) statusLabel = '<span style="color:#818cf8; font-weight:600;">RDV pris</span>';
                }

                // Seuils déjà notifiés
                var alertedLabel = '—';
                if (ct && ct.ct_alerted_days && ct.ct_alerted_days.length) {
                    alertedLabel = ct.ct_alerted_days.map(function (d) { return 'J-' + d; }).join(', ');
                }

                tr.innerHTML =
                    '<td>' + (v.name || v.id) + '</td>' +
                    '<td>' + ctBadgeHtml(ct) + '</td>' +
                    '<td>' + statusLabel + '</td>' +
                    '<td style="font-size:0.82rem; color:var(--text-secondary);">' + alertedLabel + '</td>' +
                    '<td class="text-right">' +
                        (canEditCt(v)
                            ? '<button class="btn btn-text btn-sm" title="Gérer le CT"><i class="fa-solid fa-pen-to-square"></i></button>'
                            : '') +
                    '</td>';

                if (canEditCt(v)) {
                    tr.querySelector('button').addEventListener('click', function () {
                        openCtModal(v, ct);
                    });
                }

                tbody.appendChild(tr);
            });
        }

        // ── Mobile cards ─────────────────────────────────────────────────────
        cardList.innerHTML = '';
        vehicles.forEach(function (v) {
            var ct = getCtForVehicle(v.id);
            var card = document.createElement('div');
            card.className = 'm-card';
            card.innerHTML =
                '<div class="m-card-row"><span class="m-card-label"><i class="fa-solid fa-truck-medical"></i> Véhicule</span>' +
                '<span class="m-card-value" style="font-weight:600;">' + (v.name || v.id) + '</span></div>' +
                '<div class="m-card-row"><span class="m-card-label"><i class="fa-solid fa-calendar-days"></i> Date CT</span>' +
                '<span class="m-card-value">' + ctBadgeHtml(ct) + '</span></div>';

            if (canEditCt(v)) {
                var btn = document.createElement('button');
                btn.className = 'btn btn-secondary btn-sm';
                btn.style.marginTop = '0.5rem';
                btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Gérer';
                btn.addEventListener('click', function () { openCtModal(v, ct); });
                card.appendChild(btn);
            }

            cardList.appendChild(card);
        });
    }

    // ── Exposition publique ─────────────────────────────────────────────────
    return {
        init:          init,
        setData:       setData,
        loadCtData:    loadCtData,
        injectCtData:  injectCtData,
        openCtModal:   openCtModal,
        renderCtPanel: renderCtPanel,
    };

})();
