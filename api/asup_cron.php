<?php
/**
 * api/asup_cron.php
 * Script appelable par cron pour envoyer automatiquement les alertes ASUP :
 *   - M�f©dicaments ASUP dont la p�f©remption est dans <= 14 jours
 *   - Contr�f´le mensuel non effectu�f© �f  J-14 avant la fin du mois
 *
 * Usage (�f  ajouter via `sudo crontab -e`) :
 *   0 8 * * * /usr/local/bin/php /volume1/Web/Inventaire_Pompier/api/asup_cron.php >> /volume1/Web/Inventaire_Pompier/data/asup_cron.log 2>&1
 *
 * Cette commande ex�f©cute le script chaque jour �f  8h.
 * Le mail n'est envoy�f© que si des alertes sont d�f©tect�f©es (p�f©remption imminente
 * ou contr�f´le mensuel manquant �f  J-14 de la fin du mois).
 *
 * Rapport annuel PDF :
 *   Le 31 d�f©cembre �f  8h, en plus des alertes habituelles, un rapport annuel
 *   JSON est g�f©n�f©r�f© et stock�f© dans data/asup_rapport_{YYYY}.json.
 *   La g�f©n�f©ration PDF depuis ce JSON est �f  planifier s�f©par�f©ment si besoin.
 */

// Pas de session ni d'authentification requises pour le cron
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/asup.php';

// ---------------------------------------------------------------------------
// Ex�f©cution des alertes J-14 (p�f©remption + contr�f´le manquant)
// ---------------------------------------------------------------------------
$result = runAsupAlerts();

$logFile  = DATA_DIR . '/asup_cron.log';
$logEntry = date('Y-m-d H:i:s') . " | "
          . ($result['sent'] ?? false ? "â�"�?o Mail envoy�f©" : "â�,��?� Pas d'envoi")
          . " | P�f©remptions: " . ($result['peremption_alerts'] ?? 0)
          . " | Contr�f´les manquants: " . ($result['missed_checks'] ?? 0)
          . " | " . ($result['message'] ?? $result['error'] ?? 'No message')
          . "\n";

@file_put_contents($logFile, $logEntry, FILE_APPEND);
echo $logEntry;

// ---------------------------------------------------------------------------
// Rapport annuel : d�f©clench�f© le 31 d�f©cembre
// ---------------------------------------------------------------------------
$today = new DateTime();
$isLastDayOfYear = ($today->format('m-d') === '12-31');

if ($isLastDayOfYear) {
    $year        = (int) $today->format('Y');
    $history     = loadAsupHistory();
    $yearHistory = array_values(array_filter($history, function($h) use ($year) {
        return isset($h['finished_at']) && (int) substr($h['finished_at'], 0, 4) === $year;
    }));

    usort($yearHistory, function($a, $b) {
        return strcmp($a['finished_at'] ?? '', $b['finished_at'] ?? '');
    });

    $completeChecks = 0;
    foreach ($yearHistory as $h) {
        if (($h['unchecked_count'] ?? 1) === 0) $completeChecks++;
    }

    $reportData = [
        'year'            => $year,
        'generated_at'    => date('Y-m-d H:i:s'),
        'total_checks'    => count($yearHistory),
        'complete_checks' => $completeChecks,
        'history'         => $yearHistory,
        'note_archivage'  => 'Ce rapport doit �fªtre archiv�f© pendant 24 mois sous la responsabilit�f© du chef de caserne (r�f©glementation SDIS).',
    ];

    $reportFile = DATA_DIR . '/asup_rapport_' . $year . '.json';
    $saved      = @file_put_contents($reportFile,
        json_encode($reportData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false;

    $reportLog = date('Y-m-d H:i:s') . " | Rapport annuel $year : "
               . ($saved ? "â�"�?o G�f©n�f©r�f© â�?��?T $reportFile" : "â�"�?" �f�?�chec �f©criture")
               . " | " . count($yearHistory) . " contr�f´le(s) archiv�f©(s)\n";

    @file_put_contents($logFile, $reportLog, FILE_APPEND);
    echo $reportLog;

    // G�f©n�f©ration du PDF via Python3 AppCentral
    if ($saved && count($yearHistory) > 0) {
        $pythonBin    = '/usr/local/AppCentral/python3/bin/python3';
        $pythonScript = dirname(__DIR__) . '/asup_rapport_annuel.py';

        if (file_exists($pythonScript) && file_exists($pythonBin)) {
            $output     = [];
            $returnCode = 0;
            @exec("$pythonBin $pythonScript $year 2>&1", $output, $returnCode);
            $pdfLog = date('Y-m-d H:i:s') . " | PDF rapport $year : "
                    . ($returnCode === 0 ? "â�"�?o G�f©n�f©r�f©" : "â�"�?" Erreur : " . implode(' ', $output)) . "\n";
        } else {
            $pdfLog = date('Y-m-d H:i:s') . " | PDF rapport $year : â�"�?" Script Python introuvable\n";
        }
        @file_put_contents($logFile, $pdfLog, FILE_APPEND);
        echo $pdfLog;
    }

    // Envoi du rapport annuel par mail au correspondant pharmacie
    if ($saved && count($yearHistory) > 0) {
        $email = getCorrespondantPharmacieEmail();
        if (!empty($email)) {
            $subject = "[ASUP Caserne] Rapport annuel $year â�,��?� " . count($yearHistory) . " contr�f´le(s)";
            $body    = "Bonjour,\n\n";
            $body   .= "Le rapport annuel ASUP $year a �f©t�f© g�f©n�f©r�f© automatiquement.\n\n";
            $body   .= "R�f©sum�f© :\n";
            $body   .= "  â�,�¢ Contr�f´les effectu�f©s : " . count($yearHistory) . "\n";
            $body   .= "  â�,�¢ Contr�f´les complets (tout point�f©) : $completeChecks\n\n";
            $body   .= "Le fichier JSON de r�f©f�f©rence est disponible sur le serveur :\n";
            $body   .= "  data/asup_rapport_$year.json\n\n";
            $body   .= "Ce rapport doit �fªtre archiv�f© pendant 24 mois sous la responsabilit�f©\n";
            $body   .= "du chef de caserne (r�f©glementation SDIS).\n\n";
            $body   .= "Date de g�f©n�f©ration : " . date('d/m/Y �f  H:i') . "\n\n";
            $body   .= "-- Message automatique Inventaire Pompier --";

            $mailSent = sendAsupMailSMTP($email, $subject, $body);

            $mailLog = date('Y-m-d H:i:s') . " | Mail rapport annuel $year : "
                     . ($mailSent ? "â�"�?o Envoy�f© �f  $email" : "â�"�?" �f�?�chec envoi") . "\n";
            @file_put_contents($logFile, $mailLog, FILE_APPEND);
            echo $mailLog;
        }
    }
}

exit(0);
?>
