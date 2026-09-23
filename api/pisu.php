<?php
/**
 * api/pisu.php
 * API de gestion du PISU �?" version multi-infirmiers.
 *
 * Chaque infirmier possède ses propres fichiers de données :
 *   data/pisu_<login>.json        �?" liste des médicaments
 *   data/pisu_config_<login>.json �?" configuration (alert_days, email)
 *
 * Routes publiques (sans auth) :
 *   GET  ?action=status
 *   POST ?action=login
 *   GET  ?action=list_infirmiers   �?� liste des comptes rôle infirmier
 *   GET  ?action=public_count&infirmier=<login>
 *
 * Routes protégées (session pisu_logged_in OU session admin) :
 *   POST ?action=logout
 *   GET  ?action=list
 *   POST ?action=add
 *   POST ?action=edit
 *   POST ?action=delete
 *   POST ?action=save_config
 *   POST ?action=send_alerts
 */

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? $_GET['action'] : '';

// �"?�"? Résolution de l'infirmier actif �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// Priorité : session (utilisateur connecté) > paramètre GET (public_count uniquement)
function getActiveLogin() {
    if (!empty($_SESSION['pisu_user_login'])) {
        return $_SESSION['pisu_user_login'];
    }
    // Pour les admins connectés via la session principale sans avoir choisi un infirmier PISU
    if (!empty($_SESSION['logged_in']) && !empty($_SESSION['pisu_context_login'])) {
        return $_SESSION['pisu_context_login'];
    }
    return null;
}

function pisuDataFile($login) {
    $safe = preg_replace('/[^a-z0-9_]/', '', strtolower($login));
    return DATA_DIR . '/pisu_' . $safe . '.json';
}

function pisuConfigFile($login) {
    $safe = preg_replace('/[^a-z0-9_]/', '', strtolower($login));
    return DATA_DIR . '/pisu_config_' . $safe . '.json';
}

// �"?�"? Helpers données �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function loadPisu($login) {
    $f = pisuDataFile($login);
    if (!file_exists($f)) return [];
    return json_decode(file_get_contents($f), true) ?: [];
}

function savePisu($login, $items) {
    $json = json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents(pisuDataFile($login), $json) !== false;
}

function loadPisuConfig($login) {
    $f = pisuConfigFile($login);
    if (!file_exists($f)) return ['alert_days' => 30, 'email' => ''];
    return json_decode(file_get_contents($f), true) ?: ['alert_days' => 30, 'email' => ''];
}

function savePisuConfig($login, $config) {
    $json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents(pisuConfigFile($login), $json) !== false;
}

// �"?�"? Auth �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function isAdminSession() {
    return !empty($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
}

function isPisuSession() {
    return !empty($_SESSION['pisu_logged_in']) && $_SESSION['pisu_logged_in'] === true;
}

function requirePisuAuth() {
    if (isAdminSession() || isPisuSession()) return;
    sendJSON(['error' => 'Authentification PISU requise.'], 401);
}

// �"?�"? Lecture des infirmiers depuis users.json �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function loadInfirmiers() {
    if (!file_exists(USERS_FILE)) return [];
    $users = json_decode(file_get_contents(USERS_FILE), true) ?: [];
    $result = [];
    foreach ($users as $u) {
        if (userHasAnyRole($u, ['infirmier', 'admin', 'superadmin'])) {
            // N'inclure dans la liste de sélection que les vrais infirmiers
            // (pas les admins qui y ont accès en coulisses)
            if (userHasAnyRole($u, ['infirmier'])) {
                $result[] = [
                    'login' => $u['login'],
                    'name'  => $u['name'],
                ];
            }
        }
    }
    return $result;
}

// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// ROUTING �?" HTTP uniquement (cron include ne passe pas ici)
// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if (isset($_SERVER['REQUEST_METHOD'])) {

// �"?�"? Liste des infirmiers (publique) �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'list_infirmiers' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    sendJSON(['infirmiers' => loadInfirmiers()]);
}

// �"?�"? Statut de session �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $isAdmin    = isAdminSession();
    $isPisuUser = isPisuSession();

    if ($isAdmin || $isPisuUser) {
        $login = getActiveLogin();
        sendJSON([
            'logged_in' => true,
            'user' => [
                'name'  => $_SESSION['pisu_user_name'] ?? 'Administrateur',
                'login' => $login,
                'role'  => $isAdmin && !$isPisuUser ? 'admin' : 'infirmier',
            ]
        ]);
    } else {
        sendJSON(['logged_in' => false]);
    }
}

// �"?�"? Login PISU �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
	checkRateLimit('pisu_login');
    $input    = json_decode(file_get_contents('php://input'), true);
    $login    = trim($input['login']    ?? '');
    $password = trim($input['password'] ?? '');

    if (!$login || !$password || !file_exists(USERS_FILE)) {
        sendJSON(['error' => 'Identifiant ou mot de passe incorrect.'], 401);
    }

    $users = json_decode(file_get_contents(USERS_FILE), true) ?: [];
    $found = null;
    $foundIndex = null;
    foreach ($users as $index => $u) {
        if ($u['login'] === $login) {
            $found = $u;
            $foundIndex = $index;
            break;
        }
    }

    $passwordOk = false;
    if ($found && isset($found['password_hash'])) {
        $storedHash = $found['password_hash'];
        $isLegacySha256 = (strlen($storedHash) === 64 && ctype_xdigit($storedHash));

        if ($isLegacySha256) {
            if (hash('sha256', $password) === $storedHash) {
                $passwordOk = true;
                $users[$foundIndex]['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
                @file_put_contents(
                    USERS_FILE,
                    json_encode(array_values($users), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
                );
            }
        } else {
            $passwordOk = password_verify($password, $storedHash);
        }
    }

    if (!$found || !$passwordOk) {
		recordFailedAttempt('pisu_login');
        sendJSON(['error' => 'Identifiant ou mot de passe incorrect.'], 401);
    }
	clearRateLimit('pisu_login');

    session_regenerate_id(true);

    $_SESSION['pisu_logged_in']  = true;
    $_SESSION['pisu_user_login'] = $found['login'];
    $_SESSION['pisu_user_name']  = $found['name'];

    // Seuls les infirmiers (et admins) peuvent se connecter via le PISU
    if (!userHasAnyRole($found, ['infirmier', 'admin', 'superadmin'])) {
        sendJSON(['error' => 'Accès non autorisé.'], 403);
    }

    // Un admin/superadmin qui se connecte via le login PISU doit avoir le rôle infirmier
    // (ou être explicitement autorisé). On autorise tout de même pour la supervision.
	session_regenerate_id(true);
    $_SESSION['pisu_logged_in']  = true;
    $_SESSION['pisu_user_login'] = $found['login'];
    $_SESSION['pisu_user_name']  = $found['name'];

    $roleList = normalizeUserRoles($found);
    $role = primaryRoleFromList($roleList);

    sendJSON(['success' => true, 'user' => ['name' => $found['name'], 'login' => $found['login'], 'role' => $role]]);
}

// �"?�"? Logout PISU �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $wasLoggedIn = isPisuSession() || isAdminSession();
    unset($_SESSION['pisu_logged_in'], $_SESSION['pisu_user_login'], $_SESSION['pisu_user_name'],
          $_SESSION['pisu_user_role'], $_SESSION['pisu_context_login']);
    if (!$wasLoggedIn) {
        sendJSON(['error' => 'Aucune session PISU active.'], 401);
    }
    sendJSON(['success' => true]);
}

// �"?�"? Compteur public (tuile index.php) �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'public_count' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    // Agrège tous les infirmiers OU filtre sur un login spécifique
    $filterLogin = isset($_GET['infirmier']) ? trim($_GET['infirmier']) : null;
    $infirmiers  = loadInfirmiers();

    $total = $expiring = $expired = 0;
    $now   = new DateTime();

    foreach ($infirmiers as $inf) {
        if ($filterLogin && $inf['login'] !== $filterLogin) continue;
        $items  = loadPisu($inf['login']);
        $config = loadPisuConfig($inf['login']);
        $alertDays = isset($config['alert_days']) ? (int)$config['alert_days'] : 30;

        foreach ($items as $item) {
            $total++;
            if (empty($item['expiry_date'])) continue;
            try {
                $expiry = new DateTime($item['expiry_date']);
                $diff   = (int)$now->diff($expiry)->format('%r%a');
                if ($diff < 0)            $expired++;
                elseif ($diff <= $alertDays) $expiring++;
            } catch (Exception $e) { /* ignorée */ }
        }
    }

    sendJSON(['total' => $total, 'expiring' => $expiring, 'expired' => $expired]);
}

// �"?�"? �? partir d'ici : auth requise �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
requirePisuAuth();

// Résolution du login actif (infirmier connecté)
$activeLogin = getActiveLogin();
if (!$activeLogin) {
    sendJSON(['error' => 'Contexte infirmier indéterminé.'], 400);
}

// �"?�"? Liste des médicaments �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $items  = loadPisu($activeLogin);
    $config = loadPisuConfig($activeLogin);
    $now    = new DateTime();
    $alertDays = isset($config['alert_days']) ? (int)$config['alert_days'] : 30;

    foreach ($items as &$item) {
        if (!empty($item['expiry_date'])) {
            try {
                $expiry = new DateTime($item['expiry_date']);
                $diff   = (int)$now->diff($expiry)->format('%r%a');
                if ($diff < 0) {
                    $item['_status'] = 'expired';
                    $item['_days']   = abs($diff);
                } elseif ($diff <= $alertDays) {
                    $item['_status'] = 'expiring';
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

// �"?�"? Ajout �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'add' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['name'])) {
        sendJSON(['error' => 'Le nom du médicament est obligatoire.'], 400);
    }

    $item = [
        'id'          => uniqid('med_'),
        'name'        => trim($input['name']),
        'dosage'      => isset($input['dosage'])      ? trim($input['dosage'])      : '',
        'form'        => isset($input['form'])        ? trim($input['form'])        : '',
        'quantity'    => isset($input['quantity'])    ? (int)$input['quantity']     : 0,
        'expiry_date' => isset($input['expiry_date']) ? trim($input['expiry_date']) : '',
        'notes'       => isset($input['notes'])       ? trim($input['notes'])       : '',
        'created_at'  => date('Y-m-d H:i:s'),
        'updated_at'  => date('Y-m-d H:i:s'),
    ];

    $items   = loadPisu($activeLogin);
    $items[] = $item;

    if (!savePisu($activeLogin, $items)) {
        sendJSON(['error' => 'Erreur lors de la sauvegarde.'], 500);
    }

    sendJSON(['success' => true, 'item' => $item]);
}

// �"?�"? Modification �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'edit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['id']) || empty($input['name'])) {
        sendJSON(['error' => 'ID et nom requis.'], 400);
    }

    $items = loadPisu($activeLogin);
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

    if (!$found) sendJSON(['error' => 'Médicament introuvable.'], 404);
    if (!savePisu($activeLogin, $items)) sendJSON(['error' => 'Erreur lors de la sauvegarde.'], 500);

    sendJSON(['success' => true]);
}

// �"?�"? Suppression �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['id'])) {
        sendJSON(['error' => 'ID requis.'], 400);
    }

    $items    = loadPisu($activeLogin);
    $filtered = array_filter($items, function($i) use ($input) {
        return $i['id'] !== $input['id'];
    });

    if (count($filtered) === count($items)) sendJSON(['error' => 'Médicament introuvable.'], 404);
    if (!savePisu($activeLogin, $filtered)) sendJSON(['error' => 'Erreur lors de la suppression.'], 500);

    sendJSON(['success' => true]);
}

// �"?�"? Config �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'save_config' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) sendJSON(['error' => 'Données invalides.'], 400);

    $config = [
        'alert_days' => isset($input['alert_days']) ? max(1, (int)$input['alert_days']) : 30,
        'email'      => isset($input['email'])      ? trim($input['email'])              : '',
    ];

    if (!savePisuConfig($activeLogin, $config)) {
        sendJSON(['error' => 'Impossible de sauvegarder la configuration.'], 500);
    }

    sendJSON(['success' => true, 'config' => $config]);
}

// �"?�"? Envoi alertes manuel �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if ($action === 'send_alerts' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $result = runPisuAlerts($activeLogin);
    sendJSON($result);
}

} // fin if (isset($_SERVER['REQUEST_METHOD']))

// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// FONCTIONS M�?TIER (utilisées aussi par pisu_cron.php)
// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?

/**
 * Envoie les alertes d'expiration pour UN infirmier.
 */
function runPisuAlerts($login) {
    $items  = loadPisu($login);
    $config = loadPisuConfig($login);

    $alertDays = isset($config['alert_days']) ? (int)$config['alert_days'] : 30;
    $email     = isset($config['email'])      ? $config['email']           : '';

    if (empty($email)) {
        return ['error' => 'Aucun e-mail destinataire configuré.', 'sent' => false];
    }

    $now      = new DateTime();
    $expiring = [];
    $expired  = [];

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
        } catch (Exception $e) { /* ignorée */ }
    }

    if (empty($expiring) && empty($expired)) {
        return ['success' => true, 'message' => 'Aucun médicament à alerter.', 'sent' => false,
                'expired' => 0, 'expiring' => 0];
    }

    $subject = '[PISU Caserne] '
             . (empty($expired)  ? '' : count($expired)  . ' périmé(s) �?" ')
             . (empty($expiring) ? '' : count($expiring) . ' bientôt périmé(s)');

    $body  = "Bonjour,\n\n";
    $body .= "Rapport d'expiration PISU �?" Caserne.\n\n";

    if (!empty($expired)) {
        $body .= "�.��.��.� M�?DICAMENTS P�?RIM�?S (" . count($expired) . ") �.��.��.�\n";
        foreach ($expired as $m) {
            $body .= "  �?� " . $m['name'];
            if (!empty($m['dosage'])) $body .= " " . $m['dosage'];
            if (!empty($m['form']))   $body .= " �?" " . $m['form'];
            $body .= "\n    Qté : " . $m['quantity'];
            $body .= " | Périmé depuis " . $m['_days_overdue'] . " jour(s)";
            $body .= " (échéance : " . formatDateFR($m['expiry_date']) . ")\n";
            if (!empty($m['notes'])) $body .= "    Note : " . $m['notes'] . "\n";
            $body .= "\n";
        }
    }

    if (!empty($expiring)) {
        $body .= "�.��.��.� M�?DICAMENTS BIENT�"T P�?RIM�?S (" . count($expiring) . ") �.��.��.�\n";
        foreach ($expiring as $m) {
            $body .= "  �?� " . $m['name'];
            if (!empty($m['dosage'])) $body .= " " . $m['dosage'];
            if (!empty($m['form']))   $body .= " �?" " . $m['form'];
            $body .= "\n    Qté : " . $m['quantity'];
            $body .= " | Expire dans " . $m['_days_left'] . " jour(s)";
            $body .= " (échéance : " . formatDateFR($m['expiry_date']) . ")\n";
            if (!empty($m['notes'])) $body .= "    Note : " . $m['notes'] . "\n";
            $body .= "\n";
        }
    }

    $body .= "Connectez-vous à l'espace PISU pour gérer les échanges.\n";
    $body .= "Date du rapport : " . date('d/m/Y à H:i') . "\n\n";
    $body .= "-- Message automatique Inventaire Pompier --";

    $sent = sendPisuMailSMTP($email, $subject, $body);

    @file_put_contents(DATA_DIR . '/pisu_mail.log',
        date('Y-m-d H:i:s') . " | Login: $login | To: $email | " . ($sent ? "OK" : "FAILED")
        . " | Expired: " . count($expired) . " | Expiring: " . count($expiring) . "\n",
        FILE_APPEND
    );

    return [
        'success'  => $sent,
        'message'  => $sent ? 'E-mail envoyé avec succès.' : "�?chec de l'envoi (voir pisu_mail.log).",
        'sent'     => $sent,
        'expired'  => count($expired),
        'expiring' => count($expiring),
    ];
}

function formatDateFR($isoDate) {
    if (empty($isoDate)) return '�?"';
    $parts = explode('-', $isoDate);
    if (count($parts) === 3) return $parts[2] . '/' . $parts[1] . '/' . $parts[0];
    return $isoDate;
}

function sendPisuMailSMTP($to, $subject, $body) {
    $host     = defined('SMTP_HOST')     ? SMTP_HOST     : envVar('SMTP_HOST', 'smtp.gmail.com');
    $port     = defined('SMTP_PORT')     ? SMTP_PORT     : (int)envVar('SMTP_PORT', 587);
    $user     = defined('SMTP_USER')     ? SMTP_USER     : envVar('SMTP_USER', '');
    $pass     = defined('SMTP_PASSWORD') ? SMTP_PASSWORD : envVar('SMTP_PASSWORD', '');
    $from     = defined('SMTP_FROM')     ? SMTP_FROM     : envVar('SMTP_FROM', $user);
    $fromName = defined('SMTP_NAME')     ? SMTP_NAME     : envVar('SMTP_NAME', 'Inventaire Pompier');
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
if (isset($_SERVER['REQUEST_METHOD'])) {
    sendJSON(['error' => 'Action non supportée.'], 400);
}
?>
