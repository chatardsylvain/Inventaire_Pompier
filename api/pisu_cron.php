<?php
/**
 * api/pisu_cron.php
 * Cron d'alertes PISU �?" version multi-infirmiers.
 * Itère sur tous les comptes infirmier et envoie une alerte par compte si nécessaire.
 *
 * Usage (crontab) :
 *   0 8 * * * /usr/local/bin/php /volume1/Web/Inventaire_Pompier/api/pisu_cron.php >> /volume1/Web/Inventaire_Pompier/data/pisu_cron.log 2>&1
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/pisu.php';

// Charger la liste des infirmiers depuis users.json
if (!file_exists(USERS_FILE)) {
    echo date('Y-m-d H:i:s') . " | �o- FAILED | users.json introuvable\n";
    exit(1);
}

$users = json_decode(file_get_contents(USERS_FILE), true) ?: [];
$infirmiers = [];
foreach ($users as $u) {
    if (userHasAnyRole($u, ['infirmier'])) {
        $infirmiers[] = $u['login'];
    }
}

if (empty($infirmiers)) {
    echo date('Y-m-d H:i:s') . " | �?" Aucun infirmier trouvé\n";
    exit(0);
}

$logFile = DATA_DIR . '/pisu_cron.log';

foreach ($infirmiers as $login) {
    $result = runPisuAlerts($login);

    $logEntry = date('Y-m-d H:i:s') . " | " . $login . " | "
              . ($result['sent'] ? "�o" OK" : "�?" Pas d'envoi") . " | "
              . ($result['expired']  ?? 0) . " expired, "
              . ($result['expiring'] ?? 0) . " expiring"
              . " | " . ($result['message'] ?? $result['error'] ?? 'No message') . "\n";

    @file_put_contents($logFile, $logEntry, FILE_APPEND);
    echo $logEntry;
}

exit(0);
?>
