/**
 * admin.js
 * Moteur JavaScript de l'interface d'administration (SPA - Single Page Application).
 * Ce script gère :
 * - L'authentification des administrateurs (sessions de connexion/déconnexion)
 * - L'affichage dynamique du Tableau de Bord (Listes des véhicules et des admins)
 * - L'éditeur interactif d'inventaires (CRUD complet en mémoire avec sauvegarde via l'API REST)
 * - Le téléversement en AJAX des images de véhicules
 * - La prévention de la mise en cache navigateur pour garantir l'affichage des données à jour.
 *
 * Modifié le 2026-09-07 �?" Compression canvas côté client avant upload (fix UPLOAD_ERR_INI_SIZE PHP 1)
 *   Fonction compressImage() ajoutée en section 11, appliquée aux deux points d'upload :
 *   image véhicule (imageUploadInput) et photo équipement (item-img-file-input).
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. D�?CLARATION DES �?L�?MENTS DU DOM
    // -------------------------------------------------------------------------
	// Logo Caserne
    const logoImg = document.getElementById('header-logo-img');
    // Conteneurs des vues (écrans de l'application)
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const editorView = document.getElementById('editor-view');
    
    // Formulaire de Connexion
    const loginForm = document.getElementById('login-form');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    
    // Boutons & �?léments d'en-tête
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplay = document.getElementById('user-display');
    const usernameSpan = document.getElementById('username-span');

    // Tables du Tableau de Bord
    const vehiclesListTbody = document.getElementById('vehicles-list-tbody');
    const usersListTbody = document.getElementById('users-list-tbody');
    const alertsListTbody = document.getElementById('alerts-list-tbody');
    const btnAddVehicle = document.getElementById('btn-add-vehicle');
    const btnAddUser = document.getElementById('btn-add-user');
    const btnPrintAllQrcodes = document.getElementById('btn-print-all-qrcodes');
    const btnRegenerateQrcodes = document.getElementById('btn-regenerate-qrcodes');

    // Modale de création d'administrateurs
    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    const userError = document.getElementById('user-error');
    const closeModalElements = document.querySelectorAll('.close-modal, .close-modal-btn');

    // Formulaire de l'éditeur de véhicule (métadonnées)
    const vehicleMetaForm = document.getElementById('vehicle-meta-form');
    const btnEditorBack = document.getElementById('btn-editor-back');
    const editorTitle = document.getElementById('editor-title');
    const editVehicleId = document.getElementById('edit-vehicle-id');
    const editVehicleName = document.getElementById('edit-vehicle-name');
    const editVehicleType = document.getElementById('edit-vehicle-type');
    const editVehicleDesc = document.getElementById('edit-vehicle-desc');
    const editVehicleIcon = document.getElementById('edit-vehicle-icon');
    const editVehicleImage = document.getElementById('edit-vehicle-image');
    
    // Image Upload & Statuts
    const imageUploadInput = document.getElementById('image-upload-input');
    const uploadStatus = document.getElementById('upload-status');
    
    // Conteneurs de l'éditeur de localisations
    const locationsEditorList = document.getElementById('locations-editor-list');
    const btnAddLocation = document.getElementById('btn-add-location');
    const btnSaveAll = document.getElementById('btn-save-all');

    // -------------------------------------------------------------------------
    // 2. VARIABLES D'�?TAT DE L'APPLICATION (Mémoire vive)
    // -------------------------------------------------------------------------
    let currentUser = null;         // Stocke l'utilisateur connecté (login et nom d'affichage)
    let vehiclesList = [];          // Liste de tous les véhicules chargée depuis l'API
    let usersList = [];             // Liste de tous les comptes administrateurs chargée depuis l'API
    let pendingUserRoles = {};      // id -> rôles cochés non encore validés
    // admin.js �?" Modifié le 2026-09-02
    //   �?� Ajout des rôles chef_caserne et adjoint (APP_ROLES, expandRolesClient, toggleRoleInList)
    //   �?� Ajout sélecteur d'image partagée /images/ sur les items (btnSelectImg + modale image-picker)
    // admin.js �?" Modifié le 2026-09-04
    //   �?� Exposition de vehiclesList sur window.vehiclesList pour accès depuis ct-admin.js (scope externe)

    let loginAutoFill = true;       // génération auto du login nom_prenom tant que l'utilisateur ne le saisit pas

    const APP_ROLES = [
        { id: 'superadmin',            label: 'Super admin',     short: 'Super admin' },
        { id: 'admin',                 label: 'Admin',           short: 'Admin' },
        { id: 'chef_caserne',          label: 'Chef de caserne', short: 'Chef cas.' },
        { id: 'adjoint',               label: 'Adjoint',         short: 'Adjoint' },
        { id: 'infirmier',             label: 'Infirmier',       short: 'Infirmier' },
        { id: 'correspondant_pharmacie', label: 'Corresp. pharma', short: 'Pharma' },
        { id: 'responsable_vehicule',  label: 'Resp. véhicule',  short: 'Resp. véh.' },
        { id: 'contributeur',          label: 'Contributeur',    short: 'Contrib.' },
    ];
    const ALL_ROLE_IDS = APP_ROLES.map(r => r.id);
    const FUNCTIONAL_ROLE_IDS = ALL_ROLE_IDS.filter(id => id !== 'superadmin');
    // Rôles implicitement accordés à chef_caserne et adjoint
    const CHEF_ADJOINT_IMPLIED = ['correspondant_pharmacie', 'responsable_vehicule', 'contributeur'];

    function setCurrentUser(user) {
        currentUser = user;
        window.currentUser = user;
    }

    function userRolesList(user) {
        if (user && Array.isArray(user.roles) && user.roles.length) return user.roles.slice();
        if (user && user.role) return [user.role];
        return ['contributeur'];
    }

    function currentUserHasRole(...ids) {
        const roles = userRolesList(currentUser);
        if (roles.includes('superadmin')) return true;
        const functional = ids.filter(id => id !== 'superadmin');
        if (roles.includes('admin') && functional.length) return true;
        return ids.some(id => roles.includes(id));
    }

    function rolesEqual(a, b) {
        return [...a].sort().join(',') === [...b].sort().join(',');
    }

    function slugLogin(lastName, firstName) {
        return (lastName + '_' + firstName)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    function splitUserName(user) {
        if (user.first_name || user.last_name) {
            return { first_name: user.first_name || '', last_name: user.last_name || '' };
        }
        const name = (user.name || '').trim();
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length <= 1) return { first_name: parts[0] || '', last_name: '' };
        return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
    }

    function expandRolesClient(roles, canSuper) {
        const set = new Set(roles.filter(id => ALL_ROLE_IDS.includes(id)));
        if (set.has('superadmin') && canSuper) return ALL_ROLE_IDS.slice();
        if (set.has('superadmin') && !canSuper) set.add('admin');
        if (set.has('admin')) {
            FUNCTIONAL_ROLE_IDS.forEach(id => set.add(id));
            if (!canSuper) set.delete('superadmin');
        }
        // chef_caserne et adjoint impliquent correspondant_pharmacie + responsable_vehicule + contributeur
        if (set.has('chef_caserne') || set.has('adjoint')) {
            CHEF_ADJOINT_IMPLIED.forEach(id => set.add(id));
        }
        if (set.size === 0) set.add('contributeur');
        return ALL_ROLE_IDS.filter(id => set.has(id));
    }

    function toggleRoleInList(roles, roleId, checked, canSuper) {
        let next = roles.slice();
        if (roleId === 'superadmin' && !canSuper) return expandRolesClient(next, canSuper);

        if (checked) {
            if (!next.includes(roleId)) next.push(roleId);
            if (roleId === 'superadmin' || roleId === 'admin') {
                next = expandRolesClient(next, canSuper);
            }
        } else {
            next = next.filter(r => r !== roleId);
            if (roleId === 'superadmin' || roleId === 'admin') {
                if (!next.includes('superadmin') && !next.includes('admin')) {
                    next = ['contributeur'];
                } else if (roleId === 'superadmin' && next.includes('admin')) {
                    next = FUNCTIONAL_ROLE_IDS.slice();
                }
            } else if (roleId === 'chef_caserne' || roleId === 'adjoint') {
                // Si ni chef_caserne ni adjoint ni admin dans next, retirer les implicites
                if (!next.includes('chef_caserne') && !next.includes('adjoint') &&
                    !next.includes('admin') && !next.includes('superadmin')) {
                    next = next.filter(r => !CHEF_ADJOINT_IMPLIED.includes(r));
                    if (next.length === 0) next = ['contributeur'];
                }
            } else if (next.includes('admin') || next.includes('superadmin')) {
                next = expandRolesClient(next.concat([roleId]), canSuper);
            }
            if (next.length === 0) next = ['contributeur'];
        }
        return expandRolesClient(next, canSuper);
    }

    function getEffectiveRoles(user) {
        const key = String(user.id);
        if (pendingUserRoles[key]) return pendingUserRoles[key].slice();
        return expandRolesClient(userRolesList(user), true);
    }

    function isUserRolesDirty(user) {
        return !rolesEqual(getEffectiveRoles(user), expandRolesClient(userRolesList(user), true));
    }

    function syncRolesSaveButton() {
        const btn = document.getElementById('btn-save-user-roles');
        if (!btn) return;
        const dirty = usersList.some(isUserRolesDirty);
        btn.disabled = !dirty;
    }
    let alertsList = [];            // Liste de toutes les alertes chargée depuis l'API
    let inventoryHistoryList = [];  // Historique des inventaires réalisés (traçabilité)
	let ctDataList = [];            // Données CT chargées depuis l'API
    let editingVehicle = null;      // Copie de travail du véhicule en cours d'édition
    let isNewVehicle = false;       // Indicateur : Nouveau véhicule (true) ou Modification d'un existant (false)

    // -------------------------------------------------------------------------
    // 3. SECURISE LES FORMULAIRES CONTRE LES RECHARGEMENTS ACCIDENTELS
    // -------------------------------------------------------------------------
    if (vehicleMetaForm) {
        // Empêche la touche "Entrée" dans les champs textes de recharger la page
        vehicleMetaForm.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    // -------------------------------------------------------------------------
    // 4. GESTION DU CHANGEMENT DE VUE (Single Page Application)
    // -------------------------------------------------------------------------
    // gestion du logo en cas d'erreur
	if (logoImg) {
        logoImg.addEventListener('error', function() {
            this.style.display = 'none';
        });
    }
	/**
     * Affiche uniquement la vue demandée et masque les autres.
     * @param {string} viewId Identifiant HTML du bloc à afficher (login-view, dashboard-view, editor-view).
     */
    function showView(viewId) {
        document.querySelectorAll('.admin-view').forEach(view => {
            view.classList.remove('active');
        });
        const target = document.getElementById(viewId);
        if (target) target.classList.add('active');

        // Sidebar visible seulement sur dashboard-view
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar) {
            sidebar.style.display = (viewId === 'dashboard-view') ? '' : 'none';
        }
    }

    // -------------------------------------------------------------------------
    // 5. FONCTIONS DE COMMUNICATION AVEC L'API (FETCH)
    // -------------------------------------------------------------------------
    /**
     * Effectue une requête HTTP asynchrone (Fetch) sécurisée et sans cache vers le serveur PHP.
     * 
     * @param {string} url L'URL de l'API à appeler.
     * @param {string} method La méthode HTTP (GET, POST).
     * @param {object} data Les données à envoyer au format JSON (dans le body d'une requête POST).
     * @returns {Promise<object>} Les données retournées par l'API décodées.
     */
    async function apiRequest(url, method = 'GET', data = null) {
        const options = {
            method,
            headers: {},
            // Force le navigateur à ignorer le cache et à interroger le serveur à chaque fois
            cache: 'no-store',
            // Envoie toujours les cookies de session (nécessaire pour requireAuth côté PHP)
            credentials: 'include'
        };
        
        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            // Si le code HTTP retourné n'est pas dans les 200 (ex: 401 Non autorisé, 500 Erreur serveur)
            if (!response.ok) {
                const err = new Error(result.error || 'Une erreur est survenue.');
                err.details = result.details || null;
                throw err;
            }
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    /**
     * Affiche l'onglet ASUP et initialise CT une fois l'utilisateur connu.
     * Doit être appelé après une session déjà ouverte ET après un login réussi
     * (sinon l'onglet reste masqué jusqu'au prochain rechargement).
     */
    // Exposition des fonctions utilitaires pour les modules externes (ct-admin.js, asup-admin.js)
    window.apiRequest = apiRequest;
    window.showToast  = showToast;

    function initOptionalModules() {
        if (!currentUser) return;
        // Initialise la sidebar selon le rôle utilisateur
        initSidebar();
        if (window.asupModule) {
            window.asupModule.init(currentUser);
        }
        if (window.ctModule) {
            window.ctModule.init(currentUser);
        }
    }

    // -------------------------------------------------------------------------
    // 6. GESTION DES SESSIONS ET DE L'AUTHENTIFICATION
    // -------------------------------------------------------------------------
    
    /**
     * Vérifie au chargement si une session valide existe déjà côté serveur.
     * Si oui, redirige vers le tableau de bord, sinon affiche la page de connexion.
     */
    async function checkSession() {
        try {
            const result = await apiRequest('api/auth.php?action=status');
            if (result.logged_in) {
                setCurrentUser(result.user);
                usernameSpan.textContent = currentUser.name;
                userDisplay.style.display = 'inline-flex';
                logoutBtn.style.display = 'inline-flex';
                showView('dashboard-view');
                loadDashboardData();
                initOptionalModules();
            } else {
                showView('login-view');
            }
        } catch (err) {
            showView('login-view');
        }
    }

    // Gestion de la soumission du formulaire de connexion
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Bloque la soumission par défaut du navigateur
        loginError.style.display = 'none';
        
        const login = loginUsername.value.trim();
        const password = loginPassword.value.trim();
        
        try {
            const result = await apiRequest('api/auth.php?action=login', 'POST', { login, password });
            if (result.success) {
                setCurrentUser(result.user);
                usernameSpan.textContent = currentUser.name;
                userDisplay.style.display = 'inline-flex';
                logoutBtn.style.display = 'inline-flex';
                
                // Réinitialise les champs de connexion
                loginUsername.value = '';
                loginPassword.value = '';
                
                showView('dashboard-view');
                loadDashboardData();
                initOptionalModules();
            }
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
        }
    });

    // Gestion de la déconnexion
    logoutBtn.addEventListener('click', async () => {
        try {
            await apiRequest('api/auth.php?action=logout', 'POST');
            setCurrentUser(null);
            // Redirige vers la page d'accueil publique avec un rechargement complet.
            // Cela force script.js à récupérer les données fraîches (alertes, inventaire)
            // depuis le serveur, sans risque de voir l'état admin en cache.
            window.location.href = './index.php';
        } catch (err) {
            alert(err.message);
        }
    });

    // -------------------------------------------------------------------------
    // 7. CHARGEMENT ET DESSIN DU TABLEAU DE BORD (DASHBOARD)
    // -------------------------------------------------------------------------
    
    /**
     * Charge en parallèle la liste des véhicules et la liste des administrateurs depuis l'API.
     */
    async function loadDashboardData() {
        // Mémoriser l'onglet actif avant le rechargement pour le restaurer ensuite
        const activeSectionEl = document.querySelector('.sidebar-item.active');
        const activeSectionId = activeSectionEl ? activeSectionEl.dataset.section : null;

        try {
            // Requêtes HTTP parallèles pour gagner en rapidité de chargement
            const [vehicles, users, alerts, inventoryHistory, cleaningConfig, ctStatuses] = await Promise.all([
                apiRequest('api/data.php?action=get_all'),
                apiRequest('api/users.php'),
                apiRequest('api/alerts.php?action=list'),
                apiRequest('api/inventory.php?action=history'),
                apiRequest('api/cleaning.php?action=status').catch(e => null),
				apiRequest('api/ct.php?action=status').catch(() => []),
            ]);
            
            vehiclesList = vehicles;
            window.vehiclesList = vehiclesList; // exposé pour ct-admin.js (scope externe)
            usersList = users;
            alertsList = alerts;
            inventoryHistoryList = inventoryHistory;
            window.cleaningConfig = cleaningConfig;
			ctDataList = ctStatuses || [];
            
            renderVehiclesTable();
            renderUsersTable();
            renderAlertsTable();
            renderInventoryHistoryTable();
            if (cleaningConfig) renderCleaningConfig();
            applyResponsiveViews();
			
			// Injecte les badges CT dans le tableau des véhicules (après renderVehiclesTable)
			if (window.ctModule) {
				// On passe ctDataList au module pour éviter un second appel API
				window.ctModule.setData(ctDataList);
				window.ctModule.injectCtData();
				window.ctModule.renderCtPanel();
			}

            // Restaurer la section active après rechargement des données
            if (activeSectionId) {
                activateSection(activeSectionId);
            }
        } catch (err) {
            alert('Erreur lors du chargement des données: ' + err.message);
        }
    }

    /**
     * Génère et injecte les lignes du tableau des véhicules dans le DOM.
     */
    function renderVehiclesTable() {
        const total = vehiclesList.length;

        // --- TABLE DESKTOP ---
        vehiclesListTbody.innerHTML = '';
        if (total === 0) {
            vehiclesListTbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--text-secondary);">Aucun véhicule enregistré.</td></tr>';
        } else {
            vehiclesList.forEach((v, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="white-space:nowrap; width:52px;">
                        <button class="btn btn-text btn-v-up" title="Monter" ${idx === 0 ? 'disabled' : ''} style="padding:0.2rem 0.35rem; color:var(--text-secondary);">
                            <i class="fa-solid fa-chevron-up" style="font-size:0.75rem;"></i>
                        </button>
                        <button class="btn btn-text btn-v-down" title="Descendre" ${idx === total - 1 ? 'disabled' : ''} style="padding:0.2rem 0.35rem; color:var(--text-secondary);">
                            <i class="fa-solid fa-chevron-down" style="font-size:0.75rem;"></i>
                        </button>
                    </td>
                    <td>
                        <strong>${v.name}</strong>${v.unavailable ? ' <span class="badge-unavailable"><i class="fa-solid fa-ban"></i> Indisponible</span>' : ''}
                        <br><small style="color:var(--text-secondary);">${v.type}</small>
                    </td>
                    <td style="color: var(--text-secondary);">${v.description || '-'}</td>
                    <td class="text-right" style="white-space:nowrap;">
                        <label class="unavailability-toggle" title="${v.unavailable ? 'Remettre disponible' : 'Marquer comme indisponible'}" style="margin-right:0.5rem;">
                            <input type="checkbox" class="chk-unavailable" ${v.unavailable ? 'checked' : ''}>
                            <span class="unavailability-slider"></span>
                        </label>
                        <button class="btn btn-outline btn-sm btn-clone-vehicle" title="Cloner ce véhicule" style="margin-right: 0.25rem; color: #a78bfa; border-color: rgba(167,139,250,0.3);">
                            <i class="fa-solid fa-copy"></i>cloner
                        </button>
                        <button class="btn btn-outline btn-sm btn-print-single-qr" title="Imprimer le QR-Code" style="margin-right: 0.25rem;">
                            <i class="fa-solid fa-qrcode"></i>imprimer QR-code
                        </button>
                        <button class="btn btn-outline btn-sm btn-print-booklet" title="Imprimer le livret A4" style="margin-right: 0.5rem; border-color: rgba(239, 68, 68, 0.3); color: #fca5a5;">
                            <i class="fa-solid fa-file-lines"></i>imprimer livret
                        </button>
                        <button class="btn btn-outline btn-sm btn-edit-vehicle" style="margin-right: 0.5rem;">
                            <i class="fa-solid fa-pen-to-square"></i> Modifier
                        </button>
                        <button class="btn btn-outline btn-sm btn-delete-vehicle" style="color: var(--primary-color); border-color: rgba(239,68,68,0.2);">
                            <i class="fa-solid fa-trash-can"></i> Supprimer
                        </button>
                    </td>
                `;
                if (v.unavailable) tr.classList.add('vehicle-unavailable');
                tr.querySelector('.btn-v-up').onclick = () => reorderVehicle(idx, -1);
                tr.querySelector('.btn-v-down').onclick = () => reorderVehicle(idx, +1);
                tr.querySelector('.btn-print-single-qr').onclick = () => printSingleQRCode(v);
                tr.querySelector('.btn-print-booklet').onclick = () => printVehicleBooklet(v);
                tr.querySelector('.btn-edit-vehicle').onclick = () => openEditor(v);
                tr.querySelector('.btn-delete-vehicle').onclick = () => deleteVehicle(v.id, v.name);
                tr.querySelector('.btn-clone-vehicle').onclick = () => openCloneModal(v);

                // Case à cocher indisponibilité
                tr.querySelector('.chk-unavailable').onchange = async (e) => {
                    const wantUnavailable = e.target.checked;
                    if (wantUnavailable) {
                        // Demande confirmation avec motif optionnel
                        const motif = prompt(
                            `�s�️ Confirmer l'indisponibilité de "${v.name}" ?\n\nSaisissez un motif (facultatif) :`,
                            ''
                        );
                        if (motif === null) {
                            // Annulation : revenir à l'état précédent
                            e.target.checked = false;
                            return;
                        }
                        try {
                            // 1. Mettre le flag dans le JSON du véhicule
                            await apiRequest('api/data.php?action=toggle_unavailable', 'POST', { id: v.id, unavailable: true });
                            // 2. Créer l'alerte dans alerts.json + envoi mail
                            await apiRequest('api/alerts.php?action=vehicle_unavailable', 'POST', {
                                vehicle_id: v.id,
                                vehicle_name: v.name,
                                comment: motif
                            });
                            // Feedback visuel
                            showToast(`�o. Véhicule "${v.name}" marqué indisponible. Une alerte a été créée.`, 'success');
                            loadDashboardData();
                        } catch (err) {
                            e.target.checked = false;
                            showToast('Erreur : ' + err.message, 'error');
                        }
                    } else {
                        // Décocher = remettre disponible
                        if (!confirm(`Remettre le véhicule "${v.name}" comme DISPONIBLE ?\nL'alerte d'indisponibilité sera automatiquement résolue.`)) {
                            e.target.checked = true;
                            return;
                        }
                        try {
                            // 1. Remettre le flag à false dans le JSON du véhicule
                            await apiRequest('api/data.php?action=toggle_unavailable', 'POST', { id: v.id, unavailable: false });
                            // 2. Résoudre l'alerte d'indisponibilité correspondante si elle existe
                            const unavailAlert = alertsList.find(a => a.vehicle_id === v.id && a.alert_type === 'Indisponible');
                            if (unavailAlert) {
                                await apiRequest('api/alerts.php?action=resolve', 'POST', { id: unavailAlert.id });
                            }
                            showToast(`�o. Véhicule "${v.name}" remis disponible.`, 'success');
                            loadDashboardData();
                        } catch (err) {
                            e.target.checked = false;
                            showToast('Erreur : ' + err.message, 'error');
                        }
                    }
                };

                vehiclesListTbody.appendChild(tr);
            });
        }

        // --- CARDS MOBILE ---
        const vehiclesCardsList = document.getElementById('vehicles-cards-list');
        if (!vehiclesCardsList) return;
        vehiclesCardsList.innerHTML = '';
        if (total === 0) {
            vehiclesCardsList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:1rem;">Aucun véhicule enregistré.</p>';
            return;
        }
        vehiclesList.forEach((v, idx) => {
            const card = document.createElement('div');
            card.className = 'm-card';
            card.innerHTML = `
                <div class="m-card-header">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <button class="btn btn-text btn-mvc-up" title="Monter" ${idx === 0 ? 'disabled' : ''} style="padding:0.15rem 0.4rem; color:var(--text-secondary);">
                                <i class="fa-solid fa-chevron-up" style="font-size:0.7rem;"></i>
                            </button>
                            <button class="btn btn-text btn-mvc-down" title="Descendre" ${idx === total - 1 ? 'disabled' : ''} style="padding:0.15rem 0.4rem; color:var(--text-secondary);">
                                <i class="fa-solid fa-chevron-down" style="font-size:0.7rem;"></i>
                            </button>
                        </div>
                        <div>
                            <div class="m-card-title"><i class="fa-solid ${v.icon || 'fa-truck'}" style="margin-right:0.4rem; color:var(--primary-color);"></i>${v.name}${v.unavailable ? ' <span class="badge-unavailable" style="font-size:0.7rem;"><i class="fa-solid fa-ban"></i> Indisponible</span>' : ''}</div>
                            <div class="m-card-sub">${v.type}${v.description ? ' �?" ' + v.description : ''}</div>
                        </div>
                    </div>
                    <label class="unavailability-toggle" title="${v.unavailable ? 'Remettre disponible' : 'Marquer indisponible'}" style="margin-left:auto; flex-shrink:0;">
                        <input type="checkbox" class="chk-unavailable-mobile" ${v.unavailable ? 'checked' : ''}>
                        <span class="unavailability-slider"></span>
                    </label>
                </div>
                <div class="m-card-actions">
                    <button class="btn btn-outline btn-sm btn-mvc-clone" title="Cloner" style="color:#a78bfa; border-color:rgba(167,139,250,0.3);">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-mvc-qr" title="Imprimer QR-Code">
                        <i class="fa-solid fa-qrcode"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-mvc-booklet" title="Livret A4" style="border-color:rgba(239,68,68,0.3); color:#fca5a5;">
                        <i class="fa-solid fa-file-lines"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-mvc-edit" style="flex:2;">
                        <i class="fa-solid fa-pen-to-square"></i> Modifier
                    </button>
                    <button class="btn btn-outline btn-sm btn-mvc-delete" style="color:var(--primary-color); border-color:rgba(239,68,68,0.2);">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            if (v.unavailable) card.classList.add('vehicle-unavailable');
            card.querySelector('.btn-mvc-up').onclick = () => reorderVehicle(idx, -1);
            card.querySelector('.btn-mvc-down').onclick = () => reorderVehicle(idx, +1);
            card.querySelector('.btn-mvc-qr').onclick = () => printSingleQRCode(v);
            card.querySelector('.btn-mvc-booklet').onclick = () => printVehicleBooklet(v);
            card.querySelector('.btn-mvc-edit').onclick = () => openEditor(v);
            card.querySelector('.btn-mvc-delete').onclick = () => deleteVehicle(v.id, v.name);
            card.querySelector('.btn-mvc-clone').onclick = () => openCloneModal(v);

            // Case à cocher mobile
            card.querySelector('.chk-unavailable-mobile').onchange = async (e) => {
                const wantUnavailable = e.target.checked;
                if (wantUnavailable) {
                    const motif = prompt(`�s�️ Marquer "${v.name}" indisponible ?\nMotif (facultatif) :`, '');
                    if (motif === null) { e.target.checked = false; return; }
                    try {
                        await apiRequest('api/data.php?action=toggle_unavailable', 'POST', { id: v.id, unavailable: true });
                        await apiRequest('api/alerts.php?action=vehicle_unavailable', 'POST', { vehicle_id: v.id, vehicle_name: v.name, comment: motif });
                        showToast(`�o. "${v.name}" marqué indisponible.`, 'success');
                        loadDashboardData();
                    } catch (err) { e.target.checked = false; showToast('Erreur : ' + err.message, 'error'); }
                } else {
                    if (!confirm(`Remettre "${v.name}" disponible ?`)) { e.target.checked = true; return; }
                    try {
                        await apiRequest('api/data.php?action=toggle_unavailable', 'POST', { id: v.id, unavailable: false });
                        const unavailAlert = alertsList.find(a => a.vehicle_id === v.id && a.alert_type === 'Indisponible');
                        if (unavailAlert) await apiRequest('api/alerts.php?action=resolve', 'POST', { id: unavailAlert.id });
                        showToast(`�o. "${v.name}" remis disponible.`, 'success');
                        loadDashboardData();
                    } catch (err) { e.target.checked = true; showToast('Erreur : ' + err.message, 'error'); }
                }
            };

            vehiclesCardsList.appendChild(card);
        });
    }

    /**
     * Déplace un véhicule vers le haut (direction=-1) ou vers le bas (direction=+1),
     * met à jour vehiclesList en mémoire, envoie le nouvel ordre au serveur et redessine.
     */
    async function reorderVehicle(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= vehiclesList.length) return;

        [vehiclesList[index], vehiclesList[newIndex]] = [vehiclesList[newIndex], vehiclesList[index]];

        renderVehiclesTable();
        applyResponsiveViews();

        try {
            await apiRequest('api/data.php?action=reorder_vehicles', 'POST', {
                order: vehiclesList.map(v => v.id)
            });
        } catch (err) {
            alert('Erreur lors de la sauvegarde de l\'ordre : ' + err.message);
            loadDashboardData();
        }
    }

    /**
     * Génère et injecte les lignes du tableau des administrateurs dans le DOM.
     * Inclut désormais l'e-mail et un bouton Modifier.
     */
    function renderUsersTable() {
        const canSuper = currentUserHasRole('superadmin');
        const thead = document.getElementById('users-list-thead');
        if (thead) {
            thead.innerHTML = `<tr>
                <th>Utilisateur</th>
                <th>Identifiant</th>
                <th>E-mail</th>
                ${APP_ROLES.map(r => `<th class="role-col" title="${r.label}">${r.short}</th>`).join('')}
                <th class="text-right">Actions</th>
            </tr>`;
        }

        const colCount = 4 + APP_ROLES.length;
        usersListTbody.innerHTML = '';
        if (usersList.length === 0) {
            usersListTbody.innerHTML = `<tr><td colspan="${colCount}" class="text-center" style="color: var(--text-secondary);">Aucun utilisateur enregistré.</td></tr>`;
        } else {
            usersList.forEach(u => {
                const roles = getEffectiveRoles(u);
                const dirty = isUserRolesDirty(u);
                const targetIsSuper = userRolesList(u).includes('superadmin');
                const rowLocked = targetIsSuper && !canSuper;
                const tr = document.createElement('tr');
                if (dirty) tr.classList.add('row-dirty');
                const emailDisplay = u.email
                    ? `<a href="mailto:${u.email}" style="color: var(--text-secondary); font-size: 0.8em;">${u.email}</a>`
                    : '<span style="color: var(--text-secondary); font-size: 0.8em; font-style: italic;">Non renseigné</span>';
                const checks = APP_ROLES.map(r => {
                    const disabled = rowLocked || (r.id === 'superadmin' && !canSuper);
                    return `<td class="role-col">
                        <input type="checkbox" data-user-id="${u.id}" data-role="${r.id}"
                            ${roles.includes(r.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}
                            title="${r.label}">
                    </td>`;
                }).join('');
                tr.innerHTML = `
                    <td><strong>${u.name}</strong></td>
                    <td style="color: var(--text-secondary); font-family: monospace;">${u.login}</td>
                    <td>${emailDisplay}</td>
                    ${checks}
                    <td class="text-right" style="white-space: nowrap;">
                        <button class="btn btn-outline btn-sm btn-edit-user" data-id="${u.id}" style="margin-right: 0.25rem;">
                            <i class="fa-solid fa-pen-to-square"></i> Modifier
                        </button>
                        <button class="btn btn-outline btn-sm btn-delete-user" data-id="${u.id}" style="color: var(--primary-color); border-color: rgba(239,68,68,0.2);">
                            <i class="fa-solid fa-user-minus"></i> Supprimer
                        </button>
                    </td>
                `;
                tr.querySelectorAll('input[type="checkbox"][data-role]').forEach(chk => {
                    chk.onchange = () => {
                        const next = toggleRoleInList(getEffectiveRoles(u), chk.dataset.role, chk.checked, canSuper);
                        pendingUserRoles[String(u.id)] = next;
                        renderUsersTable();
                    };
                });
                tr.querySelector('.btn-edit-user').onclick = () => openUserModal(u);
                tr.querySelector('.btn-delete-user').onclick = () => deleteUser(u.id, u.name);
                usersListTbody.appendChild(tr);
            });
        }

        const usersCardsList = document.getElementById('users-cards-list');
        if (!usersCardsList) {
            syncRolesSaveButton();
            return;
        }
        usersCardsList.innerHTML = '';
        if (usersList.length === 0) {
            usersCardsList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:1rem;">Aucun utilisateur enregistré.</p>';
            syncRolesSaveButton();
            return;
        }
        usersList.forEach(u => {
            const roles = getEffectiveRoles(u);
            const targetIsSuper = userRolesList(u).includes('superadmin');
            const rowLocked = targetIsSuper && !canSuper;
            const card = document.createElement('div');
            card.className = 'm-card' + (isUserRolesDirty(u) ? ' row-dirty' : '');
            const roleChecks = APP_ROLES.map(r => {
                const disabled = rowLocked || (r.id === 'superadmin' && !canSuper);
                return `<label class="role-check${disabled ? ' is-disabled' : ''}">
                    <input type="checkbox" data-user-id="${u.id}" data-role="${r.id}"
                        ${roles.includes(r.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                    ${r.short}
                </label>`;
            }).join('');
            card.innerHTML = `
                <div class="m-card-header">
                    <div>
                        <div class="m-card-title"><i class="fa-solid fa-user" style="margin-right:0.4rem; color:var(--primary-color);"></i>${u.name}</div>
                        <div class="m-card-sub" style="font-family:monospace;">${u.login}</div>
                    </div>
                </div>
                ${u.email ? `<div class="m-card-row"><span class="m-card-label"><i class="fa-solid fa-envelope"></i></span><span class="m-card-value"><a href="mailto:${u.email}" style="color:var(--text-secondary);">${u.email}</a></span></div>` : ''}
                <div class="m-card-roles">${roleChecks}</div>
                <div class="m-card-actions">
                    <button class="btn btn-outline btn-sm btn-muc-edit">
                        <i class="fa-solid fa-pen-to-square"></i> Modifier
                    </button>
                    <button class="btn btn-outline btn-sm btn-muc-delete" style="color:var(--primary-color); border-color:rgba(239,68,68,0.2);">
                        <i class="fa-solid fa-user-minus"></i> Supprimer
                    </button>
                </div>
            `;
            card.querySelectorAll('input[type="checkbox"][data-role]').forEach(chk => {
                chk.onchange = () => {
                    const next = toggleRoleInList(getEffectiveRoles(u), chk.dataset.role, chk.checked, canSuper);
                    pendingUserRoles[String(u.id)] = next;
                    renderUsersTable();
                };
            });
            card.querySelector('.btn-muc-edit').onclick = () => openUserModal(u);
            card.querySelector('.btn-muc-delete').onclick = () => deleteUser(u.id, u.name);
            usersCardsList.appendChild(card);
        });
        syncRolesSaveButton();
    }

    function getModalRoles() {
        return [...document.querySelectorAll('#user-roles-checkboxes input[type="checkbox"]:checked')].map(c => c.value);
    }

    function renderModalRoleCheckboxes(selectedRoles) {
        const box = document.getElementById('user-roles-checkboxes');
        if (!box) return;
        const canSuper = currentUserHasRole('superadmin');
        const roles = expandRolesClient(selectedRoles, canSuper);
        box.innerHTML = APP_ROLES.map(r => {
            const disabled = r.id === 'superadmin' && !canSuper;
            return `<label class="role-check${disabled ? ' is-disabled' : ''}">
                <input type="checkbox" value="${r.id}" ${roles.includes(r.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                ${r.label}
            </label>`;
        }).join('');
        box.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.onchange = () => {
                const selectedNow = getModalRoles();
                const previous = chk.checked
                    ? selectedNow.filter(id => id !== chk.value)
                    : selectedNow.concat([chk.value]);
                const next = toggleRoleInList(previous, chk.value, chk.checked, canSuper);
                renderModalRoleCheckboxes(next);
            };
        });
    }

    function maybeAutofillLogin() {
        if (!loginAutoFill) return;
        const last = (document.getElementById('user-last-name') || {}).value || '';
        const first = (document.getElementById('user-first-name') || {}).value || '';
        const loginEl = document.getElementById('user-login');
        if (loginEl) loginEl.value = slugLogin(last, first);
    }

    /**
     * Ouvre la modale en mode Création (aucun argument) ou en mode �?dition (utilisateur fourni).
     */
    function openUserModal(user = null) {
        const modalTitle    = document.getElementById('user-modal-title');
        const userIdField   = document.getElementById('user-id');
        const passwordInput = document.getElementById('user-password');
        const passwordHint  = document.getElementById('user-password-hint');
        const submitBtn     = document.getElementById('user-submit-btn');
        const rolesGroup    = document.getElementById('user-roles-group');
        const loginEl       = document.getElementById('user-login');

        userError.style.display = 'none';
        userForm.reset();

        if (user) {
            const parts = splitUserName(user);
            modalTitle.textContent = 'Modifier le compte';
            submitBtn.textContent  = 'Enregistrer les modifications';
            userIdField.value      = user.id;
            document.getElementById('user-last-name').value  = parts.last_name;
            document.getElementById('user-first-name').value = parts.first_name;
            loginEl.value = user.login;
            document.getElementById('user-email').value = user.email || '';
            loginAutoFill = false;
            if (rolesGroup) rolesGroup.style.display = 'none';
            passwordInput.required  = false;
            passwordHint.style.display = 'block';
        } else {
            modalTitle.textContent = 'Nouvel utilisateur';
            submitBtn.textContent  = 'Créer le compte';
            userIdField.value      = '';
            loginAutoFill = true;
            if (rolesGroup) rolesGroup.style.display = '';
            renderModalRoleCheckboxes(['contributeur']);
            passwordInput.required  = true;
            passwordHint.style.display = 'none';
        }

        userModal.classList.add('active');
    }

    // -------------------------------------------------------------------------
    // 7.B CHARGEMENT ET DESSIN DU TABLEAU DES ALERTES
    // -------------------------------------------------------------------------
    function renderAlertsTable() {
        // Couleur et icône selon le type d'alerte
        function alertBadgeStyle(type) {
            switch (type) {
                case 'Manquant':     return { color: 'var(--primary-color)', icon: 'fa-triangle-exclamation' };
                case 'Périmé':      return { color: '#f97316',              icon: 'fa-triangle-exclamation' };
                case 'Indisponible': return { color: '#a78bfa',              icon: 'fa-ban' };
                default:             return { color: '#eab308',              icon: 'fa-triangle-exclamation' };
            }
        }
        // --- TABLE DESKTOP ---
        if (alertsListTbody) {
            alertsListTbody.innerHTML = '';
            if (alertsList.length === 0) {
                alertsListTbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: var(--text-secondary);"><i class="fa-solid fa-check-circle" style="color: #10b981;"></i> Aucune alerte en cours.</td></tr>';
            } else {
                alertsList.forEach(a => {
            const tr = document.createElement('tr');
            
            // Format de la date (de YYYY-MM-DD HH:ii:ss à DD/MM/YYYY HH:ii)
            let dateStr = a.date;
            if (a.date) {
                const parts = a.date.split(' ');
                if (parts.length === 2) {
                    const dParts = parts[0].split('-');
                    const tParts = parts[1].split(':');
                    dateStr = `${dParts[2]}/${dParts[1]}/${dParts[0]} ${tParts[0]}:${tParts[1]}`;
                }
            }

            const badge = alertBadgeStyle(a.alert_type);

            // Recherche du nom du véhicule pour affichage
            const vehicle = vehiclesList.find(v => v.id === a.vehicle_id);
            const vehicleName = vehicle ? vehicle.name : a.vehicle_id;

            tr.innerHTML = `
                <td style="white-space: nowrap; font-size: 0.9em; color: var(--text-secondary);">${dateStr}</td>
                <td><strong>${vehicleName}</strong><br><small style="color: var(--text-secondary);">${a.location_name}</small></td>
                <td><strong>${a.item_name}</strong></td>
                <td><span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: rgba(0,0,0,0.3); color: ${badge.color}; font-weight: bold; font-size: 0.8em;"><i class="fa-solid ${badge.icon}"></i> ${a.alert_type}</span></td>
                <td style="color: var(--text-secondary); font-style: italic; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${a.comment ? a.comment : '-'}</td>
                <td class="text-right" style="white-space: nowrap;">
                    <button class="btn btn-outline btn-sm btn-comment-alert" data-id="${a.id}" title="Commenter" style="margin-right: 0.25rem;">
                        <i class="fa-solid fa-comment-dots"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-resolve-alert" data-id="${a.id}" title="Marquer comme résolu" style="color: #10b981; border-color: rgba(16,185,129,0.3);">
                        <i class="fa-solid fa-check"></i> Résoudre
                    </button>
                </td>
            `;

            tr.querySelector('.btn-comment-alert').onclick = () => {
                const newComment = prompt(`Saisissez un commentaire d'information (ex: "Commande en cours") pour l'alerte sur ${a.item_name} :\nLaisser vide pour effacer le commentaire.`, a.comment || '');
                if (newComment !== null) {
                    apiRequest('api/alerts.php?action=comment', 'POST', { id: a.id, comment: newComment })
                        .then(() => loadDashboardData())
                        .catch(err => alert("Erreur lors de l'ajout du commentaire: " + err.message));
                }
            };

            tr.querySelector('.btn-resolve-alert').onclick = () => {
                if (confirm(`Avez-vous résolu l'anomalie concernant : ${a.item_name} ?\nL'alerte sera retirée de l'inventaire.`)) {
                    apiRequest('api/alerts.php?action=resolve', 'POST', { id: a.id })
                        .then(() => loadDashboardData())
                        .catch(err => alert("Erreur lors de la résolution de l'alerte: " + err.message));
                }
            };

            alertsListTbody.appendChild(tr);
                }); // fin forEach desktop
            } // fin else alertsList.length > 0
        } // fin if alertsListTbody

        // --- CARDS MOBILE ---
        const alertsCardsList = document.getElementById('alerts-cards-list');
        if (!alertsCardsList) {
            // badge quand même
        } else {
            alertsCardsList.innerHTML = '';
            if (alertsList.length === 0) {
                alertsCardsList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:1rem;"><i class="fa-solid fa-check-circle" style="color:#10b981;"></i> Aucune alerte en cours.</p>';
            } else {
            alertsList.forEach(a => {
                let dateStr = a.date;
                if (a.date) {
                    const parts = a.date.split(' ');
                    if (parts.length === 2) {
                        const d = parts[0].split('-');
                        const t = parts[1].split(':');
                        dateStr = `${d[2]}/${d[1]}/${d[0]} ${t[0]}:${t[1]}`;
                    }
                }
                let badgeColor = a.alert_type === 'Manquant' ? 'var(--primary-color)' : (a.alert_type === 'Périmé' ? '#f97316' : '#eab308'); // eslint-disable-line no-unused-vars (conservé pour compat éventuelle)
                const vehicle = vehiclesList.find(v => v.id === a.vehicle_id);
                const vehicleName = vehicle ? vehicle.name : a.vehicle_id;
                const cardBadge = alertBadgeStyle(a.alert_type);

                const card = document.createElement('div');
                card.className = 'm-card';
                card.innerHTML = `
                    <div class="m-card-header">
                        <div>
                            <div class="m-card-title">${a.item_name}</div>
                            <div class="m-card-sub">${vehicleName} �?" ${a.location_name}</div>
                        </div>
                        <span style="padding: 3px 10px; border-radius: 4px; background: rgba(0,0,0,0.3); color: ${cardBadge.color}; font-weight:700; font-size:0.78rem; white-space:nowrap;">
                            <i class="fa-solid ${cardBadge.icon}"></i> ${a.alert_type}
                        </span>
                    </div>
                    <div class="m-card-row">
                        <span class="m-card-label"><i class="fa-regular fa-clock"></i> Date</span>
                        <span class="m-card-value">${dateStr}</span>
                    </div>
                    ${a.comment ? `<div class="m-card-row"><span class="m-card-label"><i class="fa-solid fa-comment-dots"></i> Note</span><span class="m-card-value" style="font-style:italic;">${a.comment}</span></div>` : ''}
                    <div class="m-card-actions">
                        <button class="btn btn-outline btn-sm btn-mc-comment" data-id="${a.id}" data-item="${a.item_name}" data-comment="${escapeHtml(a.comment || '')}">
                            <i class="fa-solid fa-comment-dots"></i> Commenter
                        </button>
                        <button class="btn btn-outline btn-sm btn-mc-resolve" data-id="${a.id}" data-item="${a.item_name}" style="color:#10b981; border-color:rgba(16,185,129,0.3);">
                            <i class="fa-solid fa-check"></i> Résoudre
                        </button>
                    </div>
                `;
                card.querySelector('.btn-mc-comment').onclick = () => {
                    const newComment = prompt(`Commentaire pour ${a.item_name} :\n(Vide = effacer)`, a.comment || '');
                    if (newComment !== null) {
                        apiRequest('api/alerts.php?action=comment', 'POST', { id: a.id, comment: newComment })
                            .then(() => loadDashboardData())
                            .catch(err => alert("Erreur : " + err.message));
                    }
                };
                card.querySelector('.btn-mc-resolve').onclick = () => {
                    if (confirm(`Anomalie résolue pour : ${a.item_name} ?`)) {
                        apiRequest('api/alerts.php?action=resolve', 'POST', { id: a.id })
                            .then(() => loadDashboardData())
                            .catch(err => alert("Erreur : " + err.message));
                    }
                };
                alertsCardsList.appendChild(card);
            }); // fin forEach cards
            } // fin else alertsList.length > 0
        } // fin if alertsCardsList

        // Badge compteur sur l'onglet Alertes
        const badge = document.getElementById('alerts-badge');
        if (badge) {
            if (alertsList.length > 0) {
                badge.textContent = alertsList.length;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // -------------------------------------------------------------------------
    // 7.C CHARGEMENT ET DESSIN DE L'HISTORIQUE DES INVENTAIRES (Traçabilité)
    // -------------------------------------------------------------------------
    /**
     * Formate une date "YYYY-MM-DD HH:ii:ss" en "DD/MM/YYYY HH:ii".
     */
    function formatInventoryDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.split(' ');
        if (parts.length !== 2) return dateStr;
        const d = parts[0].split('-');
        const t = parts[1].split(':');
        return `${d[2]}/${d[1]}/${d[0]} ${t[0]}:${t[1]}`;
    }

    /**
     * Peuple le filtre déroulant "Véhicule" du panneau Historique à partir de vehiclesList.
     */
    function populateInventoryHistoryFilter() {
        const filterSelect = document.getElementById('inventory-history-filter');
        if (!filterSelect) return;
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Tous les véhicules</option>';
        vehiclesList.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.name;
            filterSelect.appendChild(option);
        });
        filterSelect.value = currentValue;
    }

    /**
     * Génère et injecte les lignes de l'historique des inventaires (traçabilité :
     * qui a vérifié quoi, quand, et quel matériel n'a pas été pointé).
     * Inclut des cases à cocher pour la suppression groupée.
     */
    function renderInventoryHistoryTable() {
        populateInventoryHistoryFilter();

        const filterSelect = document.getElementById('inventory-history-filter');
        const filterValue = filterSelect ? filterSelect.value : '';
        const filtered = filterValue
            ? inventoryHistoryList.filter(h => h.vehicle_id === filterValue)
            : inventoryHistoryList;

        // Réinitialise la barre de sélection à chaque re-rendu
        updateInventorySelectionBar(0);
        const isSuperAdmin = currentUserHasRole('superadmin');

        // --- TABLE DESKTOP ---
        const tbody = document.getElementById('inventory-history-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="color: var(--text-secondary);">Aucun inventaire enregistré pour le moment.</td></tr>';
            } else {
                // Case "tout sélectionner" dans le thead (superadmin uniquement)
                const thead = tbody.closest('table') && tbody.closest('table').querySelector('thead tr');
                if (thead) {
                    const existingThChk = thead.querySelector('.th-chk-inv');
                    if (isSuperAdmin && !existingThChk) {
                        const thChk = document.createElement('th');
                        thChk.className = 'th-chk-inv';
                        thChk.style.width = '36px';
                        thChk.innerHTML = `<input type="checkbox" class="chk-inv-select-all" title="Tout sélectionner">`;
                        thead.prepend(thChk);
                        thChk.querySelector('.chk-inv-select-all').onchange = (e) => {
                            tbody.querySelectorAll('.chk-inv-row').forEach(c => { c.checked = e.target.checked; });
                            updateInventorySelectionBar(tbody.querySelectorAll('.chk-inv-row:checked').length);
                        };
                    } else if (!isSuperAdmin && existingThChk) {
                        existingThChk.remove();
                    }
                }

                filtered.forEach(h => {
                    const tr = document.createElement('tr');
                    const missingCount = h.missing_items ? h.missing_items.length : 0;
                    const missingHtml = missingCount === 0
                        ? '<span style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> Tout vérifié</span>'
                        : `<span style="color: var(--primary-color);"><i class="fa-solid fa-triangle-exclamation"></i> ${missingCount} non pointé(s)</span>`;

                    tr.innerHTML = `
                        ${isSuperAdmin ? `<td style="width:36px; text-align:center;"><input type="checkbox" class="chk-inv-row" data-id="${h.id}"></td>` : ''}
                        <td><strong>${h.vehicle_name}</strong></td>
                        <td>${h.agents.join(', ')}</td>
                        <td style="white-space: nowrap; font-size: 0.9em; color: var(--text-secondary);">${formatInventoryDate(h.started_at)}</td>
                        <td style="white-space: nowrap; font-size: 0.9em; color: var(--text-secondary);">${formatInventoryDate(h.finished_at)}</td>
                        <td>${h.checked_count} / ${h.total_items}</td>
                        <td>${missingHtml}</td>
                        <td class="text-right" style="white-space: nowrap;">
                            <button class="btn btn-outline btn-sm btn-view-report" title="Voir le rapport détaillé">
                                <i class="fa-solid fa-file-lines"></i> Rapport
                            </button>
                        </td>
                    `;

                    tr.querySelector('.btn-view-report').onclick = () => {
                        window.open('admin/rapport_inventaire.html?id=' + encodeURIComponent(h.id), '_blank');
                    };

                    if (isSuperAdmin) {
                        tr.querySelector('.chk-inv-row').onchange = () => {
                            const checkedCount = tbody.querySelectorAll('.chk-inv-row:checked').length;
                            updateInventorySelectionBar(checkedCount);
                            const selectAll = document.querySelector('.chk-inv-select-all');
                            if (selectAll) selectAll.checked = checkedCount === filtered.length;
                        };
                    }

                    tbody.appendChild(tr);
                });
            }
        }

        // --- CARDS MOBILE ---
        const cardsList = document.getElementById('inventory-history-cards-list');
        if (cardsList) {
            cardsList.innerHTML = '';
            if (filtered.length === 0) {
                cardsList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:1rem;">Aucun inventaire enregistré pour le moment.</p>';
            } else {
                // Bouton "Tout sélectionner" en haut des cards mobile (superadmin uniquement)
                if (isSuperAdmin) {
                const selectAllBar = document.createElement('div');
                selectAllBar.style.cssText = 'display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0; margin-bottom:0.25rem;';
                selectAllBar.innerHTML = `
                    <input type="checkbox" id="chk-inv-mobile-all" style="width:18px;height:18px;cursor:pointer;">
                    <label for="chk-inv-mobile-all" style="font-size:0.88rem; color:var(--text-secondary); cursor:pointer;">Tout sélectionner</label>
                `;
                cardsList.appendChild(selectAllBar);
                selectAllBar.querySelector('#chk-inv-mobile-all').onchange = (e) => {
                    cardsList.querySelectorAll('.chk-inv-mobile-row').forEach(c => { c.checked = e.target.checked; });
                    updateInventorySelectionBar(cardsList.querySelectorAll('.chk-inv-mobile-row:checked').length);
                };
                } // fin if isSuperAdmin

                filtered.forEach(h => {
                    const missingCount = h.missing_items ? h.missing_items.length : 0;
                    const card = document.createElement('div');
                    card.className = 'm-card';
                    card.innerHTML = `
                        <div class="m-card-header" style="align-items:flex-start;">
                            ${isSuperAdmin ? `<input type="checkbox" class="chk-inv-mobile-row" data-id="${h.id}" style="width:18px;height:18px;cursor:pointer;margin-top:2px;flex-shrink:0;">` : ''}
                            <div style="flex:1; ${isSuperAdmin ? 'margin-left:0.5rem;' : ''}"}
                                <div class="m-card-title">${h.vehicle_name}</div>
                                <div class="m-card-sub">${h.agents.join(', ')}</div>
                            </div>
                        </div>
                        <div class="m-card-row">
                            <span class="m-card-label"><i class="fa-regular fa-clock"></i> Début</span>
                            <span class="m-card-value">${formatInventoryDate(h.started_at)}</span>
                        </div>
                        <div class="m-card-row">
                            <span class="m-card-label"><i class="fa-solid fa-flag-checkered"></i> Fin</span>
                            <span class="m-card-value">${formatInventoryDate(h.finished_at)}</span>
                        </div>
                        <div class="m-card-row">
                            <span class="m-card-label"><i class="fa-solid fa-list-check"></i> Pointage</span>
                            <span class="m-card-value">${h.checked_count} / ${h.total_items}</span>
                        </div>
                        ${missingCount > 0
                            ? `<div class="m-card-row"><span class="m-card-label" style="color: var(--primary-color);"><i class="fa-solid fa-triangle-exclamation"></i> Non pointé</span><span class="m-card-value" style="color: var(--primary-color);">${missingCount}</span></div>`
                            : `<div class="m-card-row"><span class="m-card-label" style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> Statut</span><span class="m-card-value" style="color:#10b981;">Tout vérifié</span></div>`
                        }
                        <div class="m-card-actions">
                            <button class="btn btn-outline btn-sm btn-mih-report">
                                <i class="fa-solid fa-file-lines"></i> Voir le rapport
                            </button>
                        </div>
                    `;
                    card.querySelector('.btn-mih-report').onclick = () => {
                        window.open('admin/rapport_inventaire.html?id=' + encodeURIComponent(h.id), '_blank');
                    };
                    if (isSuperAdmin) {
                        card.querySelector('.chk-inv-mobile-row').onchange = () => {
                            const checkedCount = cardsList.querySelectorAll('.chk-inv-mobile-row:checked').length;
                            updateInventorySelectionBar(checkedCount);
                            const mobileAll = document.getElementById('chk-inv-mobile-all');
                            if (mobileAll) mobileAll.checked = checkedCount === filtered.length;
                        };
                    }
                    cardsList.appendChild(card);
                });
            }
        }
    }

    /**
     * Met à jour (ou crée) la barre flottante de suppression groupée selon le nombre de lignes sélectionnées.
     * @param {number} count Nombre de lignes cochées
     */
    function updateInventorySelectionBar(count) {
        let bar = document.getElementById('inv-selection-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'inv-selection-bar';
            bar.style.cssText = `
                display: none;
                position: sticky; bottom: 1rem;
                background: var(--surface-color, #1e293b);
                border: 1px solid rgba(239,68,68,0.4);
                border-radius: 8px;
                padding: 0.65rem 1rem;
                margin: 0.75rem 0 0;
                align-items: center;
                gap: 1rem;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                z-index: 50;
            `;
            bar.innerHTML = `
                <span id="inv-sel-count" style="flex:1; font-size:0.9rem; color:var(--text-secondary);"></span>
                <button id="inv-btn-delete-selected" class="btn btn-sm" style="color:#fff; background:rgba(239,68,68,0.85); border:none; gap:0.35rem;">
                    <i class="fa-solid fa-trash-can"></i> Supprimer la sélection
                </button>
            `;
            // Insérer après la table ou les cards, dans le panneau historique
            const panel = document.getElementById('inventory-history-panel') || document.getElementById('tab-inventory');
            if (panel) panel.appendChild(bar);
            else document.body.appendChild(bar);

            bar.querySelector('#inv-btn-delete-selected').onclick = () => openInventoryDeleteModal();
        }

        const isSuperAdmin = currentUserHasRole('superadmin');
        if (count > 0 && isSuperAdmin) {
            bar.style.display = 'flex';
            bar.querySelector('#inv-sel-count').textContent =
                count === 1 ? '1 inventaire sélectionné' : `${count} inventaires sélectionnés`;
        } else {
            bar.style.display = 'none';
        }
    }

    /**
     * Ouvre la modale de confirmation de suppression (avec saisie du mot de passe).
     */
    function openInventoryDeleteModal() {
        // Récupère les IDs cochés (desktop + mobile)
        const ids = [
            ...document.querySelectorAll('.chk-inv-row:checked'),
            ...document.querySelectorAll('.chk-inv-mobile-row:checked')
        ].map(c => c.dataset.id).filter((v, i, a) => a.indexOf(v) === i); // dédoublonnage

        if (ids.length === 0) return;

        // Crée la modale si elle n'existe pas encore
        let modal = document.getElementById('inv-delete-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'inv-delete-modal';
            modal.className = 'modal'; // même style que les autres modales
            modal.innerHTML = `
                <div class="modal-content" style="max-width:420px;">
                    <div class="modal-header">
                        <h3 class="modal-title" style="color:var(--primary-color);">
                            <i class="fa-solid fa-trash-can"></i> Supprimer des inventaires
                        </h3>
                        <button class="close-modal" id="inv-delete-modal-close" style="background:none;border:none;cursor:pointer;font-size:1.25rem;color:var(--text-secondary);">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="modal-body" style="padding:1.25rem 1.5rem;">
                        <p id="inv-delete-modal-desc" style="margin:0 0 1.1rem; font-size:0.95rem;"></p>
                        <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.4rem;">
                            Confirmez avec votre mot de passe :
                        </label>
                        <input type="password" id="inv-delete-password" placeholder="Mot de passe"
                            style="width:100%; padding:0.55rem 0.75rem; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:inherit; font-size:0.95rem; box-sizing:border-box;">
                        <p id="inv-delete-error" style="display:none; color:var(--primary-color); font-size:0.85rem; margin:0.5rem 0 0;"></p>
                    </div>
                    <div class="modal-footer" style="padding:0.75rem 1.5rem 1.25rem; display:flex; gap:0.75rem; justify-content:flex-end;">
                        <button class="btn btn-outline btn-sm close-modal" id="inv-delete-cancel-btn">Annuler</button>
                        <button class="btn btn-sm" id="inv-delete-confirm-btn"
                            style="color:#fff; background:rgba(239,68,68,0.85); border:none;">
                            <i class="fa-solid fa-trash-can"></i> Confirmer la suppression
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Fermeture via la croix ou Annuler
            modal.querySelectorAll('#inv-delete-modal-close, #inv-delete-cancel-btn').forEach(btn => {
                btn.onclick = () => { modal.classList.remove('active'); };
            });
            // Fermeture si clic en dehors du contenu
            modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
        }

        // Met à jour le texte et réinitialise le formulaire
        const desc = modal.querySelector('#inv-delete-modal-desc');
        desc.innerHTML = ids.length === 1
            ? 'Vous êtes sur le point de supprimer <strong>1 enregistrement</strong> de l\'historique. Cette action est irréversible.'
            : `Vous êtes sur le point de supprimer <strong>${ids.length} enregistrements</strong> de l\'historique. Cette action est irréversible.`;
        modal.querySelector('#inv-delete-password').value = '';
        modal.querySelector('#inv-delete-error').style.display = 'none';

        // Stocke les IDs sur le bouton Confirmer
        const confirmBtn = modal.querySelector('#inv-delete-confirm-btn');
        confirmBtn.onclick = () => confirmInventoryDelete(ids);

        modal.classList.add('active');
        setTimeout(() => modal.querySelector('#inv-delete-password').focus(), 120);
    }

    /**
     * Envoie les requêtes de suppression pour chaque ID sélectionné,
     * après vérification du mot de passe côté serveur.
     * @param {string[]} ids Liste des IDs d'historique à supprimer
     */
    async function confirmInventoryDelete(ids) {
        const modal = document.getElementById('inv-delete-modal');
        const passwordInput = modal.querySelector('#inv-delete-password');
        const errorEl = modal.querySelector('#inv-delete-error');
        const confirmBtn = modal.querySelector('#inv-delete-confirm-btn');

        const password = passwordInput.value.trim();
        if (!password) {
            errorEl.textContent = 'Veuillez saisir votre mot de passe.';
            errorEl.style.display = 'block';
            passwordInput.focus();
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Suppression�?�';
        errorEl.style.display = 'none';

        const login = currentUser ? (currentUser.login || '') : '';

        try {
            // Suppression atomique : une seule requête pour tous les IDs sélectionnés.
            // �?vite les écrasements croisés entre requêtes séquentielles sur inventory_history.json.
            await apiRequest('api/inventory.php?action=delete_history_batch', 'POST', { ids, password, login });
        } catch (err) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Confirmer la suppression';
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
            return;
        }

        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Confirmer la suppression';

        modal.classList.remove('active');

        // Recharge les données pour refléter la suppression
        await loadDashboardData();
    }

    // Filtrage par véhicule (délégation d'événement posée une seule fois)
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'inventory-history-filter') {
            renderInventoryHistoryTable();
        }
    });

    // -------------------------------------------------------------------------
    // 8. ACTIONS SUR LES ADMINISTRATEURS (Création / Suppression)
    // -------------------------------------------------------------------------
    
    // Ouvre la fenêtre modale en mode création
    btnAddUser.onclick = () => openUserModal();

    const userLastNameInput  = document.getElementById('user-last-name');
    const userFirstNameInput = document.getElementById('user-first-name');
    const userLoginInput     = document.getElementById('user-login');
    if (userLastNameInput) userLastNameInput.addEventListener('input', maybeAutofillLogin);
    if (userFirstNameInput) userFirstNameInput.addEventListener('input', maybeAutofillLogin);
    if (userLoginInput) {
        userLoginInput.addEventListener('input', () => { loginAutoFill = false; });
    }

    const btnSaveUserRoles = document.getElementById('btn-save-user-roles');
    if (btnSaveUserRoles) {
        btnSaveUserRoles.onclick = async () => {
            const payload = usersList
                .filter(isUserRolesDirty)
                .map(u => ({ id: u.id, roles: getEffectiveRoles(u) }));
            if (payload.length === 0) return;
            try {
                btnSaveUserRoles.disabled = true;
                await apiRequest('api/users.php?action=update_roles', 'POST', { users: payload });
                pendingUserRoles = {};
                await loadDashboardData();
            } catch (err) {
                alert(err.message);
                syncRolesSaveButton();
            }
        };
    }

    // Fermeture de la modale via la croix ou le bouton Annuler
    closeModalElements.forEach(el => {
        el.onclick = () => {
            userModal.classList.remove('active');
        };
    });

    // Envoi du formulaire : gère la création ET la modification
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        userError.style.display = 'none';

        const userId    = document.getElementById('user-id').value;
        const login     = document.getElementById('user-login').value.trim();
        const firstName = document.getElementById('user-first-name').value.trim();
        const lastName  = document.getElementById('user-last-name').value.trim();
        const name      = `${firstName} ${lastName}`.trim();
        const email     = document.getElementById('user-email').value.trim();
        const password  = document.getElementById('user-password').value.trim();
        const roles     = getModalRoles();

        const isEditing = userId !== '';

        try {
            if (isEditing) {
                await apiRequest('api/users.php?action=edit', 'POST', {
                    id: parseInt(userId), login, first_name: firstName, last_name: lastName, name, email, password
                });
            } else {
                if (!password) {
                    userError.textContent = 'Le mot de passe (matricule) est obligatoire pour la création d\'un compte.';
                    userError.style.display = 'block';
                    return;
                }
                const createRoles = roles.length ? roles : ['contributeur'];
                await apiRequest('api/users.php?action=create', 'POST', {
                    login, first_name: firstName, last_name: lastName, name, email, password, roles: createRoles
                });
            }
            userModal.classList.remove('active');
            loadDashboardData();
        } catch (err) {
            userError.textContent = err.message;
            userError.style.display = 'block';
        }
    });

    /**
     * Supprime un compte administrateur.
     */
    async function deleteUser(id, name) {
        if (!confirm(`�Stes-vous sûr de vouloir supprimer le compte de ${name} ?`)) {
            return;
        }
        try {
            await apiRequest('api/users.php?action=delete', 'POST', { id });
            loadDashboardData();
        } catch (err) {
            alert(err.message);
        }
    }

    // -------------------------------------------------------------------------
    // 9. ACTIONS SUR LES V�?HICULES (Suppression + Clonage)
    // -------------------------------------------------------------------------
    /**
     * Supprime définitivement un véhicule et son fichier JSON.
     */
    async function deleteVehicle(id, name) {
        if (!confirm(`ATTENTION : Voulez-vous vraiment supprimer définitivement le véhicule "${name}" et tout son inventaire ? Cette action est irréversible.`)) {
            return;
        }
        try {
            await apiRequest('api/data.php?action=delete_vehicle', 'POST', { id });
            loadDashboardData();
        } catch (err) {
            alert(err.message);
        }
    }

    /**
     * Ouvre la modale de clonage pré-remplie avec une suggestion d'ID.
     * @param {object} v Le véhicule source à cloner.
     */
    function openCloneModal(v) {
        const cloneModal       = document.getElementById('clone-modal');
        const cloneSourceId    = document.getElementById('clone-source-id');
        const cloneNewId       = document.getElementById('clone-new-id');
        const cloneNewName     = document.getElementById('clone-new-name');
        const cloneError       = document.getElementById('clone-error');
        const cloneModalTitle  = document.getElementById('clone-modal-title');

        cloneModalTitle.innerHTML = `<i class="fa-solid fa-copy"></i> Cloner "${v.name}"`;
        cloneSourceId.value = v.id;

        // Suggestion d'ID : ajouter '-copy' ou incrémenter le suffixe numérique
        const suggested = v.id.match(/-\d+$/) 
            ? v.id.replace(/-\d+$/, m => '-' + (parseInt(m.slice(1)) + 1))
            : v.id + '-2';
        cloneNewId.value   = suggested;
        cloneNewName.value = v.name + ' (copie)';
        cloneError.style.display = 'none';

        cloneModal.classList.add('active');
        cloneNewId.focus();
    }

    // Fermeture modale de clonage
    document.getElementById('clone-modal-close').onclick = () =>
        document.getElementById('clone-modal').classList.remove('active');
    document.getElementById('clone-modal-cancel').onclick = () =>
        document.getElementById('clone-modal').classList.remove('active');

    // Soumission du formulaire de clonage
    document.getElementById('clone-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cloneError    = document.getElementById('clone-error');
        const cloneModal    = document.getElementById('clone-modal');
        const cloneSubmit   = document.getElementById('clone-submit-btn');
        const sourceId      = document.getElementById('clone-source-id').value;
        const newId         = document.getElementById('clone-new-id').value.trim();
        const newName       = document.getElementById('clone-new-name').value.trim();

        cloneError.style.display = 'none';
        cloneSubmit.disabled = true;
        cloneSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clonage en cours...';

        try {
            const result = await apiRequest('api/data.php?action=clone_vehicle', 'POST', {
                source_id: sourceId,
                new_id:    newId,
                new_name:  newName
            });
            cloneModal.classList.remove('active');
            showToast(`�o. ${result.message}`, 'success');
            loadDashboardData();
        } catch (err) {
            cloneError.textContent = err.message;
            cloneError.style.display = 'block';
        } finally {
            cloneSubmit.disabled = false;
            cloneSubmit.innerHTML = '<i class="fa-solid fa-copy"></i> Confirmer le clonage';
        }
    });

    /**
     * Affiche un toast de notification flottant (succès ou erreur).
     * @param {string} message Le texte à afficher.
     * @param {string} type 'success' ou 'error'.
     */
    function showToast(message, type = 'success') {
        let toast = document.getElementById('admin-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'admin-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = 'admin-toast admin-toast-' + type;
        toast.classList.add('visible');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('visible'), 4000);
    }

    // -------------------------------------------------------------------------
    // 10. M�?THODES DE L'�?DITEUR D'INVENTAIRES (WORK SPA)
    // -------------------------------------------------------------------------
    
    // Bouton de création d'un nouveau véhicule vide
    btnAddVehicle.onclick = () => {
        isNewVehicle = true;
        editingVehicle = {
            id: '',
            name: '',
            type: 'Véhicule',
            description: '',
            icon: 'fa-truck-fast',
            image: '',
            locations: []
        };
        openEditor(editingVehicle);
    };

    // Bouton Retour de l'éditeur (avec confirmation pour éviter les pertes de saisie)
    btnEditorBack.onclick = () => {
        if (confirm('Voulez-vous abandonner vos modifications non enregistrées ?')) {
            editingVehicle = null;
            showView('dashboard-view');
            loadDashboardData();
        }
    };

    /**
     * Charge l'éditeur avec un clone (Deep Copy) des données du véhicule sélectionné.
     * @param {object} vehicle Les données du véhicule à charger.
     */
    function openEditor(vehicle) {
        isNewVehicle = !vehicle.id;
        // Deep copy pour pouvoir manipuler les données en mémoire vive locale sans affecter la liste principale avant sauvegarde
        editingVehicle = JSON.parse(JSON.stringify(vehicle)); 

        editorTitle.textContent = isNewVehicle ? "Nouveau Véhicule / Lot" : `�?dition : ${vehicle.name}`;
        
        // Configuration des champs du formulaire
        editVehicleId.value = editingVehicle.id;
        editVehicleId.disabled = !isNewVehicle; // L'identifiant (ID) est immutable une fois créé
        editVehicleName.value = editingVehicle.name;
        editVehicleType.value = editingVehicle.type;
        editVehicleDesc.value = editingVehicle.description || '';
        editVehicleIcon.value = editingVehicle.icon || 'fa-truck-fast';
        editVehicleImage.value = editingVehicle.image || '';
		
		const nextCtInput = document.getElementById('edit-vehicle-next-ct');
		if (nextCtInput) {
			nextCtInput.value = editingVehicle.next_ct || '';
		}

        const respSelect = document.getElementById('edit-vehicle-responsible');
        respSelect.innerHTML = '<option value="">-- Aucun responsable assigné --</option>';
        if (usersList) {
            usersList.forEach(u => {
                const option = document.createElement('option');
                option.value = u.login;
                option.textContent = u.name;
                respSelect.appendChild(option);
            });
        }
        respSelect.value = editingVehicle.responsible_admin || '';

        uploadStatus.textContent = '';
        showView('editor-view');
        renderEditorLocations(); // Dessine la structure des emplacements physiques et des équipements
    }

	/**
     * Génère l'arbre HTML des localisations et de leurs tableaux d'équipements en mémoire.
     * Inclut les options ASUP par emplacement et des colonnes Lot/Péremption par équipement si l'emplacement est ASUP.
     */
    function renderEditorLocations() {
        locationsEditorList.innerHTML = '';
        // Vérification du type de véhicule (insensible à la casse)
        const vehicleName = editingVehicle.name.toLowerCase();
        const isAsupEligible = vehicleName.includes('vsav') || vehicleName.includes('vssuap');

        if (editingVehicle.locations.length === 0) {
            locationsEditorList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">Aucune localisation créée pour le moment.</div>';
            return;
        }

        const totalLocs = editingVehicle.locations.length;

        editingVehicle.locations.forEach((loc, locIndex) => {
            const locBox = document.createElement('div');
            locBox.className = 'location-edit-box';

            // --- SECTION ASUP EMPLACEMENT ---
            let asupHtml = '';
            if (isAsupEligible) {
                asupHtml = `
                    <div class="asup-config-section" style="margin: 0.5rem 0; padding: 0.75rem; background: rgba(0,0,0,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500; cursor: pointer; font-size: 0.9rem;">
                            <input type="checkbox" class="loc-asup-checkbox" ${loc.is_asup ? 'checked' : ''}> 
                            Localisation ASUP (Gestion péremption par correspondant PUI)
                        </label>
                    </div>
                `;
            }

            // En-têtes du tableau conditionnels selon si l'emplacement est ASUP
            const colspanVal = loc.is_asup ? 7 : 5;
            const asupHeadersHtml = loc.is_asup ? `
                <th style="width: 110px;">Lot</th>
                <th style="width: 130px;">Péremption</th>
            ` : '';

            locBox.innerHTML = `
                <div class="location-edit-header">
                    <div class="location-edit-title-group">
                        <i class="fa-solid fa-box-open" style="color: var(--primary-color);"></i>
                        <input type="text" class="loc-name-input" value="${escapeHtml(loc.name)}" placeholder="Nom de l'emplacement">
                        <input type="text" class="loc-icon-input" value="${escapeHtml(loc.icon || 'fa-box')}" placeholder="Icône (ex: fa-fire)" style="font-size: 0.8rem; width: 130px; font-family: monospace;">
                    </div>
                    <div class="location-edit-actions">
                        <button type="button" class="btn btn-outline btn-sm btn-loc-up" title="Monter" ${locIndex === 0 ? 'disabled' : ''} style="padding: 0.3rem 0.55rem;">
                            <i class="fa-solid fa-chevron-up"></i>
                        </button>
                        <button type="button" class="btn btn-outline btn-sm btn-loc-down" title="Descendre" ${locIndex === totalLocs - 1 ? 'disabled' : ''} style="padding: 0.3rem 0.55rem;">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                        <button type="button" class="btn btn-outline btn-sm btn-delete-loc" style="color: var(--primary-color); border-color: rgba(239,68,68,0.2);">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                ${asupHtml}
                <div class="location-edit-body">
                    <div class="table-container">
                        <table class="admin-table eq-edit-table" style="margin-bottom: 1rem;">
                            <thead>
                                <tr>
                                    <th style="width: 36px;"></th>
                                    <th style="width: 60px; text-align: center;">Photo</th>
                                    <th>Nom de l'équipement</th>
                                    ${asupHeadersHtml}
                                    <th style="width: 100px;">Quantité</th>
                                    <th style="width: 36px;"></th>
                                </tr>
                            </thead>
                            <tbody class="eq-tbody"></tbody>
                        </table>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm btn-add-eq">
                        <i class="fa-solid fa-plus"></i> Ajouter un équipement
                    </button>
                </div>
            `;

            // Bindings nom et icône
            locBox.querySelector('.loc-name-input').oninput = (e) => { loc.name = e.target.value; };
            locBox.querySelector('.loc-icon-input').oninput = (e) => { loc.icon = e.target.value; };

            // Binding de la checkbox ASUP globale de l'emplacement
            if (isAsupEligible) {
                const asupCheckbox = locBox.querySelector('.loc-asup-checkbox');
                asupCheckbox.onchange = (e) => {
                    loc.is_asup = e.target.checked;
                    // Re-render pour afficher/masquer instantanément les colonnes de lots/péremptions sur les lignes
                    renderEditorLocations();
                };
            }

            // Monter l'emplacement
            locBox.querySelector('.btn-loc-up').onclick = () => {
                if (locIndex === 0) return;
                [editingVehicle.locations[locIndex - 1], editingVehicle.locations[locIndex]] =
                    [editingVehicle.locations[locIndex], editingVehicle.locations[locIndex - 1]];
                renderEditorLocations();
            };

            // Descendre l'emplacement
            locBox.querySelector('.btn-loc-down').onclick = () => {
                if (locIndex === totalLocs - 1) return;
                [editingVehicle.locations[locIndex + 1], editingVehicle.locations[locIndex]] =
                    [editingVehicle.locations[locIndex], editingVehicle.locations[locIndex + 1]];
                renderEditorLocations();
            };

            // Supprimer l'emplacement
            locBox.querySelector('.btn-delete-loc').onclick = () => {
                if (confirm(`Voulez-vous supprimer l'emplacement "${loc.name}" et tous ses équipements ?`)) {
                    editingVehicle.locations.splice(locIndex, 1);
                    renderEditorLocations();
                }
            };

            // Ajouter un équipement vide
            locBox.querySelector('.btn-add-eq').onclick = () => {
                loc.items.push({ name: '', quantity: 1, lot: '', peremption: '' });
                renderEditorLocations();
            };

            // Génération des lignes d'équipements
            const eqTbody = locBox.querySelector('.eq-tbody');
            const totalItems = loc.items.length;

            if (totalItems === 0) {
                eqTbody.innerHTML = `<tr><td colspan="${colspanVal}" class="text-center" style="color: var(--text-secondary); padding: 1rem 0;">Aucun équipement dans cet emplacement.</td></tr>`;
            } else {
                loc.items.forEach((item, itemIndex) => {
                    const tr = document.createElement('tr');

                    // Cellules de lot et péremption conditionnelles par ligne
                    const asupItemCellsHtml = loc.is_asup ? `
                        <td>
                            <input type="text" class="item-lot-input" value="${escapeHtml(item.lot || '')}" placeholder="N° de lot" style="width: 100%; font-size: 0.85rem;">
                        </td>
                        <td>
                            <input type="date" class="item-peremption-input" value="${escapeHtml(item.peremption || '')}" style="width: 100%; font-size: 0.85rem;">
                        </td>
                    ` : '';

                    tr.innerHTML = `
                        <td style="vertical-align: middle; text-align: center;">
                            <div style="display:flex; flex-direction:column; gap:1px;">
                                <button type="button" class="btn btn-text btn-item-up" title="Monter" ${itemIndex === 0 ? 'disabled' : ''} style="padding:0.1rem 0.3rem; color:var(--text-secondary); line-height:1;">
                                    <i class="fa-solid fa-chevron-up" style="font-size:0.7rem;"></i>
                                </button>
                                <button type="button" class="btn btn-text btn-item-down" title="Descendre" ${itemIndex === totalItems - 1 ? 'disabled' : ''} style="padding:0.1rem 0.3rem; color:var(--text-secondary); line-height:1;">
                                    <i class="fa-solid fa-chevron-down" style="font-size:0.7rem;"></i>
                                </button>
                            </div>
                        </td>
                        <td class="text-center" style="vertical-align: middle;">
                            <div class="item-img-edit-container">
                                ${item.image ? `
                                    <img src="${item.image}" class="item-edit-thumbnail" alt="thumbnail">
                                    <button type="button" class="btn-clear-item-img" title="Supprimer la photo"><i class="fa-solid fa-circle-xmark"></i></button>
                                ` : `
                                    <button type="button" class="btn-upload-item-img" title="Prendre/Ajouter une photo"><i class="fa-solid fa-camera"></i></button>
                                    <button type="button" class="btn-select-item-img" title="Choisir une image existante" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:0.2rem;"><i class="fa-solid fa-images"></i></button>
                                `}
                                <input type="file" class="item-img-file-input" accept="image/*" capture="environment" style="display: none;">
                            </div>
                        </td>
                        <td>
                            <input type="text" class="item-name-input" value="${escapeHtml(item.name)}" placeholder="Ex: Masque haute concentration">
                        </td>
                        ${asupItemCellsHtml}
                        <td>
                            <input type="number" class="item-qty-input" value="${item.quantity}" min="0">
                        </td>
                        <td style="vertical-align: middle; text-align:right;">
                            <button type="button" class="btn btn-text btn-delete-item" style="color: var(--primary-color);">
                                <i class="fa-solid fa-times-circle" style="font-size: 1.25rem;"></i>
                            </button>
                        </td>
                    `;

                    // Bindings des champs de la ligne
                    tr.querySelector('.item-name-input').oninput = (e) => { item.name = e.target.value; };
                    tr.querySelector('.item-qty-input').oninput = (e) => { item.quantity = parseInt(e.target.value) || 0; };

                    if (loc.is_asup) {
                        const lotInput = tr.querySelector('.item-lot-input');
                        const peremptionInput = tr.querySelector('.item-peremption-input');
                        if (lotInput) lotInput.oninput = (e) => { item.lot = e.target.value; };
                        if (peremptionInput) peremptionInput.oninput = (e) => { item.peremption = e.target.value; };
                    }

                    // Monter équipement
                    tr.querySelector('.btn-item-up').onclick = () => {
                        if (itemIndex === 0) return;
                        [loc.items[itemIndex - 1], loc.items[itemIndex]] =
                            [loc.items[itemIndex], loc.items[itemIndex - 1]];
                        renderEditorLocations();
                    };

                    // Descendre équipement
                    tr.querySelector('.btn-item-down').onclick = () => {
                        if (itemIndex === totalItems - 1) return;
                        [loc.items[itemIndex + 1], loc.items[itemIndex]] =
                            [loc.items[itemIndex], loc.items[itemIndex + 1]];
                        renderEditorLocations();
                    };

                    // Photo : upload
                    const uploadBtn = tr.querySelector('.btn-upload-item-img');
                    const fileInput = tr.querySelector('.item-img-file-input');
                    if (uploadBtn && fileInput) {
                        uploadBtn.onclick = () => fileInput.click();
                        fileInput.onchange = async () => {
                            if (fileInput.files.length === 0) return;
                            let file = fileInput.files[0];
                            try { file = await compressImage(file); } catch (e) { /* fallback : fichier original */ }
                            const formData = new FormData();
                            formData.append('image', file);
                            formData.append('vehicle_id', editingVehicle.id || 'new_vehicle');
                            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                            uploadBtn.disabled = true;
                            try {
                                const response = await fetch('api/upload.php', { method: 'POST', body: formData });
                                const result = await response.json();
                                if (!response.ok) throw new Error(result.error || 'Erreur lors du téléchargement.');
                                item.image = result.filePath;
                                renderEditorLocations();
                            } catch (err) {
                                alert("Erreur d'upload : " + err.message);
                                renderEditorLocations();
                            }
                        };
                    }

                    // Photo : sélectionner depuis /images/ (images partagées entre véhicules)
                    const selectImgBtn = tr.querySelector('.btn-select-item-img');
                    if (selectImgBtn) {
                        selectImgBtn.onclick = () => openImagePicker(selectedPath => {
                            item.image = selectedPath;
                            renderEditorLocations();
                        });
                    }

                    // Photo : supprimer
                    const clearBtn = tr.querySelector('.btn-clear-item-img');
                    if (clearBtn) {
                        clearBtn.onclick = () => { delete item.image; renderEditorLocations(); };
                    }

                    // Photo : zoom
                    const thumbImg = tr.querySelector('.item-edit-thumbnail');
                    if (thumbImg) {
                        thumbImg.onclick = () => zoomImage(item.image, item.name || '�?quipement');
                    }

                    // Supprimer équipement
                    tr.querySelector('.btn-delete-item').onclick = () => {
                        loc.items.splice(itemIndex, 1);
                        renderEditorLocations();
                    };

                    eqTbody.appendChild(tr);
                });
            }

            locationsEditorList.appendChild(locBox);
        });
    }

    // �?vénement global de l'éditeur : Créer un nouvel emplacement physique vide
    if (typeof btnAddLocation !== 'undefined' && btnAddLocation) {
        btnAddLocation.onclick = () => {
            const id = 'loc-' + Date.now();
            editingVehicle.locations.push({
                id,
                name: 'Nouvel Emplacement',
                icon: 'fa-box',
                is_asup: false,
                items: []
            });
            renderEditorLocations();
        };
    }

    // -------------------------------------------------------------------------
    // 11. T�?L�?VERSEMENT D'IMAGE AJAX (Upload)
    // -------------------------------------------------------------------------

    /**
     * compressImage(file, maxWidth, quality)
     * Redimensionne et compresse une image côté client via Canvas avant upload,
     * afin d'éviter l'erreur PHP UPLOAD_ERR_INI_SIZE (code 1) sur les photos
     * de smartphone pouvant dépasser upload_max_filesize dans php.ini.
     *
     * @param {File}   file     - Fichier image source (depuis <input type="file">)
     * @param {number} maxWidth - Largeur maximale en pixels (défaut : 1280)
     * @param {number} quality  - Qualité JPEG de sortie entre 0 et 1 (défaut : 0.82)
     * @returns {Promise<File>} - Fichier compressé au format image/jpeg
     *
     * Modifié le 2026-09-07 �?" Ajout compression canvas côté client (fix UPLOAD_ERR_INI_SIZE)
     */
    function compressImage(file, maxWidth, quality) {
        maxWidth = maxWidth || 1280;
        quality  = quality  || 0.82;
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onerror = function() { reject(new Error('Lecture du fichier impossible.')); };
            reader.onload = function(e) {
                var img = new Image();
                img.onerror = function() { reject(new Error('Décodage image impossible.')); };
                img.onload = function() {
                    var w = img.width;
                    var h = img.height;
                    if (w > maxWidth) {
                        h = Math.round(h * maxWidth / w);
                        w = maxWidth;
                    }
                    var canvas = document.createElement('canvas');
                    canvas.width  = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(function(blob) {
                        if (!blob) { reject(new Error('Compression canvas échouée.')); return; }
                        var compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
                        resolve(compressed);
                    }, 'image/jpeg', quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    imageUploadInput.onchange = async () => {
        if (imageUploadInput.files.length === 0) return;

        let file = imageUploadInput.files[0];
        try { file = await compressImage(file); } catch (e) { /* fallback : fichier original */ }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('vehicle_id', editingVehicle.id || 'new_vehicle');

        uploadStatus.textContent = 'Téléchargement en cours...';
        uploadStatus.style.color = 'var(--text-secondary)';

        try {
            const response = await fetch('api/upload.php', {
                method: 'POST',
                body: formData
                // NOTE : fetch gère automatiquement la bonne configuration Multipart/form-data et les cookies de session
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Erreur lors du téléchargement.');
            }
            // Insère le chemin généré dans l'input et la variable en mémoire
            editVehicleImage.value = result.filePath;
            editingVehicle.image = result.filePath;
            
            uploadStatus.textContent = 'Image mise en ligne avec succès !';
            uploadStatus.style.color = '#10b981';
        } catch (err) {
            uploadStatus.textContent = err.message;
            uploadStatus.style.color = 'var(--primary-color)';
        }
    };

    // -------------------------------------------------------------------------
    // 12. ENREGISTREMENT ET VALIDATION FINALE DES DONN�?ES
    // -------------------------------------------------------------------------
    btnSaveAll.onclick = async () => {
        // Lecture finale de tous les champs de saisie des métadonnées
        const vId = editVehicleId.value.trim().toLowerCase();
        const vName = editVehicleName.value.trim();
        const vType = editVehicleType.value;
        const vDesc = editVehicleDesc.value.trim();
        const vIcon = editVehicleIcon.value.trim();
        const vImage = editVehicleImage.value.trim();
        const vResponsible = document.getElementById('edit-vehicle-responsible').value;
		const vNextCt = document.getElementById('edit-vehicle-next-ct').value; // Récupération de la date (peut être vide)

        // 12.1 VALIDATIONS STRICTES AVANT ENVOI
        if (!vId) {
            alert('Veuillez saisir un identifiant unique.');
            return;
        }
        if (!pregMatch(/^[a-z0-9\-]+$/, vId)) {
            alert('L\'identifiant unique doit contenir uniquement des lettres minuscules, des chiffres et des tirets (-).');
            return;
        }
        if (!vName) {
            alert('Veuillez saisir un nom pour le véhicule.');
            return;
        }

        // 12.2 INT�?GRATION DES DONN�?ES AU MOD�^LE EN M�?MOIRE
        editingVehicle.id = vId;
        editingVehicle.name = vName;
        editingVehicle.type = vType;
        editingVehicle.description = vDesc;
        editingVehicle.icon = vIcon;
        editingVehicle.image = vImage;
        editingVehicle.responsible_admin = vResponsible;
		editingVehicle.next_ct = vNextCt || ''; // Sauvegarde de la valeur (vide si non renseignée)

        // 12.3 NETTOYAGE : �?limine automatiquement les lignes d'équipements vides de la sauvegarde
        editingVehicle.locations.forEach(loc => {
            if (loc.items) {
                loc.items = loc.items.filter(item => item.name.trim() !== '');
            }
        });

        // 12.4 SAUVEGARDE EN BASE DE DONN�?ES VIA L'API REST
        try {
            const result = await apiRequest('api/data.php?action=save_vehicle', 'POST', editingVehicle);
            // Mise à jour CT uniquement si la date a changé
            if (vType.toLowerCase() === 'véhicule') {
                const oldCtDate = editingVehicle.next_ct || '';
                const newCtDate = vNextCt || '';
                if (newCtDate !== oldCtDate) {
                    // Date modifiée �?' reset ct_alert_disabled, ct.php gère le reset de ct_done
                    await apiRequest('api/ct.php?action=update', 'POST', {
                        vehicle_id: vId,
                        ct_date: newCtDate || null,
                        ct_alert_disabled: false
                    }).catch(err => console.warn('[CT] Info non synchronisée:', err));
                }
                // Date inchangée �?' on ne touche pas au CT (toggle et alert_disabled préservés)
            }
            
            // Confirmation visuelle et retour au Tableau de Bord
            alert(result.message || 'Véhicule sauvegardé avec succès.');
            editingVehicle = null;
            showView('dashboard-view');
            loadDashboardData();
        } catch (err) {
            alert('Erreur lors de la sauvegarde : ' + err.message);
        }
    };

    // Helper regex
    function pregMatch(regex, str) {
        return regex.test(str);
    }

    /**
     * �?chappe les caractères HTML spéciaux pour éviter de casser les attributs HTML
     * lors de l'injection de valeurs dans les templates littéraux.
     * Par exemple, les guillemets " dans un nom d'item cassent un attribut value="...".
     */
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // -------------------------------------------------------------------------
    // 13. FONCTIONS D'IMPRESSION DES QR-CODES
    // -------------------------------------------------------------------------
    
    /**
     * Détermine le chemin du fichier image du QR Code à partir de l'identifiant du véhicule.
     * Par exemple : "vsav-1" devient "./images/qrcodes/vsav_qrcode.png".
     */
    function getQRCodeFileName(vehicleId) {
        return `./images/qrcodes/${vehicleId}_qrcode.png`;
    }

    /**
     * Prépare la zone d'impression avec le QR Code d'un seul véhicule et lance l'impression.
     */
    function printSingleQRCode(vehicle) {
        const printSection = document.getElementById('print-section');
        if (!printSection) return;

        const qrPath = getQRCodeFileName(vehicle.id);
        
        printSection.innerHTML = `
            <div class="print-qr-card">
                <img src="${qrPath}" alt="QR Code ${vehicle.name}">
                <div class="qr-print-label">${vehicle.name}</div>
            </div>
        `;

        // Active la classe du mode QR Code sur le body et lance le module d'impression
        document.body.classList.add('print-mode-qrcodes');
        window.print();
    }

    /**
     * Prépare la zone d'impression sous forme de grille avec les QR Codes de tous les véhicules.
     */
    // Bouton Regénérer QR Codes
    btnRegenerateQrcodes.addEventListener('click', async () => {
        const originalHTML = btnRegenerateQrcodes.innerHTML;
        btnRegenerateQrcodes.disabled = true;
        btnRegenerateQrcodes.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Génération...';

        try {
            const result = await apiRequest('api/regenerate_qrcodes.php', 'POST');
            alert('�o. QR codes régénérés avec succès !\n\n' + (result.output || ''));
            loadDashboardData();
        } catch (err) {
            // Affiche les détails d'erreur retournés par le serveur si disponibles
            const details = err.details ? '\n\nDétails :\n' + (Array.isArray(err.details) ? err.details.join('\n') : err.details) : '';
            alert('�O Erreur lors de la régénération des QR codes :\n' + err.message + details);
        } finally {
            btnRegenerateQrcodes.disabled = false;
            btnRegenerateQrcodes.innerHTML = originalHTML;
        }
    });


    function printAllQRCodes() {
        const printSection = document.getElementById('print-section');
        if (!printSection || !vehiclesList || vehiclesList.length === 0) return;

        let html = '';
        vehiclesList.forEach(v => {
            const qrPath = getQRCodeFileName(v.id);
            html += `
                <div class="print-qr-card">
                    <img src="${qrPath}" alt="QR Code ${v.name}">
                    <div class="qr-print-label">${v.name}</div>
                </div>
            `;
        });

        printSection.innerHTML = html;

        // Active la classe du mode QR Code sur le body et lance le module d'impression
        document.body.classList.add('print-mode-qrcodes');
        window.print();
    }

    /**
     * Génère un livret d'inventaire de référence (A4 plastifiable, multi-colonnes) pour un véhicule.
     * Cette fiche regroupe tous les emplacements et matériels du véhicule avec son QR-code d'en-tête.
     */
    function printVehicleBooklet(vehicle) {
        const printBookletSection = document.getElementById('print-booklet-section');
        if (!printBookletSection) return;

        const qrPath = getQRCodeFileName(vehicle.id);
        const today = new Date().toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Structure HTML du livret d'impression A4
        // Modifié le 2026-09-13 : QR compact dans header, grille 2 colonnes, vignettes 32px
        let html = `
            <div class="booklet-header">
                <div class="booklet-title">
                    <h1>Fiche d'Inventaire �?" ${vehicle.name}</h1>
                    <p>Caserne Nom du Centre de Secours &nbsp;·&nbsp; ${vehicle.type}</p>
                    <p style="margin-top:0.2rem;"><strong>Mise à jour :</strong> ${today}</p>
                </div>
                <div class="booklet-meta-box">
                    <div class="booklet-meta-text">
                        <em>Scannez pour la<br>version en ligne</em>
                    </div>
                    <img class="booklet-qr-mini" src="${qrPath}" alt="QR Code ${vehicle.name}">
                </div>
            </div>

            <div class="booklet-grid">
        `;

        // Itère sur tous les emplacements physiques du véhicule
        if (vehicle.locations && vehicle.locations.length > 0) {
            vehicle.locations.forEach(loc => {
                const locIcon = loc.icon || 'fa-box';
                html += `
                    <div class="booklet-location-card">
                        <div class="booklet-location-header">
                            <i class="fa-solid ${locIcon}"></i>
                            <span>${loc.name}</span>
                        </div>
                        <table class="booklet-table">
                            <tbody>
                `;

                // Liste de tout le matériel dans cet emplacement
                if (loc.items && loc.items.length > 0) {
                    loc.items.forEach(item => {
                        const printImageHtml = item.image
                            ? `<img src="${item.image}" class="booklet-item-thumbnail" alt="${escapeHtml(item.name)}">`
                            : '';
                        html += `
                            <tr>
                                <td style="vertical-align: middle;">
                                    <div class="booklet-item-cell">
                                        ${printImageHtml}
                                        <span>${escapeHtml(item.name)}</span>
                                    </div>
                                </td>
                                <td class="booklet-qty" style="vertical-align: middle;">${item.quantity}</td>
                            </tr>
                        `;
                    });
                } else {
                    html += `
                        <tr>
                            <td colspan="2" style="color: #64748b; text-align: center; padding: 10px; font-style: italic;">
                                Aucun matériel répertorié.
                            </td>
                        </tr>
                    `;
                }

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });
        } else {
            html += `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b;">
                    Aucun emplacement configuré pour ce véhicule.
                </div>
            `;
        }

        html += `
            </div>
        `;

        printBookletSection.innerHTML = html;

        // Active la classe du mode livret sur le body et déclenche la boîte de dialogue d'impression
        document.body.classList.add('print-mode-booklet');
        window.print();
    }

    // Association de l'impression globale des QR-codes au clic sur le bouton
    if (btnPrintAllQrcodes) {
        btnPrintAllQrcodes.addEventListener('click', printAllQRCodes);
    }

    // �?vénement après impression : nettoie les classes CSS appliquées sur le body
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('print-mode-qrcodes', 'print-mode-booklet');
    });

    /**
     * Affiche une image en plein écran dans un modal dynamique.
     * Utilisé pour zoomer sur les vignettes d'équipements.
     */
    function zoomImage(src, title) {
        let modal = document.getElementById('zoom-image-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'zoom-image-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
            modal.style.display = 'flex';
            modal.style.flexDirection = 'column';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.zIndex = '9999';
            modal.style.cursor = 'zoom-out';
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            
            modal.innerHTML = `
                <div style="position: absolute; top: 20px; right: 20px; color: white; font-size: 28px; cursor: pointer; z-index: 10000;">
                    <i class="fa-solid fa-xmark"></i>
                </div>
                <img id="zoom-image-content" src="" alt="" style="max-width: 90%; max-height: 80%; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); object-fit: contain;">
                <p id="zoom-image-title" style="color: white; margin-top: 15px; font-size: 16px; font-weight: 600; text-align: center; font-family: sans-serif; padding: 0 20px;"></p>
            `;
            
            modal.onclick = () => {
                modal.style.opacity = '0';
                setTimeout(() => { modal.style.display = 'none'; }, 250);
            };
            document.body.appendChild(modal);
        }
        
        document.getElementById('zoom-image-content').src = src;
        document.getElementById('zoom-image-title').textContent = title;
        modal.style.display = 'flex';
        modal.offsetHeight; // force reflow
        modal.style.opacity = '1';
    }

    // -------------------------------------------------------------------------
    // 14. D�?MARRAGE : Lancement de la vérification de la session
    // -------------------------------------------------------------------------

    /**
     * Détecte si on est sur un écran mobile (largeur < 769px).
     * Utilisé pour choisir entre la vue tableau (desktop) et la vue cards (mobile).
     */
    function isMobile() {
        return window.innerWidth < 769;
    }

    /**
     * Met à jour la visibilité des vues tableau/cards selon la taille d'écran.
     * Appelée au chargement et au resize.
     */
    function applyResponsiveViews() {
        const mobile = isMobile();
        document.querySelectorAll('.desktop-only').forEach(el => {
            el.style.display = mobile ? 'none' : 'block';
        });
        document.querySelectorAll('.mobile-only').forEach(el => {
            el.style.display = mobile ? 'flex' : 'none';
            if (mobile) el.style.flexDirection = 'column';
        });
    }

    // Ré-applique au resize (rotation de l'écran, redimensionnement fenêtre)
    window.addEventListener('resize', applyResponsiveViews);

    /**
     * Compatibilité ascendante : redirige vers activateSection.
     */
    function activateTab(tabId) {
        const map = {
            'tab-alerts':            'section-alerts',
            'tab-admins':            'section-users',
            'tab-vehicles':          'section-vehicles',
            'tab-inventory-history': 'section-history',
            'tab-asup':              'section-asup',
            'tab-ct':                'section-ct',
        };
        const sectionId = map[tabId] || tabId;
        if (typeof activateSection === 'function') activateSection(sectionId);
    }

    // �"?�"? Sidebar : init sections selon rôle �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
    function initSidebar() {
        const items = document.querySelectorAll('.sidebar-item');

        items.forEach(item => {
            const roles = JSON.parse(item.dataset.roles || '[]');
            if (roles.length === 0 || currentUserHasRole(...roles)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });

        // Active le premier item visible
        const firstVisible = document.querySelector('.sidebar-item:not(.hidden)');
        if (firstVisible) activateSection(firstVisible.dataset.section);
    }

    // Active une section et met à jour la sidebar
    function activateSection(sectionId) {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));

        const section = document.getElementById(sectionId);
        if (section) section.classList.add('active');

        const item = document.querySelector('.sidebar-item[data-section="' + sectionId + '"]');
        if (item) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        }

        const main = document.getElementById('admin-main');
        if (main) main.scrollTop = 0;

        // Rafraîchit le panneau CT à chaque activation (données déjà en mémoire)
        if (sectionId === 'section-ct' && window.ctModule) {
            window.ctModule.renderCtPanel();
        }
    }

    // Listeners clics sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            activateSection(item.dataset.section);
        });
    });

    function renderCleaningConfig() {
        const config = window.cleaningConfig;
        if (!config) return;

        const dateInput   = document.getElementById('cleaning-date');
        const teamSelect  = document.getElementById('cleaning-team');
        const form        = document.getElementById('cleaning-config-form');
        const teamsList   = document.getElementById('cleaning-teams-list');
        const btnAddTeam  = document.getElementById('btn-add-cleaning-team');

        if (!dateInput || !teamSelect || !form || !teamsList || !btnAddTeam) return;

        // --- Champs date et équipe ---
        dateInput.value = config.next_cleaning_date || '';

        teamSelect.innerHTML = '';
        (config.teams || []).forEach((team, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = team;
            teamSelect.appendChild(opt);
        });
        teamSelect.value = config.current_team_index ?? 0;

        // --- Rendu de la liste des équipes ---
        // FIX : renderTeamsList est appelée seule (pas de bouton créé dedans)
        // pour éviter le bouton "Enregistrer les équipes" orphelin après reload.
        const renderTeamsList = () => {
            teamsList.innerHTML = '';
            (config.teams || []).forEach((team, idx) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; gap:0.5rem;';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = team;
                input.style.flex = '1';
                input.className = 'team-input';
                input.dataset.index = idx;

                const btnRemove = document.createElement('button');
                btnRemove.className = 'btn btn-outline btn-sm';
                btnRemove.innerHTML = '<i class="fa-solid fa-trash"></i>';
                btnRemove.onclick = (e) => {
                    e.preventDefault();
                    config.teams.splice(idx, 1);
                    // Resync le select après suppression
                    teamSelect.innerHTML = '';
                    config.teams.forEach((t, i) => {
                        const opt = document.createElement('option');
                        opt.value = i;
                        opt.textContent = t;
                        teamSelect.appendChild(opt);
                    });
                    teamSelect.value = Math.min(config.current_team_index ?? 0, config.teams.length - 1);
                    renderTeamsList();
                };

                row.appendChild(input);
                row.appendChild(btnRemove);
                teamsList.appendChild(row);
            });
        };

        renderTeamsList();

        // FIX : le bouton "Enregistrer les équipes" est placé une seule fois
        // hors de renderTeamsList pour ne jamais être orphelin après un re-render.
        let btnSaveTeams = document.getElementById('btn-save-cleaning-teams');
        if (!btnSaveTeams) {
            btnSaveTeams = document.createElement('button');
            btnSaveTeams.id = 'btn-save-cleaning-teams';
            btnSaveTeams.className = 'btn btn-primary btn-sm';
            btnSaveTeams.innerHTML = '<i class="fa-solid fa-save"></i> Enregistrer les équipes';
            btnSaveTeams.style.marginTop = '0.5rem';
            btnAddTeam.insertAdjacentElement('afterend', btnSaveTeams);
        }
        // FIX : réassigner onclick (pas addEventListener) pour éviter les doublons
        btnSaveTeams.onclick = async (e) => {
            e.preventDefault();
            const inputs = teamsList.querySelectorAll('.team-input');
            const newTeams = Array.from(inputs).map(inp => inp.value.trim()).filter(v => v);
            const origHtml = btnSaveTeams.innerHTML;
            btnSaveTeams.disabled = true;
            btnSaveTeams.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
            try {
                const res = await apiRequest('api/cleaning.php?action=update_teams', 'POST', { teams: newTeams });
                if (res.error) throw new Error(res.error);
                config.teams = newTeams;
                showToast('�?quipes mises à jour avec succès');
                loadDashboardData();
            } catch (err) {
                alert(err.message);
            } finally {
                btnSaveTeams.disabled = false;
                btnSaveTeams.innerHTML = origHtml;
            }
        };

        // FIX : form.onsubmit (pas addEventListener) �?' pas de double soumission
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const origHtml = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...'; }
            try {
                const res = await apiRequest('api/cleaning.php?action=update', 'POST', {
                    next_cleaning_date: dateInput.value,
                    current_team_index: parseInt(teamSelect.value, 10)
                });
                if (res.error) throw new Error(res.error);
                config.next_cleaning_date   = dateInput.value;
                config.current_team_index   = parseInt(teamSelect.value, 10);
                showToast('Configuration mise à jour avec succès');
                loadDashboardData();
            } catch (err) {
                alert(err.message);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origHtml; }
            }
        };

        // FIX : btnAddTeam.onclick (pas addEventListener) �?' pas de doublons
        btnAddTeam.onclick = (e) => {
            e.preventDefault();
            config.teams.push('Nouvelle équipe');
            // Resync le select
            teamSelect.innerHTML = '';
            config.teams.forEach((t, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = t;
                teamSelect.appendChild(opt);
            });
            renderTeamsList();
        };
    }

    // -------------------------------------------------------------------------
    // IMAGE PICKER �?" Sélection d'image partagée depuis /images/
    // Affiche une modale avec toutes les images présentes dans /images/
    // (hors logo.webp et qrcodes/). Images "partagées" (sans préfixe véhicule) en premier.
    // Modifié le 2026-09-02
    // -------------------------------------------------------------------------

    let _imagePicker = null; // modale singleton

    function buildImagePickerModal() {
        const modal = document.createElement('div');
        modal.id = 'image-picker-modal';
        modal.innerHTML = `
            <div class="img-picker-inner">
                <div class="img-picker-header">
                    <h3><i class="fa-solid fa-images"></i> Choisir une image existante</h3>
                    <button id="img-picker-close" title="Fermer"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="img-picker-search-bar">
                    <input type="text" id="img-picker-search" placeholder="Filtrer par nom�?�">
                </div>
                <div id="img-picker-grid">
                    <p style="color:var(--text-secondary); grid-column:1/-1;">Chargement�?�</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#img-picker-close').onclick = () => closeImagePicker();
        modal.addEventListener('click', e => { if (e.target === modal) closeImagePicker(); });
        modal.querySelector('#img-picker-search').oninput = function() {
            const q = this.value.toLowerCase();
            modal.querySelectorAll('.img-picker-item').forEach(el => {
                el.style.display = el.dataset.name.includes(q) ? '' : 'none';
            });
        };
        return modal;
    }

    function closeImagePicker() {
        if (_imagePicker) {
            _imagePicker.style.display = 'none';
            _imagePicker._callback = null;
        }
    }

    async function openImagePicker(callback) {
        if (!_imagePicker) {
            _imagePicker = buildImagePickerModal();
        }
        _imagePicker._callback = callback;
        _imagePicker.style.display = 'flex';

        const grid = _imagePicker.querySelector('#img-picker-grid');
        _imagePicker.querySelector('#img-picker-search').value = '';
        grid.innerHTML = '<p style="color:var(--text-secondary); grid-column:1/-1;">Chargement�?�</p>';

        try {
            const res = await fetch('api/data.php?action=list_images');
            const data = await res.json();
            const images = data.images || [];

            if (images.length === 0) {
                grid.innerHTML = '<p style="color:var(--text-secondary); grid-column:1/-1;">Aucune image disponible dans /images/</p>';
                return;
            }

            grid.innerHTML = '';
            images.forEach(img => {
                const cell = document.createElement('div');
                cell.className = 'img-picker-item' + (img.shared ? ' shared' : '');
                cell.dataset.name = img.name.toLowerCase();
                cell.title = img.name + (img.shared ? ' �?" image partagée' : '');
                cell.innerHTML = `
                    <img src="${img.path}" alt="${img.name}" loading="lazy">
                    <span class="img-picker-name">
                        ${img.shared ? '<i class="fa-solid fa-link" title="Partagée"></i> ' : ''}${img.name}
                    </span>
                `;
                cell.onclick = () => {
                    if (_imagePicker._callback) _imagePicker._callback(img.path);
                    closeImagePicker();
                };
                grid.appendChild(cell);
            });
        } catch (err) {
            grid.innerHTML = `<p style="color:var(--primary-color); grid-column:1/-1;">Erreur : ${err.message}</p>`;
        }
    }

    checkSession();
});
