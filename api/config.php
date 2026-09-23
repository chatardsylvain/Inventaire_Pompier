?<?php
/**
 * api/config.php
 * Fichier de configuration globale du backend de l'application d'inventaire.
 * Ce fichier centralise le démarrage des sessions, définit les constantes de chemin,
 * charge les variables d'environnement sensibles (.env), et propose des fonctions
 * d'assistance communes (sécurité et réponses JSON).
 *
 * Modifié le 2026-09-02 �?" Ajout des rôles chef_caserne et adjoint
 */

// Chargement des variables d'environnement (.env) �?" DOIT être fait avant tout le reste
require_once __DIR__ . '/env.php';

// === SANDBOX �?" désactive les envois mail ===
putenv('SMTP_USER='); //à retirer pour la prod
putenv('SMTP_PASSWORD='); //à retirer pour la prod

// Initialisation de la session PHP pour gérer l'authentification des administrateurs
session_name('INVENTAIRE_DEV'); //à retirer pour la prod
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'Lax');
session_start();

// mode sandbox pour affichage bandeau
define('SANDBOX_MODE', true);

// Constante : Chemin absolu vers le dossier contenant les fichiers JSON des véhicules
define('DATA_DIR', __DIR__ . '/../data');

// Constante : Chemin absolu vers le fichier de stockage des administrateurs
// Fichier des utilisateurs (universel dans data/ ou spécifique NAS)
$usersFile = file_exists('c:\Users\Utilisateur\.gemini\antigravity\scratch\Inventaire_dev\Secrets\users_dev.json') ? 'c:\Users\Utilisateur\.gemini\antigravity\scratch\Inventaire_dev\Secrets\users_dev.json' : __DIR__ . '/../data/users.json';
define('USERS_FILE', $usersFile);

/**
 * Envoie une réponse HTTP au format JSON et arrête l'exécution du script.
 */
function sendJSON($data, $status = 200) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Cache-Control: post-check=0, pre-check=0', false);
    header('Pragma: no-cache');
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Vérifie si l'utilisateur connecté dispose d'une session d'administration valide.
 */
function requireAuth() {
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        sendJSON(['error' => 'Non authentifié. Veuillez vous connecter.'], 401);
    }
}

/**
 * Clés de rôles attribuables, dans l'ordre de priorité/affichage.
 * chef_caserne et adjoint : accès contributeur + responsable_vehicule + correspondant_pharmacie
 */
function appRoleKeys() {
    return [
        'superadmin',
        'admin',
        'chef_caserne',
        'adjoint',
        'infirmier',
        'correspondant_pharmacie',
        'responsable_vehicule',
        'contributeur',
    ];
}

/**
 * Rôles fonctionnels (hors superadmin), utilisés pour l'expansion admin.
 */
function functionalRoleKeys() {
    return [
        'admin',
        'chef_caserne',
        'adjoint',
        'infirmier',
        'correspondant_pharmacie',
        'responsable_vehicule',
        'contributeur',
    ];
}

/**
 * Rôles accordés automatiquement à chef_caserne et adjoint.
 * Périmètre : contributeur + responsable_vehicule + correspondant_pharmacie
 */
function chefAdjointImpliedRoles() {
    return [
        'correspondant_pharmacie',
        'responsable_vehicule',
        'contributeur',
    ];
}

/**
 * Rôles d'un enregistrement utilisateur (compat ancien champ `role` string).
 */
function normalizeUserRoles($user) {
    if (isset($user['roles']) && is_array($user['roles'])) {
        $roles = $user['roles'];
    } elseif (!empty($user['role'])) {
        $roles = [$user['role']];
    } else {
        $roles = ['contributeur'];
    }
    return expandAssignedRoles($roles, true);
}

/**
 * Expansion des rôles assignés :
 * - superadmin �?' tous les rôles
 * - admin       �?' tous les rôles fonctionnels
 * - chef_caserne / adjoint �?' contributeur + responsable_vehicule + correspondant_pharmacie
 */
function expandAssignedRoles(array $roles, $allowSuperadmin = true) {
    $valid = appRoleKeys();
    $roles = array_values(array_unique(array_intersect($roles, $valid)));
    $hasSuper  = in_array('superadmin', $roles, true);
    $hasAdmin  = in_array('admin', $roles, true);
    $hasChef   = in_array('chef_caserne', $roles, true);
    $hasAdjoint = in_array('adjoint', $roles, true);

    if ($hasSuper && $allowSuperadmin) {
        return $valid;
    }
    if ($hasSuper && !$allowSuperadmin) {
        $hasAdmin = true;
    }
    if ($hasAdmin) {
        return functionalRoleKeys();
    }
    // Expansion chef_caserne / adjoint
    if ($hasChef || $hasAdjoint) {
        $implied = chefAdjointImpliedRoles();
        $roles = array_values(array_unique(array_merge($roles, $implied)));
    }
    if (empty($roles)) {
        return ['contributeur'];
    }
    return $roles;
}

function primaryRoleFromList(array $roles) {
    foreach (appRoleKeys() as $role) {
        if (in_array($role, $roles, true)) {
            return $role;
        }
    }
    return 'contributeur';
}

function sessionRoles() {
    if (!empty($_SESSION['roles']) && is_array($_SESSION['roles'])) {
        return $_SESSION['roles'];
    }
    if (!empty($_SESSION['role'])) {
        return [$_SESSION['role']];
    }
    return [];
}

/**
 * True si la session possède au moins un des rôles demandés.
 */
function sessionHasAnyRole(array $allowed) {
    $roles = sessionRoles();
    if (in_array('superadmin', $roles, true)) {
        return true;
    }
    $allowedFunctional = array_values(array_diff($allowed, ['superadmin']));
    if (in_array('admin', $roles, true) && !empty($allowedFunctional)) {
        return true;
    }
    // chef_caserne et adjoint ont accès aux sections de leur périmètre
    $chefPerm = chefAdjointImpliedRoles();
    foreach (['chef_caserne', 'adjoint'] as $cr) {
        if (in_array($cr, $roles, true)) {
            $overlap = array_intersect($allowed, array_merge([$cr], $chefPerm));
            if (!empty($overlap)) return true;
        }
    }
    return count(array_intersect($roles, $allowed)) > 0;
}

function userHasAnyRole($user, array $allowed) {
    $roles = normalizeUserRoles($user);
    if (in_array('superadmin', $roles, true)) {
        return true;
    }
    $allowedFunctional = array_values(array_diff($allowed, ['superadmin']));
    if (in_array('admin', $roles, true) && !empty($allowedFunctional)) {
        return true;
    }
    return count(array_intersect($roles, $allowed)) > 0;
}

function fullNameFromParts($firstName, $lastName) {
    return trim($firstName . ' ' . $lastName);
}

/**
 * Récupère une variable d'environnement (.env) avec valeur par défaut optionnelle.
 */
function envVar(string $key, $default = null) {
    $value = getenv($key);
    return ($value === false) ? $default : $value;
}

// -------------------------------------------------------------------------
// RATE LIMITING �?" Protection anti brute-force sur les endpoints sensibles
// -------------------------------------------------------------------------

$rateLimitFile = file_exists('c:\Users\Utilisateur\.gemini\antigravity\scratch\Inventaire_dev\Secrets\rate_limit.json') ? 'c:\Users\Utilisateur\.gemini\antigravity\scratch\Inventaire_dev\Secrets\rate_limit.json' : __DIR__ . '/../data/rate_limit.json';
define('RATE_LIMIT_FILE', $rateLimitFile);
define('RATE_LIMIT_MAX_ATTEMPTS', 5);
define('RATE_LIMIT_WINDOW', 900);
define('RATE_LIMIT_BLOCK_DURATION', 900);

function loadRateLimitData() {
    if (!file_exists(RATE_LIMIT_FILE)) {
        return [];
    }
    $data = json_decode(file_get_contents(RATE_LIMIT_FILE), true);
    if (!is_array($data)) {
        return [];
    }
    $now = time();
    foreach ($data as $key => $entry) {
        $lastAttempt = isset($entry['last_attempt']) ? $entry['last_attempt'] : 0;
        $blockedUntil = isset($entry['blocked_until']) ? $entry['blocked_until'] : 0;
        if ($blockedUntil < $now && ($now - $lastAttempt) > RATE_LIMIT_WINDOW) {
            unset($data[$key]);
        }
    }
    return $data;
}

function saveRateLimitData($data) {
    @file_put_contents(RATE_LIMIT_FILE, json_encode($data, JSON_PRETTY_PRINT));
}

function rateLimitKey($context) {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    return $context . '|' . $ip;
}

function checkRateLimit($context) {
    $data = loadRateLimitData();
    $key = rateLimitKey($context);
    $now = time();
    if (isset($data[$key]) && $data[$key]['blocked_until'] > $now) {
        $remaining = $data[$key]['blocked_until'] - $now;
        $minutes = ceil($remaining / 60);
        sendJSON([
            'error' => "Trop de tentatives échouées. Réessayez dans {$minutes} minute(s)."
        ], 429);
    }
}

function recordFailedAttempt($context) {
    $data = loadRateLimitData();
    $key = rateLimitKey($context);
    $now = time();
    if (!isset($data[$key])) {
        $data[$key] = ['count' => 0, 'first_attempt' => $now, 'last_attempt' => $now, 'blocked_until' => 0];
    }
    if (($now - $data[$key]['first_attempt']) > RATE_LIMIT_WINDOW) {
        $data[$key] = ['count' => 0, 'first_attempt' => $now, 'last_attempt' => $now, 'blocked_until' => 0];
    }
    $data[$key]['count']++;
    $data[$key]['last_attempt'] = $now;
    if ($data[$key]['count'] >= RATE_LIMIT_MAX_ATTEMPTS) {
        $data[$key]['blocked_until'] = $now + RATE_LIMIT_BLOCK_DURATION;
    }
    saveRateLimitData($data);
}

function clearRateLimit($context) {
    $data = loadRateLimitData();
    $key = rateLimitKey($context);
    if (isset($data[$key])) {
        unset($data[$key]);
        saveRateLimitData($data);
    }
}
?>

