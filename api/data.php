<?php
/**
 * api/data.php
 * API de gestion des inventaires (CRUD) pour les véhicules et lots.
 *
 * Modifié le 2026-09-02 — Ajout action list_images (GET, public)
 *   Retourne la liste des images disponibles dans /images/ (hors qrcodes/ et logo.webp)
 *   pour permettre la sélection d'une image partagée entre véhicules/lots.
 */

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

function isValidVehicleId($id) {
    return preg_match('/^[a-zA-Z0-9\-]+$/', $id);
}

function loadManifest() {
    $manifestPath = DATA_DIR . '/manifest.json';
    if (!file_exists($manifestPath)) {
        return [];
    }
    return json_decode(file_get_contents($manifestPath), true) ?: [];
}

function saveManifest($manifest) {
    $manifestPath = DATA_DIR . '/manifest.json';
    $jsonContent = json_encode(array_values($manifest), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        return false;
    }
    $result = @file_put_contents($manifestPath, $jsonContent);
    return $result !== false;
}

// -------------------------------------------------------------------------
// 1. REQUÊTES PUBLIQUES (GET)
// -------------------------------------------------------------------------

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // Action get_all : agrège tous les inventaires
    if ($action === 'get_all') {
        $manifest = loadManifest();
        $vehicles = [];
        foreach ($manifest as $vId) {
            if (!isValidVehicleId($vId)) continue;
            $filePath = DATA_DIR . '/' . $vId . '.json';
            if (file_exists($filePath)) {
                $vehicleData = json_decode(file_get_contents($filePath), true);
                if ($vehicleData) {
                    $vehicles[] = $vehicleData;
                }
            }
        }
        sendJSON($vehicles);
    }

    // Action list_images : liste les fichiers du répertoire /images/
    // Exclut : sous-dossier qrcodes/, logo.webp, fichiers non-image
    // Retourne pour chaque image : { name, path, shared }
    // shared=true si le nom ne contient pas de préfixe véhicule (pas de '_' suivi de timestamp)
    if ($action === 'list_images') {
        $imagesDir = __DIR__ . '/../images';
        if (!is_dir($imagesDir)) {
            sendJSON(['images' => []]);
        }

        $allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $excluded   = ['logo.webp'];
        $images     = [];

        $files = scandir($imagesDir);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            if (is_dir($imagesDir . '/' . $file)) continue; // ignore qrcodes/ et autres sous-dossiers
            if (in_array($file, $excluded, true)) continue;

            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExt, true)) continue;

            // Détermine si l'image est "partagée" (nom sans préfixe_timestamp)
            // Pattern préfixé : vehicleId_1234567890.webp
            $isShared = !preg_match('/^[a-zA-Z0-9\-]+_\d{9,11}\.[a-z]+$/', $file);

            $images[] = [
                'name'   => $file,
                'path'   => './images/' . $file,
                'shared' => $isShared,
            ];
        }

        // Tri : images partagées en premier, puis ordre alphabétique
        usort($images, function($a, $b) {
            if ($a['shared'] !== $b['shared']) {
                return $a['shared'] ? -1 : 1;
            }
            return strcmp($a['name'], $b['name']);
        });

        sendJSON(['images' => $images]);
    }
}

// -------------------------------------------------------------------------
// 2. REQUÊTES SÉCURISÉES (POST) — authentification requise
// -------------------------------------------------------------------------
requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if ($action === 'save_vehicle') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id']) || !isset($input['name'])) {
            sendJSON(['error' => 'Données de véhicule invalides ou incomplètes.'], 400);
        }
        $vId = trim($input['id']);
        if (!isValidVehicleId($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide. Utilisez uniquement des lettres, chiffres et tirets.'], 400);
        }
        $filePath = DATA_DIR . '/' . $vId . '.json';

        // Préservation du CT toggle si la date CT n'a pas changé
        if (file_exists($filePath)) {
            $existing = json_decode(file_get_contents($filePath), true);
            if ($existing) {
                $newCtDate = isset($input['ct_date']) ? $input['ct_date'] : '';
                $oldCtDate = isset($existing['ct_date']) ? $existing['ct_date'] : '';
                if ($newCtDate === $oldCtDate) {
                    // Date inchangée → conserver l'état du toggle
                    $input['ct_done'] = isset($existing['ct_done']) ? (bool)$existing['ct_done'] : false;
                } else {
                    // Date modifiée → reset du toggle (comportement normal)
                    $input['ct_done'] = false;
                }
            }
        }

        $jsonContent = json_encode($input, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($jsonContent === false) {
            sendJSON(['error' => 'Erreur lors de l\'encodage JSON des données : ' . json_last_error_msg()], 500);
        }
        $result = @file_put_contents($filePath, $jsonContent);
        if ($result === false) {
            $error = error_get_last();
            $errorMsg = isset($error['message']) ? $error['message'] : 'Problème d\'écriture sur le serveur (vérifiez les permissions d\'écriture du dossier data).';
            sendJSON(['error' => 'Impossible de sauvegarder le fichier d\'inventaire : ' . $errorMsg], 500);
        }
        $manifest = loadManifest();
        if (!in_array($vId, $manifest)) {
            $manifest[] = $vId;
            if (!saveManifest($manifest)) {
                sendJSON(['error' => 'Véhicule sauvegardé, mais impossible de mettre à jour le fichier d\'index manifest.json.'], 500);
            }
        }
        sendJSON(['success' => true, 'message' => 'Véhicule et inventaire sauvegardés avec succès.']);
    }

    elseif ($action === 'delete_vehicle') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) {
            sendJSON(['error' => 'Identifiant de véhicule manquant.'], 400);
        }
        $vId = trim($input['id']);
        if (!isValidVehicleId($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }
        $filePath = DATA_DIR . '/' . $vId . '.json';
        if (file_exists($filePath)) {
            if (!@unlink($filePath)) {
                $error = error_get_last();
                $errorMsg = isset($error['message']) ? $error['message'] : 'Vérifiez les permissions d\'écriture du fichier.';
                sendJSON(['error' => 'Impossible de supprimer le fichier JSON du véhicule : ' . $errorMsg], 500);
            }
        }
        $manifest = loadManifest();
        $key = array_search($vId, $manifest);
        if ($key !== false) {
            unset($manifest[$key]);
            if (!saveManifest($manifest)) {
                sendJSON(['error' => 'Le fichier du véhicule a été supprimé, mais l\'index manifest.json n\'a pas pu être mis à jour.'], 500);
            }
        }
        sendJSON(['success' => true, 'message' => 'Véhicule supprimé de la base de données avec succès.']);
    }

    elseif ($action === 'reorder_vehicles') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['order']) || !is_array($input['order'])) {
            sendJSON(['error' => 'Liste d\'ordre invalide ou manquante.'], 400);
        }
        $newOrder = [];
        foreach ($input['order'] as $vId) {
            $vId = trim($vId);
            if (!isValidVehicleId($vId)) {
                sendJSON(['error' => 'Identifiant invalide dans la liste : ' . $vId], 400);
            }
            $newOrder[] = $vId;
        }
        $manifest = loadManifest();
        $diffA = array_diff($newOrder, $manifest);
        $diffB = array_diff($manifest, $newOrder);
        if (!empty($diffA) || !empty($diffB)) {
            sendJSON(['error' => 'La liste d\'ordre ne correspond pas aux véhicules existants.'], 400);
        }
        if (!saveManifest($newOrder)) {
            sendJSON(['error' => 'Impossible de sauvegarder le nouvel ordre dans manifest.json.'], 500);
        }
        sendJSON(['success' => true, 'message' => 'Ordre des véhicules mis à jour.']);
    }

    elseif ($action === 'toggle_unavailable') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) {
            sendJSON(['error' => 'Identifiant de véhicule manquant.'], 400);
        }
        $vId = trim($input['id']);
        if (!isValidVehicleId($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }
        $filePath = DATA_DIR . '/' . $vId . '.json';
        if (!file_exists($filePath)) {
            sendJSON(['error' => 'Fichier de véhicule introuvable.'], 404);
        }
        $vehicleData = json_decode(file_get_contents($filePath), true);
        if (!$vehicleData) {
            sendJSON(['error' => 'Données du véhicule illisibles.'], 500);
        }
        $newState = isset($input['unavailable']) ? (bool) $input['unavailable'] : !((bool)($vehicleData['unavailable'] ?? false));
        $vehicleData['unavailable'] = $newState;
        $jsonContent = json_encode($vehicleData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($jsonContent === false || @file_put_contents($filePath, $jsonContent) === false) {
            sendJSON(['error' => 'Erreur lors de la sauvegarde de l\'état d\'indisponibilité.'], 500);
        }
        sendJSON(['success' => true, 'unavailable' => $newState]);
    }

    elseif ($action === 'clone_vehicle') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['source_id']) || !isset($input['new_id']) || !isset($input['new_name'])) {
            sendJSON(['error' => 'Données incomplètes. source_id, new_id et new_name sont requis.'], 400);
        }
        $sourceId = trim($input['source_id']);
        $newId    = trim($input['new_id']);
        $newName  = trim($input['new_name']);
        if (!isValidVehicleId($sourceId) || !isValidVehicleId($newId)) {
            sendJSON(['error' => 'Identifiant source ou cible invalide. Utilisez uniquement des lettres, chiffres et tirets.'], 400);
        }
        if (empty($newName)) {
            sendJSON(['error' => 'Le nom du véhicule cloné est obligatoire.'], 400);
        }
        $sourcePath = DATA_DIR . '/' . $sourceId . '.json';
        if (!file_exists($sourcePath)) {
            sendJSON(['error' => 'Le véhicule source est introuvable.'], 404);
        }
        $targetPath = DATA_DIR . '/' . $newId . '.json';
        if (file_exists($targetPath)) {
            sendJSON(['error' => 'Un véhicule avec cet identifiant existe déjà. Choisissez un autre ID.'], 409);
        }
        $manifest = loadManifest();
        if (in_array($newId, $manifest)) {
            sendJSON(['error' => 'Cet identifiant est déjà utilisé dans l\'index.'], 409);
        }
        $sourceData = json_decode(file_get_contents($sourcePath), true);
        if (!$sourceData) {
            sendJSON(['error' => 'Impossible de lire les données du véhicule source.'], 500);
        }
        $sourceData['id']          = $newId;
        $sourceData['name']        = $newName;
        $sourceData['unavailable'] = false;
        $jsonContent = json_encode($sourceData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($jsonContent === false || @file_put_contents($targetPath, $jsonContent) === false) {
            sendJSON(['error' => 'Erreur lors de l\'écriture du fichier cloné.'], 500);
        }
        $sourceIndex = array_search($sourceId, $manifest);
        if ($sourceIndex !== false) {
            array_splice($manifest, $sourceIndex + 1, 0, [$newId]);
        } else {
            $manifest[] = $newId;
        }
        if (!saveManifest($manifest)) {
            @unlink($targetPath);
            sendJSON(['error' => 'Véhicule cloné mais impossible de mettre à jour l\'index manifest.json.'], 500);
        }
        sendJSON(['success' => true, 'message' => "Véhicule \"{$newName}\" cloné avec succès depuis \"{$sourceId}\".", 'new_id' => $newId]);
    }
}

sendJSON(['error' => 'Action ou méthode non supportée.'], 400);
?>
