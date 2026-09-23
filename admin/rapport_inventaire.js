(function () {
    let historyData = [];

    const selectEl       = document.getElementById('inventory-select');
    const statusEl       = document.getElementById('status-msg');
    const reportArea     = document.getElementById('report-area');
    const emptyState     = document.getElementById('empty-state');
    const btnLoadApi     = document.getElementById('btn-load-api');
    const btnLoadFile    = document.getElementById('btn-load-file');
    const fileInput      = document.getElementById('file-input');
    const btnPrint       = document.getElementById('btn-print');

    function setStatus(message, type) {
        statusEl.className = 'status-msg status-' + type;
        const icon = type === 'error' ? 'fa-circle-exclamation' : (type === 'success' ? 'fa-circle-check' : 'fa-circle-info');
        statusEl.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Formate une date "YYYY-MM-DD HH:ii:ss" en "DD/MM/YYYY à HH:ii".
     */
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.split(' ');
        if (parts.length !== 2) return dateStr;
        const d = parts[0].split('-');
        const t = parts[1].split(':');
        return `${d[2]}/${d[1]}/${d[0]} à ${t[0]}:${t[1]}`;
    }

    /**
     * Calcule une durée lisible (ex: "12 min", "1 h 05") entre deux dates "YYYY-MM-DD HH:ii:ss".
     */
    function formatDuration(startStr, endStr) {
        try {
            const start = new Date(startStr.replace(' ', 'T'));
            const end = new Date(endStr.replace(' ', 'T'));
            let diffMin = Math.round((end - start) / 60000);
            if (isNaN(diffMin) || diffMin < 0) return '-';
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            if (h === 0) return `${m} min`;
            return `${h} h ${String(m).padStart(2, '0')}`;
        } catch (e) {
            return '-';
        }
    }

    /**
     * Peuple le menu déroulant à partir du tableau d'historique chargé (le plus récent en premier).
     * Si targetId est fourni, sélectionne directement cet inventaire (utile pour l'ouverture
     * depuis l'onglet Historique de l'administration, via ?id=...).
     */
    function populateSelect(targetId) {
        const sorted = [...historyData].sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''));
        selectEl.innerHTML = '';

        if (sorted.length === 0) {
            selectEl.innerHTML = '<option value="">Aucun inventaire dans ce fichier</option>';
            selectEl.disabled = true;
            return;
        }

        let targetIndex = 0;
        sorted.forEach((h, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            const missingCount = h.missing_items ? h.missing_items.length : 0;
            const flag = missingCount > 0 ? ` — ⚠ ${missingCount} non vérifié(s)` : ' — ✓ complet';
            option.textContent = `${h.vehicle_name || h.vehicle_id} — ${formatDate(h.finished_at)}${flag}`;
            selectEl.appendChild(option);
            if (targetId && h.id === targetId) targetIndex = idx;
        });

        selectEl.disabled = false;
        historyData = sorted; // garde le tri pour que les index du <select> correspondent
        selectEl.value = targetIndex;
        renderReport(targetIndex);

        if (targetId) {
            const found = sorted.some(h => h.id === targetId);
            if (!found) {
                setStatus('Inventaire demandé introuvable dans les données chargées — l\'inventaire le plus récent est affiché à la place.', 'error');
            }
        }
    }

    /**
     * Affiche le rapport détaillé pour l'inventaire à l'index donné dans historyData.
     */
    function renderReport(index) {
        const h = historyData[index];
        if (!h) {
            reportArea.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        reportArea.style.display = 'block';

        document.getElementById('r-vehicle-name').textContent = h.vehicle_name || h.vehicle_id || 'Véhicule inconnu';
        document.getElementById('r-vehicle-sub').textContent = h.vehicle_id || '';
        document.getElementById('r-agents').textContent = (h.agents && h.agents.length) ? h.agents.join(', ') : '-';
        document.getElementById('r-started').textContent = formatDate(h.started_at);
        document.getElementById('r-finished').textContent = formatDate(h.finished_at);
        document.getElementById('r-duration').textContent = formatDuration(h.started_at, h.finished_at);

        const total = h.total_items || 0;
        const checked = h.checked_count || 0;
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
        document.getElementById('r-progress-text').textContent = `${checked} / ${total}`;
        document.getElementById('r-progress-fill').style.width = pct + '%';

        const missingItems = h.missing_items || [];
        const pill = document.getElementById('r-status-pill');
        if (missingItems.length === 0) {
            pill.className = 'status-pill ok';
            pill.innerHTML = '<i class="fa-solid fa-circle-check"></i> Inventaire complet';
        } else {
            pill.className = 'status-pill warn';
            pill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${missingItems.length} non vérifié(s)`;
        }

        const missingContent = document.getElementById('r-missing-content');
        if (missingItems.length === 0) {
            missingContent.innerHTML = '<div class="all-ok"><i class="fa-solid fa-circle-check"></i> Tout le matériel a été vérifié lors de cet inventaire.</div>';
        } else {
            // Regroupe le matériel manquant par emplacement pour une lecture plus claire
            const grouped = {};
            missingItems.forEach(m => {
                const loc = m.location || 'Emplacement inconnu';
                if (!grouped[loc]) grouped[loc] = [];
                grouped[loc].push(m.item);
            });

            let html = '';
            Object.keys(grouped).sort().forEach(loc => {
                html += `<div class="missing-group">
                    <h4><i class="fa-solid fa-location-dot"></i> ${escapeHtml(loc)}</h4>
                    <ul class="missing-list">`;
                grouped[loc].forEach(item => {
                    html += `<li><i class="fa-solid fa-xmark"></i> ${escapeHtml(item)}</li>`;
                });
                html += `</ul></div>`;
            });
            missingContent.innerHTML = html;
        }
    }

    selectEl.addEventListener('change', () => {
        if (selectEl.value !== '') renderReport(parseInt(selectEl.value, 10));
    });

    // --- Chargement depuis le site (nécessite d'être hébergé dans le dossier admin, session active) ---
    async function loadFromApi(targetId) {
        setStatus('Chargement depuis le serveur...', 'info');
        try {
            const response = await fetch('../api/inventory.php?action=history', { cache: 'no-store' });
            if (response.status === 401) {
                throw new Error('Non authentifié. Connectez-vous d\'abord à l\'administration, ou placez ce fichier dans le dossier du site.');
            }
            if (!response.ok) throw new Error('Erreur serveur (' + response.status + ')');
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error('Format de réponse inattendu.');

            historyData = data;
            if (historyData.length === 0) {
                setStatus('Aucun inventaire n\'a encore été réalisé.', 'info');
                selectEl.innerHTML = '<option value="">Aucune donnée</option>';
                selectEl.disabled = true;
                reportArea.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }
            populateSelect(targetId);
            if (!targetId || historyData.some(h => h.id === targetId)) {
                setStatus(`${historyData.length} inventaire(s) chargé(s) depuis le serveur.`, 'success');
            }
        } catch (err) {
            setStatus(err.message, 'error');
        }
    }

    btnLoadApi.addEventListener('click', () => loadFromApi());

    // --- Ouverture directe depuis l'administration (lien "Voir le rapport" -> ?id=hist_xxxx) ---
    // Charge automatiquement l'historique et sélectionne l'inventaire demandé, sans clic supplémentaire.
    const urlParams = new URLSearchParams(window.location.search);
    const requestedId = urlParams.get('id');
    if (requestedId) {
        document.getElementById('back-to-admin-wrap').style.display = 'block';
        loadFromApi(requestedId);
    }

    // --- Chargement d'un fichier JSON local (export manuel de data/inventory_history.json) ---
    btnLoadFile.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error('Le fichier doit contenir un tableau JSON (comme inventory_history.json).');
                historyData = data;
                if (historyData.length === 0) {
                    setStatus('Ce fichier ne contient aucun inventaire.', 'info');
                    reportArea.style.display = 'none';
                    emptyState.style.display = 'block';
                    return;
                }
                populateSelect();
                setStatus(`${historyData.length} inventaire(s) chargé(s) depuis « ${file.name} ».`, 'success');
            } catch (err) {
                setStatus('Fichier invalide : ' + err.message, 'error');
            }
        };
        reader.onerror = () => setStatus('Impossible de lire ce fichier.', 'error');
        reader.readAsText(file);
    });

    btnPrint.addEventListener('click', () => window.print());
})();
