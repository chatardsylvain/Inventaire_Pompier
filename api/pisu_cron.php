<?php
/**
 * api/pisu_cron.php
 * Script appelable par cron pour envoyer automatiquement les alertes d'expiration PISU.
 *
 * Usage (dans crontab) :
 *   0 8 * * * /usr/bin/php /volume1/Web/stock-tmc/api/pisu_cron.php >> /volume1/Web/stock-tmc/data/pisu_cron.log 2>&1
 * 
 * Cette commande envoie les alertes chaque jour à 8h du matin.
 */

// Pas de session ni d'authentification requises pour le cron
// (ce script vérifie juste que la config est valide avant d'envoyer)

require_once __DIR__ . '/config.php';

// Inclusion du fichier pisu.php pour accéder à la fonction runPisuAlerts
require_once __DIR__ . '/pisu.php';

// Exécution de la fonction d'alerte
$result = runPisuAlerts();

// Log du résultat
$logFile = DATA_DIR . '/pisu_cron.log';
$logEntry = date('Y-m-d H:i:s') . " | " . ($result['sent'] ? "✓ OK" : "✗ FAILED") . " | "
          . ($result['expired'] ?? 0) . " expired, " . ($result['expiring'] ?? 0) . " expiring"
          . " | " . ($result['message'] ?? $result['error'] ?? 'No message') . "\n";

@file_put_contents($logFile, $logEntry, FILE_APPEND);

// Optionnellement, afficher sur stdout pour les logs du serveur
echo $logEntry;
exit(0);
?>
