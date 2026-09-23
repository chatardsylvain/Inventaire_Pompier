/**
 * asup-admin.js (CORRIGÉ & CONFORME CSP)
 * Moteur JavaScript du module ASUP dans admin.php/admin.js.
 * Gère : état du mois, pointage des médicaments, historique, alertes mail.
 */

window.asupModule = (function() {
    'use strict';

    // ====================================================================
    // ÉLÉMENTS DOM
    // ====================================================================
    const tabAsupBtn        = document.getElementById('tab-asup-btn');
    const statusBanner      = document.getElementById('asup-status-banner');
    const statusIcon        = document.getElementById('asup-status-icon');
    const statusText        = document.getElementById('asup-status-text');
    const statusSub         = document.getElementById('asup-status-sub');
    const statusActions     = document.getElementById('asup-status-actions');
    const checkPanel        = document.getElementById('asup-check-panel');
    const medsList          = document.getElementById('asup-medications-list');
    const checkProgress     = document.getElementById('asup-check-progress');
    const btnFinish         = document.getElementById('btn-asup-finish');
    const btnCancel         = document.getElementById('btn-asup-cancel');
    const btnSendAlerts     = document.getElementById('btn-asup-send-alerts');
    const btnGenReport      = document.getElementById('btn-asup-gen-report');
    const btnPrintInventory = document.getElementById('btn-asup-print-inventory');
    const historyTbody      = document.getElementById('asup-history-tbody');
    const historyCardsList  = document.getElementById('asup-history-cards-list');
    const yearFilter        = document.getElementById('asup-history-year-filter');

    // ====================================================================
    // VARIABLES D'ÉTAT
    // ====================================================================
    let currentUserRoles    = [];
    let asupStatus          = null;
    let asupSession         = null;
    let asupHistory         = [];
    let asupMedications     = [];

    // ====================================================================
    // WRAPPER POUR apiRequest (depuis admin.js)
    // ====================================================================
    async function makeApiRequest(url, method = 'GET', data = null) {
        try {
            // Cache-buster sur les GET pour éviter les réponses périmées après finalisation
            const finalUrl = (method === 'GET')
                ? url + (url.includes('?') ? '&' : '?') + '_=' + Date.now()
                : url;

            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store',
                    'Pragma': 'no-cache',
                },
                cache: 'no-store',
            };
            if (data) options.body = JSON.stringify(data);

            const response = await fetch(finalUrl, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            console.error('Erreur API ASUP :', url, err);
            throw err;
        }
    }

    // ====================================================================
    // INIT & VÉRIFICATION DE RÔLE
    // ====================================================================

    function rolesFromInitArg(userOrRole) {
        if (Array.isArray(userOrRole)) return userOrRole.slice();
        if (userOrRole && typeof userOrRole === 'object') {
            if (Array.isArray(userOrRole.roles) && userOrRole.roles.length) return userOrRole.roles.slice();
            if (userOrRole.role) return [userOrRole.role];
            return [];
        }
        if (typeof userOrRole === 'string' && userOrRole) return [userOrRole];
        return [];
    }

    function asupHasRole(...allowed) {
        if (currentUserRoles.includes('superadmin')) return true;
        const functional = allowed.filter(id => id !== 'superadmin');
        if (currentUserRoles.includes('admin') && functional.length) return true;
        return allowed.some(id => currentUserRoles.includes(id));
    }

    function init(userOrRole) {
        currentUserRoles = rolesFromInitArg(userOrRole);
        const isAsupAllowed = asupHasRole('correspondant_pharmacie', 'superadmin', 'admin');

        if (tabAsupBtn) {
            tabAsupBtn.style.display = isAsupAllowed ? 'flex' : 'none';
        }

        if (isAsupAllowed) {
            loadAsupData();
            setupEventListeners();
        }
    }

    // ====================================================================
    // CHARGEMENT DES DONNÉES
    // ====================================================================

    async function loadAsupData() {
        try {
            // Charge statut + session active du mois courant
            const statusRes = await makeApiRequest('api/asup.php?action=status&vehicle_id=vsav');
            asupStatus = statusRes;
            asupSession = statusRes.active_session || null;

            // Charge liste des médicaments ASUP
            const medsRes = await makeApiRequest('api/asup.php?action=medications&vehicle_id=vsav');
            asupMedications = (medsRes.medications || medsRes) || [];

            // Charge historique
            const histRes = await makeApiRequest('api/asup.php?action=history');
            asupHistory = histRes || [];

            renderAsupUI();
        } catch (err) {
            console.error('Erreur chargement ASUP :', err);
            if (statusBanner) {
                statusBanner.innerHTML = `<div style="color:#ef4444;"><i class="fa-solid fa-exclamation-circle"></i> Erreur chargement des données ASUP</div>`;
            }
        }
    }

    // ====================================================================
    // RENDU DE L'INTERFACE
    // ====================================================================

    function renderAsupUI() {
        renderStatusBanner();
        renderCheckPanel();
        renderHistory();
    }

    function renderStatusBanner() {
        if (!statusBanner || !asupStatus) return;

        statusIcon.innerHTML = '';
        statusText.innerHTML = '';
        statusSub.innerHTML = '';
        statusActions.innerHTML = '';

        const { status, days_until_deadline, deadline, last_check } = asupStatus;
        const isAuthorized = asupHasRole('correspondant_pharmacie', 'superadmin');

        // Icon + texte
        if (status === 'done') {
            statusBanner.style.background = 'rgba(16,185,129,0.12)';
            statusIcon.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i>';
            statusText.textContent = '✓ Contrôle effectué ce mois';
            if (last_check && last_check.finished_at) {
                const [d, t] = last_check.finished_at.split(' ');
                statusSub.textContent = `Validé le ${d.split('-').reverse().join('/')} par ${last_check.agent}`;
            }
        } else if (status === 'overdue') {
            statusBanner.style.background = 'rgba(239,68,68,0.12)';
            statusIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i>';
            statusText.textContent = '⚠ Contrôle EN RETARD';
            statusSub.textContent = `Dernier jour du mois dépassé (échéance : ${deadline})`;
        } else {
            statusBanner.style.background = 'rgba(251,191,36,0.12)';
            statusIcon.innerHTML = '<i class="fa-solid fa-clock" style="color:#fbbf24;"></i>';
            statusText.textContent = '⏱ Contrôle à faire';
            statusSub.textContent = `${days_until_deadline} jour(s) avant la fin du mois (${deadline})`;
        }

        // Boutons d'action
        if (isAuthorized) {
            // Bouton "Reprendre" si une session est en cours (prioritaire)
            if (asupSession) {
                const btnResume = document.createElement('button');
                btnResume.className = 'btn btn-outline btn-sm';
                btnResume.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reprendre';
                btnResume.onclick = resumeAsupCheck;
                statusActions.appendChild(btnResume);
            }

            // Bouton toujours présent — libellé adapté au statut
            const btn = document.createElement('button');
            if (status === 'done') {
                btn.className = 'btn btn-outline btn-sm';
                btn.innerHTML = '<i class="fa-solid fa-plus"></i> Nouveau contrôle';
            } else if (status === 'overdue') {
                btn.className = 'btn btn-danger btn-sm';
                btn.innerHTML = '<i class="fa-solid fa-play"></i> Démarrer (en retard)';
            } else {
                btn.className = 'btn btn-primary btn-sm';
                btn.innerHTML = '<i class="fa-solid fa-play"></i> Démarrer';
            }
            btn.onclick = startAsupCheck;
            statusActions.appendChild(btn);
        }
    }

    function renderCheckPanel() {
        if (!checkPanel) return;
        
        if (!asupSession) {
            checkPanel.style.display = 'none';
            return;
        }

        checkPanel.style.display = 'block';
        const checked = Object.keys(asupSession.checked).length;
        const total = asupSession.medications.length;
        if (checkProgress) checkProgress.textContent = `${checked} / ${total} pointé(s)`;

        medsList.innerHTML = '';

        // Grouper par localisation
        const byLocation = {};
        asupSession.medications.forEach(med => {
            if (!byLocation[med.location]) byLocation[med.location] = [];
            byLocation[med.location].push(med);
        });

        Object.keys(byLocation).sort().forEach(locName => {
            const locDiv = document.createElement('div');
            locDiv.style.marginBottom = '1.5rem';

            const locTitle = document.createElement('h4');
            locTitle.style.cssText = 'margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.95rem;';
            locTitle.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> ${locName}`;
            locDiv.appendChild(locTitle);

            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width:36px;"><input type="checkbox" class="loc-check-all" data-location="${locName}" title="Tout cocher/décocher pour cet emplacement"></th>
                        <th>Médicament</th>
                        <th>Lot</th>
                        <th>Péremption</th>
                        <th style="width:80px;">Stock prévu</th>
                        <th style="width:90px;">Stock réel *</th>
                        <th>Commentaire <span style="font-weight:400; font-size:0.8rem;">(obligatoire si écart)</span></th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');
            byLocation[locName].forEach(med => {
                const isChecked = !!asupSession.checked[med.key];
                const details   = asupSession.details ? (asupSession.details[med.key] || {}) : {};
                const realQty   = details.real_quantity !== undefined ? details.real_quantity : '';
                const comment   = details.comment || '';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align:center;">
                        <input type="checkbox" class="med-checkbox" data-key="${med.key}" ${isChecked ? 'checked' : ''}>
                    </td>
                    <td><strong>${med.name}</strong></td>
                    <td style="color:var(--text-secondary); font-size:0.9rem;">${med.lot || '—'}</td>
                    <td style="color:var(--text-secondary); font-size:0.9rem;">${med.peremption ? med.peremption.split('-').reverse().join('/') : '—'}</td>
                    <td style="text-align:center; color:var(--text-secondary);">${med.quantity}</td>
                    <td style="text-align:center;">
                        <input type="number" class="real-qty-input" min="0" value="${realQty}"
                            style="width:65px; padding:0.3rem; text-align:center; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary); -webkit-text-fill-color:var(--text-primary);"
                            placeholder="—">
                    </td>
                    <td>
                        <input type="text" class="comment-input" value="${comment}"
                            style="width:100%; padding:0.3rem 0.5rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary); -webkit-text-fill-color:var(--text-primary); font-size:0.85rem;"
                            placeholder="Aucun commentaire">
                    </td>
                `;

                // Checkbox
                tr.querySelector('.med-checkbox').onchange = (e) => {
                    const rq = tr.querySelector('.real-qty-input').value;
                    const cm = tr.querySelector('.comment-input').value;
                    toggleMedCheckbox(med.key, e.target.checked, rq !== '' ? parseInt(rq) : null, cm);
                };

                // Stock réel — mise à jour visuelle si écart + envoi API
                const realQtyInput = tr.querySelector('.real-qty-input');
                realQtyInput.onchange = () => {
                    const rq = realQtyInput.value !== '' ? parseInt(realQtyInput.value) : null;
                    const cm = tr.querySelector('.comment-input').value;
                    if (rq !== null && rq !== med.quantity) {
                        realQtyInput.style.borderColor = '#f97316';
                        realQtyInput.style.color = '#f97316';
                    } else {
                        realQtyInput.style.borderColor = '';
                        realQtyInput.style.color = '';
                    }
                    saveDetails(med.key, rq, cm);
                };

                // Commentaire — envoi API
                const commentInput = tr.querySelector('.comment-input');
                commentInput.onchange = () => {
                    const rq = realQtyInput.value !== '' ? parseInt(realQtyInput.value) : null;
                    saveDetails(med.key, rq, commentInput.value);
                };

                tbody.appendChild(tr);
            });

            table.querySelector('.loc-check-all').onchange = (e) => {
                const locMeds = byLocation[locName];
                locMeds.forEach(med => {
                    tbody.querySelectorAll(`[data-key="${med.key}"]`).forEach(cb => {
                        cb.checked = e.target.checked;
                    });
                });
                toggleMedBatch(byLocation[locName].map(m => m.key), e.target.checked);
            };

            // Wrapper scroll horizontal pour tablette/mobile
            const tableWrapper = document.createElement('div');
            tableWrapper.style.cssText = 'overflow-x: auto; -webkit-overflow-scrolling: touch;';
            tableWrapper.appendChild(table);
            locDiv.appendChild(tableWrapper);
            medsList.appendChild(locDiv);
        });
    }

    function renderHistory() {
        if (!historyTbody) return;
        
        historyTbody.innerHTML = '';
        if (historyCardsList) historyCardsList.innerHTML = '';

        // Filtre année
        const years = new Set();
        asupHistory.forEach(h => {
            if (h.finished_at) years.add(parseInt(h.finished_at.substring(0, 4)));
        });
        if (yearFilter) {
            yearFilter.innerHTML = '<option value="">Toute année</option>';
            Array.from(years).sort((a, b) => b - a).forEach(year => {
                const opt = document.createElement('option');
                opt.value = year;
                opt.textContent = year;
                yearFilter.appendChild(opt);
            });
        }

        // Filtre par année sélectionnée
        const selectedYear = yearFilter ? parseInt(yearFilter.value) : null;
        let filtered = asupHistory;
        if (selectedYear) {
            filtered = filtered.filter(h => h.finished_at && parseInt(h.finished_at.substring(0, 4)) === selectedYear);
        }
        filtered.sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''));

        if (filtered.length === 0) {
            historyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">Aucun contrôle pour cette période.</td></tr>';
            if (historyCardsList) historyCardsList.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:2rem;">Aucun contrôle pour cette période.</p>';
            return;
        }

        // Table desktop (CORRIGÉ SANS ONCLICK INLINE)
        filtered.forEach(h => {
            const start = new Date(h.started_at);
            const end = new Date(h.finished_at);
            const durationMin = Math.round((end - start) / 60000);
            const durationText = durationMin < 60 ? `${durationMin} min` : `${Math.floor(durationMin/60)}h ${durationMin%60}`;
            const uncheckedCount = h.unchecked_count || 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${h.finished_at.split(' ')[0].split('-').reverse().join('/')}</td>
                <td><strong>${h.agent}</strong></td>
                <td>${durationText}</td>
                <td>${h.checked_count} / ${h.total_count}</td>
                <td>${uncheckedCount > 0 ? `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${uncheckedCount}</span>` : '<span style="color:#10b981;">✓</span>'}</td>
                <td class="text-right">
                    <button class="btn btn-outline btn-sm btn-view-details" data-id="${h.id}">Détails</button>
                </td>
            `;
            
            // Attachement propre de l'événement sans violation CSP
            tr.querySelector('.btn-view-details').addEventListener('click', () => {
                viewDetails(h.id);
            });

            historyTbody.appendChild(tr);
        });

        // Cards mobile (CORRIGÉ SANS ONCLICK INLINE)
        if (historyCardsList) {
            filtered.forEach(h => {
                const uncheckedCount = h.unchecked_count || 0;
                const card = document.createElement('div');
                card.className = 'm-card';
                card.innerHTML = `
                    <div class="m-card-header">
                        <div>
                            <div class="m-card-title">${h.agent}</div>
                            <div class="m-card-sub">${h.finished_at.split(' ')[0].split('-').reverse().join('/')}</div>
                        </div>
                        ${uncheckedCount > 0 ? '<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ' + uncheckedCount + '</span>' : '<span style="color:#10b981;">✓</span>'}
                    </div>
                    <div class="m-card-row">
                        <span class="m-card-label">Pointage</span>
                        <span class="m-card-value">${h.checked_count} / ${h.total_count}</span>
                    </div>
                    <div class="m-card-actions">
                        <button class="btn btn-outline btn-sm btn-view-details-card" data-id="${h.id}">Détails</button>
                    </div>
                `;

                // Attachement propre de l'événement sans violation CSP
                card.querySelector('.btn-view-details-card').addEventListener('click', () => {
                    viewDetails(h.id);
                });

                historyCardsList.appendChild(card);
            });
        }
    }

    // ====================================================================
    // ACTIONS
    // ====================================================================

    async function startAsupCheck(force = false) {
        const agent = prompt('Nom du correspondant pharmacie qui effectue le contrôle :');
        if (!agent || !agent.trim()) return;

        await _doStartCheck(agent.trim(), force);
    }

    /**
     * Appel API start_check avec gestion explicite du 409 (contrôle déjà fait ce mois).
     * Si le serveur répond can_force=true, propose une confirmation pour forcer un nouveau contrôle.
     */
    async function _doStartCheck(agent, force = false) {
        try {
            const response = await fetch('api/asup.php?action=start_check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicle_id: 'vsav', agent, force }),
            });
            const res = await response.json();

            // Contrôle déjà finalisé ce mois → proposer de forcer
            if (response.status === 409 && res.can_force) {
                const existingAgent = res.existing ? res.existing.agent : 'inconnu';
                const existingDate  = res.existing && res.existing.finished_at
                    ? res.existing.finished_at.split(' ')[0].split('-').reverse().join('/')
                    : '?';
                const ok = confirm(
                    `Un contrôle a déjà été effectué ce mois :\n` +
                    `  → ${existingDate} par ${existingAgent}\n\n` +
                    `Voulez-vous quand même démarrer un nouveau contrôle ?`
                );
                if (!ok) return;
                // Relancer avec force:true — agent déjà saisi, pas de nouveau prompt
                await _doStartCheck(agent, true);
                return;
            }

            if (!response.ok) {
                throw new Error(res.error || `HTTP ${response.status}`);
            }

            asupSession = res.session;
            renderCheckPanel();
            console.log(res.resumed ? '✓ Session reprise' : '✓ Session démarrée');
        } catch (err) {
            console.error('Erreur start_check :', err);
            alert('Erreur : ' + err.message);
        }
    }

    function resumeAsupCheck() {
        if (asupSession) renderCheckPanel();
    }

    async function toggleMedCheckbox(key, checked, realQuantity = null, comment = null) {
        try {
            const payload = {
                vehicle_id: 'vsav',
                key: key,
                checked: checked,
            };
            if (realQuantity !== null) payload.real_quantity = realQuantity;
            if (comment !== null)      payload.comment       = comment;

            await makeApiRequest('api/asup.php?action=toggle', 'POST', payload);
            if (checked) {
                asupSession.checked[key] = new Date().toISOString();
            } else {
                delete asupSession.checked[key];
            }
            if (!asupSession.details) asupSession.details = {};
            if (!asupSession.details[key]) asupSession.details[key] = {};
            if (realQuantity !== null) asupSession.details[key].real_quantity = realQuantity;
            if (comment !== null)      asupSession.details[key].comment       = comment;

            if (checkProgress) {
                checkProgress.textContent = `${Object.keys(asupSession.checked).length} / ${asupSession.medications.length} pointé(s)`;
            }
        } catch (err) {
            console.error('Erreur toggle :', err);
            alert('Erreur : ' + err.message);
        }
    }

    async function saveDetails(key, realQuantity, comment) {
        try {
            const payload = {
                vehicle_id: 'vsav',
                key: key,
                checked: !!asupSession.checked[key],
            };
            if (realQuantity !== null) payload.real_quantity = realQuantity;
            if (comment !== null)      payload.comment       = comment;

            await makeApiRequest('api/asup.php?action=toggle', 'POST', payload);

            if (!asupSession.details) asupSession.details = {};
            if (!asupSession.details[key]) asupSession.details[key] = {};
            if (realQuantity !== null) asupSession.details[key].real_quantity = realQuantity;
            if (comment !== null)      asupSession.details[key].comment       = comment;
        } catch (err) {
            console.error('Erreur saveDetails :', err);
        }
    }

    async function toggleMedBatch(keys, checked) {
        try {
            const promises = keys.map(key => 
                makeApiRequest('api/asup.php?action=toggle', 'POST', {
                    vehicle_id: 'vsav',
                    key: key,
                    checked: checked,
                })
            );
            await Promise.all(promises);
            
            keys.forEach(key => {
                if (checked) {
                    asupSession.checked[key] = new Date().toISOString();
                } else {
                    delete asupSession.checked[key];
                }
            });
            if (checkProgress) {
                checkProgress.textContent = `${Object.keys(asupSession.checked).length} / ${asupSession.medications.length} pointé(s)`;
            }
        } catch (err) {
            console.error('Erreur batch toggle :', err);
        }
    }

    async function finishAsupCheck() {
        const details = asupSession.details || {};
        const missing = [];
        asupSession.medications.forEach(med => {
            const d   = details[med.key] || {};
            const rq  = d.real_quantity !== undefined ? d.real_quantity : null;
            const cm  = (d.comment || '').trim();
            if (rq !== null && rq !== med.quantity && !cm) {
                missing.push(med.name);
            }
        });
        if (missing.length > 0) {
            alert('Commentaire obligatoire pour les médicaments avec écart de stock :\n• ' + missing.join('\n• '));
            return;
        }

        if (!confirm('Confirmer la fin du contrôle mensuel ? Le matériel non pointé sera enregistré comme non vérifié.')) return;

        btnFinish.disabled = true;
        btnFinish.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validation...';

        try {
            const res = await makeApiRequest('api/asup.php?action=finish_check', 'POST', {
                vehicle_id: 'vsav',
            });
            asupSession = null;
            await loadAsupData();
            console.log('✓ Contrôle validé');
            alert('✓ Contrôle validé et archivé');
        } catch (err) {
            console.error('Erreur finish_check :', err);
            alert('Erreur : ' + err.message);
        } finally {
            btnFinish.disabled = false;
            btnFinish.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Valider le contrôle';
        }
    }

    async function cancelAsupCheck() {
        if (!confirm('Annuler le contrôle en cours sans enregistrement ?')) return;

        try {
            await makeApiRequest('api/asup.php?action=cancel_check', 'POST', { vehicle_id: 'vsav' });
            asupSession = null;
            renderCheckPanel();
            console.log('✓ Contrôle annulé');
        } catch (err) {
            console.error('Erreur cancel :', err);
            alert('Erreur : ' + err.message);
        }
    }

    async function sendAlerts() {
        const btn = btnSendAlerts;
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';

        try {
            const res = await makeApiRequest('api/asup.php?action=send_alerts', 'POST', {});
            console.log('✓ Alertes envoyées :', res);
            alert(res.message || 'Alertes traitées');
        } catch (err) {
            console.error('Erreur send_alerts :', err);
            alert('Erreur : ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    async function generateReport() {
        const year = new Date().getFullYear();
        const btn  = btnGenReport;
        if (!btn) return;

        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Génération...';

        try {
            // La réponse est un PDF binaire streamé, pas du JSON
            const response = await fetch('api/asup.php?action=generate_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store',
                },
                body: JSON.stringify({ year }),
            });

            if (!response.ok) {
                // En cas d'erreur, le serveur renvoie du JSON
                const err = await response.json();
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            // Ouvrir le PDF dans un nouvel onglet via un blob URL temporaire
            const blob    = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const tab     = window.open(blobUrl, '_blank');
            // Révoquer l'URL blob après ouverture (5 s)
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            if (!tab) alert('Le PDF a été généré mais le navigateur a bloqué l\'ouverture. Autorisez les pop-ups pour ce site.');
        } catch (err) {
            console.error('Erreur generate_report :', err);
            alert('Erreur lors de la génération du rapport : ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

	// ====================================================================
    // IMPRESSION INVENTAIRE ASUP (VIA SCRIPT PYTHON / PDF)
    // ====================================================================

    async function printInventory() {
        const btn = btnPrintInventory;
        const orig = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Génération du PDF...';
        }

        try {
            // Option 1 : Si votre API PHP gère l'appel du script Python et renvoie le PDF ou son URL
            const response = await fetch('api/asup.php?action=print_pdf&vehicle_id=vsav');
            
            if (!response.ok) {
                throw new Error('Erreur lors de la génération du PDF par le serveur.');
            }

            // Si l'API renvoie directement le flux PDF, on l'ouvre dans un nouvel onglet
            const blob = await response.blob();
            const pdfUrl = URL.createObjectURL(blob);
            window.open(pdfUrl, '_blank');

        } catch (err) {
            console.error(err);
            alert('Impossible de générer le rapport PDF : ' + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = orig;
            }
        }
    }

    // ====================================================================
    // UTILITAIRES
    // ====================================================================

    function viewDetails(checkId) {
        const check = asupHistory.find(h => h.id === checkId);
        if (!check) return;
        alert(`Détails du contrôle du ${check.finished_at}\nAgent: ${check.agent}\nPointage: ${check.checked_count}/${check.total_count}\nNon vérifié: ${check.unchecked_count}`);
    }

    // ====================================================================
    // EVENT LISTENERS
    // ====================================================================

    function setupEventListeners() {
        if (btnFinish) btnFinish.onclick = finishAsupCheck;
        if (btnCancel) btnCancel.onclick = cancelAsupCheck;
        if (btnSendAlerts)     btnSendAlerts.onclick     = sendAlerts;
        if (btnGenReport)      btnGenReport.onclick      = generateReport;
        if (btnPrintInventory) btnPrintInventory.onclick = printInventory;
        if (yearFilter) yearFilter.onchange = renderHistory;

        // Onglet ASUP
        document.querySelectorAll('.dash-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.tab === 'tab-asup') {
                    loadAsupData();
                }
            });
        });
    }

    // ====================================================================
    // PUBLIC API
    // ====================================================================

    return {
        init: init,
        viewDetails: viewDetails,
    };
})();