<?php
/**
 * api/ct_cron.php
 * Script cron pour les alertes de Contrôle Technique véhicules.
 *
 * �? planifier via la tâche planifiée QNAP ADM (ou crontab SSH) :
 *   0 8 * * * /usr/local/bin/php /volume1/Web/Inventaire_Pompier/api/ct_cron.php >> /volume1/Web/Inventaire_Pompier/data/ct_cron.log 2>&1
 *
 * Vérification manuelle (SSH) :
 *   /usr/local/bin/php /volume1/Web/Inventaire_Pompier/api/ct_cron.php
 *
 * Résultat attendu dans le log : lignes avec "�o" Mail envoyé" ou "�?" Ignoré".
 * Jamais : "Authentification requise" ou "Action ou méthode non supportée".
 */

// Inclusion de config.php pour DATA_DIR, USERS_FILE, envVar() etc.
require_once __DIR__ . '/config.php';

// Inclusion de ct.php �?" le bloc HTTP (routing) est ignoré car
// $_SERVER['REQUEST_METHOD'] n'est pas défini en contexte CLI.
require_once __DIR__ . '/ct.php';

echo date('Y-m-d H:i:s') . " | [ct_cron] Démarrage\n";

$result = runCtAlerts(false); // false = mode normal (respecte les seuils déjà notifiés)

echo date('Y-m-d H:i:s') . " | [ct_cron] Terminé"
   . " | Envoyés: {$result['sent']}"
   . " | Ignorés: {$result['skipped']}\n";

if (!empty($result['log'])) {
    foreach ($result['log'] as $line) {
        echo "  {$line}\n";
    }
}
