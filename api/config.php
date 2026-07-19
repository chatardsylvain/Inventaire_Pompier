<?php
/**
 * api/config.php
 * Fichier de configuration globale du backend de l'application d'inventaire.
 * Ce fichier centralise le démarrage des sessions, définit les constantes de chemin,
 * charge les variables d'environnement sensibles (.env), et propose des fonctions
 * d'assistance communes (sécurité et réponses JSON).
 */

// Chargement des variables d'environnement (.env) — DOIT être fait avant tout le reste
require_once __DIR__ . '/env.php';

// Initialisation de la session PHP pour gérer l'authentification des administrateurs
session_start();

// Constante : Chemin absolu vers le dossier contenant les fichiers JSON des véhicules
define('DATA_DIR', __DIR__ . '/../data');

// Constante : Chemin absolu vers le fichier de stockage des administrateurs
define('USERS_FILE', '/chemin/vers/vos/secrets/users.json');

/**
 * Envoie une réponse HTTP au format JSON et arrête l'exécution du script.
 * 
 * Ajoute des en-têtes HTTP de sécurité pour empêcher les navigateurs et proxys
 * de mettre en cache les données dynamiques (évite les bugs d'affichage après sauvegarde).
 *
 * @param mixed $data Les données à encoder en JSON (tableau ou objet).
 * @param int $status Le code de statut HTTP à renvoyer (200 par défaut).
 */
function sendJSON($data, $status = 200) {
    // Spécifie au navigateur que le contenu retourné est du JSON encodé en UTF-8
    header('Content-Type: application/json; charset=utf-8');
    
    // En-têtes HTTP anti-cache stricts
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Cache-Control: post-check=0, pre-check=0', false);
    header('Pragma: no-cache');
    
    // Définit le code de statut HTTP de la réponse (ex: 200 OK, 400 Bad Request, 500 Server Error)
    http_response_code($status);
    
    // Encode et affiche les données en préservant les caractères spéciaux/accents (UNESCAPED_UNICODE)
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Vérifie si l'utilisateur connecté dispose d'une session d'administration valide.
 * Si l'utilisateur n'est pas connecté, renvoie une erreur JSON 401 et bloque l'exécution.
 */
function requireAuth() {
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        sendJSON(['error' => 'Non authentifié. Veuillez vous connecter.'], 401);
    }
}

/**
 * Récupère une variable d'environnement (.env) avec valeur par défaut optionnelle.
 * Centralise l'accès pour éviter de disperser des appels getenv() partout.
 *
 * @param string $key Nom de la variable (ex: 'SMTP_HOST')
 * @param mixed $default Valeur retournée si la variable est absente
 * @return mixed
 */
function envVar(string $key, $default = null) {
    $value = getenv($key);
    return ($value === false) ? $default : $value;
}

// -------------------------------------------------------------------------
// RATE LIMITING — Protection anti brute-force sur les endpoints sensibles
// -------------------------------------------------------------------------

define('RATE_LIMIT_FILE', '/chemin/vers/vos/secrets/rate_limit.json');
define('RATE_LIMIT_MAX_ATTEMPTS', 5);      // Nombre d'échecs autorisés
define('RATE_LIMIT_WINDOW', 900);          // Fenêtre glissante : 15 minutes (en secondes)
define('RATE_LIMIT_BLOCK_DURATION', 900);  // Durée du blocage une fois le seuil dépassé

/**
 * Charge le fichier de suivi des tentatives, en purgeant les entrées expirées.
 */
function loadRateLimitData() {
    if (!file_exists(RATE_LIMIT_FILE)) {
        return [];
    }
    $data = json_decode(file_get_contents(RATE_LIMIT_FILE), true);
    if (!is_array($data)) {
        return [];
    }
    $now = time();
    // Purge les entrées dont le blocage et la fenêtre sont expirés
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

/**
 * Construit une clé de suivi unique : IP + contexte (ex: "login", "alert").
 */
function rateLimitKey($context) {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    return $context . '|' . $ip;
}

/**
 * Vérifie si la clé donnée est actuellement bloquée.
 * Si bloquée, envoie directement une réponse 429 et arrête l'exécution.
 */
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

/**
 * Enregistre une tentative échouée. Déclenche un blocage si le seuil est dépassé.
 */
function recordFailedAttempt($context) {
    $data = loadRateLimitData();
    $key = rateLimitKey($context);
    $now = time();

    if (!isset($data[$key])) {
        $data[$key] = ['count' => 0, 'first_attempt' => $now, 'last_attempt' => $now, 'blocked_until' => 0];
    }

    // Réinitialise le compteur si la fenêtre glissante est dépassée
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

/**
 * Réinitialise le compteur d'une clé (à appeler après un succès, ex: login réussi).
 */
function clearRateLimit($context) {
    $data = loadRateLimitData();
    $key = rateLimitKey($context);
    if (isset($data[$key])) {
        unset($data[$key]);
        saveRateLimitData($data);
    }
}
?>
