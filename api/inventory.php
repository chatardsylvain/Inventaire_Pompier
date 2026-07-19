<?php
/**
 * api/inventory.php
 * API du "processus d'inventaire" : permet à un ou plusieurs agents de démarrer
 * une vérification physique du matériel d'un véhicule, de cocher chaque élément
 * au fur et à mesure, puis de clôturer l'inventaire.
 *
 * À la clôture, un enregistrement définitif est ajouté à data/inventory_history.json
 * avec la date, l'heure, le(s) agent(s) et la liste du matériel manquant (non coché).
 *
 * Contrairement à data.php (accès public en lecture, écriture admin uniquement),
 * ce module autorise TOUTES les actions sans authentification admin : ce sont les
 * agents de terrain (pas forcément administrateurs) qui réalisent l'inventaire
 * depuis l'appli publique.
 */

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

define('SESSIONS_DIR', DATA_DIR . '/inventory_sessions');
define('HISTORY_FILE', DATA_DIR . '/inventory_history.json');

// Crée le dossier des sessions actives s'il n'existe pas encore
if (!is_dir(SESSIONS_DIR)) {
    @mkdir(SESSIONS_DIR, 0775, true);
}

/**
 * Valide un identifiant de véhicule (mêmes règles que data.php).
 */
function isValidVehicleIdInv($id) {
    return preg_match('/^[a-zA-Z0-9\-]+$/', $id);
}

function sessionFilePath($vehicleId) {
    return SESSIONS_DIR . '/' . $vehicleId . '.json';
}

function loadSession($vehicleId) {
    $path = sessionFilePath($vehicleId);
    if (!file_exists($path)) return null;
    return json_decode(file_get_contents($path), true) ?: null;
}

function saveSession($vehicleId, $session) {
    $path = sessionFilePath($vehicleId);
    $json = json_encode($session, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents($path, $json) !== false;
}

function deleteSession($vehicleId) {
    $path = sessionFilePath($vehicleId);
    if (file_exists($path)) @unlink($path);
}

function loadHistory() {
    if (!file_exists(HISTORY_FILE)) return [];
    return json_decode(file_get_contents(HISTORY_FILE), true) ?: [];
}

function saveHistory($history) {
    $json = json_encode(array_values($history), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents(HISTORY_FILE, $json) !== false;
}

/**
 * Charge les données complètes (nom, emplacements, items) d'un véhicule
 * depuis son fichier JSON individuel (data/{id}.json).
 */
function loadVehicleData($vehicleId) {
    $path = DATA_DIR . '/' . $vehicleId . '.json';
    if (!file_exists($path)) return null;
    return json_decode(file_get_contents($path), true) ?: null;
}

// -------------------------------------------------------------------------
// GET : consultation (session active, historique)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // Retourne la session d'inventaire en cours pour un véhicule (ou null)
    if ($action === 'get_active') {
        $vId = isset($_GET['vehicle_id']) ? trim($_GET['vehicle_id']) : '';
        if (!isValidVehicleIdInv($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }
        $session = loadSession($vId);
        sendJSON(['session' => $session]);
    }

    // Retourne l'historique des inventaires (tous véhicules, ou filtré par vehicle_id)
    // Réservé aux administrateurs connectés (traçabilité interne).
    if ($action === 'history') {
        requireAuth();
        $history = loadHistory();
        if (isset($_GET['vehicle_id']) && $_GET['vehicle_id'] !== '') {
            $vId = trim($_GET['vehicle_id']);
            $history = array_values(array_filter($history, function ($h) use ($vId) {
                return $h['vehicle_id'] === $vId;
            }));
        }
        // Les plus récents en premier
        usort($history, function ($a, $b) {
            return strcmp($b['finished_at'], $a['finished_at']);
        });
        sendJSON($history);
    }
}

// -------------------------------------------------------------------------
// POST : actions de terrain (démarrage, pointage, clôture)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $input = json_decode(file_get_contents('php://input'), true);

    // ACTION : start -> démarre une nouvelle session d'inventaire pour un véhicule
    if ($action === 'start') {
        if (!$input || !isset($input['vehicle_id']) || !isset($input['agents']) || !is_array($input['agents'])) {
            sendJSON(['error' => 'Données incomplètes (véhicule et agent(s) requis).'], 400);
        }

        $vId = trim($input['vehicle_id']);
        if (!isValidVehicleIdInv($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }

        $agents = array_values(array_filter(array_map('trim', $input['agents']), function ($a) {
            return $a !== '';
        }));
        if (empty($agents)) {
            sendJSON(['error' => 'Veuillez indiquer au moins un agent.'], 400);
        }

        $vehicleData = loadVehicleData($vId);
        if (!$vehicleData) {
            sendJSON(['error' => 'Véhicule introuvable.'], 404);
        }

        // Si une session existe déjà pour ce véhicule, on la renvoie telle quelle
        // (évite d'écraser un inventaire déjà en cours par un autre agent)
        $existing = loadSession($vId);
        if ($existing) {
            sendJSON(['session' => $existing, 'resumed' => true]);
        }

        $session = [
            'session_id'   => uniqid('inv_'),
            'vehicle_id'   => $vId,
            'vehicle_name' => $vehicleData['name'],
            'agents'       => $agents,
            'started_at'   => date('Y-m-d H:i:s'),
            'checked'      => [] // clé "emplacement||item" => true
        ];

        if (!saveSession($vId, $session)) {
            sendJSON(['error' => 'Impossible de créer la session d\'inventaire.'], 500);
        }

        sendJSON(['session' => $session, 'resumed' => false]);
    }

    // ACTION : toggle -> coche/décoche un élément de matériel dans la session en cours
    if ($action === 'toggle') {
        if (!$input || !isset($input['vehicle_id']) || !isset($input['location_name'])
                    || !isset($input['item_name'])   || !isset($input['checked'])) {
            sendJSON(['error' => 'Données incomplètes.'], 400);
        }

        $vId = trim($input['vehicle_id']);
        if (!isValidVehicleIdInv($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }

        $session = loadSession($vId);
        if (!$session) {
            sendJSON(['error' => 'Aucun inventaire en cours pour ce véhicule.'], 404);
        }

        $key = $input['location_name'] . '||' . $input['item_name'];
        if ($input['checked']) {
            $session['checked'][$key] = date('Y-m-d H:i:s');
        } else {
            unset($session['checked'][$key]);
        }

        if (!saveSession($vId, $session)) {
            sendJSON(['error' => 'Impossible d\'enregistrer la progression.'], 500);
        }

        sendJSON(['success' => true, 'checked_count' => count($session['checked'])]);
    }

    // ACTION : cancel -> annule l'inventaire en cours sans l'archiver
    if ($action === 'cancel') {
        if (!$input || !isset($input['vehicle_id'])) {
            sendJSON(['error' => 'Identifiant de véhicule manquant.'], 400);
        }
        $vId = trim($input['vehicle_id']);
        if (!isValidVehicleIdInv($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }
        deleteSession($vId);
        sendJSON(['success' => true]);
    }

    // ACTION : finish -> clôture l'inventaire et l'archive dans l'historique
    if ($action === 'finish') {
        if (!$input || !isset($input['vehicle_id'])) {
            sendJSON(['error' => 'Identifiant de véhicule manquant.'], 400);
        }

        $vId = trim($input['vehicle_id']);
        if (!isValidVehicleIdInv($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }

        $session = loadSession($vId);
        if (!$session) {
            sendJSON(['error' => 'Aucun inventaire en cours pour ce véhicule.'], 404);
        }

        $vehicleData = loadVehicleData($vId);

        // Calcule la liste du matériel non coché (= potentiellement manquant/à vérifier)
        $totalItems = 0;
        $missingItems = [];
        if ($vehicleData && !empty($vehicleData['locations'])) {
            foreach ($vehicleData['locations'] as $loc) {
                if (empty($loc['items'])) continue;
                foreach ($loc['items'] as $item) {
                    $totalItems++;
                    $key = $loc['name'] . '||' . $item['name'];
                    if (!isset($session['checked'][$key])) {
                        $missingItems[] = [
                            'location' => $loc['name'],
                            'item'     => $item['name']
                        ];
                    }
                }
            }
        }

        $record = [
            'id'            => uniqid('hist_'),
            'vehicle_id'    => $vId,
            'vehicle_name'  => $session['vehicle_name'],
            'agents'        => $session['agents'],
            'started_at'    => $session['started_at'],
            'finished_at'   => date('Y-m-d H:i:s'),
            'total_items'   => $totalItems,
            'checked_count' => count($session['checked']),
            'missing_items' => $missingItems
        ];

        $history = loadHistory();
        $history[] = $record;
        if (!saveHistory($history)) {
            sendJSON(['error' => 'Impossible d\'enregistrer l\'historique de l\'inventaire.'], 500);
        }

        deleteSession($vId);

        sendJSON(['success' => true, 'record' => $record]);
    }
}

sendJSON(['error' => 'Action ou méthode non supportée.'], 400);
?>
