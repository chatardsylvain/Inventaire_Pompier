<?php
/**
 * api/alerts.php
 * API de gestion des alertes (matériel manquant, défectueux, périmé).
 * Utilise une connexion SMTP directe via socket pour l'envoi des e-mails
 * (compatible NAS ASUSTOR - ne dépend pas de mail() ou sendmail).
 *
 * L'affichage des alertes sur l'écran de la caserne (Raspberry Pi) se fait
 * en LECTURE SEULE directement depuis data/alerts.json — ce fichier PHP
 * n'a donc plus besoin de contacter une quelconque API d'affichage externe
 * (l'ancienne intégration Directus a été entièrement retirée).
 */

require_once __DIR__ . '/config.php';

$action     = isset($_GET['action']) ? $_GET['action'] : '';
$alertsFile = DATA_DIR . '/alerts.json';

// =============================================================================
// ⚙️  CONFIGURATION SMTP — Chargée depuis le fichier .env (api/config.php)
//     Les valeurs ne sont plus en dur dans le code source. Voir .env.example
//     à la racine du projet pour la liste des variables attendues.
// =============================================================================
define('SMTP_HOST',     envVar('SMTP_HOST', 'smtp.gmail.com'));
define('SMTP_PORT',     (int) envVar('SMTP_PORT', 587));
define('SMTP_USER',     envVar('SMTP_USER', ''));
define('SMTP_PASSWORD', envVar('SMTP_PASSWORD', ''));
define('SMTP_FROM',     envVar('SMTP_FROM', ''));
define('SMTP_NAME',     envVar('SMTP_NAME', 'Inventaire TMC'));
define('SMTP_USE_TLS',  filter_var(envVar('SMTP_USE_TLS', true), FILTER_VALIDATE_BOOLEAN));

// Garde-fou : si les secrets essentiels sont absents, on log une alerte claire
// (le site continue de fonctionner, mais les mails ne partiront pas)
if (empty(SMTP_USER) || empty(SMTP_PASSWORD)) {
    @file_put_contents(DATA_DIR . '/mail_error.log',
        date('Y-m-d H:i:s') . " | ATTENTION : SMTP_USER ou SMTP_PASSWORD absent du .env\n", FILE_APPEND);
}
// =============================================================================

function loadAlerts() {
    global $alertsFile;
    if (!file_exists($alertsFile)) {
        return [];
    }
    return json_decode(file_get_contents($alertsFile), true) ?: [];
}

function saveAlerts($alerts) {
    global $alertsFile;
    $jsonContent = json_encode(array_values($alerts), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) return false;
    $result = @file_put_contents($alertsFile, $jsonContent);
    return $result !== false;
}

/**
 * Envoie un e-mail via SMTP direct (compatible ASUSTOR NAS).
 * Ne dépend pas de la fonction mail() ni de sendmail.
 *
 * @param string $to      Adresse du destinataire
 * @param string $subject Sujet du mail
 * @param string $body    Corps du mail (texte brut)
 * @return bool           True si l'envoi a réussi
 */
function sendAlertMailSMTP($to, $subject, $body) {
    $errno = 0;
    $errstr = '';

    if (!SMTP_USE_TLS) {
        $socket = @fsockopen('ssl://' . SMTP_HOST, SMTP_PORT, $errno, $errstr, 15);
    } else {
        $socket = @fsockopen(SMTP_HOST, SMTP_PORT, $errno, $errstr, 15);
    }

    if (!$socket) {
        @file_put_contents(DATA_DIR . '/mail_error.log',
            date('Y-m-d H:i:s') . " | SMTP connect failed: $errstr ($errno)\n", FILE_APPEND);
        return false;
    }

    $sendCmd = function($cmd) use ($socket) {
        if ($cmd !== null) fputs($socket, $cmd . "\r\n");
        return fgets($socket, 512);
    };

    $sendCmd(null);

    $sendCmd('EHLO ' . (function_exists('gethostname') ? gethostname() : 'nas'));
    while ($line = fgets($socket, 512)) {
        if (strlen($line) >= 4 && $line[3] === ' ') break;
    }

    if (SMTP_USE_TLS) {
        fputs($socket, "STARTTLS\r\n");
        fgets($socket, 512);

        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($socket);
            @file_put_contents(DATA_DIR . '/mail_error.log',
                date('Y-m-d H:i:s') . " | TLS upgrade failed\n", FILE_APPEND);
            return false;
        }

        fputs($socket, 'EHLO ' . (function_exists('gethostname') ? gethostname() : 'nas') . "\r\n");
        while ($line = fgets($socket, 512)) {
            if (strlen($line) >= 4 && $line[3] === ' ') break;
        }
    }

    fputs($socket, "AUTH LOGIN\r\n");
    fgets($socket, 512);
    fputs($socket, base64_encode(SMTP_USER) . "\r\n");
    fgets($socket, 512);
    fputs($socket, base64_encode(SMTP_PASSWORD) . "\r\n");
    $authResp = fgets($socket, 512);

    if (substr(trim($authResp), 0, 3) !== '235') {
        fclose($socket);
        @file_put_contents(DATA_DIR . '/mail_error.log',
            date('Y-m-d H:i:s') . " | AUTH FAILED: $authResp\n", FILE_APPEND);
        return false;
    }

    fputs($socket, "MAIL FROM: <" . SMTP_FROM . ">\r\n");
    fgets($socket, 512);

    fputs($socket, "RCPT TO: <" . $to . ">\r\n");
    fgets($socket, 512);

    fputs($socket, "DATA\r\n");
    fgets($socket, 512);

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers  = "From: " . SMTP_NAME . " <" . SMTP_FROM . ">\r\n";
    $headers .= "To: <" . $to . ">\r\n";
    $headers .= "Subject: " . $encodedSubject . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: base64\r\n";
    $headers .= "Date: " . date('r') . "\r\n";

    $encodedBody = chunk_split(base64_encode($body));

    fputs($socket, $headers . "\r\n" . $encodedBody . "\r\n.\r\n");
    fgets($socket, 512);

    fputs($socket, "QUIT\r\n");
    fclose($socket);

    return true;
}

// =============================================================================
// ROUTES
// =============================================================================

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'list') {
        sendJSON(loadAlerts());
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // ACTION : create — Enregistre une nouvelle alerte et notifie le responsable
    if ($action === 'create') {
		checkRateLimit('alert_create');
		recordFailedAttempt('alert_create'); // compte chaque appel, réussi ou non
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['vehicle_id']) || !isset($input['location_name'])
                    || !isset($input['item_name'])   || !isset($input['alert_type'])) {
            sendJSON(['error' => 'Données incomplètes.'], 400);
        }

        $vehicleId = trim($input['vehicle_id']);
        if (!preg_match('/^[a-zA-Z0-9\-_]+$/', $vehicleId)) {
            sendJSON(['error' => 'ID véhicule invalide.'], 400);
        }

        $newAlert = [
            'id'            => uniqid('alert_'),
            'vehicle_id'    => $vehicleId,
            'location_name' => trim($input['location_name']),
            'item_name'     => trim($input['item_name']),
            'alert_type'    => trim($input['alert_type']),
            'comment'       => '',
            'date'          => date('Y-m-d H:i:s')
        ];

        $alerts = loadAlerts();

        foreach ($alerts as $a) {
            if ($a['vehicle_id']    === $newAlert['vehicle_id']    &&
                $a['location_name'] === $newAlert['location_name'] &&
                $a['item_name']     === $newAlert['item_name']) {
                sendJSON(['error' => 'Ce matériel est déjà signalé.'], 400);
            }
        }

        $alerts[] = $newAlert;
        if (!saveAlerts($alerts)) {
            sendJSON(['error' => 'Erreur lors de la sauvegarde de l\'alerte.'], 500);
        }

        // --- Envoi d'e-mail au responsable matériel (l'affichage caserne lit alerts.json directement) ---
        $vehicleFile = DATA_DIR . '/' . $vehicleId . '.json';
        if (file_exists($vehicleFile)) {
            $vehicleData      = json_decode(file_get_contents($vehicleFile), true);
            $vehicleName      = isset($vehicleData['name']) ? $vehicleData['name'] : $vehicleId;
            $responsibleLogin = isset($vehicleData['responsible_admin']) ? $vehicleData['responsible_admin'] : '';

            if ($responsibleLogin) {
                $usersFile = USERS_FILE;
                if (file_exists($usersFile)) {
                    $users           = json_decode(file_get_contents($usersFile), true) ?: [];
                    $responsibleUser = null;
                    foreach ($users as $u) {
                        if ($u['login'] === $responsibleLogin) {
                            $responsibleUser = $u;
                            break;
                        }
                    }

                    if ($responsibleUser && !empty($responsibleUser['email'])) {
                        $subject = "[Inventaire TMC] Alerte : " . $newAlert['alert_type']
                                 . " sur " . $vehicleName;

                        $body  = "Bonjour " . $responsibleUser['name'] . ",\n\n";
                        $body .= "Une nouvelle anomalie vient d'etre signalee sur le terrain.\n\n";
                        $body .= "--- Details du signalement ---\n";
                        $body .= "Vehicule    : " . $vehicleName . "\n";
                        $body .= "Emplacement : " . $newAlert['location_name'] . "\n";
                        $body .= "Materiel    : " . $newAlert['item_name'] . "\n";
                        $body .= "Probleme    : " . $newAlert['alert_type'] . "\n";
                        $body .= "Date        : " . date('d/m/Y a H:i') . "\n\n";
                        $body .= "Connectez-vous a l'interface d'administration pour traiter cette alerte.\n\n";
                        $body .= "-- Message automatique Inventaire TMC --";

                        $sent = sendAlertMailSMTP($responsibleUser['email'], $subject, $body);

                        @file_put_contents(DATA_DIR . '/mail_error.log',
                            date('Y-m-d H:i:s') . " | Mail to " . $responsibleUser['email']
                            . " | " . ($sent ? "OK" : "FAILED") . "\n", FILE_APPEND);
                    }
                }
            }
        }

        sendJSON(['success' => true, 'message' => 'Alerte enregistree avec succes.']);
    }

    // ACTION : vehicle_unavailable — Crée une alerte d'indisponibilité pour un véhicule entier
    if ($action === 'vehicle_unavailable') {
        requireAuth();
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['vehicle_id'])) {
            sendJSON(['error' => 'Données incomplètes.'], 400);
        }

        $vehicleId = trim($input['vehicle_id']);
        if (!preg_match('/^[a-zA-Z0-9\-_]+$/', $vehicleId)) {
            sendJSON(['error' => 'ID véhicule invalide.'], 400);
        }

        // Vérifie qu'une alerte d'indisponibilité n'existe pas déjà pour ce véhicule
        $existingAlerts = loadAlerts();
        foreach ($existingAlerts as $a) {
            if ($a['vehicle_id'] === $vehicleId && $a['alert_type'] === 'Indisponible') {
                sendJSON(['error' => 'Ce véhicule est déjà signalé comme indisponible.'], 400);
            }
        }

        $newAlert = [
            'id'            => uniqid('alert_'),
            'vehicle_id'    => $vehicleId,
            'location_name' => 'Véhicule entier',
            'item_name'     => isset($input['vehicle_name']) ? trim($input['vehicle_name']) : $vehicleId,
            'alert_type'    => 'Indisponible',
            'comment'       => isset($input['comment']) ? trim($input['comment']) : '',
            'date'          => date('Y-m-d H:i:s')
        ];

        $existingAlerts[] = $newAlert;
        if (!saveAlerts($existingAlerts)) {
            sendJSON(['error' => 'Erreur lors de la sauvegarde de l\'alerte d\'indisponibilité.'], 500);
        }

        // --- Envoi d'e-mail au responsable du véhicule ---
        $vehicleFile = DATA_DIR . '/' . $vehicleId . '.json';
        if (file_exists($vehicleFile)) {
            $vehicleData      = json_decode(file_get_contents($vehicleFile), true);
            $vehicleName      = isset($vehicleData['name']) ? $vehicleData['name'] : $vehicleId;
            $responsibleLogin = isset($vehicleData['responsible_admin']) ? $vehicleData['responsible_admin'] : '';

            if ($responsibleLogin) {
                $usersFile = USERS_FILE;
                if (file_exists($usersFile)) {
                    $users           = json_decode(file_get_contents($usersFile), true) ?: [];
                    $responsibleUser = null;
                    foreach ($users as $u) {
                        if ($u['login'] === $responsibleLogin) {
                            $responsibleUser = $u;
                            break;
                        }
                    }

                    if ($responsibleUser && !empty($responsibleUser['email'])) {
                        $subject = "[Inventaire TMC] Véhicule indisponible : " . $vehicleName;

                        $body  = "Bonjour " . $responsibleUser['name'] . ",\n\n";
                        $body .= "Un véhicule vient d'être signalé INDISPONIBLE.\n\n";
                        $body .= "--- Détails du signalement ---\n";
                        $body .= "Véhicule    : " . $vehicleName . "\n";
                        if (!empty($newAlert['comment'])) {
                            $body .= "Motif       : " . $newAlert['comment'] . "\n";
                        }
                        $body .= "Date        : " . date('d/m/Y à H:i') . "\n\n";
                        $body .= "Connectez-vous à l'interface d'administration pour traiter cette indisponibilité.\n\n";
                        $body .= "-- Message automatique Inventaire TMC --";

                        $sent = sendAlertMailSMTP($responsibleUser['email'], $subject, $body);

                        @file_put_contents(DATA_DIR . '/mail_error.log',
                            date('Y-m-d H:i:s') . " | Mail indisponibilité to " . $responsibleUser['email']
                            . " | " . ($sent ? "OK" : "FAILED") . "\n", FILE_APPEND);
                    }
                }
            }
        }

        sendJSON(['success' => true, 'alert_id' => $newAlert['id'], 'message' => 'Alerte d\'indisponibilité enregistrée.']);
    }

    // À partir d'ici, les actions requièrent d'être admin connecté
    requireAuth();

    // ACTION : comment — Ajoute ou modifie un commentaire sur une alerte
    if ($action === 'comment') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id']) || !isset($input['comment'])) {
            sendJSON(['error' => 'Données incomplètes.'], 400);
        }

        $alerts = loadAlerts();
        $found  = false;
        foreach ($alerts as &$a) {
            if ($a['id'] === $input['id']) {
                $a['comment'] = trim($input['comment']);
                $found = true;
                break;
            }
        }
        unset($a);

        if ($found && saveAlerts($alerts)) {
            // Rien à faire côté affichage : le Raspberry relit alerts.json directement
            // à son prochain cycle et affichera le commentaire mis à jour.
            sendJSON(['success' => true]);
        } else {
            sendJSON(['error' => 'Alerte introuvable ou erreur de sauvegarde.'], 500);
        }
    }

    // ACTION : resolve — Supprime une alerte (problème résolu)
    if ($action === 'resolve') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) {
            sendJSON(['error' => 'Données incomplètes.'], 400);
        }

        $alerts        = loadAlerts();
        $resolvedAlert = null;
        foreach ($alerts as $a) {
            if ($a['id'] === $input['id']) {
                $resolvedAlert = $a;
                break;
            }
        }

        if (!$resolvedAlert) {
            sendJSON(['error' => 'Alerte introuvable.'], 404);
        }

        $filtered = array_filter($alerts, function($a) use ($input) {
            return $a['id'] !== $input['id'];
        });

        if (!saveAlerts($filtered)) {
            sendJSON(['error' => 'Erreur lors de la sauvegarde de l\'alerte résolue.'], 500);
        }

        // Si l'alerte résolue est de type "Indisponible", remettre le véhicule disponible dans son JSON
        if ($resolvedAlert['alert_type'] === 'Indisponible') {
            $vehicleFile = DATA_DIR . '/' . $resolvedAlert['vehicle_id'] . '.json';
            if (file_exists($vehicleFile)) {
                $vehicleData = json_decode(file_get_contents($vehicleFile), true);
                if ($vehicleData) {
                    $vehicleData['unavailable'] = false;
                    @file_put_contents($vehicleFile,
                        json_encode($vehicleData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                }
            }
        }

        // Rien à faire côté affichage : le Raspberry relit alerts.json directement
        // et l'alerte résolue disparaîtra de son propre affichage au cycle suivant.
        sendJSON(['success' => true, 'message' => 'Alerte résolue avec succès.']);
    }
}

sendJSON(['error' => 'Action non supportée.'], 400);
?>
