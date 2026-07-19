/**
 * script.js — v1.9
 * Moteur JavaScript de l'application publique d'inventaire de la caserne (SPA).
 * Ce script gère :
 * - Le chargement dynamique asynchrone des données des véhicules via l'API REST
 * - L'affichage de la grille d'accueil réactive (Grid)
 * - L'affichage détaillé de l'inventaire d'un véhicule sélectionné par localisations
 * - La recherche instantanée d'équipements à l'aide d'un champ de filtrage
 * - Le routage profond basé sur l'ancre URL (Hash-based Routing) pour charger un véhicule directement via QR-code
 * - La carte PISU pour la gestion des médicaments (module infirmier)
 * - Le processus d'inventaire guidé (démarrage / pointage par checkbox / clôture)
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
    // 3. INITIALISATION
    // -------------------------------------------------------------------------

    /**
     * Démarre l'application : récupère les inventaires et les alertes en parallèle,
     * puis construit la grille d'accueil et active le routage par ancre.
     */
    async function init() {
        try {
            const [dataRes, alertsRes] = await Promise.all([
                fetch('api/data.php?action=get_all',  { cache: 'no-store' }),
                fetch('api/alerts.php?action=list',   { cache: 'no-store' })
            ]);

            if (!dataRes.ok) throw new Error('Impossible de se connecter à l\'API d\'inventaire.');

            inventoryData = await dataRes.json();
            if (alertsRes.ok) {
                alertsData = await alertsRes.json();
            }

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

            card.innerHTML = `
                <div class="card-img-container">${mediaHtml}</div>
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

            card.addEventListener('click', () => openInventory(item));
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
                <p class="card-desc">Protocole Infirmier de Soin d'Urgence — Gestion des médicaments</p>
                <div class="card-footer">
                    <span><i class="fa-solid fa-pills"></i> ${pisuData.total || 0} Médicaments</span>
                    <span style="color:${pisuData.expired > 0 ? '#ef4444' : '#10b981'};">
                        <i class="fa-solid fa-triangle-exclamation"></i> ${(pisuData.expired || 0) + (pisuData.expiring || 0)} Alertes
                    </span>
                </div>
            </div>
        `;
        pisuCard.addEventListener('click', () => showPisuLoginModal());
        vehiclesGrid.appendChild(pisuCard);
    }

    // -------------------------------------------------------------------------
    // 5. INVENTAIRE DÉTAILLÉ D'UN VÉHICULE
    // -------------------------------------------------------------------------

    /**
     * Ouvre la vue d'inventaire d'un véhicule et peuple la sidebar des localisations.
     */
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

        homeView.classList.remove('active');
        inventoryView.classList.add('active');

        homeBtn.style.display = 'inline-flex';
        document.getElementById('admin-btn').style.display = 'none';

        scrollTopBtn.classList.add('visible');

        window.location.hash = item.id;

        searchInput.value = '';
        searchQuery       = '';

        loadActiveInventorySession(item.id);
    }

    /**
     * Sélectionne un emplacement physique et rafraîchit le tableau des équipements.
     */
    function selectLocation(loc) {
        currentLocation = loc;
        currentLocationTitle.textContent = loc.name;
        renderEquipment();
    }

    /**
     * Génère les lignes du tableau des équipements, avec filtre de recherche,
     * badges d'alerte et (si une session est active) colonnes de pointage.
     */
    function renderEquipment() {
        equipmentTbody.innerHTML = '';

        const emptyColspan = activeInventorySession ? 3 : 2;

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

            // Alerte active pour cet équipement ?
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

            // Checkbox de pointage si une session d'inventaire est active
            let checkboxHtml = '';
            if (activeInventorySession) {
                const key       = currentLocation.name + '||' + item.name;
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
                checkboxEl.onchange = () => toggleInventoryCheck(item.name, checkboxEl.checked, checkboxEl);
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
                window.scrollTo(0, 0); // fallback iOS < 15.4
            }
        });

        // Processus d'inventaire
        btnStartInventory.addEventListener('click',  showStartInventoryModal);
        btnFinishInventory.addEventListener('click', confirmFinishInventory);
        btnCancelInventory.addEventListener('click', confirmCancelInventory);
    }

    // -------------------------------------------------------------------------
    // 7. ROUTAGE PAR ANCRE URL (QR-CODES)
    // -------------------------------------------------------------------------

    /**
     * Lit le fragment (#id) de l'URL et ouvre directement la fiche du véhicule correspondant.
     */
    function checkHashRoute() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const vehicle = inventoryData.find(v => v.id === hash);
            if (vehicle) openInventory(vehicle);
        }
    }

    // Gestion du bouton "Précédent" et des changements de hash en cours de navigation
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
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

    /**
     * Vérifie si une session d'inventaire est déjà en cours pour ce véhicule
     * (utile en cas de rechargement de page pendant un inventaire).
     */
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

    /**
     * Met à jour les boutons et badges selon l'état de la session d'inventaire.
     */
    function updateInventoryProcessUI() {
        const checkHeader = document.getElementById('inventory-check-header');
        if (activeInventorySession) {
            btnStartInventory.style.display      = 'none';
            btnFinishInventory.style.display     = 'inline-flex';
            btnCancelInventory.style.display     = 'inline-flex';
            inventoryProgressBadge.style.display = 'inline-flex';
            if (checkHeader) checkHeader.style.display = 'table-cell';

            const checkedCount  = Object.keys(activeInventorySession.checked || {}).length;
            const agentsLabel   = activeInventorySession.agents.join(', ');
            inventoryProgressBadge.innerHTML =
                `<i class="fa-solid fa-user-check"></i> ${escapeHtml(agentsLabel)} — ${checkedCount} pointé(s)`;
        } else {
            btnStartInventory.style.display      = 'inline-flex';
            btnFinishInventory.style.display     = 'none';
            btnCancelInventory.style.display     = 'none';
            inventoryProgressBadge.style.display = 'none';
            if (checkHeader) checkHeader.style.display = 'none';
        }
    }

    /**
     * Affiche la modale de démarrage d'inventaire (saisie du/des agent(s)).
     */
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
        modal.offsetHeight; // force reflow
        modal.style.opacity = '1';
    }

    /**
     * Coche ou décoche un équipement dans la session d'inventaire en cours.
     */
    async function toggleInventoryCheck(itemName, checked, checkboxEl) {
        if (!activeInventorySession || !currentLocation) return;
        checkboxEl.disabled = true;
        try {
            const response = await fetch('api/inventory.php?action=toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicle_id:    currentItem.id,
                    location_name: currentLocation.name,
                    item_name:     itemName,
                    checked:       checked
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erreur lors du pointage.');

            const key = currentLocation.name + '||' + itemName;
            if (checked) {
                activeInventorySession.checked[key] = true;
            } else {
                delete activeInventorySession.checked[key];
            }
            updateInventoryProcessUI();
        } catch (err) {
            checkboxEl.checked = !checked; // annule visuellement le changement
            alert(err.message);
        } finally {
            checkboxEl.disabled = false;
        }
    }

    /**
     * Demande confirmation puis annule l'inventaire en cours (sans archivage).
     */
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
                body: JSON.stringify({ vehicle_id: currentItem.id })
            });
            activeInventorySession = null;
            updateInventoryProcessUI();
            renderEquipment();
        } catch (err) {
            alert('Erreur lors de l\'annulation : ' + err.message);
        }
    }

    /**
     * Demande confirmation puis clôture l'inventaire : enregistre date, agents
     * et matériel non pointé dans l'historique côté serveur.
     */
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
                summary += `\n⚠️ Matériel NON pointé (${record.missing_items.length}) :\n`;
                summary += record.missing_items.map(m => `- ${m.item} (${m.location})`).join('\n');
            } else {
                summary += '\n✅ Tout le matériel a été vérifié.';
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

    /**
     * Modale de confirmation asynchrone (remplace window.confirm, incompatible avec async/await).
     * Retourne une Promise<boolean>.
     */
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
            modal.offsetHeight; // force reflow
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

    /**
     * Affiche une image en plein écran (zoom sur vignette d'équipement).
     */
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
        modal.offsetHeight; // force reflow
        modal.style.opacity = '1';
    }

    /**
     * Modale de signalement d'anomalie sur un équipement.
     */
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

                    // Invalide le cache SW pour alerts si présent, puis recharge
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
        modal.offsetHeight; // force reflow
        modal.style.opacity = '1';
    }

    /**
     * Modale de connexion PISU — redirige vers pisu.php après authentification.
     */
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
        modal.offsetHeight; // force reflow
        modal.style.opacity = '1';
    }

    // -------------------------------------------------------------------------
    // 10. FALLBACK LOGO (conformité CSP — remplace l'ancien onerror= inline)
    // -------------------------------------------------------------------------

    const headerLogoImg = document.getElementById('header-logo-img');
    if (headerLogoImg) {
        headerLogoImg.addEventListener('error', () => {
            headerLogoImg.style.display = 'none';
            const fallback = headerLogoImg.nextElementSibling;
            if (fallback) fallback.style.display = 'inline-block';
        });
    }

    // -------------------------------------------------------------------------
    // DÉMARRAGE
    // -------------------------------------------------------------------------

    init();

}); // fin DOMContentLoaded

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE WORKER — enregistrement hors DOMContentLoaded (conformité CSP)
// Remplace l'ancien bloc <script> inline de index.php
// ─────────────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./sw.js')
            .then(reg  => console.log('[SW] Enregistré :', reg.scope))
            .catch(err => console.warn('[SW] Échec d\'enregistrement :', err));
    });
}
