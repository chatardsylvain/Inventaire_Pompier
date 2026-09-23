<?php
/**
 * api/asup.php
 * API de gestion du contrôle mensuel des médicaments ASUP (Aide aux Soins d'Urgence
 * aux Pompiers) du VSAV / VSSUAP.
 *
 * Les médicaments ASUP ne sont PAS stockés dans un fichier séparé : ils sont lus
 * directement depuis data/{vehicle_id}.json (ex: data/vsav.json), dans les
 * localisations marquées is_asup = true.  Seule la TRA�?ABILIT�? des contrôles est
 * stockée à part, dans data/asup_history.json.
 *
 * Modifié : 2026-09-11 �?" Ajout endpoint public_medications (v2.0)
 *
 * Endpoints :
 *   GET  ?action=public_medications �?" Péremptions ASUP pour affichage inventaire public (sans auth)
 *   GET  ?action=status             �?" �?tat du contrôle pour le mois en cours (auth requise)
 *   GET  ?action=medications        �?" Liste des médicaments ASUP (auth requise)
 *   GET  ?action=history            �?" Historique de tous les contrôles (auth requise)
 *   POST ?action=start_check        �?" Démarre une session de contrôle mensuel (auth requise)
 *   POST ?action=toggle             �?" Coche / décoche un médicament (auth requise)
 *   POST ?action=finish_check       �?" Valide et archive le contrôle du mois (auth requise)
 *   POST ?action=cancel_check       �?" Annule la session en cours (auth requise)
 *   POST ?action=send_alerts        �?" Envoi alertes mail J-14 (cron ou manuel)
 *   POST ?action=generate_report    �?" Génère le rapport annuel PDF via asup_rapport_annuel.py (auth requise)
 *   GET  ?action=annual_report      �?" Données JSON pour rapport annuel (auth requise)
 *
 * Rôles autorisés : correspondant_pharmacie + superadmin (+ admin lecture seule)
 *
 * Fichiers :
 *   data/asup_session_{vehicle_id}.json  �?" session de contrôle en cours (temporaire)
 *   data/asup_checks_history.json        �?" historique des contrôles archivés
 *   data/asup_mail.log                   �?" journal des envois mail
 */

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

define('ASUP_HISTORY_FILE', DATA_DIR . '/asup_history.json');
define('ASUP_MAIL_LOG',     DATA_DIR . '/asup_mail.log');
define('ASUP_ELIGIBLE_IDS', ['vsav', 'vssuap']);

// ===========================================================================
// HELPERS �?" Authentification
// ===========================================================================

function requireAsupAuth() {
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        sendJSON(['error' => 'Authentification requise.'], 401);
    }
    if (!sessionHasAnyRole(['correspondant_pharmacie', 'superadmin', 'admin'])) {
        sendJSON(['error' => 'Accès non autorisé. Rôle requis : correspondant_pharmacie.'], 403);
    }
}

function requireAsupCheckAuth() {
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        sendJSON(['error' => 'Authentification requise.'], 401);
    }
    if (!sessionHasAnyRole(['correspondant_pharmacie', 'superadmin'])) {
        sendJSON(['error' => 'Accès non autorisé. Rôle correspondant_pharmacie requis.'], 403);
    }
}

// ===========================================================================
// HELPERS �?" Lecture des médicaments ASUP depuis data/{vehicle_id}.json
// ===========================================================================

/**
 * Charge tous les médicaments des localisations is_asup = true d'un véhicule.
 * Retourne un tableau avec les localisations et une liste plate des médicaments.
 */
function loadAsupMedications($vehicleId) {
    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS)) {
        return ['locations' => [], 'medications' => []];
    }
    $path = DATA_DIR . '/' . $vehicleId . '.json';
    if (!file_exists($path)) {
        return ['locations' => [], 'medications' => []];
    }
    $vehicleData   = json_decode(file_get_contents($path), true) ?: [];
    $asupLocations = [];
    $flatMeds      = [];

    foreach ($vehicleData['locations'] ?? [] as $loc) {
        if (empty($loc['is_asup'])) continue;
        $locMeds = [];
        foreach ($loc['items'] ?? [] as $itemIndex => $item) {
            $med = [
                'key'        => $loc['name'] . '||' . $item['name'] . '||' . $itemIndex,
                'location'   => $loc['name'],
                'name'       => $item['name'],
                'quantity'   => $item['quantity'] ?? 0,
                'lot'        => $item['lot'] ?? '',
                'peremption' => $item['peremption'] ?? '',
            ];
            $locMeds[]  = $med;
            $flatMeds[] = $med;
        }
        $asupLocations[] = [
            'name'  => $loc['name'],
            'icon'  => $loc['icon'] ?? 'fa-pills',
            'items' => $locMeds,
        ];
    }
    return ['locations' => $asupLocations, 'medications' => $flatMeds];
}

/**
 * Retourne tous les véhicules éligibles ASUP ayant au moins une localisation is_asup.
 */
function loadAllAsupVehicles() {
    $result = [];
    foreach (ASUP_ELIGIBLE_IDS as $vId) {
        $data = loadAsupMedications($vId);
        if (empty($data['medications'])) continue;
        $vPath = DATA_DIR . '/' . $vId . '.json';
        $vData = file_exists($vPath)
            ? (json_decode(file_get_contents($vPath), true) ?: [])
            : [];
        $result[] = [
            'id'          => $vId,
            'name'        => $vData['name'] ?? $vId,
            'locations'   => $data['locations'],
            'medications' => $data['medications'],
        ];
    }
    return $result;
}

// ===========================================================================
// HELPERS �?" Session de contrôle
// ===========================================================================

function asupSessionFilePath($vehicleId) {
    return DATA_DIR . '/asup_session_' . $vehicleId . '.json';
}

function loadAsupSession($vehicleId) {
    $path = asupSessionFilePath($vehicleId);
    if (!file_exists($path)) return null;
    $session = json_decode(file_get_contents($path), true) ?: null;
    // Auto-expiration : 8 heures
    if ($session && isset($session['started_at'])) {
        if ((time() - strtotime($session['started_at'])) > 8 * 3600) {
            deleteAsupSession($vehicleId);
            return null;
        }
    }
    return $session;
}

function saveAsupSession($vehicleId, $session) {
    $path = asupSessionFilePath($vehicleId);
    return @file_put_contents($path,
        json_encode($session, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false;
}

function deleteAsupSession($vehicleId) {
    $path = asupSessionFilePath($vehicleId);
    if (file_exists($path)) @unlink($path);
}

// ===========================================================================
// HELPERS �?" Historique
// ===========================================================================

function loadAsupHistory() {
    if (!file_exists(ASUP_HISTORY_FILE)) return [];
    return json_decode(file_get_contents(ASUP_HISTORY_FILE), true) ?: [];
}

function saveAsupHistory($history) {
    return @file_put_contents(ASUP_HISTORY_FILE,
        json_encode(array_values($history), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false;
}

// ===========================================================================
// HELPERS �?" Calcul d'état mensuel
// ===========================================================================

function getLastDayOfCurrentMonth() {
    $d = new DateTime('last day of this month');
    $d->setTime(23, 59, 59);
    return $d;
}

function getFirstDayOfCurrentMonth() {
    $d = new DateTime('first day of this month');
    $d->setTime(0, 0, 0);
    return $d;
}

function findCurrentMonthCheck($vehicleId) {
    $history = loadAsupHistory();
    $first   = getFirstDayOfCurrentMonth();
    $last    = getLastDayOfCurrentMonth();
    foreach ($history as $record) {
        if ($record['vehicle_id'] !== $vehicleId) continue;
        if ($record['status'] !== 'finalisé') continue;
        try {
            $finished = new DateTime($record['finished_at']);
            if ($finished >= $first && $finished <= $last) return $record;
        } catch (Exception $e) {}
    }
    return null;
}

function computeMonthlyStatus($vehicleId) {
    $now      = new DateTime();
    $deadline = getLastDayOfCurrentMonth();
    $daysLeft = (int) $now->diff($deadline)->format('%r%a');
    $lastCheck = findCurrentMonthCheck($vehicleId);

    if ($lastCheck) {
        return [
            'status'              => 'done',
            'days_until_deadline' => $daysLeft,
            'deadline'            => $deadline->format('Y-m-d'),
            'last_check'          => $lastCheck,
        ];
    }
    return [
        'status'              => ($daysLeft < 0) ? 'overdue' : 'pending',
        'days_until_deadline' => $daysLeft,
        'deadline'            => $deadline->format('Y-m-d'),
        'last_check'          => null,
    ];
}

// ===========================================================================
// HELPERS �?" Email SMTP
// (Même implémentation que pisu.php / alerts.php �?" indépendance du module)
// ===========================================================================

function asupFormatDateFR($isoDate) {
    if (empty($isoDate)) return '�?"';
    $parts = explode('-', $isoDate);
    return (count($parts) === 3) ? $parts[2] . '/' . $parts[1] . '/' . $parts[0] : $isoDate;
}

function getCorrespondantPharmacieEmail() {
    if (!file_exists(USERS_FILE)) return '';
    $users = json_decode(file_get_contents(USERS_FILE), true) ?: [];
    foreach ($users as $u) {
        $stored = [];
        if (isset($u['roles']) && is_array($u['roles'])) {
            $stored = $u['roles'];
        } elseif (!empty($u['role'])) {
            $stored = [$u['role']];
        }
        if (in_array('correspondant_pharmacie', $stored, true) && !empty($u['email'])) return $u['email'];
    }
    foreach ($users as $u) {
        $stored = [];
        if (isset($u['roles']) && is_array($u['roles'])) {
            $stored = $u['roles'];
        } elseif (!empty($u['role'])) {
            $stored = [$u['role']];
        }
        if (in_array('superadmin', $stored, true) && !empty($u['email'])) return $u['email'];
    }
    return '';
}

function sendAsupMailSMTP($to, $subject, $body) {
    $host     = defined('SMTP_HOST')     ? SMTP_HOST     : envVar('SMTP_HOST', 'smtp.gmail.com');
    $port     = defined('SMTP_PORT')     ? SMTP_PORT     : (int)envVar('SMTP_PORT', 587);
    $user     = defined('SMTP_USER')     ? SMTP_USER     : envVar('SMTP_USER', '');
    $pass     = defined('SMTP_PASSWORD') ? SMTP_PASSWORD : envVar('SMTP_PASSWORD', '');
    $from     = defined('SMTP_FROM')     ? SMTP_FROM     : envVar('SMTP_FROM', $user);
    $fromName = defined('SMTP_NAME')     ? SMTP_NAME     : envVar('SMTP_NAME', 'Inventaire Pompier');
    $useTls   = defined('SMTP_USE_TLS')  ? SMTP_USE_TLS
                : filter_var(envVar('SMTP_USE_TLS', true), FILTER_VALIDATE_BOOLEAN);

    if (empty($user) || empty($pass)) {
        @file_put_contents(ASUP_MAIL_LOG, date('Y-m-d H:i:s') . " | SMTP config manquante\n", FILE_APPEND);
        return false;
    }

    $errno = 0; $errstr = '';
    $socket = $useTls
        ? @fsockopen($host, $port, $errno, $errstr, 15)
        : @fsockopen('ssl://' . $host, $port, $errno, $errstr, 15);

    if (!$socket) {
        @file_put_contents(ASUP_MAIL_LOG,
            date('Y-m-d H:i:s') . " | Connect failed: $errstr ($errno)\n", FILE_APPEND);
        return false;
    }

    $read = function() use ($socket) { return fgets($socket, 512); };
    $send = function($cmd) use ($socket) { fputs($socket, $cmd . "\r\n"); };

    $read();
    $send('EHLO ' . (function_exists('gethostname') ? gethostname() : 'nas'));
    while ($l = fgets($socket, 512)) { if (strlen($l) >= 4 && $l[3] === ' ') break; }

    if ($useTls) {
        $send('STARTTLS');
        $read();
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($socket);
            @file_put_contents(ASUP_MAIL_LOG, date('Y-m-d H:i:s') . " | TLS failed\n", FILE_APPEND);
            return false;
        }
        $send('EHLO ' . (function_exists('gethostname') ? gethostname() : 'nas'));
        while ($l = fgets($socket, 512)) { if (strlen($l) >= 4 && $l[3] === ' ') break; }
    }

    $send('AUTH LOGIN'); $read();
    $send(base64_encode($user)); $read();
    $send(base64_encode($pass));
    $authResp = $read();

    if (substr(trim($authResp), 0, 3) !== '235') {
        fclose($socket);
        @file_put_contents(ASUP_MAIL_LOG,
            date('Y-m-d H:i:s') . " | AUTH FAILED: $authResp\n", FILE_APPEND);
        return false;
    }

    $send("MAIL FROM: <$from>"); $read();
    $send("RCPT TO: <$to>");     $read();
    $send('DATA');               $read();

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers  = "From: $fromName <$from>\r\n";
    $headers .= "To: <$to>\r\n";
    $headers .= "Subject: $encodedSubject\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: base64\r\n";
    $headers .= "Date: " . date('r') . "\r\n";

    fputs($socket, $headers . "\r\n" . chunk_split(base64_encode($body)) . "\r\n.\r\n");
    $read();
    $send('QUIT');
    fclose($socket);
    return true;
}

// ===========================================================================
// FONCTION PRINCIPALE D'ALERTES (cron ou appel manuel)
// ===========================================================================

function runAsupAlerts() {
    $now      = new DateTime();
    $vehicles = loadAllAsupVehicles();
    $email    = getCorrespondantPharmacieEmail();

    if (empty($email)) {
        return ['error' => 'Aucun e-mail correspondant_pharmacie configuré dans les utilisateurs.'];
    }

    $alertThreshold   = 14;
    $peremptionAlerts = [];
    $missedChecks     = [];

    foreach ($vehicles as $vehicle) {
        // 1. Alertes péremption J-14
        foreach ($vehicle['medications'] as $med) {
            if (empty($med['peremption'])) continue;
            try {
                $expiry = new DateTime($med['peremption']);
                $diff   = (int) $now->diff($expiry)->format('%r%a');
                if ($diff <= $alertThreshold) {
                    $peremptionAlerts[] = array_merge($med, [
                        '_vehicle_id'   => $vehicle['id'],
                        '_vehicle_name' => $vehicle['name'],
                        '_days_left'    => $diff,
                        '_overdue'      => ($diff < 0),
                    ]);
                }
            } catch (Exception $e) {}
        }

        // 2. Contrôle mensuel manquant à J-14 avant fin de mois
        $deadline = getLastDayOfCurrentMonth();
        $daysLeft = (int) $now->diff($deadline)->format('%r%a');
        if ($daysLeft >= 0 && $daysLeft <= $alertThreshold) {
            if (!findCurrentMonthCheck($vehicle['id'])) {
                $missedChecks[] = [
                    'vehicle_id'   => $vehicle['id'],
                    'vehicle_name' => $vehicle['name'],
                    'deadline'     => $deadline->format('d/m/Y'),
                    'days_left'    => $daysLeft,
                ];
            }
        }
    }

    if (empty($peremptionAlerts) && empty($missedChecks)) {
        return ['success' => true, 'sent' => false, 'message' => 'Aucune alerte ASUP à envoyer.'];
    }

    // Construction du mail
    $subject = '[ASUP Caserne] ';
    $parts   = [];
    if (!empty($peremptionAlerts)) $parts[] = count($peremptionAlerts) . ' médicament(s) à péremption';
    if (!empty($missedChecks))     $parts[] = count($missedChecks) . ' contrôle(s) manquant(s)';
    $subject .= implode(' �?" ', $parts);

    $body  = "Bonjour,\n\n";
    $body .= "Rapport automatique ASUP �?" Nom du Centre de Secours\n";
    $body .= "Date : " . $now->format('d/m/Y à H:i') . "\n\n";

    if (!empty($peremptionAlerts)) {
        $body .= "�.��.��.� M�?DICAMENTS ASUP �? P�?REMPTION IMMINENTE (" . count($peremptionAlerts) . ") �.��.��.�\n\n";
        foreach ($peremptionAlerts as $med) {
            $body .= "  �?� " . $med['name'] . " (" . $med['_vehicle_name'] . " �?" " . $med['location'] . ")\n";
            $body .= "    Lot : " . ($med['lot'] ?: '�?"') . "\n";
            $body .= "    Quantité : " . $med['quantity'] . "\n";
            if ($med['_overdue']) {
                $body .= "    �s� P�?RIM�? depuis " . abs($med['_days_left']) . " jour(s)";
            } else {
                $body .= "    ⏱ Expire dans " . $med['_days_left'] . " jour(s)";
            }
            $body .= " (échéance : " . asupFormatDateFR($med['peremption']) . ")\n\n";
        }
    }

    if (!empty($missedChecks)) {
        $body .= "�.��.��.� CONTR�"LE MENSUEL NON EFFECTU�? (" . count($missedChecks) . ") �.��.��.�\n\n";
        foreach ($missedChecks as $mc) {
            $body .= "  �?� " . $mc['vehicle_name'] . "\n";
            $body .= "    �?chéance : " . $mc['deadline'];
            $body .= " (dans " . $mc['days_left'] . " jour(s))\n";
            $body .= "    Aucun contrôle enregistré pour ce mois.\n\n";
        }
        $body .= "Connectez-vous à l'interface pour effectuer le contrôle.\n\n";
    }

    $body .= "-- Message automatique Inventaire Pompier --";

    $sent = sendAsupMailSMTP($email, $subject, $body);

    @file_put_contents(ASUP_MAIL_LOG,
        date('Y-m-d H:i:s') . " | To: $email | " . ($sent ? "OK" : "FAILED")
        . " | Peremption: " . count($peremptionAlerts)
        . " | MissedChecks: " . count($missedChecks) . "\n",
        FILE_APPEND
    );

    return [
        'success'           => $sent,
        'sent'              => $sent,
        'message'           => $sent ? 'E-mail ASUP envoyé.' : '�?chec envoi (voir asup_mail.log).',
        'peremption_alerts' => count($peremptionAlerts),
        'missed_checks'     => count($missedChecks),
        'recipient'         => $email,
    ];
}

// ===========================================================================
// ROUTES
// N'est exécuté que lors d'un appel HTTP direct. Quand ce fichier est inclus
// par un script cron, $_SERVER['REQUEST_METHOD'] n'existe pas : on saute tout
// le routing pour laisser la main au script appelant.
// ===========================================================================
if (isset($_SERVER['REQUEST_METHOD'])) {

// GET : public_medications (sans auth �?" péremptions pour affichage inventaire public)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'public_medications') {
    $result = [];
    $now    = new DateTime();
    foreach (ASUP_ELIGIBLE_IDS as $vId) {
        $data = loadAsupMedications($vId);
        foreach ($data['medications'] as $med) {
            $entry = [
                'vehicle_id' => $vId,
                'location'   => $med['location'],
                'name'       => $med['name'],
                'peremption' => $med['peremption'] ?? '',
                '_status'    => 'no_date',
                '_days'      => null,
            ];
            if (!empty($med['peremption'])) {
                try {
                    $expiry           = new DateTime($med['peremption']);
                    $diff             = (int) $now->diff($expiry)->format('%r%a');
                    $entry['_status'] = $diff < 0 ? 'expired' : ($diff <= 14 ? 'expiring' : 'ok');
                    $entry['_days']   = $diff;
                } catch (Exception $e) {}
            }
            $result[] = $entry;
        }
    }
    sendJSON($result);
}

// GET : status
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'status') {
    requireAsupAuth();
    $vehicleId = trim($_GET['vehicle_id'] ?? 'vsav');
    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS)) {
        sendJSON(['error' => 'Véhicule non éligible ASUP.'], 400);
    }
    $status  = computeMonthlyStatus($vehicleId);
    $session = loadAsupSession($vehicleId);
    sendJSON(array_merge($status, ['active_session' => $session]));
}

// GET : medications
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'medications') {
    requireAsupAuth();
    $vehicleId = trim($_GET['vehicle_id'] ?? 'vsav');
    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS)) {
        sendJSON(['error' => 'Véhicule non éligible ASUP.'], 400);
    }
    $data = loadAsupMedications($vehicleId);
    $now  = new DateTime();
    foreach ($data['medications'] as &$med) {
        if (!empty($med['peremption'])) {
            try {
                $expiry = new DateTime($med['peremption']);
                $diff   = (int) $now->diff($expiry)->format('%r%a');
                $med['_status'] = $diff < 0 ? 'expired' : ($diff <= 14 ? 'expiring' : 'ok');
                $med['_days']   = abs($diff);
            } catch (Exception $e) {
                $med['_status'] = 'unknown';
                $med['_days']   = null;
            }
        } else {
            $med['_status'] = 'no_date';
            $med['_days']   = null;
        }
    }
    unset($med);
    sendJSON($data);
}

// GET : history
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'history') {
    requireAsupAuth();
    $history = loadAsupHistory();
    if (!empty($_GET['vehicle_id'])) {
        $vId = trim($_GET['vehicle_id']);
        $history = array_values(array_filter($history, function($h) use ($vId) { return $h['vehicle_id'] === $vId; }));
    }
    if (!empty($_GET['year'])) {
        $year = (int) $_GET['year'];
        $history = array_values(array_filter($history,
            function($h) use ($year) {
                return isset($h['finished_at']) && (int)substr($h['finished_at'], 0, 4) === $year;
            }));
    }
    usort($history, function($a, $b) {
        return strcmp($b['finished_at'] ?? '', $a['finished_at'] ?? '');
    });
    sendJSON($history);
}

// GET : annual_report
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'annual_report') {
    requireAsupAuth();
    $year    = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $history = loadAsupHistory();
    $yearHistory = array_values(array_filter($history,
        function($h) use ($year) {
            return isset($h['finished_at']) && (int)substr($h['finished_at'], 0, 4) === $year;
        }));
    usort($yearHistory, function($a, $b) {
        return strcmp($a['finished_at'] ?? '', $b['finished_at'] ?? '');
    });
    $completeChecks = 0;
    foreach ($yearHistory as $h) {
        if (($h['unchecked_count'] ?? 1) === 0) $completeChecks++;
    }
    sendJSON([
        'year'            => $year,
        'total_checks'    => count($yearHistory),
        'complete_checks' => $completeChecks,
        'history'         => $yearHistory,
        'generated_at'    => date('Y-m-d H:i:s'),
    ]);
}

// POST : start_check
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'start_check') {
    requireAsupCheckAuth();
    $input     = json_decode(file_get_contents('php://input'), true);
    $vehicleId = trim($input['vehicle_id'] ?? 'vsav');
    $agent     = trim($input['agent'] ?? '');
    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS)) {
        sendJSON(['error' => 'Véhicule non éligible ASUP.'], 400);
    }
    if (empty($agent)) {
        sendJSON(['error' => 'Le nom du correspondant pharmacie est requis.'], 400);
    }
    $currentCheck = findCurrentMonthCheck($vehicleId);
    $force = !empty($input['force']); // forcer un nouveau contrôle même si déjà finalisé ce mois
    if ($currentCheck && !$force) {
        sendJSON([
            'error'     => 'Un contrôle a déjà été finalisé ce mois pour ce véhicule.',
            'existing'  => $currentCheck,
            'can_force' => true,
        ], 409);
    }
    $existing = loadAsupSession($vehicleId);
    if ($existing) {
        sendJSON(['session' => $existing, 'resumed' => true]);
    }
    $data    = loadAsupMedications($vehicleId);
    $session = [
        'session_id'  => uniqid('asup_'),
        'vehicle_id'  => $vehicleId,
        'agent'       => $agent,
        'started_at'  => date('Y-m-d H:i:s'),
        'checked'     => [],
        'medications' => $data['medications'],
    ];
    if (!saveAsupSession($vehicleId, $session)) {
        sendJSON(['error' => 'Impossible de créer la session de contrôle.'], 500);
    }
    sendJSON(['session' => $session, 'resumed' => false]);
}

// POST : toggle
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'toggle') {
    requireAsupCheckAuth();
    $input        = json_decode(file_get_contents('php://input'), true);
    $vehicleId    = trim($input['vehicle_id'] ?? '');
    $key          = trim($input['key'] ?? '');
    $checked      = (bool)($input['checked'] ?? false);
    $realQuantity = isset($input['real_quantity']) ? (int)$input['real_quantity'] : null;
    $comment      = isset($input['comment']) ? trim($input['comment']) : null;

    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS) || empty($key)) {
        sendJSON(['error' => 'Données incomplètes.'], 400);
    }
    $session = loadAsupSession($vehicleId);
    if (!$session) {
        sendJSON(['error' => 'Aucune session de contrôle en cours.'], 404);
    }

    if ($checked) {
        $session['checked'][$key] = date('Y-m-d H:i:s');
    } else {
        unset($session['checked'][$key]);
    }

    // Enregistre real_quantity et comment dans la session (par clé médicament)
    if (!isset($session['details'])) $session['details'] = [];
    if (!isset($session['details'][$key])) $session['details'][$key] = [];
    if ($realQuantity !== null) $session['details'][$key]['real_quantity'] = $realQuantity;
    if ($comment !== null)      $session['details'][$key]['comment']       = $comment;

    if (!saveAsupSession($vehicleId, $session)) {
        sendJSON(['error' => 'Impossible d\'enregistrer le pointage.'], 500);
    }
    sendJSON(['success' => true, 'checked_count' => count($session['checked'])]);
}

// POST : finish_check
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'finish_check') {
    requireAsupCheckAuth();
    $input     = json_decode(file_get_contents('php://input'), true);
    $vehicleId = trim($input['vehicle_id'] ?? 'vsav');
    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS)) {
        sendJSON(['error' => 'Véhicule non éligible ASUP.'], 400);
    }
    $session = loadAsupSession($vehicleId);
    if (!$session) {
        sendJSON(['error' => 'Aucune session de contrôle en cours.'], 404);
    }
    $details   = $session['details'] ?? [];
    $unchecked = [];
    $anomalies = []; // médicaments avec écart stock ou commentaire

    // Validation : commentaire obligatoire si écart entre stock prévu et stock réel
    foreach ($session['medications'] as $med) {
        $key          = $med['key'];
        $realQty      = isset($details[$key]['real_quantity']) ? (int)$details[$key]['real_quantity'] : null;
        $comment      = $details[$key]['comment'] ?? '';
        $expectedQty  = (int)($med['quantity'] ?? 0);

        if ($realQty !== null && $realQty !== $expectedQty && empty($comment)) {
            sendJSON([
                'error'   => 'Commentaire obligatoire si le stock réel diffère du stock prévu.',
                'med_key' => $key,
                'med_name'=> $med['name'],
            ], 400);
        }
    }

    foreach ($session['medications'] as $med) {
        if (!isset($session['checked'][$med['key']])) $unchecked[] = $med;
    }

    // Construction du snapshot enrichi
    $snapshot = [];
    foreach ($session['medications'] as $med) {
        $key         = $med['key'];
        $realQty     = isset($details[$key]['real_quantity']) ? (int)$details[$key]['real_quantity'] : null;
        $comment     = $details[$key]['comment'] ?? '';
        $expectedQty = (int)($med['quantity'] ?? 0);
        $hasAnomaly  = ($realQty !== null && $realQty !== $expectedQty) || !empty($comment);

        $entry = array_merge($med, [
            '_checked'       => isset($session['checked'][$key]),
            '_checked_at'    => $session['checked'][$key] ?? null,
            '_real_quantity' => $realQty,
            '_comment'       => $comment,
            '_has_anomaly'   => $hasAnomaly,
        ]);
        $snapshot[] = $entry;

        if ($hasAnomaly) $anomalies[] = $entry;
    }

    $record = [
        'id'                   => uniqid('asup_hist_'),
        'vehicle_id'           => $vehicleId,
        'agent'                => $session['agent'],
        'started_at'           => $session['started_at'],
        'finished_at'          => date('Y-m-d H:i:s'),
        'status'               => 'finalisé',
        'total_count'          => count($session['medications']),
        'checked_count'        => count($session['checked']),
        'unchecked_count'      => count($unchecked),
        'unchecked_items'      => $unchecked,
        'anomaly_count'        => count($anomalies),
        'anomalies'            => $anomalies,
        'medications_snapshot' => $snapshot,
    ];
    $history   = loadAsupHistory();
    $history[] = $record;
    if (!saveAsupHistory($history)) {
        sendJSON(['error' => 'Impossible d\'enregistrer l\'historique du contrôle.'], 500);
    }
    deleteAsupSession($vehicleId);
    sendJSON(['success' => true, 'record' => $record]);
}

// POST : cancel_check
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'cancel_check') {
    requireAsupCheckAuth();
    $input     = json_decode(file_get_contents('php://input'), true);
    $vehicleId = trim($input['vehicle_id'] ?? 'vsav');
    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS)) {
        sendJSON(['error' => 'Véhicule non éligible ASUP.'], 400);
    }
    deleteAsupSession($vehicleId);
    sendJSON(['success' => true, 'message' => 'Session annulée.']);
}

// POST : send_alerts (cron ou manuel admin)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send_alerts') {
    if (isset($_SERVER['HTTP_HOST'])) requireAsupAuth();
    $result = runAsupAlerts();
    sendJSON($result);
}

// POST : generate_report �?" génère le rapport annuel PDF via asup_rapport_annuel.py
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'generate_report') {
    requireAsupAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    $year  = isset($input['year']) ? (int)$input['year'] : (int)date('Y');

    $pythonBin    = '/usr/local/bin/python3';
    $pythonScript = dirname(__DIR__) . '/asup_rapport_annuel.py';

    if (!file_exists($pythonScript)) {
        sendJSON(['error' => 'Script de génération introuvable (asup_rapport_annuel.py).'], 500);
    }
    if (!file_exists($pythonBin)) {
        sendJSON(['error' => 'Interpréteur Python3 introuvable sur le NAS.'], 500);
    }

    // Fichier temporaire dans /tmp/ �?" pas de problème de droits sur data/
    $tmpPdf = sys_get_temp_dir() . '/asup_rapport_' . $year . '_' . getmypid() . '.pdf';

    $output     = [];
    $returnCode = 0;
    @exec(
        escapeshellcmd($pythonBin) . ' ' . escapeshellarg($pythonScript)
        . ' ' . (int)$year . ' ' . escapeshellarg($tmpPdf) . ' --force 2>&1',
        $output, $returnCode
    );

    if ($returnCode !== 0 || !file_exists($tmpPdf)) {
        sendJSON([
            'error'  => '�?chec de la génération du rapport PDF.',
            'detail' => implode("\n", $output),
            'year'   => $year,
        ], 500);
    }

    // Streaming du PDF directement au navigateur
    $pdfSize = filesize($tmpPdf);
    // Nettoyage différé : après envoi complet, pas avant
    register_shutdown_function(function() use ($tmpPdf) {
        if (file_exists($tmpPdf)) @unlink($tmpPdf);
    });
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="asup_rapport_' . $year . '.pdf"');
    header('Content-Length: ' . $pdfSize);
    header('Cache-Control: no-store');
    readfile($tmpPdf);
    exit;
}
// POST ou GET : print_pdf �?" génère l'inventaire actuel des médicaments en PDF via asup_inventaire_pdf.py
if (($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'POST') && $action === 'print_pdf') {
    requireAsupAuth();
    $vehicleId = trim($_GET['vehicle_id'] ?? $_POST['vehicle_id'] ?? 'vsav');
    if (!in_array($vehicleId, ASUP_ELIGIBLE_IDS)) {
        sendJSON(['error' => 'Véhicule non éligible ASUP.'], 400);
    }

    $pythonBin    = '/usr/local/bin/python3';
    $pythonScript = dirname(__DIR__) . '/asup_inventaire_pdf.py';

    if (!file_exists($pythonScript)) {
        sendJSON(['error' => 'Script de génération introuvable (asup_inventaire_pdf.py).'], 500);
    }
    if (!file_exists($pythonBin)) {
        sendJSON(['error' => 'Interpréteur Python3 introuvable sur le NAS.'], 500);
    }

    // 1. Générer dynamiquement un fichier JSON temporaire avec l'état actuel des médicaments du véhicule
    $medData = loadAsupMedications($vehicleId);
    $now = new DateTime();
    foreach ($medData['medications'] as &$med) {
        if (!empty($med['peremption'])) {
            try {
                $expiry = new DateTime($med['peremption']);
                $diff = (int) $now->diff($expiry)->format('%r%a');
                $med['_status'] = $diff < 0 ? 'expired' : ($diff <= 14 ? 'expiring' : 'ok');
                $med['_days'] = abs($diff);
            } catch (Exception $e) {
                $med['_status'] = 'unknown';
                $med['_days'] = null;
            }
        } else {
            $med['_status'] = 'no_date';
            $med['_days'] = null;
        }
    }
    unset($med);

    // Date du dernier contrôle finalisé pour ce véhicule
	$lastCheckDate = null;
	$histData = loadAsupHistory();
	foreach (array_reverse($histData) as $rec) {
		if ($rec['vehicle_id'] === $vehicleId && $rec['status'] === 'finalisé') {
			$lastCheckDate = $rec['finished_at'];
			break;
		}
	}
$medData['last_check_date'] = $lastCheckDate;

$tmpJson = tempnam(sys_get_temp_dir(), 'asup_inv_');
file_put_contents($tmpJson, json_encode($medData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    // 2. Fichier PDF temporaire pour la sortie
    $tmpPdf = sys_get_temp_dir() . '/asup_inventaire_' . $vehicleId . '_' . getmypid() . '.pdf';

    $output     = [];
    $returnCode = 0;
    @exec(
        escapeshellcmd($pythonBin) . ' ' . escapeshellarg($pythonScript)
        . ' ' . escapeshellarg($tmpJson) . ' ' . escapeshellarg($tmpPdf) . ' 2>&1',
        $output, $returnCode
    );

    // Nettoyage du JSON temporaire
    if (file_exists($tmpJson)) @unlink($tmpJson);

    if ($returnCode !== 0 || !file_exists($tmpPdf)) {
        sendJSON([
            'error'  => '�?chec de la génération du PDF d\'inventaire.',
            'detail' => implode("\n", $output),
        ], 500);
    }

    // 3. Streaming du PDF généré vers le navigateur
    $pdfSize = filesize($tmpPdf);
    register_shutdown_function(function() use ($tmpPdf) {
        if (file_exists($tmpPdf)) @unlink($tmpPdf);
    });

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="inventaire_asup_' . $vehicleId . '.pdf"');
    header('Content-Length: ' . $pdfSize);
    header('Cache-Control: no-store');
    readfile($tmpPdf);
    exit;
}
sendJSON(['error' => 'Action ou méthode non supportée.'], 400);

} // fin if (isset($_SERVER['REQUEST_METHOD']))
?>