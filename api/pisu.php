<?php
/**
 * api/pisu.php
 * API de gestion du PISU (Protocole Infirmier de Soin d'Urgence).
 */

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

define('PISU_FILE',        DATA_DIR . '/pisu.json');
define('PISU_CONFIG_FILE', DATA_DIR . '/pisu_config.json');

// --- Helpers ---
function loadPisu() {
    if (!file_exists(PISU_FILE)) return [];
    return json_decode(file_get_contents(PISU_FILE), true) ?: [];
}

function savePisu($items) {
    $json = json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents(PISU_FILE, $json) !== false;
}

function loadPisuConfig() {
    if (!file_exists(PISU_CONFIG_FILE)) {
        return ['alert_days' => 30, 'email' => ''];
    }
    return json_decode(file_get_contents(PISU_CONFIG_FILE), true) ?: ['alert_days' => 30, 'email' => ''];
}

function savePisuConfig($config) {
    $json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents(PISU_CONFIG_FILE, $json) !== false;
}

function requirePisuAuth() {
    if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) return;
    if (!isset($_SESSION['pisu_logged_in']) || $_SESSION['pisu_logged_in'] !== true) {
        sendJSON(['error' => 'Authentification PISU requise.'], 401);
    }
}

// --- Routes ---
if ($action === 'status') {
    $isAdmin    = isset($_SESSION['logged_in'])      && $_SESSION['logged_in']      === true;
    $isPisuUser = isset($_SESSION['pisu_logged_in']) && $_SESSION['pisu_logged_in'] === true;

    if ($isAdmin || $isPisuUser) {
        sendJSON(['logged_in' => true, 'user' => ['name' => $_SESSION['pisu_user_name'] ?? 'Administrateur', 'role' => 'infirmier']]);
    } else {
        sendJSON(['logged_in' => false]);
    }
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input    = json_decode(file_get_contents('php://input'), true);
    $login    = trim($input['login'] ?? '');
    $password = trim($input['password'] ?? '');

    if (!$login || !$password || !file_exists(USERS_FILE)) {
        sendJSON(['error' => 'Identifiant ou mot de passe incorrect.'], 401);
    }

    $users = json_decode(file_get_contents(USERS_FILE), true) ?: [];
    $found = null;
    foreach ($users as $u) {
        if ($u['login'] === $login) { $found = $u; break; }
    }

    // Vérification du rôle et du mot de passe via password_hash
    if (!$found || !isset($found['password_hash']) || !password_verify($password, $found['password_hash'])) {
        sendJSON(['error' => 'Identifiant ou mot de passe incorrect.'], 401);
    }

    $role = $found['role'] ?? 'admin';
    if ($role !== 'infirmier' && $role !== 'admin') {
        sendJSON(['error' => 'Accès non autorisé.'], 403);
    }

    $_SESSION['pisu_logged_in']  = true;
    $_SESSION['pisu_user_login'] = $found['login'];
    $_SESSION['pisu_user_name']  = $found['name'];
    
    sendJSON(['success' => true, 'user' => ['name' => $found['name'], 'role' => $role]]);
}

// ── Route : déconnexion PISU ─────────────────────────────────────────────────
if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    unset($_SESSION['pisu_logged_in'], $_SESSION['pisu_user_login'], $_SESSION['pisu_user_name'], $_SESSION['pisu_user_role']);
    sendJSON(['success' => true]);
}

// ── Route publique : liste des médicaments (lecture seule) ───────────────────
// Utilisée pour compter les médicaments sur la carte d'accueil
if ($action === 'public_count' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $items = loadPisu();
    $now   = new DateTime();
    $config = loadPisuConfig();
    $alertDays = isset($config['alert_days']) ? (int)$config['alert_days'] : 30;

    $total    = count($items);
    $expiring = 0;
    $expired  = 0;

    foreach ($items as $item) {
        if (empty($item['expiry_date'])) continue;
        try {
            $expiry = new DateTime($item['expiry_date']);
            $diff   = (int)$now->diff($expiry)->format('%r%a'); // négatif si passé
            if ($diff < 0) {
                $expired++;
            } elseif ($diff <= $alertDays) {
                $expiring++;
            }
        } catch (Exception $e) { /* date invalide, ignorée */ }
    }

    sendJSON(['total' => $total, 'expiring' => $expiring, 'expired' => $expired]);
}

// ── À partir d'ici : authentification requise ────────────────────────────────
requirePisuAuth();

// ── Route : liste complète des médicaments ───────────────────────────────────
if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $items  = loadPisu();
    $config = loadPisuConfig();
    $now    = new DateTime();
    $alertDays = isset($config['alert_days']) ? (int)$config['alert_days'] : 30;

    // Enrichit chaque médicament avec son statut d'expiration calculé
    foreach ($items as &$item) {
        if (!empty($item['expiry_date'])) {
            try {
                $expiry = new DateTime($item['expiry_date']);
                $diff   = (int)$now->diff($expiry)->format('%r%a');
                if ($diff < 0) {
                    $item['_status'] = 'expired';       // Périmé
                    $item['_days']   = abs($diff);
                } elseif ($diff <= $alertDays) {
                    $item['_status'] = 'expiring';      // Bientôt périmé
                    $item['_days']   = $diff;
                } else {
                    $item['_status'] = 'ok';
                    $item['_days']   = $diff;
                }
            } catch (Exception $e) {
                $item['_status'] = 'unknown';
                $item['_days']   = null;
            }
        } else {
            $item['_status'] = 'no_date';
            $item['_days']   = null;
        }
    }
    unset($item);

    sendJSON(['items' => $items, 'config' => $config]);
}

// ── Route : ajout d'un médicament ────────────────────────────────────────────
if ($action === 'add' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['name'])) {
        sendJSON(['error' => 'Le nom du médicament est obligatoire.'], 400);
    }

    $item = [
        'id'          => uniqid('med_'),
        'name'        => trim($input['name']),
        'dosage'      => isset($input['dosage'])      ? trim($input['dosage'])      : '',
        'form'        => isset($input['form'])        ? trim($input['form'])        : '',  // forme pharma
        'quantity'    => isset($input['quantity'])    ? (int)$input['quantity']     : 0,
        'expiry_date' => isset($input['expiry_date']) ? trim($input['expiry_date']) : '',
        'notes'       => isset($input['notes'])       ? trim($input['notes'])       : '',
        'created_at'  => date('Y-m-d H:i:s'),
        'updated_at'  => date('Y-m-d H:i:s'),
    ];

    $items   = loadPisu();
    $items[] = $item;

    if (!savePisu($items)) {
        sendJSON(['error' => 'Erreur lors de la sauvegarde.'], 500);
    }

    sendJSON(['success' => true, 'item' => $item]);
}

// ── Route : modification d'un médicament ─────────────────────────────────────
if ($action === 'edit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['id']) || empty($input['name'])) {
        sendJSON(['error' => 'ID et nom requis.'], 400);
    }

    $items = loadPisu();
    $found = false;

    foreach ($items as &$item) {
        if ($item['id'] === $input['id']) {
            $item['name']        = trim($input['name']);
            $item['dosage']      = isset($input['dosage'])      ? trim($input['dosage'])      : '';
            $item['form']        = isset($input['form'])        ? trim($input['form'])        : '';
            $item['quantity']    = isset($input['quantity'])    ? (int)$input['quantity']     : 0;
            $item['expiry_date'] = isset($input['expiry_date']) ? trim($input['expiry_date']) : '';
            $item['notes']       = isset($input['notes'])       ? trim($input['notes'])       : '';
            $item['updated_at']  = date('Y-m-d H:i:s');
            $found = true;
            break;
        }
    }
    unset($item);

    if (!$found) {
        sendJSON(['error' => 'Médicament introuvable.'], 404);
    }

    if (!savePisu($items)) {
        sendJSON(['error' => 'Erreur lors de la sauvegarde.'], 500);
    }

    sendJSON(['success' => true]);
}

// ── Route : suppression d'un médicament ──────────────────────────────────────
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['id'])) {
        sendJSON(['error' => 'ID requis.'], 400);
    }

    $items    = loadPisu();
    $filtered = array_filter($items, function($i) use ($input) {
        return $i['id'] !== $input['id'];
    });

    if (count($filtered) === count($items)) {
        sendJSON(['error' => 'Médicament introuvable.'], 404);
    }

    if (!savePisu($filtered)) {
        sendJSON(['error' => 'Erreur lors de la suppression.'], 500);
    }

    sendJSON(['success' => true]);
}

// ── Route : mise à jour de la configuration (délai alerte + e-mail) ──────────
if ($action === 'save_config' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        sendJSON(['error' => 'Données invalides.'], 400);
    }

    $config = [
        'alert_days' => isset($input['alert_days']) ? max(1, (int)$input['alert_days']) : 30,
        'email'      => isset($input['email'])      ? trim($input['email'])              : '',
    ];

    if (!savePisuConfig($config)) {
        sendJSON(['error' => 'Impossible de sauvegarder la configuration.'], 500);
    }

    sendJSON(['success' => true, 'config' => $config]);
}

// ── Route : envoi manuel des alertes d'expiration ────────────────────────────
// Peut aussi être appelée par un cron via pisu_cron.php
if ($action === 'send_alerts' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $result = runPisuAlerts();
    sendJSON($result);
}

// ── Fonction principale d'envoi des alertes d'expiration ────────────────────
/**
 * Parcourt tous les médicaments et envoie un e-mail récapitulatif
 * si des médicaments arrivent à expiration dans le délai configuré.
 * Retourne un tableau de résumé.
 */
function runPisuAlerts() {
    $items  = loadPisu();
    $config = loadPisuConfig();

    $alertDays = isset($config['alert_days']) ? (int)$config['alert_days'] : 30;
    $email     = isset($config['email'])      ? $config['email']           : '';

    if (empty($email)) {
        return ['error' => 'Aucun e-mail destinataire configuré.'];
    }

    $now      = new DateTime();
    $expiring = []; // bientôt périmés
    $expired  = []; // déjà périmés

    foreach ($items as $item) {
        if (empty($item['expiry_date'])) continue;
        try {
            $expiry = new DateTime($item['expiry_date']);
            $diff   = (int)$now->diff($expiry)->format('%r%a');
            if ($diff < 0) {
                $item['_days_overdue'] = abs($diff);
                $expired[] = $item;
            } elseif ($diff <= $alertDays) {
                $item['_days_left'] = $diff;
                $expiring[] = $item;
            }
        } catch (Exception $e) { /* ignoré */ }
    }

    if (empty($expiring) && empty($expired)) {
        return ['success' => true, 'message' => 'Aucun médicament à alerter.', 'sent' => false];
    }

    // Construction du corps de l'e-mail
    $subject = "[PISU TMC] " . (empty($expired) ? '' : count($expired) . ' périmé(s) — ')
             . (empty($expiring) ? '' : count($expiring) . ' bientôt périmé(s)');

    $body  = "Bonjour,\n\n";
    $body .= "Voici le rapport d'expiration des médicaments du PISU - CT TMC.\n\n";

    if (!empty($expired)) {
        $body .= "═══ MÉDICAMENTS PÉRIMÉS (" . count($expired) . ") ═══\n";
        foreach ($expired as $m) {
            $body .= "  • " . $m['name'];
            if (!empty($m['dosage'])) $body .= " " . $m['dosage'];
            if (!empty($m['form']))   $body .= " — " . $m['form'];
            $body .= "\n    Qté : " . $m['quantity'];
            $body .= " | Périmé depuis " . $m['_days_overdue'] . " jour(s)";
            $body .= " (échéance : " . formatDateFR($m['expiry_date']) . ")\n";
            if (!empty($m['notes'])) $body .= "    Note : " . $m['notes'] . "\n";
            $body .= "\n";
        }
    }

    if (!empty($expiring)) {
        $body .= "═══ MÉDICAMENTS BIENTÔT PÉRIMÉS (" . count($expiring) . ") ═══\n";
        foreach ($expiring as $m) {
            $body .= "  • " . $m['name'];
            if (!empty($m['dosage'])) $body .= " " . $m['dosage'];
            if (!empty($m['form']))   $body .= " — " . $m['form'];
            $body .= "\n    Qté : " . $m['quantity'];
            $body .= " | Expire dans " . $m['_days_left'] . " jour(s)";
            $body .= " (échéance : " . formatDateFR($m['expiry_date']) . ")\n";
            if (!empty($m['notes'])) $body .= "    Note : " . $m['notes'] . "\n";
            $body .= "\n";
        }
    }

    $body .= "Connectez-vous à l'espace PISU pour gérer les échanges.\n";
    $body .= "Date du rapport : " . date('d/m/Y à H:i') . "\n\n";
    $body .= "-- Message automatique Inventaire TMC --";

    $sent = sendPisuMailSMTP($email, $subject, $body);

    // Log du résultat
    @file_put_contents(DATA_DIR . '/pisu_mail.log',
        date('Y-m-d H:i:s') . " | To: $email | " . ($sent ? "OK" : "FAILED")
        . " | Expired: " . count($expired) . " | Expiring: " . count($expiring) . "\n",
        FILE_APPEND
    );

    return [
        'success'  => $sent,
        'message'  => $sent ? 'E-mail envoyé avec succès.' : 'Échec de l\'envoi (voir pisu_mail.log).',
        'sent'     => $sent,
        'expired'  => count($expired),
        'expiring' => count($expiring),
    ];
}

/**
 * Formate une date ISO (YYYY-MM-DD) en format français (DD/MM/YYYY).
 */
function formatDateFR($isoDate) {
    if (empty($isoDate)) return '—';
    $parts = explode('-', $isoDate);
    if (count($parts) === 3) return $parts[2] . '/' . $parts[1] . '/' . $parts[0];
    return $isoDate;
}

/**
 * Envoi SMTP direct — réutilise la même approche que alerts.php (compatible ASUSTOR NAS).
 * Identique à sendAlertMailSMTP() de alerts.php, dupliquée ici pour l'indépendance du module.
 */
function sendPisuMailSMTP($to, $subject, $body) {
    // Récupère la config SMTP depuis alerts.php via les constantes si déjà définies,
    // sinon charge directement depuis config.php (les constantes SMTP sont définies dans alerts.php).
    // Pour l'indépendance du module, on duplique les paramètres SMTP ici.
    $host     = defined('SMTP_HOST')     ? SMTP_HOST     : envVar('SMTP_HOST', 'smtp.gmail.com');
    $port     = defined('SMTP_PORT')     ? SMTP_PORT     : (int)envVar('SMTP_PORT', 587);
    $user     = defined('SMTP_USER')     ? SMTP_USER     : envVar('SMTP_USER', '');
    $pass     = defined('SMTP_PASSWORD') ? SMTP_PASSWORD : envVar('SMTP_PASSWORD', '');
    $from     = defined('SMTP_FROM')     ? SMTP_FROM     : envVar('SMTP_FROM', $user);
    $fromName = defined('SMTP_NAME')     ? SMTP_NAME     : envVar('SMTP_NAME', 'Inventaire TMC');
    $useTls   = defined('SMTP_USE_TLS')  ? SMTP_USE_TLS  : filter_var(envVar('SMTP_USE_TLS', true), FILTER_VALIDATE_BOOLEAN);

    if (empty($user) || empty($pass)) {
        @file_put_contents(DATA_DIR . '/pisu_mail.log',
            date('Y-m-d H:i:s') . " | SMTP config manquante\n", FILE_APPEND);
        return false;
    }

    $errno = 0; $errstr = '';
    $socket = $useTls
        ? @fsockopen($host, $port, $errno, $errstr, 15)
        : @fsockopen('ssl://' . $host, $port, $errno, $errstr, 15);

    if (!$socket) {
        @file_put_contents(DATA_DIR . '/pisu_mail.log',
            date('Y-m-d H:i:s') . " | Connect failed: $errstr ($errno)\n", FILE_APPEND);
        return false;
    }

    $read = function() use ($socket) { return fgets($socket, 512); };
    $send = function($cmd) use ($socket) { fputs($socket, $cmd . "\r\n"); };

    $read(); // Bannière
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
        @file_put_contents(DATA_DIR . '/pisu_mail.log',
            date('Y-m-d H:i:s') . " | AUTH FAILED: $authResp\n", FILE_APPEND);
        return false;
    }

    $send("MAIL FROM: <$from>");  $read();
    $send("RCPT TO: <$to>");      $read();
    $send('DATA');                $read();

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

// Route non reconnue
sendJSON(['error' => 'Action non supportée.'], 400);
?>
