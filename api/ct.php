<?php
/**
 * api/ct.php
 * Généré le 2026-09-02 �?" Corrigé le 2026-09-04 : loadAllVehiclesWithCt() migré de vehicles.json vers manifest.json
 * API de gestion des Contrôles Techniques (CT) des véhicules.
 *
 * Actions disponibles :
 *   GET  ?action=status           �?' liste les statuts CT de tous les véhicules (admin)
 *   POST ?action=update           �?' met à jour la date CT et les paramètres d'un véhicule
 *   POST ?action=toggle_disabled  �?' active/désactive la suspension des alertes CT
 *   POST ?action=send_alerts      �?' déclenche manuellement l'envoi des alertes mail
 *
 * Rôles autorisés :
 *   - superadmin, admin           �?' tous les véhicules
 *   - responsable_vehicule        �?' uniquement les véhicules dont il est responsible_admin
 *
 * Règle cron : le bloc de routing HTTP est conditionné à isset($_SERVER['REQUEST_METHOD'])
 * pour permettre l'inclusion par ct_cron.php sans déclencher de routing.
 *
 * Destinataires des alertes mail :
 *   - Le responsible_admin du véhicule (champ dans {vehicleId}.json)
 *   - Tous les users ayant le rôle "responsable_vehicule" dans users.json
 *   Les adresses sont dédupliquées avant envoi.
 */

require_once __DIR__ . '/config.php';

// �"?�"? Constantes �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
define('CT_LOG_FILE', DATA_DIR . '/ct_cron.log');

// Seuils d'alerte en jours (exprimés en jours avant échéance)
const CT_ALERT_THRESHOLDS = [60, 30, 15, 7];

// �"?�"? Helpers locaux �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?

/**
 * Charge tous les véhicules depuis data/manifest.json (liste d'IDs) puis
 * lit les champs CT directement dans chaque fichier individuel {id}.json.
 */
function loadAllVehiclesWithCt() {
    $manifestFile = DATA_DIR . '/manifest.json';
    if (!file_exists($manifestFile)) return [];

    $ids      = json_decode(file_get_contents($manifestFile), true) ?: [];
    $vehicles = [];

    foreach ($ids as $id) {
        $vehicleFile = DATA_DIR . '/' . $id . '.json';
        if (!file_exists($vehicleFile)) continue;
        $data = json_decode(file_get_contents($vehicleFile), true) ?: [];
        // Tous les champs sont dans le fichier individuel
        $vehicles[] = [
            'id'                  => $id,
            'name'                => $data['name']                ?? $id,
            'type'                => $data['type']                ?? '',
            'ct_date'             => $data['ct_date']             ?? null,
            'ct_alert_disabled'   => $data['ct_alert_disabled']   ?? false,
            'ct_alerted_days'     => $data['ct_alerted_days']     ?? [],
            'responsible_admin'   => $data['responsible_admin']   ?? null,
        ];
    }

    return $vehicles;
}

/**
 * Sauvegarde les champs CT dans le fichier individuel du véhicule.
 * Ne touche qu'aux clés CT pour ne pas écraser l'inventaire.
 */
function saveVehicleCtFields($vehicleId, $fields) {
    $vehicleFile = DATA_DIR . '/' . $vehicleId . '.json';
    if (!file_exists($vehicleFile)) return false;

    $data = json_decode(file_get_contents($vehicleFile), true) ?: [];
    foreach ($fields as $k => $v) {
        $data[$k] = $v;
    }

    return file_put_contents(
        $vehicleFile,
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    ) !== false;
}

/**
 * Calcule le statut CT d'un véhicule à partir de sa date de CT.
 * Retourne un tableau avec : days_remaining, status (ok/warning/urgent/overdue/none).
 */
function computeCtStatus($ctDate) {
    if (empty($ctDate)) {
        return ['days_remaining' => null, 'status' => 'none'];
    }

    try {
        $now    = new DateTime('today');
        $target = new DateTime($ctDate);
        $diff   = (int)$now->diff($target)->format('%r%a');

        if ($diff < 0) {
            $status = 'overdue';
        } elseif ($diff <= 7) {
            $status = 'urgent';
        } elseif ($diff <= 30) {
            $status = 'warning';
        } elseif ($diff <= 60) {
            $status = 'soon';
        } else {
            $status = 'ok';
        }

        return ['days_remaining' => $diff, 'status' => $status];
    } catch (Exception $e) {
        return ['days_remaining' => null, 'status' => 'none'];
    }
}

/**
 * Vérifie que l'utilisateur a le droit de modifier le CT du véhicule donné.
 * Superadmin et admin �?' tous les véhicules.
 * Responsable_vehicule �?' seulement si responsible_admin correspond à son login.
 */
function requireCtAuth($vehicleId = null) {
    $login = $_SESSION['login'] ?? '';

    if (sessionHasAnyRole(['superadmin', 'admin'])) return;

    if (sessionHasAnyRole(['responsable_vehicule']) && $vehicleId) {
        $vehicleFile = DATA_DIR . '/' . $vehicleId . '.json';
        if (file_exists($vehicleFile)) {
            $data = json_decode(file_get_contents($vehicleFile), true) ?: [];
            if (($data['responsible_admin'] ?? '') === $login) return;
        }
    }

    sendJSON(['error' => 'Accès non autorisé.'], 403);
}

/**
 * Récupère l'email du responsable d'un véhicule depuis users.json.
 */
function getResponsibleEmail($responsibleLogin) {
    if (empty($responsibleLogin) || !file_exists(USERS_FILE)) return null;

    $users = json_decode(file_get_contents(USERS_FILE), true) ?: [];
    foreach ($users as $u) {
        if ($u['login'] === $responsibleLogin) {
            return !empty($u['email']) ? $u['email'] : null;
        }
    }
    return null;
}

/**
 * Retourne la liste des emails de tous les users ayant le rôle "responsable_vehicule".
 * Gère les deux formats : role (string) et roles (array).
 */
function getResponsableVehiculeEmails() {
    if (!file_exists(USERS_FILE)) return [];

    $users  = json_decode(file_get_contents(USERS_FILE), true) ?: [];
    $emails = [];

    foreach ($users as $u) {
        $hasRole = ($u['role'] ?? '') === 'responsable_vehicule'
                || in_array('responsable_vehicule', $u['roles'] ?? [], true);

        if ($hasRole && !empty($u['email'])) {
            $emails[] = $u['email'];
        }
    }

    return $emails;
}

// �"?�"? Routing HTTP (ignoré lors d'un include CLI par ct_cron.php) �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if (isset($_SERVER['REQUEST_METHOD'])) {

    $action = $_GET['action'] ?? '';

    // �"?�"? GET public_status : lecture publique (sans auth) pour index.php �"?�"?�"?�"?�"?
    // N'expose que : id, ct_status, days_remaining, ct_alert_disabled.
    // Jamais la date exacte ni le responsable.
    if ($action === 'public_status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $vehicles = loadAllVehiclesWithCt();
        $result   = [];
        foreach ($vehicles as $v) {
            if (strtolower($v['type'] ?? '') !== 'véhicule') continue;
            if (empty($v['ct_date'])) continue;
            $ctStatus = computeCtStatus($v['ct_date']);
            $result[] = [
                'id'                => $v['id'],
                'ct_status'         => $ctStatus['status'],
                'days_remaining'    => $ctStatus['days_remaining'],
                'ct_alert_disabled' => $v['ct_alert_disabled'] ?? false,
            ];
        }
        sendJSON($result);
    }

    // �"?�"? GET status : liste des statuts CT (admin+) �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
    if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        requireAuth(); // admin minimum

        $vehicles = loadAllVehiclesWithCt();
        $result   = [];

        foreach ($vehicles as $v) {
            // Filtre pour responsable_vehicule : seulement ses véhicules
            $login = $_SESSION['login'] ?? '';
            $isFullCtAccess = sessionHasAnyRole(['superadmin', 'admin']);
            if (!$isFullCtAccess && sessionHasAnyRole(['responsable_vehicule']) && ($v['responsible_admin'] ?? '') !== $login) {
                continue;
            }

            $ctStatus = computeCtStatus($v['ct_date'] ?? null);
            $result[] = [
                'id'                  => $v['id'],
                'name'                => $v['name'],
                'type'                => $v['type'],
                'ct_date'             => $v['ct_date']           ?? null,
                'ct_alert_disabled'   => $v['ct_alert_disabled'] ?? false,
                'ct_alerted_days'     => $v['ct_alerted_days']   ?? [],
                'responsible_admin'   => $v['responsible_admin'] ?? null,
                'days_remaining'      => $ctStatus['days_remaining'],
                'ct_status'           => $ctStatus['status'],
            ];
        }

        sendJSON($result);
    }

    // �"?�"? POST update : mise à jour date CT + désactivation alerte �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
    if ($action === 'update' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input     = json_decode(file_get_contents('php://input'), true);
        $vehicleId = trim($input['vehicle_id'] ?? '');

        if (empty($vehicleId) || !preg_match('/^[a-zA-Z0-9\-]+$/', $vehicleId)) {
            sendJSON(['error' => 'Identifiant véhicule invalide.'], 400);
        }

        requireCtAuth($vehicleId);

        $ctDate = trim($input['ct_date'] ?? '');
        // Validation format YYYY-MM-DD
        if (!empty($ctDate) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $ctDate)) {
            sendJSON(['error' => 'Format de date invalide (attendu : YYYY-MM-DD).'], 400);
        }

        $fields = [
            'ct_date'           => $ctDate ?: null,
            'ct_alert_disabled' => (bool)($input['ct_alert_disabled'] ?? false),
        ];

        // Réinitialise les seuils déjà notifiés uniquement si la date change réellement
		if (isset($input['ct_date'])) {
			$vehicleFile = DATA_DIR . '/' . $vehicleId . '.json';
			$existing    = json_decode(file_get_contents($vehicleFile), true) ?: [];
			$oldDate     = $existing['ct_date'] ?? null;
			if ($ctDate !== $oldDate) {
				$fields['ct_alerted_days'] = [];
			}
		}

        if (!saveVehicleCtFields($vehicleId, $fields)) {
            sendJSON(['error' => 'Impossible de sauvegarder.'], 500);
        }

        sendJSON(['success' => true]);
    }

    // �"?�"? POST toggle_disabled : bascule la suspension des alertes �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
    if ($action === 'toggle_disabled' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input     = json_decode(file_get_contents('php://input'), true);
        $vehicleId = trim($input['vehicle_id'] ?? '');

        if (empty($vehicleId)) sendJSON(['error' => 'vehicle_id requis.'], 400);
        requireCtAuth($vehicleId);

        $disabled = (bool)($input['ct_alert_disabled'] ?? false);
        if (!saveVehicleCtFields($vehicleId, ['ct_alert_disabled' => $disabled])) {
            sendJSON(['error' => 'Sauvegarde impossible.'], 500);
        }

        sendJSON(['success' => true, 'ct_alert_disabled' => $disabled]);
    }

    // �"?�"? POST send_alerts : déclenchement manuel �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
    if ($action === 'send_alerts' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        requireAuth();
        if (!sessionHasAnyRole(['superadmin', 'admin', 'responsable_vehicule'])) {
            sendJSON(['error' => 'Accès non autorisé. Rôle requis : admin ou responsable_vehicule.'], 403);
        }
        $result = runCtAlerts(true); // true = mode test (force l'envoi même si déjà notifié)
        sendJSON($result);
    }

    sendJSON(['error' => 'Action ou méthode non supportée.'], 400);

} // fin if REQUEST_METHOD

// �"?�"? Fonction principale �?" appelée par ct_cron.php �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?

/**
 * Parcourt tous les véhicules de type "Véhicule" et envoie un mail d'alerte
 * si le CT approche d'un seuil non encore notifié.
 *
 * Destinataires par véhicule :
 *   - Le responsible_admin du véhicule (champ dans {vehicleId}.json)
 *   - Tous les users ayant le rôle "responsable_vehicule" dans users.json
 *   Les adresses sont dédupliquées ; un seul mail multi-destinataires est envoyé.
 *
 * @param bool $forceResend  Si true, ignore les seuils déjà notifiés (mode test).
 * @return array             Résumé de l'opération.
 */
function runCtAlerts($forceResend = false) {
    $vehicles = loadAllVehiclesWithCt();
    $now      = new DateTime('today');
    $sent     = 0;
    $skipped  = 0;
    $log      = [];

    // Collecte une fois pour toutes les emails des responsables_vehicule
    $rvEmails = getResponsableVehiculeEmails();

    foreach ($vehicles as $v) {
        // Uniquement les véhicules (pas les lots ni les remorques)
        if (strtolower($v['type'] ?? '') !== 'véhicule') {
            continue;
        }

        $ctDate   = $v['ct_date'] ?? null;
        $disabled = $v['ct_alert_disabled'] ?? false;

        if (empty($ctDate) || $disabled) {
            $log[] = "�?" {$v['name']} : " . (empty($ctDate) ? 'pas de date CT' : 'alertes désactivées (RDV pris)');
            $skipped++;
            continue;
        }

        try {
            $target      = new DateTime($ctDate);
            $daysLeft    = (int)$now->diff($target)->format('%r%a');
            $alertedDays = $v['ct_alerted_days'] ?? [];

            // Cherche le seuil le plus bas atteint non encore notifié,
            // et collecte tous les seuils atteints pour les marquer d'un coup
            // (évite plusieurs mails en rafale si plusieurs seuils sont franchis simultanément).
            $triggerThreshold = null;
            $thresholdsToMark = []; // tous les seuils atteints, à marquer même si non déclenchés

            foreach (CT_ALERT_THRESHOLDS as $threshold) {
                if ($daysLeft <= $threshold) {
                    $thresholdsToMark[] = $threshold;
                    // CT_ALERT_THRESHOLDS est trié DESC [60,30,15,7] :
                    // le dernier itéré sera le plus petit �?' on l'écrase à chaque tour.
                    if ($forceResend || !in_array($threshold, $alertedDays, true)) {
                        $triggerThreshold = $threshold;
                    }
                }
            }

            if ($triggerThreshold === null) {
                $log[] = "�?" {$v['name']} : J-{$daysLeft} �?" aucun seuil nouveau à notifier";
                $skipped++;
                continue;
            }

            // Récupère l'email du responsible_admin + tous les responsables_vehicule
            $responsibleLogin = $v['responsible_admin'] ?? null;
            $mainEmail        = getResponsibleEmail($responsibleLogin);

            // Fusion et déduplication ; le responsable direct est en premier
            $allEmails = array_values(array_unique(array_filter(
                array_merge(
                    $mainEmail ? [$mainEmail] : [],
                    $rvEmails
                )
            )));

            if (empty($allEmails)) {
                $log[] = "�s� {$v['name']} : aucun destinataire trouvé (login: {$responsibleLogin})";
                $skipped++;
                continue;
            }

            // Construction du mail
            $ctDateFr = implode('/', array_reverse(explode('-', $ctDate)));
            $urgency  = $daysLeft <= 0 ? 'D�?PASS�?' : "J-{$daysLeft}";
            $subject  = "[CT Caserne] {$v['name']} �?" Contrôle Technique {$urgency}";

            $body  = "Bonjour,\n\n";
            if ($daysLeft <= 0) {
                $body .= "�s� ALERTE : Le contrôle technique du véhicule {$v['name']} est D�?PASS�?.\n\n";
                $body .= "Date d'échéance : {$ctDateFr} (dépassée depuis " . abs($daysLeft) . " jour(s))\n\n";
            } else {
                $body .= "Rappel : le contrôle technique du véhicule {$v['name']} approche.\n\n";
                $body .= "Date d'échéance : {$ctDateFr} (dans {$daysLeft} jour(s))\n\n";
            }
            $body .= "Connectez-vous à l'interface d'administration pour mettre à jour les informations\n";
            $body .= "ou désactiver cette alerte si un rendez-vous est déjà pris.\n\n";
            $body .= "-- Message automatique Inventaire Pompier --\n";
            $body .= "Date du rapport : " . date('d/m/Y à H:i') . "\n";

            $ok = sendCtMailSMTP($allEmails, $subject, $body);

            if ($ok && !$forceResend) {
                // Marque le seuil déclenché ET tous les seuils supérieurs déjà franchis
                // pour ne pas envoyer plusieurs mails en rafale les jours suivants.
                foreach ($thresholdsToMark as $t) {
                    $alertedDays[] = $t;
                }
                $alertedDays = array_unique($alertedDays);
                saveVehicleCtFields($v['id'], ['ct_alerted_days' => $alertedDays]);
            }

            $recipientsList = implode(', ', $allEmails);
            $status = $ok ? '�o" Mail envoyé' : '�o- �?chec envoi';
            $log[]  = "{$status} �?' {$v['name']} ({$recipientsList}) J-{$daysLeft} seuil-{$triggerThreshold}";
            if ($ok) $sent++;

        } catch (Exception $e) {
            $log[] = "�o- Erreur {$v['name']} : " . $e->getMessage();
        }
    }

    $summary = date('Y-m-d H:i:s') . " | Envoyés: {$sent} | Ignorés: {$skipped}\n"
             . implode("\n", array_map(function($l) { return "  " . $l; }, $log)) . "\n";

    @file_put_contents(CT_LOG_FILE, $summary . str_repeat('-', 60) . "\n", FILE_APPEND);

    return [
        'success' => true,
        'sent'    => $sent,
        'skipped' => $skipped,
        'log'     => $log,
    ];
}

// �"?�"? Envoi SMTP (même pattern que alerts.php / pisu.php) �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?

/**
 * Envoie un mail SMTP.
 * @param string|array $to  Adresse ou tableau d'adresses destinataires.
 */
function sendCtMailSMTP($to, $subject, $body) {
    $host     = defined('SMTP_HOST')     ? SMTP_HOST     : envVar('SMTP_HOST', 'smtp.gmail.com');
    $port     = defined('SMTP_PORT')     ? SMTP_PORT     : (int)envVar('SMTP_PORT', 587);
    $user     = defined('SMTP_USER')     ? SMTP_USER     : envVar('SMTP_USER', '');
    $pass     = defined('SMTP_PASSWORD') ? SMTP_PASSWORD : envVar('SMTP_PASSWORD', '');
    $from     = defined('SMTP_FROM')     ? SMTP_FROM     : envVar('SMTP_FROM', $user);
    $fromName = defined('SMTP_NAME')     ? SMTP_NAME     : envVar('SMTP_NAME', 'Inventaire Pompier');
    $useTls   = defined('SMTP_USE_TLS')  ? SMTP_USE_TLS  : filter_var(envVar('SMTP_USE_TLS', true), FILTER_VALIDATE_BOOLEAN);

    // $to peut être une string ou un array d'adresses
    $toList = is_array($to) ? array_values(array_filter($to)) : [trim($to)];

    if (empty($toList)) return false;

    if (empty($user) || empty($pass)) {
        @file_put_contents(CT_LOG_FILE,
            date('Y-m-d H:i:s') . " | SMTP config manquante\n", FILE_APPEND);
        return false;
    }

    $errno = 0; $errstr = '';
    $socket = $useTls
        ? @fsockopen($host, $port, $errno, $errstr, 15)
        : @fsockopen('ssl://' . $host, $port, $errno, $errstr, 15);

    if (!$socket) {
        @file_put_contents(CT_LOG_FILE,
            date('Y-m-d H:i:s') . " | Connect failed: {$errstr} ({$errno})\n", FILE_APPEND);
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
            return false;
        }
        $send('EHLO ' . (function_exists('gethostname') ? gethostname() : 'nas'));
        while ($l = fgets($socket, 512)) { if (strlen($l) >= 4 && $l[3] === ' ') break; }
    }

    $send('AUTH LOGIN');
    $read();
    $send(base64_encode($user));
    $read();
    $send(base64_encode($pass));
    $authResp = $read();

    if (substr(trim($authResp), 0, 3) !== '235') {
        fclose($socket);
        @file_put_contents(CT_LOG_FILE,
            date('Y-m-d H:i:s') . " | AUTH FAILED: {$authResp}\n", FILE_APPEND);
        return false;
    }

    $send("MAIL FROM: <{$from}>"); $read();

    // Un RCPT TO par destinataire
    foreach ($toList as $addr) {
        $send("RCPT TO: <{$addr}>"); $read();
    }

    $send('DATA'); $read();

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $toHeader = implode(', ', array_map(function($a) { return "<{$a}>"; }, $toList));

    $headers  = "From: {$fromName} <{$from}>\r\n";
    $headers .= "To: {$toHeader}\r\n";
    $headers .= "Subject: {$encodedSubject}\r\n";
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