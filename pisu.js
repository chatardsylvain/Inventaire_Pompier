/**
 * pisu.js — version multi-infirmiers
 * Flow : sélection infirmier → login → dashboard
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // LOGO FALLBACK
    // ─────────────────────────────────────────────────────────────────────────
    const logoImg      = document.getElementById('pisu-logo');
    const logoFallback = document.getElementById('pisu-logo-fallback');
    if (logoImg && logoFallback) {
        logoImg.addEventListener('error', function () {
            this.style.display = 'none';
            logoFallback.style.display = 'inline-block';
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DOM
    // ─────────────────────────────────────────────────────────────────────────
    const selectView          = document.getElementById('select-view');
    const loginView           = document.getElementById('login-view');
    const dashboardView       = document.getElementById('dashboard-view');

    // Sélection
    const infirmierLoading    = document.getElementById('infirmier-loading');
    const infirmierGrid       = document.getElementById('infirmier-grid');
    const infirmierError      = document.getElementById('infirmier-error');

    // Login
    const loginForm           = document.getElementById('login-form');
    const loginUsernameInput  = document.getElementById('login-username'); // hidden
    const loginPassword       = document.getElementById('login-password');
    const loginError          = document.getElementById('login-error');
    const selectedBadge       = document.getElementById('selected-infirmier-badge');
    const badgeAvatar         = document.getElementById('badge-avatar');
    const badgeName           = document.getElementById('badge-name');
    const btnChangeInfirmier  = document.getElementById('btn-change-infirmier');

    // Header
    const logoutBtn           = document.getElementById('logout-btn');
    const userDisplay         = document.getElementById('user-display');
    const usernameSpan        = document.getElementById('username-span');

    // Dashboard
    const dashboardSubtitle   = document.getElementById('dashboard-subtitle');
    const medicinesTbody      = document.getElementById('medicines-tbody');
    const medicinesCards      = document.getElementById('medicines-cards');
    const btnAddMedicine      = document.getElementById('btn-add-medicine');
    const medicineModal       = document.getElementById('medicine-modal');
    const medicineForm        = document.getElementById('medicine-form');
    const medicineError       = document.getElementById('medicine-error');
    const closeModalBtns      = document.querySelectorAll('.close-modal, .close-modal-btn');

    // Config
    const configAlertDays     = document.getElementById('config-alert-days');
    const configEmail         = document.getElementById('config-email');
    const btnSaveConfig       = document.getElementById('btn-save-config');
    const btnSendAlertsNow    = document.getElementById('btn-send-alerts-now');
    const configMessage       = document.getElementById('config-message');

    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────
    let currentUser     = null;   // { name, login, role }
    let selectedLogin   = null;   // login sélectionné avant connexion
    let selectedName    = null;
    let medicines       = [];
    let config          = { alert_days: 30, email: '' };

    // ─────────────────────────────────────────────────────────────────────────
    // API
    // ─────────────────────────────────────────────────────────────────────────
    async function apiRequest(url, method, data) {
        method = method || 'GET';
        if (method === 'GET') {
            url += (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        }
        var options = { method: method, headers: {}, cache: 'no-store' };
        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
        try {
            var response = await fetch(url, options);
            var result   = await response.json();
            if (!response.ok) {
                var err = new Error(result.error || 'Erreur serveur');
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
        document.querySelectorAll('.view').forEach(function (v) {
            v.classList.remove('active');
        });
        document.getElementById(viewId).classList.add('active');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────────────────
    function init() {
        // Valeurs injectées par PHP (pisu.php) — fallback si absent
        var isAuth   = (typeof PISU_IS_AUTH   !== 'undefined') ? PISU_IS_AUTH   : false;
        var userLogin= (typeof PISU_USER_LOGIN !== 'undefined') ? PISU_USER_LOGIN : '';
        var userName = (typeof PISU_USER_NAME  !== 'undefined') ? PISU_USER_NAME  : '';

        // PHP a déjà rendu la bonne vue si authentifié
        if (isAuth && userLogin) {
            currentUser = { name: userName, login: userLogin, role: 'infirmier' };
            showHeaderAuth();
            updateDashboardSubtitle();
            showView('dashboard-view');
            loadDashboard();
        } else {
            showView('select-view');
            loadInfirmiers();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VUE 1 : SÉLECTION INFIRMIER
    // ─────────────────────────────────────────────────────────────────────────
    async function loadInfirmiers() {
        infirmierLoading.style.display = 'flex';
        infirmierGrid.style.display    = 'none';
        infirmierError.style.display   = 'none';

        try {
            var result = await apiRequest('api/pisu.php?action=list_infirmiers');
            var list   = result.infirmiers || [];

            infirmierLoading.style.display = 'none';

            if (list.length === 0) {
                infirmierError.textContent = 'Aucun compte infirmier trouvé.';
                infirmierError.style.display = 'block';
                return;
            }

            infirmierGrid.innerHTML = '';
            list.forEach(function (inf) {
                var card = document.createElement('div');
                card.className = 'infirmier-card';

                var initials = inf.name.split(' ').map(function (w) {
                    return w.charAt(0).toUpperCase();
                }).slice(0, 2).join('');

                card.innerHTML = '<div class="infirmier-avatar">' + escapeHtml(initials) + '</div>'
                    + '<div class="infirmier-name">' + escapeHtml(inf.name) + '</div>';

                card.addEventListener('click', function () {
                    selectInfirmier(inf.login, inf.name);
                });

                infirmierGrid.appendChild(card);
            });

            infirmierGrid.style.display = 'grid';

        } catch (err) {
            infirmierLoading.style.display = 'none';
            infirmierError.textContent = 'Impossible de charger les comptes : ' + err.message;
            infirmierError.style.display = 'block';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VUE 2 : LOGIN
    // ─────────────────────────────────────────────────────────────────────────
    function selectInfirmier(login, name) {
        selectedLogin = login;
        selectedName  = name;

        // Badge
        var initials = name.split(' ').map(function (w) {
            return w.charAt(0).toUpperCase();
        }).slice(0, 2).join('');

        badgeAvatar.textContent      = initials;
        badgeName.textContent        = name;
        selectedBadge.style.display  = 'flex';

        loginUsernameInput.value = login;
        loginPassword.value      = '';
        loginError.style.display = 'none';

        showView('login-view');
        setTimeout(function () { loginPassword.focus(); }, 100);
    }

    btnChangeInfirmier.addEventListener('click', function () {
        selectedLogin = null;
        selectedName  = null;
        loginPassword.value = '';
        showView('select-view');
    });

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        loginError.style.display = 'none';

        var login    = loginUsernameInput.value.trim();
        var password = loginPassword.value.trim();

        if (!login) {
            loginError.textContent = 'Veuillez sélectionner un infirmier.';
            loginError.style.display = 'block';
            return;
        }

        try {
            var result = await apiRequest('api/pisu.php?action=login', 'POST', { login: login, password: password });
            if (result.success) {
                currentUser = result.user;
                loginPassword.value = '';
                showHeaderAuth();
                updateDashboardSubtitle();
                showView('dashboard-view');
                loadDashboard();
            }
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HEADER AUTH
    // ─────────────────────────────────────────────────────────────────────────
    function showHeaderAuth() {
        if (!currentUser) return;
        usernameSpan.textContent   = currentUser.name;
        userDisplay.style.display  = '';
        logoutBtn.style.display    = '';
    }

    function updateDashboardSubtitle() {
        if (dashboardSubtitle && currentUser) {
            dashboardSubtitle.textContent = 'Inventaire PISU — ' + currentUser.name + ' — Protocole Infirmier de Soins d\'Urgence.';
        }
    }

    logoutBtn.addEventListener('click', async function () {
        try {
            await apiRequest('api/pisu.php?action=logout', 'POST');
            currentUser   = null;
            selectedLogin = null;
            selectedName  = null;
            window.location.href = './index.php';
        } catch (err) {
            alert(err.message);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // VUE 3 : DASHBOARD
    // ─────────────────────────────────────────────────────────────────────────
    async function loadDashboard() {
        try {
            var result = await apiRequest('api/pisu.php?action=list');
            medicines  = result.items  || [];
            config     = result.config || { alert_days: 30, email: '' };
            renderMedicines();
            renderConfig();
            applyResponsiveViews();
        } catch (err) {
            alert('Erreur lors du chargement : ' + err.message);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDU MÉDICAMENTS
    // ─────────────────────────────────────────────────────────────────────────
    function renderMedicines() {
        medicinesTbody.innerHTML = '';

        if (medicines.length === 0) {
            medicinesTbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--text-secondary);padding:2rem;">Aucun médicament enregistré.</td></tr>';
        } else {
            medicines.forEach(function (med) {
                var tr         = document.createElement('tr');
                var statusText = med._status === 'expired'  ? '⚠️ Périmé'
                               : med._status === 'expiring' ? '⏰ Bientôt'
                               : med._status === 'ok'       ? '✓ OK' : '—';
                var expiryDate = med.expiry_date ? formatDateFR(med.expiry_date) : '—';
                var statusStyle = med._status === 'expired'  ? 'background:rgba(239,68,68,0.2);color:var(--primary-color);'
                                : med._status === 'expiring' ? 'background:rgba(249,115,22,0.2);color:#f97316;'
                                : 'background:rgba(16,185,129,0.2);color:#10b981;';

                tr.innerHTML = '<td><strong>' + escapeHtml(med.name) + '</strong></td>'
                    + '<td>' + escapeHtml(med.dosage || '—') + '</td>'
                    + '<td>' + escapeHtml(med.form   || '—') + '</td>'
                    + '<td style="text-align:center;font-weight:bold;">' + med.quantity + '</td>'
                    + '<td>' + expiryDate + '</td>'
                    + '<td><span style="padding:2px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;' + statusStyle + '">' + statusText + '</span></td>'
                    + '<td class="text-right" style="white-space:nowrap;">'
                    +   '<button class="btn btn-outline btn-sm btn-edit-med" style="margin-right:0.25rem;"><i class="fa-solid fa-pen-to-square"></i> Modifier</button>'
                    +   '<button class="btn btn-outline btn-sm btn-delete-med" style="color:var(--primary-color);border-color:rgba(239,68,68,0.2);"><i class="fa-solid fa-trash-can"></i> Supprimer</button>'
                    + '</td>';

                tr.querySelector('.btn-edit-med').onclick   = (function (m) { return function () { openMedicineModal(m); }; })(med);
                tr.querySelector('.btn-delete-med').onclick = (function (m) { return function () { deleteMedicine(m.id, m.name); }; })(med);

                medicinesTbody.appendChild(tr);
            });
        }

        // Cards mobile
        medicinesCards.innerHTML = '';
        if (medicines.length === 0) {
            medicinesCards.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:1rem;">Aucun médicament.</p>';
        } else {
            medicines.forEach(function (med) {
                var statusEmoji = med._status === 'expired' ? '⚠️' : (med._status === 'expiring' ? '⏰' : '✓');
                var statusStyle = med._status === 'expired'  ? 'background:rgba(239,68,68,0.2);color:var(--primary-color);'
                                : med._status === 'expiring' ? 'background:rgba(249,115,22,0.2);color:#f97316;'
                                : 'background:rgba(16,185,129,0.2);color:#10b981;';
                var card = document.createElement('div');
                card.className = 'm-card';
                card.innerHTML = '<div class="m-card-header">'
                    +   '<div style="flex:1;">'
                    +     '<div class="m-card-title">' + escapeHtml(med.name) + '</div>'
                    +     '<div class="m-card-sub">' + (med.dosage ? escapeHtml(med.dosage) : '—') + ' — ' + (med.form ? escapeHtml(med.form) : '—') + '</div>'
                    +   '</div>'
                    +   '<span style="padding:4px 8px;border-radius:4px;font-size:0.75rem;font-weight:700;' + statusStyle + '">' + statusEmoji + '</span>'
                    + '</div>'
                    + '<div class="m-card-row"><span class="m-card-label">Quantité</span><span class="m-card-value" style="font-weight:bold;">' + med.quantity + '</span></div>'
                    + '<div class="m-card-row"><span class="m-card-label">Expiration</span><span class="m-card-value">' + (med.expiry_date ? formatDateFR(med.expiry_date) : '—') + '</span></div>'
                    + (med.notes ? '<div class="m-card-row"><span class="m-card-label">Note</span><span class="m-card-value" style="font-size:0.85rem;">' + escapeHtml(med.notes) + '</span></div>' : '')
                    + '<div class="m-card-actions">'
                    +   '<button class="btn btn-outline btn-sm btn-mcard-edit"><i class="fa-solid fa-pen-to-square"></i> Modifier</button>'
                    +   '<button class="btn btn-outline btn-sm btn-mcard-delete" style="color:var(--primary-color);border-color:rgba(239,68,68,0.2);"><i class="fa-solid fa-trash-can"></i> Supprimer</button>'
                    + '</div>';

                card.querySelector('.btn-mcard-edit').onclick   = (function (m) { return function () { openMedicineModal(m); }; })(med);
                card.querySelector('.btn-mcard-delete').onclick = (function (m) { return function () { deleteMedicine(m.id, m.name); }; })(med);

                medicinesCards.appendChild(card);
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODALE MÉDICAMENT
    // ─────────────────────────────────────────────────────────────────────────
    function openMedicineModal(med) {
        document.getElementById('medicine-modal-title').textContent  = med ? 'Modifier le médicament' : 'Ajouter un médicament';
        document.getElementById('medicine-submit-btn').textContent   = med ? 'Enregistrer' : 'Ajouter';
        medicineError.style.display = 'none';
        medicineForm.reset();

        if (med) {
            document.getElementById('medicine-id').value           = med.id;
            document.getElementById('medicine-name').value         = med.name;
            document.getElementById('medicine-dosage').value       = med.dosage || '';
            document.getElementById('medicine-pharma-form').value  = med.form   || '';
            document.getElementById('medicine-quantity').value     = med.quantity;
            document.getElementById('medicine-expiry').value       = med.expiry_date || '';
            document.getElementById('medicine-notes').value        = med.notes  || '';
        } else {
            document.getElementById('medicine-id').value = '';
        }

        medicineModal.classList.add('active');
    }

    closeModalBtns.forEach(function (btn) {
        btn.onclick = function () { medicineModal.classList.remove('active'); };
    });

    medicineForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        medicineError.style.display = 'none';

        var id   = document.getElementById('medicine-id').value;
        var data = {
            name:        document.getElementById('medicine-name').value.trim(),
            dosage:      document.getElementById('medicine-dosage').value.trim(),
            form:        document.getElementById('medicine-pharma-form').value,
            quantity:    parseInt(document.getElementById('medicine-quantity').value) || 0,
            expiry_date: document.getElementById('medicine-expiry').value,
            notes:       document.getElementById('medicine-notes').value.trim(),
        };

        if (!data.name) {
            medicineError.textContent    = 'Le nom est obligatoire.';
            medicineError.style.display  = 'block';
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
            medicineError.textContent   = err.message;
            medicineError.style.display = 'block';
        }
    });

    btnAddMedicine.addEventListener('click', function () { openMedicineModal(null); });

    async function deleteMedicine(id, name) {
        if (!confirm('Supprimer le médicament "' + name + '" ?')) return;
        try {
            await apiRequest('api/pisu.php?action=delete', 'POST', { id: id });
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
        configEmail.value     = config.email      || '';
    }

    btnSaveConfig.addEventListener('click', async function () {
        configMessage.innerHTML      = '';
        configMessage.style.display  = 'none';

        var data = {
            alert_days: Math.max(1, parseInt(configAlertDays.value) || 30),
            email:      configEmail.value.trim()
        };

        try {
            var result = await apiRequest('api/pisu.php?action=save_config', 'POST', data);
            config = result.config;
            configMessage.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-check-circle"></i> Configuration enregistrée avec succès.</div>';
            configMessage.style.display = 'block';
            setTimeout(function () { configMessage.style.display = 'none'; }, 3000);
        } catch (err) {
            configMessage.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation"></i> ' + err.message + '</div>';
            configMessage.style.display = 'block';
        }
    });

    btnSendAlertsNow.addEventListener('click', async function () {
        configMessage.innerHTML      = '';
        configMessage.style.display  = 'none';
        var originalHTML = btnSendAlertsNow.innerHTML;
        btnSendAlertsNow.disabled  = true;
        btnSendAlertsNow.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi…';

        try {
            var result = await apiRequest('api/pisu.php?action=send_alerts', 'POST', {});
            if (result.sent) {
                configMessage.innerHTML = '<div class="alert alert-success"><i class="fa-solid fa-envelope"></i> E-mail envoyé. Périmés : ' + result.expired + ', Bientôt : ' + result.expiring + '</div>';
            } else {
                configMessage.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation"></i> ' + (result.message || result.error || 'Erreur inconnue') + '</div>';
            }
            configMessage.style.display = 'block';
        } catch (err) {
            configMessage.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-triangle-exclamation"></i> ' + err.message + '</div>';
            configMessage.style.display = 'block';
        } finally {
            btnSendAlertsNow.disabled  = false;
            btnSendAlertsNow.innerHTML = originalHTML;
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ONGLETS
    // ─────────────────────────────────────────────────────────────────────────
    document.querySelectorAll('.dash-tab-panel').forEach(function (p, i) {
        p.style.display = i === 0 ? 'block' : 'none';
    });

    document.querySelectorAll('.dash-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.dash-tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.dash-tab-panel').forEach(function (p) { p.style.display = 'none'; });
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).style.display = 'block';
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // RESPONSIVE
    // ─────────────────────────────────────────────────────────────────────────
    function applyResponsiveViews() {
        var mobile = window.innerWidth < 769;
        document.querySelectorAll('.desktop-only').forEach(function (el) {
            el.style.display = mobile ? 'none' : 'block';
        });
        document.querySelectorAll('.mobile-only').forEach(function (el) {
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
        var parts = isoDate.split('-');
        return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : isoDate;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DÉMARRAGE
    // ─────────────────────────────────────────────────────────────────────────
    init();
});
