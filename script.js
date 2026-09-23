/**
 * script.js — v2.0 — 2026-09-11
 * Moteur JavaScript de l'application publique d'inventaire de la caserne (SPA).
 * Ce script gère :
 * - Le chargement dynamique asynchrone des données des véhicules via l'API REST
 * - L'affichage de la grille d'accueil réactive (Grid)
 * - L'affichage détaillé de l'inventaire d'un véhicule sélectionné par localisations
 * - La recherche instantanée d'équipements à l'aide d'un champ de filtrage
 * - Le routage profond basé sur l'ancre URL (Hash-based Routing) pour charger un véhicule directement via QR-code
 * - La carte PISU pour la gestion des médicaments (module infirmier)
 * - Le processus d'inventaire guidé (démarrage / pointage par checkbox / clôture)
 * - L'affichage des dates de péremption ASUP sur les items d'inventaire (v2.0)
 */

document.addEventListener('DOMContentLoaded', () => {

    // -------------------------------------------------------------------------
    // 1. ÉLÉMENTS DU DOM
    // -------------------------------------------------------------------------

    const homeView              = document.getElementById('home-view');
    const inventoryView         = document.getElementById('inventory-view');
    const vehiclesGrid          = document.getElementById('vehicles-grid');
    const currentItemTitle      = document.getElementById('current-item-title');
    const currentItemType       = document.getElementById('current-item-type');
    const locationsList         = document.getElementById('locations-list');
    const currentLocationTitle  = document.getElementById('current-location-title');
    const equipmentTbody        = document.getElementById('equipment-tbody');
    const searchInput           = document.getElementById('search-input');
    const homeBtn               = document.getElementById('home-btn');
    const backBtn               = document.getElementById('back-btn');
    const scrollTopBtn          = document.getElementById('scroll-top-btn');

    // Processus d'inventaire
    const btnStartInventory      = document.getElementById('btn-start-inventory');
    const btnFinishInventory     = document.getElementById('btn-finish-inventory');
    const btnCancelInventory     = document.getElementById('btn-cancel-inventory');
    const btnForceRestartInventory = document.getElementById('btn-force-restart-inventory');
    const inventoryProgressBadge = document.getElementById('inventory-progress-badge');

    // -------------------------------------------------------------------------
    // 2. VARIABLES D'ÉTAT
    // -------------------------------------------------------------------------

    let currentItem             = null;  // Véhicule/Lot en cours de consultation
    let currentLocation         = null;  // Emplacement physique actuellement sélectionné
    let searchQuery             = '';    // Terme de recherche courant
    let inventoryData           = [];    // Données complètes de tous les véhicules
    let alertsData              = [];    // Alertes actives
    let activeInventorySession  = null;  // Session de processus d'inventaire en cours

    // Compteurs PISU (alimentés de façon asynchrone)
    window.pisuData = { total: 0, expiring: 0, expired: 0 };

    // -------------------------------------------------------------------------
    // UTILITAIRE : échappement HTML
    // -------------------------------------------------------------------------

    /**
     * Échappe les caractères HTML spéciaux pour un affichage sûr dans le DOM.
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
    // UTILITAIRE : badge péremption ASUP
    // -------------------------------------------------------------------------

    /**
     * Retourne un badge HTML de péremption ASUP si l'item correspond à un
     * médicament ASUP (croisement par name + location), sinon chaîne vide.
     */
    function buildAsupBadge(itemName, locationName) {
        if (!window.asupMeds || !window.asupMeds.length) return '';
        const med = window.asupMeds.find(function(m) {
            return m.name === itemName && m.location === locationName;
        });
        if (!med || !med.peremption) return '';

        const dateFormatted = med.peremption.split('-').reverse().join('/');
        let color, icon, label;

        if (med._status === 'expired') {
            color = '#ef4444';
            icon  = 'fa-triangle-exclamation';
            label = 'P\u00e9rim\u00e9 depuis ' + Math.abs(med._days) + 'j (' + dateFormatted + ')';
        } else if (med._status === 'expiring') {
            color = '#f97316';
            icon  = 'fa-clock';
            label = 'P\u00e9remption dans ' + med._days + 'j (' + dateFormatted + ')';
        } else {
            color = 'var(--text-secondary)';
            icon  = 'fa-calendar-check';
            label = 'P\u00e9remption\u00a0: ' + dateFormatted;
        }

        return '<div style="margin-top:3px; font-size:0.8rem; color:' + color + ';">'
             + '<i class="fa-solid ' + icon + '"></i> ' + label
             + '</div>';
    }

    // -------------------------------------------------------------------------
    // 3. INITIALISATION
    // -------------------------------------------------------------------------

    /**
     * Démarre l'application : récupère les inventaires et les alertes en parallèle,
     * puis construit la grille d'accueil et active le routage par ancre.
     */
    async function init() {
        try {
            const [dataRes, alertsRes, cleaningRes, asupRes] = await Promise.all([
                fetch('api/data.php?action=get_all',  { cache: 'no-store' }),
                fetch('api/alerts.php?action=list',   { cache: 'no-store' }),
                fetch('api/cleaning.php?action=status', { cache: 'no-store' }).catch(() => ({ ok: false })),
                fetch('api/asup.php?action=public_medications', { cache: 'no-store' }).catch(() => ({ ok: false })),
            ]);

            if (!dataRes.ok) throw new Error('Impossible de se connecter à l\'API d\'inventaire.');

            inventoryData = await dataRes.json();
            if (alertsRes.ok) {
                alertsData = await alertsRes.json();
            }
            if (cleaningRes && cleaningRes.ok) {
                window.cleaningData = await cleaningRes.json();
            }
            window.asupMeds = (asupRes && asupRes.ok) ? await asupRes.json() : [];

            // Chargement asynchrone des compteurs PISU (non bloquant)
            fetch('api/pisu.php?action=public_count', { cache: 'no-store' })
                .then(r => r.json())
                .then(data => { window.pisuData = data; })
                .catch(() => { window.pisuData = { total: 0, expiring: 0, expired: 0 }; });

            renderGrid();
            setupEventListeners();
            checkHashRoute();

        } catch (error) {
            console.error('Erreur lors du chargement de l\'inventaire :', error);
            vehiclesGrid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:4rem 2rem; color:var(--primary-color);">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; margin-bottom:1rem;"></i>
                    <h3 style="font-size:1.5rem; margin-bottom:0.5rem;">Impossible de charger l'inventaire</h3>
                    <p style="color:var(--text-secondary); margin-bottom:1.5rem;">Vérifiez que le serveur web fonctionne correctement ou que l'accès au réseau est établi.</p>
                </div>
            `;
        }
    }

    // -------------------------------------------------------------------------
    // 4. GRILLE D'ACCUEIL
    // -------------------------------------------------------------------------

    /**
     * Génère les cartes de tous les véhicules et la carte PISU, puis les injecte dans la grille.
     */
    function renderGrid() {
        vehiclesGrid.innerHTML = '';

        // --- Cartes véhicules ---
        inventoryData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = item.id;

            const mediaHtml = item.image
                ? `<img src="${(typeof imageOptimizer !== 'undefined' ? imageOptimizer.getOptimizedUrl(item.image) : item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">`
                : `<i class="fa-solid ${item.icon || 'fa-truck-fast'} card-icon"></i>`;

            const totalLocations = item.locations ? item.locations.length : 0;
            const totalItems     = item.locations
                ? item.locations.reduce((acc, loc) => acc + (loc.items ? loc.items.length : 0), 0)
                : 0;

            // Bandeau "Indisponible" affiché en surimpression sur la photo si le flag est actif
            const unavailableBanner = item.unavailable
                ? `<div class="card-unavailable-banner"><i class="fa-solid fa-ban"></i> Indisponible</div>`
                : '';

            let cleaningBanner = '';
            if (item.id === 'vsav' && window.cleaningData && window.cleaningData.next_cleaning_date) {
                let bannerColor = 'var(--success-color, #10b981)';
                if (window.cleaningData.is_overdue) {
                    bannerColor = 'var(--danger-color, #ef4444)';
                } else if (window.cleaningData.is_cleaning_week) {
                    bannerColor = 'var(--warning-color, #f59e0b)';
                }
                cleaningBanner = `
                    <div class="card-cleaning-banner" style="background-color: ${bannerColor};">
                        <i class="fa-solid fa-broom"></i> Protocole désinfection : <br>Sem. du ${window.cleaningData.next_cleaning_date_formatted} &mdash; ${escapeHtml(window.cleaningData.current_team_name)}
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="card-img-container">
                    ${mediaHtml}
                    ${unavailableBanner}
                </div>
                ${cleaningBanner}
                <div class="card-content">
                    <span class="card-type">${item.type}</span>
                    <h3 class="card-title">${item.name}</h3>
                    <p class="card-desc">${item.description || ''}</p>
                    <div class="card-footer">
                        <span><i class="fa-solid fa-map-location-dot"></i> ${totalLocations} Emplacements</span>
                        <span><i class="fa-solid fa-box"></i> ${totalItems} Réf.</span>
                    </div>
                </div>
            `;

            if (item.unavailable) {
                card.classList.add('card-unavailable');
                card.addEventListener('click', (e) => e.preventDefault());
            } else {
                card.addEventListener('click', () => openInventory(item));
            }
            vehiclesGrid.appendChild(card);
        });

        // --- Carte PISU ---
        const pisuData   = window.pisuData || { total: 0, expiring: 0, expired: 0 };
        const pisuCard   = document.createElement('div');
        pisuCard.className = 'card';
        pisuCard.style.cursor = 'pointer';
        pisuCard.innerHTML = `
            <div class="card-img-container" style="background:linear-gradient(135deg,#ec4899 0%,#f43f5e 100%);">
                <i class="fa-solid fa-briefcase-medical card-icon"></i>
            </div>
            <div class="card-content">
                <span class="card-type">SYSTÈME</span>
                <h3 class="card-title">PISU</h3>
                <p class="card-desc">Protocole Infirmier de Soins d'Urgence &mdash; Gestion des médicaments</p>
                <div class="card-footer">
                    <span><i class="fa-solid fa-pills"></i> ${pisuData.total || 0} Médicaments</span>
                    <span style="color:${pisuData.expired > 0 ? '#ef4444' : '#10b981'};">
                        <i class="fa-solid fa-triangle-exclamation"></i> ${(pisuData.expired || 0) + (pisuData.expiring || 0)} Alertes
                    </span>
                </div>
            </div>
        `;
		pisuCard.addEventListener('click', () => { window.location.href = './pisu.php'; });
        vehiclesGrid.appendChild(pisuCard);
    }

    // -------------------------------------------------------------------------
    // 5. INVENTAIRE DÉTAILLÉ D'UN VÉHICULE
    // -------------------------------------------------------------------------

    function openInventory(item) {
        currentItem = item;

        currentItemTitle.textContent = item.name;
        currentItemType.textContent  = item.type;

        locationsList.innerHTML = '';
        if (item.locations && item.locations.length > 0) {
            item.locations.forEach((loc, index) => {
                const option = document.createElement('option');
                option.value       = index;
                option.textContent = loc.name;
                locationsList.appendChild(option);
            });

            locationsList.onchange = (e) => selectLocation(item.locations[e.target.value]);
            selectLocation(item.locations[0]);
        } else {
            currentLocation = null;
            renderEquipment();
        }

        // Affiche ou masque la barre "Emplacement suivant" selon le nombre d'emplacements
        const nextLocationBar = document.getElementById('next-location-bar');
        if (nextLocationBar) {
            nextLocationBar.style.display = (item.locations && item.locations.length > 1) ? 'block' : 'none';
        }

        homeView.classList.remove('active');
        inventoryView.classList.add('active');

        homeBtn.style.display = 'inline-flex';
        document.getElementById('admin-btn').style.display = 'none';

        scrollTopBtn.classList.add('visible');

        if (window.location.hash !== '#' + item.id) {
            window.location.hash = item.id;
        }

        searchInput.value = '';
        searchQuery       = '';

        loadActiveInventorySession(item.id);
    }

    function selectLocation(loc) {
        currentLocation = loc;
        currentLocationTitle.textContent = loc.name;
        renderEquipment();

        // Met à jour le libellé du bouton selon la position dans la liste
        const btnNextLoc = document.getElementById('btn-next-location');
        if (btnNextLoc && currentItem && currentItem.locations && currentItem.locations.length > 1) {
            const currentIndex = parseInt(locationsList.value, 10);
            const isLast = currentIndex === currentItem.locations.length - 1;
            btnNextLoc.innerHTML = isLast
                ? '<i class="fa-solid fa-arrow-rotate-left"></i> Retour au 1er emplacement'
                : '<i class="fa-solid fa-arrow-right"></i> Emplacement suivant';
        }
    }

    function renderEquipment() {
        equipmentTbody.innerHTML = '';

        const emptyColspan = activeInventorySession ? 3 : 2;

        // Reconstruction dynamique du thead pour intégrer la coche "Tout sélectionner"
        // (nécessaire car la coche est recréée à chaque renderEquipment)
        const tableElement = equipmentTbody.closest('table');
        if (tableElement) {
            const tableHead = tableElement.querySelector('thead tr');
            if (tableHead) {
                const checkboxHeaderHtml = activeInventorySession
                    ? `<th style="width: 40px; text-align: center;">
                           <input type="checkbox" id="inventory-check-all"
                                  title="Tout sélectionner/désélectionner"
                                  style="transform: scale(1.3); cursor: pointer;">
                       </th>`
                    : '';
                tableHead.innerHTML = `
                    ${checkboxHeaderHtml}
                    <th>Matériel</th>
                    <th class="text-right">Qté Requise</th>
                `;
            }
        }

        if (!currentLocation || !currentLocation.items || currentLocation.items.length === 0) {
            equipmentTbody.innerHTML = `
                <tr><td colspan="${emptyColspan}" class="empty-state">
                    <i class="fa-solid fa-box-open"></i><p>Aucun équipement enregistré ici.</p>
                </td></tr>`;
            return;
        }

        const filteredItems = currentLocation.items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (filteredItems.length === 0) {
            equipmentTbody.innerHTML = `
                <tr><td colspan="${emptyColspan}" class="empty-state">
                    <i class="fa-solid fa-magnifying-glass"></i><p>Aucun équipement ne correspond à votre recherche.</p>
                </td></tr>`;
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');

            const optimizedUrl = item.image && typeof imageOptimizer !== 'undefined'
                ? imageOptimizer.getOptimizedUrl(item.image)
                : item.image;

            const imageHtml = item.image
                ? `<img src="${optimizedUrl}" class="item-thumbnail" alt="${escapeHtml(item.name)}">`
                : '';

            const activeAlert = alertsData.find(a =>
                a.vehicle_id    === currentItem.id &&
                a.location_name === currentLocation.name &&
                a.item_name     === item.name
            );

            let alertHtml  = '';
            let actionHtml = '';

            if (activeAlert) {
                const badgeColor = activeAlert.alert_type === 'Manquant'
                    ? 'var(--primary-color)'
                    : (activeAlert.alert_type === 'Périmé' ? '#f97316' : '#eab308');

                alertHtml = `
                    <div style="margin-top:4px; font-size:0.8rem;">
                        <span style="color:${badgeColor}; font-weight:600;">
                            <i class="fa-solid fa-triangle-exclamation"></i> ${activeAlert.alert_type}
                        </span>
                        ${activeAlert.comment
                            ? `<div style="color:var(--text-secondary); margin-top:2px;">
                                <i class="fa-solid fa-comment-dots"></i> ${escapeHtml(activeAlert.comment)}
                               </div>`
                            : ''}
                    </div>`;
                actionHtml = `<span style="color:var(--text-secondary); font-size:0.8rem;">Signalé</span>`;
            } else {
                actionHtml = `
                    <button type="button" class="btn btn-text btn-report-anomaly"
                            data-item="${escapeHtml(item.name)}"
                            title="Signaler un problème"
                            style="color:#f97316;">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </button>`;
            }

            let checkboxHtml = '';
            if (activeInventorySession) {
                const key       = currentLocation.name + '||' + item.name + (item.lot ? '||' + item.lot : '');
                const isChecked = !!activeInventorySession.checked[key];
                checkboxHtml = `
                    <td class="text-center" style="vertical-align:middle;">
                        <input type="checkbox" class="inventory-check-checkbox"
                               data-key="${escapeHtml(key)}" ${isChecked ? 'checked' : ''}>
                    </td>`;
            }

            tr.innerHTML = `
                ${checkboxHtml}
                <td>
                    <div class="item-cell">
                        ${imageHtml}
                        <div>
                            <span class="item-name">${escapeHtml(item.name)}</span>
                            ${buildAsupBadge(item.name, currentLocation ? currentLocation.name : '')}
                            ${alertHtml}
                        </div>
                    </div>
                </td>
                <td class="text-right" style="vertical-align:middle;">
                    <span class="qty-badge">${item.quantity}</span>
                    <div style="margin-top:5px;">${actionHtml}</div>
                </td>
            `;

            const checkboxEl = tr.querySelector('.inventory-check-checkbox');
            if (checkboxEl) {
                checkboxEl.onchange = () => toggleInventoryCheck(checkboxEl.getAttribute('data-key'), checkboxEl.checked, checkboxEl);
            }

            const btnReport = tr.querySelector('.btn-report-anomaly');
            if (btnReport) {
                btnReport.onclick = () => showReportModal(item.name);
            }

            const thumbImg = tr.querySelector('.item-thumbnail');
            if (thumbImg) {
                thumbImg.onclick = () => zoomImage(item.image, item.name);
            }

            equipmentTbody.appendChild(tr);
        });

        const checkAllBtn = document.getElementById('inventory-check-all');
        if (checkAllBtn) {
            if (activeInventorySession && filteredItems.length > 0) {
                const allChecked = filteredItems.every(item => {
                    const key = currentLocation.name + '||' + item.name + (item.lot ? '||' + item.lot : '');
                    return !!activeInventorySession.checked[key];
                });
                checkAllBtn.checked = allChecked;
            } else {
                checkAllBtn.checked = false;
            }
        }
    }

    // -------------------------------------------------------------------------
    // 6. ÉCOUTEURS D'ÉVÉNEMENTS GLOBAUX
    // -------------------------------------------------------------------------

    function setupEventListeners() {
        const goHome = () => {
            inventoryView.classList.remove('active');
            homeView.classList.add('active');
            homeBtn.style.display = 'none';
            document.getElementById('admin-btn').style.display = 'inline-flex';
            currentItem            = null;
            activeInventorySession = null;
            scrollTopBtn.classList.remove('visible');
            history.pushState('', document.title, window.location.pathname + window.location.search);
        };

        homeBtn.addEventListener('click', goHome);
        backBtn.addEventListener('click', goHome);

        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderEquipment();
        });

        scrollTopBtn.addEventListener('click', () => {
            if ('scrollBehavior' in document.documentElement.style) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.scrollTo(0, 0);
            }
        });

        btnStartInventory.addEventListener('click',  showStartInventoryModal);
        btnFinishInventory.addEventListener('click', confirmFinishInventory);
        btnCancelInventory.addEventListener('click', confirmCancelInventory);
        if (btnForceRestartInventory) btnForceRestartInventory.addEventListener('click', confirmForceRestartInventory);

        // Délégation d'événement pour la coche "Tout sélectionner" :
        // elle est recréée à chaque renderEquipment(), donc on écoute sur le document
        document.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'inventory-check-all') {
                toggleBatchInventoryCheck(e);
            }
        });

        // Bouton "Emplacement suivant" (boucle sur le premier après le dernier)
        const btnNextLoc = document.getElementById('btn-next-location');
        if (btnNextLoc) {
            btnNextLoc.addEventListener('click', () => {
                if (!currentItem || !currentItem.locations) return;
                const currentIndex = parseInt(locationsList.value, 10);
                const nextIndex = (currentIndex + 1) % currentItem.locations.length;
                locationsList.value = nextIndex;
                selectLocation(currentItem.locations[nextIndex]);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    // -------------------------------------------------------------------------
    // 7. ROUTAGE PAR ANCRE URL (QR-CODES)
    // -------------------------------------------------------------------------

    function checkHashRoute() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const vehicle = inventoryData.find(v => v.id === hash);
            if (vehicle) openInventory(vehicle);
        }
    }

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            if (currentItem && currentItem.id === hash) return;
            checkHashRoute();
        } else if (currentItem !== null) {
            inventoryView.classList.remove('active');
            homeView.classList.add('active');
            homeBtn.style.display = 'none';
            document.getElementById('admin-btn').style.display = 'inline-flex';
            currentItem = null;
        }
    });

    // -------------------------------------------------------------------------
    // 8. PROCESSUS D'INVENTAIRE GUIDÉ
    // -------------------------------------------------------------------------

    async function loadActiveInventorySession(vehicleId) {
        activeInventorySession = null;
        updateInventoryProcessUI();
        try {
            const response = await fetch(
                `api/inventory.php?action=get_active&vehicle_id=${encodeURIComponent(vehicleId)}`,
                { cache: 'no-store' }
            );
            if (!response.ok) return;
            const result = await response.json();
            if (result.session) activeInventorySession = result.session;
        } catch (err) {
            console.error('Erreur lors de la vérification de la session d\'inventaire :', err);
        }
        updateInventoryProcessUI();
        renderEquipment();
    }

    function updateInventoryProcessUI() {
        if (activeInventorySession) {
            btnStartInventory.style.display      = 'none';
            btnFinishInventory.style.display     = 'inline-flex';
            btnCancelInventory.style.display     = 'inline-flex';
            if (btnForceRestartInventory) btnForceRestartInventory.style.display = 'inline-flex';
            inventoryProgressBadge.style.display = 'inline-flex';

            const checkedCount  = Object.keys(activeInventorySession.checked || {}).length;
            const agentsLabel   = activeInventorySession.agents.join(', ');
            inventoryProgressBadge.innerHTML =
                `<i class="fa-solid fa-user-check"></i> ${escapeHtml(agentsLabel)} &mdash; ${checkedCount} pointé(s)`;
        } else {
            btnStartInventory.style.display      = 'inline-flex';
            btnFinishInventory.style.display     = 'none';
            btnCancelInventory.style.display     = 'none';
            if (btnForceRestartInventory) btnForceRestartInventory.style.display = 'none';
            inventoryProgressBadge.style.display = 'none';
        }
    }

    function showStartInventoryModal() {
        let modal = document.getElementById('start-inventory-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'start-inventory-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0',
                width: '100%', height: '100%',
                backgroundColor: 'rgba(15,23,42,0.9)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: '9999', opacity: '0', transition: 'opacity 0.25s ease'
            });

            modal.innerHTML = `
                <div style="background-color:var(--surface-color); padding:2rem; border-radius:var(--radius-lg); border:1px solid var(--border-color); max-width:420px; width:90%;">
                    <h3 style="margin-bottom:1rem; color:var(--primary-color);">
                        <i class="fa-solid fa-clipboard-check"></i> Démarrer l'inventaire
                    </h3>
                    <p style="margin-bottom:1rem; color:var(--text-secondary); font-size:0.9rem;">
                        Indiquez le(s) nom(s) du ou des agents qui réalisent la vérification. Séparez plusieurs noms par une virgule.
                    </p>
                    <div style="margin-bottom:1.5rem;">
                        <label style="display:block; margin-bottom:0.5rem;">Agent(s) :</label>
                        <input type="text" id="start-inventory-agents"
                               placeholder="Ex: Dupont Jean, Martin Paul"
                               style="width:100%; padding:0.75rem 1rem; border-radius:var(--radius-md); background-color:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:var(--text-primary); font-family:inherit;">
                    </div>
                    <div style="display:flex; gap:1rem; justify-content:flex-end;">
                        <button type="button" id="btn-cancel-start-inventory" class="btn btn-outline">Annuler</button>
                        <button type="button" id="btn-confirm-start-inventory" class="btn btn-primary">Démarrer</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('btn-cancel-start-inventory').onclick = () => {
                modal.style.opacity = '0';
                setTimeout(() => { modal.style.display = 'none'; }, 250);
            };

            document.getElementById('btn-confirm-start-inventory').onclick = async () => {
                const raw = document.getElementById('start-inventory-agents').value.trim();
                if (!raw) {
                    alert('Veuillez indiquer au moins un nom d\'agent.');
                    return;
                }
                const agents = raw.split(',').map(a => a.trim()).filter(a => a !== '');

                const btn      = document.getElementById('btn-confirm-start-inventory');
                const origHtml = btn.innerHTML;
                btn.innerHTML  = '<i class="fa-solid fa-spinner fa-spin"></i> Démarrage...';
                btn.disabled   = true;

                try {
                    const response = await fetch('api/inventory.php?action=start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ vehicle_id: currentItem.id, agents })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Erreur lors du démarrage de l\'inventaire.');

                    activeInventorySession = result.session;
                    updateInventoryProcessUI();
                    renderEquipment();

                    if (result.resumed) {
                        alert('Un inventaire était déjà en cours pour ce véhicule, il a été repris là où il en était.');
                    }

                    document.getElementById('btn-cancel-start-inventory').click();
                } catch (err) {
                    alert(err.message);
                } finally {
                    btn.innerHTML = origHtml;
                    btn.disabled  = false;
                }
            };
        }

        document.getElementById('start-inventory-agents').value = '';
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.style.opacity = '1';
    }

    async function toggleInventoryCheck(itemKey, checked, checkboxEl) {
        if (!activeInventorySession || !currentLocation) return;
        checkboxEl.disabled = true;
        // Décompose la clé "location||name" ou "location||name||lot"
        const parts = itemKey.split('||');
        const locationName = parts[0];
        const itemName     = parts[1];
        const itemLot      = parts[2] || '';
        try {
            const response = await fetch('api/inventory.php?action=toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicle_id:    currentItem.id,
                    location_name: locationName,
                    item_name:     itemName,
                    item_lot:      itemLot,
                    checked:       checked
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erreur lors du pointage.');

            if (checked) {
                activeInventorySession.checked[itemKey] = true;
            } else {
                delete activeInventorySession.checked[itemKey];
            }
            updateInventoryProcessUI();
        } catch (err) {
            checkboxEl.checked = !checked;
            alert(err.message);
        } finally {
            checkboxEl.disabled = false;
        }
    }

    async function toggleBatchInventoryCheck(e) {
        if (!activeInventorySession || !currentLocation) return;

        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll('.inventory-check-checkbox');

        const itemsToToggle = [];
        checkboxes.forEach(cb => {
            if (cb.checked !== isChecked) {
                itemsToToggle.push(cb.getAttribute('data-key'));
            }
        });

        if (itemsToToggle.length === 0) return;

        checkboxes.forEach(cb => {
            cb.checked = isChecked;
            cb.disabled = true;
        });
        e.target.disabled = true;

        try {
            const response = await fetch('api/inventory.php?action=toggle_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicle_id: currentItem.id,
                    items: itemsToToggle,
                    checked: isChecked
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erreur lors du pointage groupé.');

            if (isChecked) {
                const now = new Date().toISOString();
                itemsToToggle.forEach(k => { activeInventorySession.checked[k] = now; });
            } else {
                itemsToToggle.forEach(k => { delete activeInventorySession.checked[k]; });
            }

            updateInventoryProcessUI();
        } catch (err) {
            alert(err.message);
            checkboxes.forEach(cb => {
                const key = cb.getAttribute('data-key');
                cb.checked = !!activeInventorySession.checked[key];
            });
            e.target.checked = !isChecked;
        } finally {
            checkboxes.forEach(cb => { cb.disabled = false; });
            e.target.disabled = false;
        }
    }

    async function confirmCancelInventory() {
        if (!activeInventorySession) return;
        const ok = await showConfirmModal(
            'Annuler l\'inventaire',
            'Voulez-vous vraiment annuler cet inventaire ? Le pointage effectué sera perdu.'
        );
        if (!ok) return;

        try {
            await fetch('api/inventory.php?action=cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicle_id: currentItem.id, status: 'annulé' })
            });
            activeInventorySession = null;
            updateInventoryProcessUI();
            renderEquipment();
        } catch (err) {
            alert('Erreur lors de l\'annulation : ' + err.message);
        }
    }

    async function confirmForceRestartInventory() {
        if (!activeInventorySession) return;
        const ok = await showConfirmModal(
            'Écraser l\'inventaire',
            'Cet inventaire a été commencé précédemment (ou par un autre agent). Voulez-vous vraiment l\'écraser et recommencer à zéro ?'
        );
        if (!ok) return;

        try {
            await fetch('api/inventory.php?action=cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicle_id: currentItem.id, status: 'écrasé' })
            });
            activeInventorySession = null;
            updateInventoryProcessUI();
            renderEquipment();
            showStartInventoryModal();
        } catch (err) {
            alert('Erreur lors de l\'écrasement : ' + err.message);
        }
    }

    async function confirmFinishInventory() {
        if (!activeInventorySession) return;
        const ok = await showConfirmModal(
            'Terminer l\'inventaire',
            'Confirmez-vous la fin de l\'inventaire ? Le matériel non coché sera consigné comme non vérifié.'
        );
        if (!ok) return;

        const btn      = btnFinishInventory;
        const origHtml = btn.innerHTML;
        btn.innerHTML  = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
        btn.disabled   = true;

        try {
            const response = await fetch('api/inventory.php?action=finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicle_id: currentItem.id })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erreur lors de la clôture de l\'inventaire.');

            const record  = result.record;
            let summary   = `Inventaire terminé pour ${record.vehicle_name}.\n`;
            summary      += `Agent(s) : ${record.agents.join(', ')}\n`;
            summary      += `Matériel pointé : ${record.checked_count} / ${record.total_items}\n`;
            if (record.missing_items.length > 0) {
                summary += `\n&o26fr; Matériel NON pointé (${record.missing_items.length}) :\n`;
                summary += record.missing_items.map(m => `- ${m.item} (${m.location})`).join('\n');
            } else {
                summary += '\n&o270; Tout le matériel a été vérifié.';
            }
            alert(summary);

            activeInventorySession = null;
            updateInventoryProcessUI();
            renderEquipment();
        } catch (err) {
            alert(err.message);
        } finally {
            btn.innerHTML = origHtml;
            btn.disabled  = false;
        }
    }

    // -------------------------------------------------------------------------
    // 9. MODALES UTILITAIRES
    // -------------------------------------------------------------------------

    function showConfirmModal(title, message) {
        return new Promise((resolve) => {
            let modal = document.getElementById('confirm-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'confirm-modal';
                Object.assign(modal.style, {
                    position: 'fixed', top: '0', left: '0',
                    width: '100%', height: '100%',
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: '9999', opacity: '0', transition: 'opacity 0.25s ease'
                });

                modal.innerHTML = `
                    <div style="background-color:var(--surface-color); padding:2rem; border-radius:var(--radius-lg); border:1px solid var(--border-color); max-width:450px; width:90%;">
                        <h3 id="confirm-title" style="margin-bottom:1rem; color:var(--primary-color);">
                            <i class="fa-solid fa-circle-question"></i>
                        </h3>
                        <p id="confirm-message" style="margin-bottom:2rem; color:var(--text-secondary); line-height:1.5;"></p>
                        <div style="display:flex; justify-content:flex-end; gap:1rem;">
                            <button id="confirm-no"  class="btn btn-outline">Non</button>
                            <button id="confirm-yes" class="btn btn-primary">Oui</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);
            }

            document.getElementById('confirm-title').innerHTML =
                `<i class="fa-solid fa-circle-question"></i> ${title}`;
            document.getElementById('confirm-message').textContent = message;

            modal.style.display = 'flex';
            modal.offsetHeight;
            modal.style.opacity = '1';

            const close = (result) => {
                modal.style.opacity = '0';
                setTimeout(() => { modal.style.display = 'none'; resolve(result); }, 250);
            };

            document.getElementById('confirm-yes').onclick       = () => close(true);
            document.getElementById('confirm-no').onclick        = () => close(false);
            modal.onclick = (e) => { if (e.target === modal) close(false); };
        });
    }

    function zoomImage(src, title) {
        let modal = document.getElementById('zoom-image-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'zoom-image-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0',
                width: '100%', height: '100%',
                backgroundColor: 'rgba(15,23,42,0.9)',
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center',
                zIndex: '9999', cursor: 'zoom-out',
                opacity: '0', transition: 'opacity 0.25s ease'
            });

            modal.innerHTML = `
                <div style="position:absolute; top:20px; right:20px; color:white; font-size:28px; cursor:pointer; z-index:10000;">
                    <i class="fa-solid fa-xmark"></i>
                </div>
                <img id="zoom-image-content" src="" alt=""
                     style="max-width:90%; max-height:80%; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5); object-fit:contain;">
                <p id="zoom-image-title"
                   style="color:white; margin-top:15px; font-size:16px; font-weight:600; text-align:center; font-family:sans-serif; padding:0 20px;"></p>
            `;

            modal.onclick = () => {
                modal.style.opacity = '0';
                setTimeout(() => { modal.style.display = 'none'; }, 250);
            };
            document.body.appendChild(modal);
        }

        document.getElementById('zoom-image-content').src         = src;
        document.getElementById('zoom-image-title').textContent   = title;
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.style.opacity = '1';
    }

    function showReportModal(itemName) {
        let modal = document.getElementById('report-anomaly-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'report-anomaly-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0',
                width: '100%', height: '100%',
                backgroundColor: 'rgba(15,23,42,0.9)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: '9999', opacity: '0', transition: 'opacity 0.25s ease'
            });

            modal.innerHTML = `
                <div style="background-color:var(--surface-color); padding:2rem; border-radius:var(--radius-lg); border:1px solid var(--border-color); max-width:400px; width:90%;">
                    <h3 style="margin-bottom:1rem; color:var(--primary-color);">
                        <i class="fa-solid fa-triangle-exclamation"></i> Signaler une anomalie
                    </h3>
                    <p style="margin-bottom:1rem; color:var(--text-secondary);">
                        Matériel : <strong id="report-item-name" style="color:var(--text-primary);"></strong>
                    </p>
                    <div style="margin-bottom:1.5rem;">
                        <label style="display:block; margin-bottom:0.5rem;">Type de problème :</label>
                        <select id="report-type" style="width:100%; padding:0.75rem; border-radius:var(--radius-md); background-color:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:white;">
                            <option value="Manquant">Manquant</option>
                            <option value="Défectueux">Défectueux</option>
                            <option value="Périmé">Périmé</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:1rem; justify-content:flex-end;">
                        <button type="button" id="btn-cancel-report" class="btn btn-outline">Annuler</button>
                        <button type="button" id="btn-submit-report" class="btn btn-primary">Signaler</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('btn-cancel-report').onclick = () => {
                modal.style.opacity = '0';
                setTimeout(() => { modal.style.display = 'none'; }, 250);
            };

            document.getElementById('btn-submit-report').onclick = async () => {
                const type     = document.getElementById('report-type').value;
                const itemName = document.getElementById('report-item-name').textContent;

                if (type === 'Manquant') {
                    const ok = await showConfirmModal(
                        'Confirmation',
                        'Avez-vous bien vérifié dans le stock de la caserne avant de signaler ce matériel comme manquant ?'
                    );
                    if (!ok) return;
                }

                const btn      = document.getElementById('btn-submit-report');
                const origHtml = btn.innerHTML;
                btn.innerHTML  = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
                btn.disabled   = true;

                try {
                    const response = await fetch('api/alerts.php?action=create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            vehicle_id:    currentItem.id,
                            location_name: currentLocation.name,
                            item_name:     itemName,
                            alert_type:    type
                        })
                    });

                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Erreur lors du signalement.');

                    alert('Anomalie signalée avec succès. Le responsable a été notifié.');

                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.open(k).then(c => c.delete('api/alerts.php?action=list'))));
                    }
                    const alertsRes = await fetch('api/alerts.php?action=list', { cache: 'no-store' });
                    if (alertsRes.ok) alertsData = await alertsRes.json();
                    renderEquipment();

                    document.getElementById('btn-cancel-report').click();
                } catch (err) {
                    alert(err.message);
                } finally {
                    btn.innerHTML = origHtml;
                    btn.disabled  = false;
                }
            };
        }

        document.getElementById('report-item-name').textContent = itemName;
        document.getElementById('report-type').value = 'Manquant';
        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.style.opacity = '1';
    }

    function showPisuLoginModal() {
        let modal = document.getElementById('pisu-login-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pisu-login-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0',
                width: '100%', height: '100%',
                backgroundColor: 'rgba(15,23,42,0.9)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: '9999', opacity: '0', transition: 'opacity 0.25s ease'
            });

            modal.innerHTML = `
                <div style="background-color:var(--surface-color); padding:2.5rem 2rem; border-radius:var(--radius-lg); border:1px solid var(--border-color); max-width:450px; width:90%; box-shadow:0 20px 25px -5px rgb(0 0 0/0.5);">
                    <div style="text-align:center; margin-bottom:2rem;">
                        <i class="fa-solid fa-briefcase-medical" style="font-size:3rem; color:#ec4899; margin-bottom:1rem; display:block;"></i>
                        <h2 style="margin-bottom:0.5rem;">Connexion PISU</h2>
                        <p style="color:var(--text-secondary); font-size:0.875rem;">Identifiez-vous pour accéder à votre espace de gestion des médicaments.</p>
                    </div>
                    <form id="pisu-login-form">
                        <div style="margin-bottom:1.25rem;">
                            <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Identifiant :</label>
                            <input type="text" id="pisu-username" placeholder="Votre identifiant" required
                                   style="width:100%; padding:0.75rem 1rem; border-radius:var(--radius-md); background-color:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:var(--text-primary); font-family:inherit; font-size:0.875rem;">
                        </div>
                        <div style="margin-bottom:1.25rem;">
                            <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Mot de passe :</label>
                            <input type="password" id="pisu-password" placeholder="Votre mot de passe" required
                                   style="width:100%; padding:0.75rem 1rem; border-radius:var(--radius-md); background-color:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:var(--text-primary); font-family:inherit; font-size:0.875rem;">
                        </div>
                        <div id="pisu-error" style="display:none; padding:0.75rem 1rem; border-radius:var(--radius-md); margin-bottom:1rem; background-color:rgba(239,68,68,0.1); color:var(--primary-color); border:1px solid rgba(239,68,68,0.2); font-size:0.875rem;"></div>
                        <div style="display:flex; gap:1rem;">
                            <button type="button" class="btn btn-outline pisu-cancel-btn" style="flex:1;">Annuler</button>
                            <button type="submit" class="btn btn-primary" style="flex:1;">Se connecter</button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            const form      = modal.querySelector('#pisu-login-form');
            const closeBtn  = modal.querySelector('.pisu-cancel-btn');
            const errorDiv  = modal.querySelector('#pisu-error');

            closeBtn.onclick = () => {
                modal.style.opacity = '0';
                setTimeout(() => { modal.style.display = 'none'; }, 250);
            };

            modal.onclick = (e) => { if (e.target === modal) closeBtn.click(); };

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorDiv.style.display = 'none';

                const login     = document.getElementById('pisu-username').value.trim();
                const password  = document.getElementById('pisu-password').value.trim();
                const submitBtn = form.querySelector('button[type="submit"]');
                const origText  = submitBtn.textContent;

                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Vérification...';
                submitBtn.disabled  = true;

                try {
                    const response = await fetch('api/pisu.php?action=login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ login, password })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Erreur de connexion');
                    window.location.href = './pisu.php';
                } catch (err) {
                    errorDiv.textContent   = err.message;
                    errorDiv.style.display = 'block';
                    submitBtn.textContent  = origText;
                    submitBtn.disabled     = false;
                }
            });
        }

        modal.style.display = 'flex';
        modal.offsetHeight;
        modal.style.opacity = '1';
    }

    const headerLogoImg = document.getElementById('header-logo-img');
    if (headerLogoImg) {
        headerLogoImg.addEventListener('error', () => {
            headerLogoImg.style.display = 'none';
            const fallback = headerLogoImg.nextElementSibling;
            if (fallback) fallback.style.display = 'inline-block';
        });
    }

    init();

});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./sw.php')
            .then(reg  => console.log('[SW] Enregistré :', reg.scope))
            .catch(err => console.warn('[SW] Échec d\'enregistrement :', err));
    });
}