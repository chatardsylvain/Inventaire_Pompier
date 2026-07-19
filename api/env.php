<?php
/**
 * api/env.php
 * Petit chargeur de fichier .env "maison", sans dépendance Composer.
 * Lit le fichier .env et injecte les valeurs dans $_ENV / getenv().
 *
 * Emplacement recherché : DEUX niveaux au-dessus de /api/, c'est-à-dire
 * un niveau au-dessus de la racine du projet Inventaire_TMC.
 * Ex: si le projet est dans /var/www/html/Inventaire_TMC/, le .env doit
 * être placé dans /var/www/html/.env — donc hors du dossier servi par Apache,
 * ce qui le rend inaccessible depuis le navigateur quel que soit le .htaccess.
 */

function loadEnv(string $path): void {
    if (!file_exists($path)) {
        // On ne bloque pas le site, mais on log l'absence pour diagnostic
        error_log("[env.php] Fichier .env introuvable : $path");
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);

        // Ignore les commentaires et lignes vides
        // (strpos utilisé au lieu de str_starts_with pour compatibilité PHP < 8.0)
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }

        // Sépare uniquement sur le premier "="
        // (strpos utilisé au lieu de str_contains pour compatibilité PHP < 8.0)
        if (strpos($line, '=') === false) {
            continue;
        }
        [$name, $value] = explode('=', $line, 2);
        $name  = trim($name);
        $value = trim($value);

        // Retire les guillemets englobants si présents (ex: SMTP_NAME="Inventaire TMC")
        if (strlen($value) >= 2) {
            $firstChar = $value[0];
            $lastChar  = $value[strlen($value) - 1];
            if (($firstChar === '"' && $lastChar === '"') || ($firstChar === "'" && $lastChar === "'")) {
                $value = substr($value, 1, -1);
            }
        }

        // N'écrase jamais une variable d'environnement déjà définie au niveau serveur
        if (getenv($name) === false) {
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

// Charge le .env situé à /var/www/html/.env (deux niveaux au-dessus de api/)
loadEnv(__DIR__ . '/../../.env');
?>
