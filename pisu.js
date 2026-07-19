/**
 * pisu.js
 * Moteur JavaScript de l'espace PISU.
 * Gère :
 * - Authentification via modal
 * - Affichage dynamique des médicaments (tableau/cards)
 * - Ajout/modification/suppression de médicaments
 * - Configuration des alertes d'expiration
 */

document.addEventListener('DOMContentLoaded', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // DOM ELEMENTS
    // ─────────────────────────────────────────────────────────────────────────
    const loginView        = document.getElementById('login-view');
    const dashboardView    = document.getElementById('dashboard-view');
    const loginForm        = document.getElementById('login-form');
    const loginUsername    = document.getElementById('login-username');
    const loginPassword    = document.getElementById('login-password');
    const loginError       = document.getElementById('login-error');
    const logoutBtn        = document.getElementById('logout-btn');
    const usernameSpan     = document.getElementById('username-span');
    
    const medicinesTbody   = document.getElementById('medicines-tbody');
    const medicinesCards   = document.getElementById('medicines-cards');
    const btnAddMedicine   = document.getElementById('btn-add-medicine');
    const medicineModal    = document.getElementById('medicine-modal');
    const medicineForm     = document.getElementById('medicine-form');
    const medicineError    = document.getElementById('medicine-error');
    const closeModalBtns   = document.querySelectorAll('.close-modal, .close-modal-btn');
    
    const configForm       = document.getElementById('config-form');
    const configAlertDays  = document.getElementById('config-alert-days');
    const configEmail      = document.getElementById('config-email');
    const btnSaveConfig    = document.getElementById('btn-save-config');
    const btnSendAlertsNow = document.getElementById('btn-send-alerts-now');
    const configMessage    = document.getElementById('config-message');

    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────
    let currentUser = null;
    let medicines   = [];
    let config      = { alert_days: 30, email: '' };

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER : API REQUESTS
    // ─────────────────────────────────────────────────────────────────────────
    async function apiRequest(url, method = 'GET', data = null) {
        if (method === 'GET') {
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}_t=${Date.now()}`;
        }
        const options = { method, headers: {}, cache: 'no-store' };
        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            if (!response.ok) {
                const err = new Error(result.error || 'Erreur serveur');
                err.details = result.details || null;
                throw err;
            }
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VUE SWITCHING
    // ─────────────────────────────────────────────────────────────────────────
    function showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUTHENTIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    async function checkSession() {
        try {
            const result = await apiRequest('api/pisu.php?action=status');
            if (result.logged_in) {
                currentUser = result.user;
                usernameSpan.textContent = currentUser.name;
                showView('dashboard-view');
                loadDashboard();
            } else {
                showView('login-view');
            }
        } catch (err) {
            showView('login-view');
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        const login = loginUsername.value.trim();
        const password = loginPassword.value.trim();

        try {
            const result = await apiRequest('api/pisu.php?action=login', 'POST', { login, password });
            if (result.success) {
                currentUser = result.user;
                usernameSpan.textContent = currentUser.name;
                loginUsername.value = '';
                loginPassword.value = '';
                showView('dashboard-view');
                loadDashboard();
            }
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await apiRequest('api/pisu.php?action=logout', 'POST');
            currentUser = null;
            window.location.href = './index.php';
        } catch (err) {
            alert(err.message);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CHARGEMENT DU DASHBOARD
    // ─────────────────────────────────────────────────────────────────────────
    async function loadDashboard() {
        try {
            const [medResult, configResult] = await Promise.all([
                apiRequest('api/pisu.php?action=list'),
                apiRequest('api/pisu.php?action=list') // Config incluse dans list
            ]);

            medicines = medResult.items || [];
            config = medResult.config || { alert_days: 30, email: '' };

            renderMedicines();
            renderConfig();
            applyResponsiveViews();
        } catch (err) {
            alert('Erreur lors du chargement : ' + err.message);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDU DES MÉDICAMENTS
    // ─────────────────────────────────────────────────────────────────────────
    function renderMedicines() {
        // --- TABLEAU DESKTOP ---
        medicinesTbody.innerHTML = '';
        if (medicines.length === 0) {
            medicinesTbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color: var(--text-secondary); padding: 2rem;">Aucun médicament enregistré.</td></tr>';
        } else {
            medicines.forEach(med => {
                const tr = document.createElement('tr');
                const statusClass = med._status === 'expired' ? 'expired' : (med._status === 'expiring' ? 'expiring' : '');
                const statusText = med._status === 'expired' ? '⚠️ Périmé' : (med._status === 'expiring' ? '⏰ Bientôt' : (med._status === 'ok' ? '✓ OK' : '—'));
                const expiryDate = med.expiry_date ? formatDateFR(med.expiry_date) : '—';

                tr.innerHTML = `
                    <td><strong>${escapeHtml(med.name)}</strong></td>
                    <td>${escapeHtml(med.dosage || '—')}</td>
                    <td>${escapeHtml(med.form || '—')}</td>
                    <td style="text-align: center; font-weight: bold;">${med.quantity}</td>
                    <td>${expiryDate}</td>
                    <td>
                        <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; ${
                            med._status === 'expired' ? 'background: rgba(239,68,68,0.2); color: var(--primary-color);' :
                            med._status === 'expiring' ? 'background: rgba(249,115,22,0.2); color: #f97316;' :
                            'background: rgba(16,185,129,0.2); color: #10b981;'
                        }">
                            ${statusText}
                        </span>
                    </td>
                    <td class="text-right" style="white-space: nowrap;">
                        <button class="btn btn-outline btn-sm btn-edit-med" data-id="${med.id}" style="margin-right: 0.25rem;">
                            <i class="fa-solid fa-pen-to-square"></i> Modifier
                        </button>
                        <button class="btn btn-outline btn-sm btn-delete-med" data-id="${med.id}" style="color: var(--primary-color); border-color: rgba(239,68,68,0.2);">
                            <i class="fa-solid fa-trash-can"></i> Supprimer
                        </button>
                    </td>
                `;

                tr.querySelector('.btn-edit-med').onclick = () => openMedicineModal(med);
                tr.querySelector('.btn-delete-med').onclick = () => deleteMedicine(med.id, med.name);

                medicinesTbody.appendChild(tr);
            });
        }

        // --- CARDS MOBILE ---
        medicinesCards.innerHTML = '';
        if (medicines.length === 0) {
            medicinesCards.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:1rem;">Aucun médicament.</p>';
        } else {
            medicines.forEach(med => {
                const statusEmoji = med._status === 'expired' ? '⚠️' : (med._status === 'expiring' ? '⏰' : '✓');
                const card = document.createElement('div');
                card.className = 'm-card';
                card.innerHTML = `
                    <div class="m-card-header">
                        <div style="flex: 1;">
                            <div class="m-card-title">${escapeHtml(med.name)}</div>
                            <div class="m-card-sub">${med.dosage ? escapeHtml(med.dosage) : '—'} — ${med.form ? escapeHtml(med.form) : '—'}</div>
                        </div>
                        <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; ${
                            med._status === 'expired' ? 'background: rgba(239,68,68,0.2); color: var(--primary-color);' :
                            med._status === 'expiring' ? 'background: rgba(249,115,22,0.2); color: #f97316;' :
                            'background: rgba(16,185,129,0.2); color: #10b981;'
                        }">${statusEmoji}</span>
                    </div>
                    <div class="m-card-row">
                        <span class="m-card-label">Quantité</span>
                        <span class="m-card-value" style="font-weight: bold;">${med.quantity}</span>
                    </div>
                    <div class="m-card-row">
                        <span class="m-card-label">Expiration</span>
                        <span class="m-card-value">${med.expiry_date ? formatDateFR(med.expiry_date) : '—'}</span>
                    </div>
                    ${med.notes ? `<div class="m-card-row"><span class="m-card-label">Note</span><span class="m-card-value" style="font-size:0.85rem;">${escapeHtml(med.notes)}</span></div>` : ''}
                    <div class="m-card-actions">
                        <button class="btn btn-outline btn-sm btn-mcard-edit">
                            <i class="fa-solid fa-pen-to-square"></i> Modifier
                        </button>
                        <button class="btn btn-outline btn-sm btn-mcard-delete" style="color:var(--primary-color); border-color:rgba(239,68,68,0.2);">
                            <i class="fa-solid fa-trash-can"></i> Supprimer
                        </button>
                    </div>
                `;
                card.querySelector('.btn-mcard-edit').onclick = () => openMedicineModal(med);
                card.querySelector('.btn-mcard-delete').onclick = () => deleteMedicine(med.id, med.name);
                medicinesCards.appendChild(card);
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODALE MÉDICAMENT
    // ─────────────────────────────────────────────────────────────────────────
    function openMedicineModal(med = null) {
        document.getElementById('medicine-modal-title').textContent = med ? 'Modifier le médicament' : 'Ajouter un médicament';
        document.getElementById('medicine-submit-btn').textContent = med ? 'Enregistrer' : 'Ajouter';
        medicineError.style.display = 'none';
        medicineForm.reset();

        if (med) {
            document.getElementById('medicine-id').value = med.id;
            document.getElementById('medicine-name').value = med.name;
            document.getElementById('medicine-dosage').value = med.dosage || '';
            document.getElementById('medicine-pharma-form').value = med.form || '';
            document.getElementById('medicine-quantity').value = med.quantity;
            document.getElementById('medicine-expiry').value = med.expiry_date || '';
            document.getElementById('medicine-notes').value = med.notes || '';
        } else {
            document.getElementById('medicine-id').value = '';
        }

        medicineModal.classList.add('active');
    }

    closeModalBtns.forEach(btn => {
        btn.onclick = () => medicineModal.classList.remove('active');
    });

    medicineForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        medicineError.style.display = 'none';

        const id    = document.getElementById('medicine-id').value;
        const data = {
            name:        document.getElementById('medicine-name').value.trim(),
            dosage:      document.getElementById('medicine-dosage').value.trim(),
            form:        document.getElementById('medicine-pharma-form').value,
            quantity:    parseInt(document.getElementById('medicine-quantity').value) || 0,
            expiry_date: document.getElementById('medicine-expiry').value,
            notes:       document.getElementById('medicine-notes').value.trim(),
        };

        if (!data.name) {
            medicineError.textContent = 'Le nom est obligatoire.';
            medicineError.style.display = 'block';
            return;
        }

        try {
            if (id) {
                data.id = id;
                await apiRequest('api/pisu.php?action=edit', 'POST', data);
            } else {
                await apiRequest('api/pisu.php?action=add', 'POST', data);
            }
            medicineModal.classList.remove('active');
            loadDashboard();
        } catch (err) {
            medicineError.textContent = err.message;
            medicineError.style.display = 'block';
        }
    });

    btnAddMedicine.addEventListener('click', () => openMedicineModal());

    async function deleteMedicine(id, name) {
        if (!confirm(`Supprimer le médicament "${name}" ?`)) return;
        try {
            await apiRequest('api/pisu.php?action=delete', 'POST', { id });
            loadDashboard();
        } catch (err) {
            alert(err.message);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIGURATION
    // ─────────────────────────────────────────────────────────────────────────
    function renderConfig() {
        configAlertDays.value = config.alert_days || 30;
        configEmail.value = config.email || '';
    }

    btnSaveConfig.addEventListener('click', async () => {
        configMessage.innerHTML = '';
        configMessage.style.display = 'none';

        const data = {
            alert_days: Math.max(1, parseInt(configAlertDays.value) || 30),
            email: configEmail.value.trim()
        };

        try {
            const result = await apiRequest('api/pisu.php?action=save_config', 'POST', data);
            config = result.config;
            configMessage.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-check-circle"></i> Configuration enregistrée avec succès.</div>';
            configMessage.style.display = 'block';
            setTimeout(() => { configMessage.style.display = 'none'; }, 3000);
        } catch (err) {
            configMessage.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation"></i> ' + err.message + '</div>';
            configMessage.style.display = 'block';
        }
    });

    btnSendAlertsNow.addEventListener('click', async () => {
        configMessage.innerHTML = '';
        configMessage.style.display = 'none';
        const originalHTML = btnSendAlertsNow.innerHTML;
        btnSendAlertsNow.disabled = true;
        btnSendAlertsNow.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';

        try {
            const result = await apiRequest('api/pisu.php?action=send_alerts', 'POST', {});
            if (result.sent) {
                configMessage.innerHTML = `<div class="alert alert-success"><i class="fa-solid fa-envelope"></i> E-mail envoyé. Périmés: ${result.expired}, Bientôt: ${result.expiring}</div>`;
            } else {
                configMessage.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation"></i> ${result.message}</div>`;
            }
            configMessage.style.display = 'block';
        } catch (err) {
            configMessage.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation"></i> ' + err.message + '</div>';
            configMessage.style.display = 'block';
        } finally {
            btnSendAlertsNow.disabled = false;
            btnSendAlertsNow.innerHTML = originalHTML;
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ONGLETS
    // ─────────────────────────────────────────────────────────────────────────
    document.querySelectorAll('.dash-tab-panel').forEach((p, i) => {
        p.style.display = i === 0 ? 'block' : 'none';
    });

    document.querySelectorAll('.dash-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.dash-tab-panel').forEach(p => p.style.display = 'none');
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).style.display = 'block';
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RESPONSIVE
    // ─────────────────────────────────────────────────────────────────────────
    function applyResponsiveViews() {
        const mobile = window.innerWidth < 769;
        document.querySelectorAll('.desktop-only').forEach(el => {
            el.style.display = mobile ? 'none' : 'block';
        });
        document.querySelectorAll('.mobile-only').forEach(el => {
            el.style.display = mobile ? 'flex' : 'none';
            if (mobile) el.style.flexDirection = 'column';
        });
    }

    window.addEventListener('resize', applyResponsiveViews);

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function formatDateFR(isoDate) {
        if (!isoDate) return '—';
        const parts = isoDate.split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : isoDate;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────────────────
    checkSession();
});
