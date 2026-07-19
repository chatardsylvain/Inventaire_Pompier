<?php
/**
 * api/data.php
 * API de gestion des inventaires (CRUD : Create, Read, Update, Delete) pour les véhicules et lots.
 * Permet de récupérer l'ensemble du parc de véhicules de manière publique,
 * et de sauvegarder ou supprimer des fiches d'inventaires pour les administrateurs connectés.
 */

require_once __DIR__ . '/config.php';

// Récupération de l'action demandée en paramètre GET (ex: get_all, save_vehicle, delete_vehicle)
$action = isset($_GET['action']) ? $_GET['action'] : '';

/**
 * Valide l'identifiant d'un véhicule.
 * N'autorise que les lettres (minuscules/majuscules), chiffres et tirets (-) pour éviter
 * toute injection de chemin (ex: ../../etc/passwd) par Directory Traversal.
 *
 * @param string $id L'identifiant à vérifier.
 * @return bool True si l'identifiant est valide, sinon False.
 */
function isValidVehicleId($id) {
    return preg_match('/^[a-zA-Z0-9\-]+$/', $id);
}

/**
 * Charge la liste d'index centralisée (manifest.json) qui répertorie tous les véhicules actifs.
 * 
 * @return array Tableau contenant les identifiants de fichiers des véhicules.
 */
function loadManifest() {
    $manifestPath = DATA_DIR . '/manifest.json';
    if (!file_exists($manifestPath)) {
        return [];
    }
    return json_decode(file_get_contents($manifestPath), true) ?: [];
}

/**
 * Sauvegarde la liste d'index (manifest.json) de manière ordonnée.
 *
 * @param array $manifest Le tableau d'identifiants à enregistrer.
 * @return bool True si l'écriture s'est bien déroulée, sinon False.
 */
function saveManifest($manifest) {
    $manifestPath = DATA_DIR . '/manifest.json';
    $jsonContent = json_encode(array_values($manifest), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        return false;
    }
    // Le symbole @ devant file_put_contents supprime l'affichage direct d'un warning en cas d'erreur
    $result = @file_put_contents($manifestPath, $jsonContent);
    return $result !== false;
}

// -------------------------------------------------------------------------
// 1. DÉBUT DU TRAITEMENT DES REQUÊTES PUBLIQUES (Lecture des données)
// -------------------------------------------------------------------------

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Action get_all : Récupère et agrège toutes les données d'inventaires de tous les véhicules
    if ($action === 'get_all') {
        $manifest = loadManifest();
        $vehicles = [];
        
        // Boucle sur chaque identifiant listé dans le manifest
        foreach ($manifest as $vId) {
            if (!isValidVehicleId($vId)) continue;
            
            $filePath = DATA_DIR . '/' . $vId . '.json';
            if (file_exists($filePath)) {
                $vehicleData = json_decode(file_get_contents($filePath), true);
                if ($vehicleData) {
                    $vehicles[] = $vehicleData; // Ajoute les données du véhicule au tableau final
                }
            }
        }
        // Envoie les données sous forme de tableau JSON au client
        sendJSON($vehicles);
    }
}

// -------------------------------------------------------------------------
// 2. DÉBUT DU TRAITEMENT DES REQUÊTES SÉCURISÉES (Création, modification, suppression)
//    Nécessite que l'administrateur soit connecté (vérifié par requireAuth)
// -------------------------------------------------------------------------
requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // ACTION : save_vehicle -> Crée un nouveau véhicule ou met à jour un inventaire existant
    if ($action === 'save_vehicle') {
        // Lecture des données JSON brutes envoyées dans le corps de la requête POST (payload)
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validation basique des données d'entrée
        if (!$input || !isset($input['id']) || !isset($input['name'])) {
            sendJSON(['error' => 'Données de véhicule invalides ou incomplètes.'], 400);
        }
        
        $vId = trim($input['id']);
        if (!isValidVehicleId($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide. Utilisez uniquement des lettres, chiffres et tirets.'], 400);
        }
        
        // Chemin cible du fichier JSON individuel du véhicule
        $filePath = DATA_DIR . '/' . $vId . '.json';
        
        // Encodage en JSON propre
        $jsonContent = json_encode($input, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($jsonContent === false) {
            sendJSON(['error' => 'Erreur lors de l\'encodage JSON des données : ' . json_last_error_msg()], 500);
        }
        
        // Tentative d'écriture du fichier sur le serveur
        $result = @file_put_contents($filePath, $jsonContent);
        if ($result === false) {
            // Récupère l'erreur PHP survenue lors de l'écriture (ex: permission refusée)
            $error = error_get_last();
            $errorMsg = isset($error['message']) ? $error['message'] : 'Problème d\'écriture sur le serveur (vérifiez les permissions d\'écriture du dossier data).';
            sendJSON(['error' => 'Impossible de sauvegarder le fichier d\'inventaire : ' . $errorMsg], 500);
        }
        
        // Mise à jour de l'index centralisé manifest.json pour ajouter ce véhicule s'il est nouveau
        $manifest = loadManifest();
        if (!in_array($vId, $manifest)) {
            $manifest[] = $vId;
            if (!saveManifest($manifest)) {
                sendJSON(['error' => 'Véhicule sauvegardé, mais impossible de mettre à jour le fichier d\'index manifest.json (problème de droits d\'écriture).'], 500);
            }
        }
        
        sendJSON(['success' => true, 'message' => 'Véhicule et inventaire sauvegardés avec succès.']);
    }
    
    // ACTION : delete_vehicle -> Supprime définitivement un véhicule de l'inventaire
    elseif ($action === 'delete_vehicle') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) {
            sendJSON(['error' => 'Identifiant de véhicule manquant.'], 400);
        }
        
        $vId = trim($input['id']);
        if (!isValidVehicleId($vId)) {
            sendJSON(['error' => 'Identifiant de véhicule invalide.'], 400);
        }
        
        // Suppression du fichier JSON lié au véhicule
        $filePath = DATA_DIR . '/' . $vId . '.json';
        if (file_exists($filePath)) {
            if (!@unlink($filePath)) {
                $error = error_get_last();
                $errorMsg = isset($error['message']) ? $error['message'] : 'Vérifiez les permissions d\'écriture du fichier.';
                sendJSON(['error' => 'Impossible de supprimer le fichier JSON du véhicule : ' . $errorMsg], 500);
            }
        }
        
        // Retrait de l'identifiant dans le manifest.json
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

    // ACTION : reorder_vehicles -> Réorganise l'ordre des véhicules dans le manifest.json
    elseif ($action === 'reorder_vehicles') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['order']) || !is_array($input['order'])) {
            sendJSON(['error' => 'Liste d\'ordre invalide ou manquante.'], 400);
        }

        // Valide chaque identifiant reçu
        $newOrder = [];
        foreach ($input['order'] as $vId) {
            $vId = trim($vId);
            if (!isValidVehicleId($vId)) {
                sendJSON(['error' => 'Identifiant invalide dans la liste : ' . $vId], 400);
            }
            $newOrder[] = $vId;
        }

        // Vérifie que la liste reçue contient exactement les mêmes IDs que le manifest actuel
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

    // ACTION : toggle_unavailable -> Bascule le champ "unavailable" dans le JSON du véhicule
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

        // Bascule l'état : si non défini ou false → true, si true → false
        $newState = isset($input['unavailable']) ? (bool) $input['unavailable'] : !((bool)($vehicleData['unavailable'] ?? false));
        $vehicleData['unavailable'] = $newState;

        $jsonContent = json_encode($vehicleData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($jsonContent === false || @file_put_contents($filePath, $jsonContent) === false) {
            sendJSON(['error' => 'Erreur lors de la sauvegarde de l\'état d\'indisponibilité.'], 500);
        }

        sendJSON(['success' => true, 'unavailable' => $newState]);
    }

    // ACTION : clone_vehicle -> Duplique un véhicule avec tout son inventaire sous un nouvel ID
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

        // Vérifie que le véhicule source existe
        $sourcePath = DATA_DIR . '/' . $sourceId . '.json';
        if (!file_exists($sourcePath)) {
            sendJSON(['error' => 'Le véhicule source est introuvable.'], 404);
        }

        // Vérifie que la cible n'existe pas déjà (évite l'écrasement)
        $targetPath = DATA_DIR . '/' . $newId . '.json';
        if (file_exists($targetPath)) {
            sendJSON(['error' => 'Un véhicule avec cet identifiant existe déjà. Choisissez un autre ID.'], 409);
        }

        // Vérifie que le nouvel ID n'est pas déjà dans le manifest
        $manifest = loadManifest();
        if (in_array($newId, $manifest)) {
            sendJSON(['error' => 'Cet identifiant est déjà utilisé dans l\'index.'], 409);
        }

        // Deep-copy des données source
        $sourceData = json_decode(file_get_contents($sourcePath), true);
        if (!$sourceData) {
            sendJSON(['error' => 'Impossible de lire les données du véhicule source.'], 500);
        }

        // Mise à jour de l'identité du clone (id et nom), on conserve tout le reste (locations, items, images)
        $sourceData['id']          = $newId;
        $sourceData['name']        = $newName;
        $sourceData['unavailable'] = false; // Le clone démarre toujours disponible

        $jsonContent = json_encode($sourceData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($jsonContent === false || @file_put_contents($targetPath, $jsonContent) === false) {
            sendJSON(['error' => 'Erreur lors de l\'écriture du fichier cloné.'], 500);
        }

        // Enregistrement dans le manifest juste après le véhicule source
        $sourceIndex = array_search($sourceId, $manifest);
        if ($sourceIndex !== false) {
            array_splice($manifest, $sourceIndex + 1, 0, [$newId]);
        } else {
            $manifest[] = $newId;
        }

        if (!saveManifest($manifest)) {
            // Nettoyage : supprime le fichier créé si le manifest ne peut pas être mis à jour
            @unlink($targetPath);
            sendJSON(['error' => 'Véhicule cloné mais impossible de mettre à jour l\'index manifest.json.'], 500);
        }

        sendJSON(['success' => true, 'message' => "Véhicule \"{$newName}\" cloné avec succès depuis \"{$sourceId}\".", 'new_id' => $newId]);
    }
}

// Si la méthode HTTP ou l'action ne correspond à aucune condition ci-dessus
sendJSON(['error' => 'Action ou méthode non supportée.'], 400);
?>

