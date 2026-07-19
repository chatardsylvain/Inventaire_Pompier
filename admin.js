/**
 * admin.js
 * Moteur JavaScript de l'interface d'administration (SPA - Single Page Application).
 * Ce script gère :
 * - L'authentification des administrateurs (sessions de connexion/déconnexion)
 * - L'affichage dynamique du Tableau de Bord (Listes des véhicules et des admins)
 * - L'éditeur interactif d'inventaires (CRUD complet en mémoire avec sauvegarde via l'API REST)
 * - Le téléversement en AJAX des images de véhicules
 * - La prévention de la mise en cache navigateur pour garantir l'affichage des données à jour.
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. DÉCLARATION DES ÉLÉMENTS DU DOM
    // -------------------------------------------------------------------------
    
    // Conteneurs des vues (écrans de l'application)
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const editorView = document.getElementById('editor-view');
    
    // Formulaire de Connexion
    const loginForm = document.getElementById('login-form');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    
    // Boutons & Éléments d'en-tête
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
    // 2. VARIABLES D'ÉTAT DE L'APPLICATION (Mémoire vive)
    // -------------------------------------------------------------------------
    let currentUser = null;         // Stocke l'utilisateur connecté (login et nom d'affichage)
    let vehiclesList = [];          // Liste de tous les véhicules chargée depuis l'API
    let usersList = [];             // Liste de tous les comptes administrateurs chargée depuis l'API
    let alertsList = [];            // Liste de toutes les alertes chargée depuis l'API
    let inventoryHistoryList = [];  // Historique des inventaires réalisés (traçabilité)
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
    /**
     * Affiche uniquement la vue demandée et masque les autres.
     * @param {string} viewId Identifiant HTML du bloc à afficher (login-view, dashboard-view, editor-view).
     */
    function showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(viewId).classList.add('active');
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
            cache: 'no-store'
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
                currentUser = result.user;
                usernameSpan.textContent = currentUser.name;
                userDisplay.style.display = 'inline-flex';
                logoutBtn.style.display = 'inline-flex';
                showView('dashboard-view');
                loadDashboardData();
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
                currentUser = result.user;
                usernameSpan.textContent = currentUser.name;
                userDisplay.style.display = 'inline-flex';
                logoutBtn.style.display = 'inline-flex';
                
                // Réinitialise les champs de connexion
                loginUsername.value = '';
                loginPassword.value = '';
                
                showView('dashboard-view');
                loadDashboardData();
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
            currentUser = null;
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
        try {
            // Requêtes HTTP parallèles pour gagner en rapidité de chargement
            const [vehicles, users, alerts, inventoryHistory] = await Promise.all([
                apiRequest('api/data.php?action=get_all'),
                apiRequest('api/users.php'),
                apiRequest('api/alerts.php?action=list'),
                apiRequest('api/inventory.php?action=history')
            ]);
            
            vehiclesList = vehicles;
            usersList = users;
            alertsList = alerts;
            inventoryHistoryList = inventoryHistory;
            
            renderVehiclesTable();
            renderUsersTable();
            renderAlertsTable();
            renderInventoryHistoryTable();
            applyResponsiveViews();
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
                            `⚠️ Confirmer l'indisponibilité de "${v.name}" ?\n\nSaisissez un motif (facultatif) :`,
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
                            showToast(`✅ Véhicule "${v.name}" marqué indisponible. Une alerte a été créée.`, 'success');
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
                            showToast(`✅ Véhicule "${v.name}" remis disponible.`, 'success');
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
                            <div class="m-card-sub">${v.type}${v.description ? ' — ' + v.description : ''}</div>
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
                    const motif = prompt(`⚠️ Marquer "${v.name}" indisponible ?\nMotif (facultatif) :`, '');
                    if (motif === null) { e.target.checked = false; return; }
                    try {
                        await apiRequest('api/data.php?action=toggle_unavailable', 'POST', { id: v.id, unavailable: true });
                        await apiRequest('api/alerts.php?action=vehicle_unavailable', 'POST', { vehicle_id: v.id, vehicle_name: v.name, comment: motif });
                        showToast(`✅ "${v.name}" marqué indisponible.`, 'success');
                        loadDashboardData();
                    } catch (err) { e.target.checked = false; showToast('Erreur : ' + err.message, 'error'); }
                } else {
                    if (!confirm(`Remettre "${v.name}" disponible ?`)) { e.target.checked = true; return; }
                    try {
                        await apiRequest('api/data.php?action=toggle_unavailable', 'POST', { id: v.id, unavailable: false });
                        const unavailAlert = alertsList.find(a => a.vehicle_id === v.id && a.alert_type === 'Indisponible');
                        if (unavailAlert) await apiRequest('api/alerts.php?action=resolve', 'POST', { id: unavailAlert.id });
                        showToast(`✅ "${v.name}" remis disponible.`, 'success');
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
        usersListTbody.innerHTML = '';
        if (usersList.length === 0) {
            usersListTbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: var(--text-secondary);">Aucun administrateur enregistré.</td></tr>';
        } else {
            usersList.forEach(u => {
                const tr = document.createElement('tr');
                const emailDisplay = u.email
                    ? `<a href="mailto:${u.email}" style="color: var(--text-secondary); font-size: 0.8em;">${u.email}</a>`
                    : '<span style="color: var(--text-secondary); font-size: 0.8em; font-style: italic;">Non renseigné</span>';
                tr.innerHTML = `
                    <td><strong>${u.name}</strong></td>
                    <td style="color: var(--text-secondary); font-family: monospace;">${u.login}</td>
                    <td>${emailDisplay}</td>
                    <td class="text-right" style="white-space: nowrap;">
                        <button class="btn btn-outline btn-sm btn-edit-user" data-id="${u.id}" style="margin-right: 0.25rem;">
                            <i class="fa-solid fa-pen-to-square"></i> Modifier
                        </button>
                        <button class="btn btn-outline btn-sm btn-delete-user" data-id="${u.id}" style="color: var(--primary-color); border-color: rgba(239,68,68,0.2);">
                            <i class="fa-solid fa-user-minus"></i> Supprimer
                        </button>
                    </td>
                `;
                tr.querySelector('.btn-edit-user').onclick = () => openUserModal(u);
                tr.querySelector('.btn-delete-user').onclick = () => deleteUser(u.id, u.name);
                usersListTbody.appendChild(tr);
            });
        }

        // --- CARDS MOBILE ---
        const usersCardsList = document.getElementById('users-cards-list');
        if (!usersCardsList) return;
        usersCardsList.innerHTML = '';
        if (usersList.length === 0) {
            usersCardsList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:1rem;">Aucun administrateur enregistré.</p>';
            return;
        }
        usersList.forEach(u => {
            const card = document.createElement('div');
            card.className = 'm-card';
            card.innerHTML = `
                <div class="m-card-header">
                    <div>
                        <div class="m-card-title"><i class="fa-solid fa-user" style="margin-right:0.4rem; color:var(--primary-color);"></i>${u.name}</div>
                        <div class="m-card-sub" style="font-family:monospace;">${u.login}</div>
                    </div>
                </div>
                ${u.email ? `<div class="m-card-row"><span class="m-card-label"><i class="fa-solid fa-envelope"></i></span><span class="m-card-value"><a href="mailto:${u.email}" style="color:var(--text-secondary);">${u.email}</a></span></div>` : ''}
                <div class="m-card-actions">
                    <button class="btn btn-outline btn-sm btn-muc-edit">
                        <i class="fa-solid fa-pen-to-square"></i> Modifier
                    </button>
                    <button class="btn btn-outline btn-sm btn-muc-delete" style="color:var(--primary-color); border-color:rgba(239,68,68,0.2);">
                        <i class="fa-solid fa-user-minus"></i> Supprimer
                    </button>
                </div>
            `;
            card.querySelector('.btn-muc-edit').onclick = () => openUserModal(u);
            card.querySelector('.btn-muc-delete').onclick = () => deleteUser(u.id, u.name);
            usersCardsList.appendChild(card);
        });
    }

    /**
     * Ouvre la modale en mode Création (aucun argument) ou en mode Édition (utilisateur fourni).
     */
    function openUserModal(user = null) {
        const modalTitle    = document.getElementById('user-modal-title');
        const userIdField   = document.getElementById('user-id');
        const passwordInput = document.getElementById('user-password');
        const passwordHint  = document.getElementById('user-password-hint');
        const submitBtn     = document.getElementById('user-submit-btn');

        userError.style.display = 'none';
        userForm.reset();

        if (user) {
            // Mode ÉDITION : pré-remplissage des champs
            modalTitle.textContent = 'Modifier le compte';
            submitBtn.textContent  = 'Enregistrer les modifications';
            userIdField.value      = user.id;
            document.getElementById('user-login').value = user.login;
            document.getElementById('user-name').value  = user.name;
            document.getElementById('user-email').value = user.email || '';
            passwordInput.required  = false;
            passwordHint.style.display = 'block';
        } else {
            // Mode CRÉATION
            modalTitle.textContent = 'Nouvel Administrateur';
            submitBtn.textContent  = 'Créer le compte';
            userIdField.value      = '';
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
                            <div class="m-card-sub">${vehicleName} — ${a.location_name}</div>
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
     */
    function renderInventoryHistoryTable() {
        populateInventoryHistoryFilter();

        const filterSelect = document.getElementById('inventory-history-filter');
        const filterValue = filterSelect ? filterSelect.value : '';
        const filtered = filterValue
            ? inventoryHistoryList.filter(h => h.vehicle_id === filterValue)
            : inventoryHistoryList;

        // --- TABLE DESKTOP ---
        const tbody = document.getElementById('inventory-history-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: var(--text-secondary);">Aucun inventaire enregistré pour le moment.</td></tr>';
            } else {
                filtered.forEach(h => {
                    const tr = document.createElement('tr');
                    const missingCount = h.missing_items ? h.missing_items.length : 0;
                    const missingHtml = missingCount === 0
                        ? '<span style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> Tout vérifié</span>'
                        : `<span style="color: var(--primary-color);"><i class="fa-solid fa-triangle-exclamation"></i> ${missingCount} non pointé(s)</span>`;

                    tr.innerHTML = `
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
                filtered.forEach(h => {
                    const missingCount = h.missing_items ? h.missing_items.length : 0;
                    const card = document.createElement('div');
                    card.className = 'm-card';
                    card.innerHTML = `
                        <div class="m-card-header">
                            <div>
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
                    cardsList.appendChild(card);
                });
            }
        }
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

        const userId   = document.getElementById('user-id').value;
        const login    = document.getElementById('user-login').value.trim();
        const name     = document.getElementById('user-name').value.trim();
        const email    = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value.trim();

        const isEditing = userId !== '';

        try {
            if (isEditing) {
                // Mode édition : on envoie l'ID et le mot de passe est optionnel
                await apiRequest('api/users.php?action=edit', 'POST', { id: parseInt(userId), login, name, email, password });
            } else {
                // Mode création : le mot de passe est obligatoire
                if (!password) {
                    userError.textContent = 'Le mot de passe (matricule) est obligatoire pour la création d\'un compte.';
                    userError.style.display = 'block';
                    return;
                }
                await apiRequest('api/users.php?action=create', 'POST', { login, name, email, password });
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
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le compte de ${name} ?`)) {
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
    // 9. ACTIONS SUR LES VÉHICULES (Suppression + Clonage)
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
            showToast(`✅ ${result.message}`, 'success');
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
    // 10. MÉTHODES DE L'ÉDITEUR D'INVENTAIRES (WORK SPA)
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

        editorTitle.textContent = isNewVehicle ? "Nouveau Véhicule / Lot" : `Édition : ${vehicle.name}`;
        
        // Configuration des champs du formulaire
        editVehicleId.value = editingVehicle.id;
        editVehicleId.disabled = !isNewVehicle; // L'identifiant (ID) est immutable une fois créé
        editVehicleName.value = editingVehicle.name;
        editVehicleType.value = editingVehicle.type;
        editVehicleDesc.value = editingVehicle.description || '';
        editVehicleIcon.value = editingVehicle.icon || 'fa-truck-fast';
        editVehicleImage.value = editingVehicle.image || '';

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
     * Inclut les boutons ↑/↓ pour réordonner les emplacements et les équipements.
     */
    function renderEditorLocations() {
        locationsEditorList.innerHTML = '';

        if (editingVehicle.locations.length === 0) {
            locationsEditorList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">Aucune localisation créée pour le moment.</div>';
            return;
        }

        const totalLocs = editingVehicle.locations.length;

        editingVehicle.locations.forEach((loc, locIndex) => {
            const locBox = document.createElement('div');
            locBox.className = 'location-edit-box';

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
                <div class="location-edit-body">
                    <div class="table-container">
                        <table class="admin-table eq-edit-table" style="margin-bottom: 1rem;">
                            <thead>
                                <tr>
                                    <th style="width: 36px;"></th>
                                    <th style="width: 60px; text-align: center;">Photo</th>
                                    <th>Nom de l'équipement</th>
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
                loc.items.push({ name: '', quantity: 1 });
                renderEditorLocations();
            };

            // Génération des lignes d'équipements
            const eqTbody = locBox.querySelector('.eq-tbody');
            const totalItems = loc.items.length;

            if (totalItems === 0) {
                eqTbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--text-secondary); padding: 1rem 0;">Aucun équipement dans cet emplacement.</td></tr>';
            } else {
                loc.items.forEach((item, itemIndex) => {
                    const tr = document.createElement('tr');
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
                                `}
                                <input type="file" class="item-img-file-input" accept="image/*" capture="environment" style="display: none;">
                            </div>
                        </td>
                        <td>
                            <input type="text" class="item-name-input" value="${escapeHtml(item.name)}" placeholder="Ex: Tuyau 70 - 20 m">
                        </td>
                        <td>
                            <input type="number" class="item-qty-input" value="${item.quantity}" min="0">
                        </td>
                        <td style="vertical-align: middle; text-align:right;">
                            <button type="button" class="btn btn-text btn-delete-item" style="color: var(--primary-color);">
                                <i class="fa-solid fa-times-circle" style="font-size: 1.25rem;"></i>
                            </button>
                        </td>
                    `;

                    tr.querySelector('.item-name-input').oninput = (e) => { item.name = e.target.value; };
                    tr.querySelector('.item-qty-input').oninput = (e) => { item.quantity = parseInt(e.target.value) || 0; };

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
                            const file = fileInput.files[0];
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

                    // Photo : supprimer
                    const clearBtn = tr.querySelector('.btn-clear-item-img');
                    if (clearBtn) {
                        clearBtn.onclick = () => { delete item.image; renderEditorLocations(); };
                    }

                    // Photo : zoom
                    const thumbImg = tr.querySelector('.item-edit-thumbnail');
                    if (thumbImg) {
                        thumbImg.onclick = () => zoomImage(item.image, item.name || 'Équipement');
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

    // Événement global de l'éditeur : Créer un nouvel emplacement physique vide
    btnAddLocation.onclick = () => {
        const id = 'loc-' + Date.now(); // Génère un identifiant ID unique temporaire en millisecondes
        editingVehicle.locations.push({
            id,
            name: 'Nouvel Emplacement',
            icon: 'fa-box',
            items: []
        });
        renderEditorLocations();
    };

    // -------------------------------------------------------------------------
    // 11. TÉLÉVERSEMENT D'IMAGE AJAX (Upload)
    // -------------------------------------------------------------------------
    imageUploadInput.onchange = async () => {
        if (imageUploadInput.files.length === 0) return;
        
        const file = imageUploadInput.files[0];
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
    // 12. ENREGISTREMENT ET VALIDATION FINALE DES DONNÉES
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

        // 12.2 INTÉGRATION DES DONNÉES AU MODÈLE EN MÉMOIRE
        editingVehicle.id = vId;
        editingVehicle.name = vName;
        editingVehicle.type = vType;
        editingVehicle.description = vDesc;
        editingVehicle.icon = vIcon;
        editingVehicle.image = vImage;
        editingVehicle.responsible_admin = vResponsible;

        // 12.3 NETTOYAGE : Élimine automatiquement les lignes d'équipements vides de la sauvegarde
        editingVehicle.locations.forEach(loc => {
            if (loc.items) {
                loc.items = loc.items.filter(item => item.name.trim() !== '');
            }
        });

        // 12.4 SAUVEGARDE EN BASE DE DONNÉES VIA L'API REST
        try {
            const result = await apiRequest('api/data.php?action=save_vehicle', 'POST', editingVehicle);
            
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
     * Échappe les caractères HTML spéciaux pour éviter de casser les attributs HTML
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
            alert('✅ QR codes régénérés avec succès !\n\n' + (result.output || ''));
            loadDashboardData();
        } catch (err) {
            // Affiche les détails d'erreur retournés par le serveur si disponibles
            const details = err.details ? '\n\nDétails :\n' + (Array.isArray(err.details) ? err.details.join('\n') : err.details) : '';
            alert('❌ Erreur lors de la régénération des QR codes :\n' + err.message + details);
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
        let html = `
            <div class="booklet-header">
                <div class="booklet-title">
                    <h1>Fiche d'Inventaire</h1>
                    <p>Caserne TMC - Réf. Matériel : ${vehicle.name} (${vehicle.type})</p>
                </div>
                <div class="booklet-meta-box">
                    <div class="booklet-meta-text">
                        <strong>Mise à jour :</strong> ${today}<br>
                        <em>Scannez le QR-code ci-contre<br>pour accéder à la version en ligne.</em>
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

    // Événement après impression : nettoie les classes CSS appliquées sur le body
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
    // 14. DÉMARRAGE : Lancement de la vérification de la session
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // 14. DÉMARRAGE : Lancement de la vérification de la session
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
     * Active un onglet du dashboard et masque les autres.
     * Tout est piloté via style.display pour être compatible tous navigateurs.
     */
    function activateTab(tabId) {
        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.dash-tab-panel').forEach(p => { p.style.display = 'none'; });
        const activeTab = document.querySelector(`.dash-tab[data-tab="${tabId}"]`);
        const activePanel = document.getElementById(tabId);
        if (activeTab) activeTab.classList.add('active');
        if (activePanel) activePanel.style.display = 'block';
    }

    // Initialisation des onglets : masquer tous les panneaux sauf le premier
    document.querySelectorAll('.dash-tab-panel').forEach((p, i) => {
        p.style.display = i === 0 ? 'block' : 'none';
    });

    // Gestion du clic sur les onglets
    document.querySelectorAll('.dash-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activateTab(tab.dataset.tab);
        });
    });

    checkSession();
});
