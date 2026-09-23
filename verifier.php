<?php
require_once __DIR__ . '/api/config.php';

$logFile = __DIR__ . '/debug_mobiles.txt';
$userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : 'Inconnu';
$ip = $_SERVER['REMOTE_ADDR'];
$date = date('Y-m-d H:i:s');
$cookieState = isset($_COOKIE['site_autorise']) ? $_COOKIE['site_autorise'] : 'ABSENT';

// NOUVELLES INFOS RETROUVÉES
$langue = isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? explode(',', $_SERVER['HTTP_ACCEPT_LANGUAGE'])[0] : 'Inconnue';
$provenance = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : 'Direct/QR-Code';

// Structure mise à jour
$line = "[$date] IP: $ip | Cookie: $cookieState | Langue: $langue | Origine: $provenance | UA: $userAgent\n";
file_put_contents($logFile, $line, FILE_APPEND);

// Clé secrète chargée depuis le fichier .env (voir .env.example à la racine du projet)
$cle_secrete = envVar('CLE_SECRETE_ACCES', '');

// Anti-bruteforce : utilise le système générique déjà défini dans api/config.php.
// Bloque immédiatement (réponse 429) si cette IP a déjà dépassé le quota d'échecs
// sur ce contexte ("access"), avant même de vérifier la clé.
checkRateLimit('access');

// On vérifie si la clé dans l'URL correspond
if (!empty($cle_secrete) && isset($_GET['cle']) && $_GET['cle'] === $cle_secrete) {

    // Succès : réinitialise le compteur d'échecs pour cette IP
    clearRateLimit('access');

    // Cookie version ultra-compatible pour l'auto-hébergement
    setcookie("site_autorise", "oui", [
        'expires' => time() + 2592000, // 30 jours
        'path' => '/',
        'secure' => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on'), // true si HTTPS, false sinon (compatible Freebox)
        'httponly' => true, // Durci : empêche tout accès au cookie via JavaScript (protection XSS)
        'samesite' => 'Lax'
    ]);

    // Redirection vers la page d'accueil
    header("Location: index.php");
    exit();
} else {
    // Échec : enregistre la tentative (déclenche un blocage 15 min après 5 échecs)
    recordFailedAttempt('access');
    header('HTTP/1.0 403 Forbidden');
    echo "<h1>Accès refusé</h1><p>Veuillez scanner le QR code officiel de la caserne.</p>";
    exit();
}
?>
