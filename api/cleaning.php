<?php
/**
 * api/cleaning.php
 * API de gestion du nettoyage mensuel de la cellule VSAV.
 * Gère la configuration des équipes, la rotation automatique,
 * et la synchronisation avec alerts.json pour l'écran Raspberry Pi.
 *
 * Endpoints :
 *   GET  ?action=status        — Retourne l'état courant (public, sans auth)
 *   GET  ?action=export_pdf    — Génère et télécharge le planning PDF (auth requise)
 *   POST ?action=update        — Modifie la date et/ou l'équipe (auth requise)
 *   POST ?action=update_teams  — Modifie la liste des équipes (auth requise)
 *
 * généré le 07/09/2026 — modifié le 10/09/2026
 */

require_once __DIR__ . '/config.php';

$action       = isset($_GET['action']) ? $_GET['action'] : '';
$cleaningFile = DATA_DIR . '/cleaning_config.json';
$alertsFile   = DATA_DIR . '/alerts.json';

// ID fixe de l'alerte nettoyage dans alerts.json (facilite la mise à jour)
define('CLEANING_ALERT_ID', 'cleaning_vsav');

// =========================================================================
// Fonctions utilitaires
// =========================================================================

/**
 * Charge la configuration de nettoyage depuis cleaning_config.json.
 */
function loadCleaningConfig() {
    global $cleaningFile;
    if (!file_exists($cleaningFile)) {
        // Configuration par défaut si le fichier n'existe pas encore
        return [
            'teams'              => ['Equipe 1', 'Equipe 2', 'Equipe 3', 'Equipe 4'],
            'current_team_index' => 0,
            'next_cleaning_date' => '',
            'last_rotation_date' => ''
        ];
    }
    $data = json_decode(file_get_contents($cleaningFile), true);
    return is_array($data) ? $data : [];
}

/**
 * Sauvegarde la configuration de nettoyage dans cleaning_config.json.
 */
function saveCleaningConfig($config) {
    global $cleaningFile;
    $json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) return false;
    return @file_put_contents($cleaningFile, $json) !== false;
}

/**
 * Charge les alertes existantes depuis alerts.json.
 */
function loadAlertsForCleaning() {
    global $alertsFile;
    if (!file_exists($alertsFile)) return [];
    return json_decode(file_get_contents($alertsFile), true) ?: [];
}

/**
 * Sauvegarde les alertes dans alerts.json.
 */
function saveAlertsForCleaning($alerts) {
    global $alertsFile;
    $json = json_encode(array_values($alerts), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) return false;
    return @file_put_contents($alertsFile, $json) !== false;
}

/**
 * Retourne le vendredi (00:00:00) de la semaine d'astreinte (vendredi→jeudi)
 * contenant la date donnée.
 * La date saisie EST le vendredi de début — on recule jusqu'au vendredi précédent
 * si jamais la date fournie n'est pas un vendredi.
 * @param string $dateStr Date au format YYYY-MM-DD
 * @return DateTime
 */
function getWeekStart($dateStr) {
    $d = new DateTime($dateStr);
    $dow = (int) $d->format('N'); // 1=lun … 5=ven … 7=dim
    // Nombre de jours à reculer pour atteindre le vendredi précédent (ou le jour même)
    $daysBack = ($dow >= 5) ? ($dow - 5) : ($dow + 2);
    if ($daysBack > 0) {
        $d->modify('-' . $daysBack . ' days');
    }
    $d->setTime(0, 0, 0);
    return $d;
}

/**
 * Retourne le jeudi (23:59:59) de la semaine d'astreinte (vendredi→jeudi)
 * contenant la date donnée.
 * @param string $dateStr Date au format YYYY-MM-DD
 * @return DateTime
 */
function getWeekEnd($dateStr) {
    $start = getWeekStart($dateStr);
    $start->modify('+6 days');          // vendredi + 6 = jeudi
    $start->setTime(23, 59, 59);
    return $start;
}

/**
 * Effectue la rotation automatique si la semaine de nettoyage est dépassée.
 * Avance l'index d'équipe et la date au mois suivant (même jour de la semaine
 * le plus proche possible, sinon décalé).
 * Retourne la config mise à jour (mais ne la sauvegarde PAS — c'est au caller).
 */
function autoRotateIfNeeded($config) {
    if (empty($config['next_cleaning_date'])) return $config;

    $now    = new DateTime();
    $sunday = getWeekEnd($config['next_cleaning_date']);

    // Tant que la semaine d'astreinte (ven→jeu) est passée, on avance
    while ($now > $sunday) {
        $nbTeams = count($config['teams']);
        if ($nbTeams > 0) {
            $config['current_team_index'] = ($config['current_team_index'] + 1) % $nbTeams;
        }

        // Avance la date d'un mois
        $nextDate = new DateTime($config['next_cleaning_date']);
        $nextDate->modify('+35 days');
        $config['next_cleaning_date'] = $nextDate->format('Y-m-d');
        $config['last_rotation_date'] = $now->format('Y-m-d H:i:s');

        // Recalcule le dimanche pour le prochain tour de boucle
        $sunday = getWeekEnd($config['next_cleaning_date']);
    }

    return $config;
}

/**
 * Synchronise l'alerte de nettoyage dans alerts.json :
 * - Si c'est la semaine du nettoyage : injecte/met à jour l'alerte
 * - Sinon : retire l'alerte de nettoyage
 */
function syncCleaningAlert($config) {
    $alerts = loadAlertsForCleaning();

    // Retire l'ancienne alerte de nettoyage si elle existe
    $alerts = array_filter($alerts, function($a) {
        return $a['id'] !== CLEANING_ALERT_ID;
    });

// Détermine si on est dans la période d'alerte/nettoyage (du mercredi précédant le vendredi jusqu'au jeudi suivant)
    $isCleaningWeek = false;
    if (!empty($config['next_cleaning_date'])) {
        $now = new DateTime();
        $cleaningDate = new DateTime($config['next_cleaning_date']);
        
        // 1. Calcule le vendredi de la semaine de nettoyage
        $dayOfWeek = (int)$cleaningDate->format('N'); // 1 = Lundi, ..., 5 = Vendredi, ..., 7 = Dimanche
        $offsetToFriday = $dayOfWeek - 5;
        
        $friday = clone $cleaningDate;
        if ($offsetToFriday != 0) {
            $friday->modify("-$offsetToFriday days");
        }
        
        // 2. Début de la période : 2 jours avant le vendredi (soit le mercredi à 00h00)
        $startPeriod = clone $friday;
        $startPeriod->modify("-2 days");
        $startPeriod->setTime(0, 0, 0);
        
        // 3. Fin de la période : le jeudi (6 jours après le vendredi, à 23h59)
        $thursday = clone $friday;
        $thursday->modify("+6 days");
        $thursday->setTime(23, 59, 59);
        
        // 4. Vérifie si la date actuelle se situe dans cette plage (du mercredi au jeudi)
        $isCleaningWeek = ($now >= $startPeriod && $now <= $thursday);
    }

    // Si c'est la semaine de nettoyage, on injecte l'alerte
    if ($isCleaningWeek) {
        $teamName = 'Non définie';
        $nbTeams  = count($config['teams']);
        if ($nbTeams > 0 && isset($config['current_team_index'])) {
            $idx = $config['current_team_index'] % $nbTeams;
            $teamName = $config['teams'][$idx];
        }

        $cleaningDate = new DateTime($config['next_cleaning_date']);
        $formattedDate = $cleaningDate->format('d/m/Y');

        $alerts[] = [
            'id'            => CLEANING_ALERT_ID,
            'vehicle_id'    => $teamName,
            'location_name' => 'VSAV',
            'item_name'     => 'Protocole Désinfection du VSAV ',
            'alert_type'    => 'Desinfection',
            'comment'       => $teamName . ' — A prévoir à partir du ' . $formattedDate,
            'date'          => date('Y-m-d H:i:s')
        ];
    }

    saveAlertsForCleaning($alerts);
    return $isCleaningWeek;
}

// =========================================================================
// ROUTES
// =========================================================================

// --- GET : status (public) ---
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'status') {
    $config = loadCleaningConfig();

    // Rotation automatique si la semaine est dépassée
    $configBefore = $config;
    $config = autoRotateIfNeeded($config);

    // Sauvegarde si rotation effectuée
    if ($config !== $configBefore) {
        saveCleaningConfig($config);
    }

    // Synchronise l'alerte dans alerts.json
    $isCleaningWeek = syncCleaningAlert($config);

    // Calculs pour le frontend
    $teamName       = 'Non définie';
    $nbTeams        = count($config['teams']);
    if ($nbTeams > 0 && isset($config['current_team_index'])) {
        $idx      = $config['current_team_index'] % $nbTeams;
        $teamName = $config['teams'][$idx];
    }

    $daysUntil    = null;
    $isOverdue    = false;
    $cleaningDateFormatted = '';

    if (!empty($config['next_cleaning_date'])) {
        $now          = new DateTime();
        $cleaningDate = new DateTime($config['next_cleaning_date']);
        $cleaningDateFormatted = $cleaningDate->format('d/m/Y');

        $sunday = getWeekEnd($config['next_cleaning_date']);
        if ($now > $sunday) {
            $isOverdue = true;
        }

        $diff     = $now->diff($cleaningDate);
        $daysUntil = $diff->invert ? -$diff->days : $diff->days;
    }

    sendJSON([
        'teams'               => $config['teams'],
        'current_team_index'  => $config['current_team_index'],
        'current_team_name'   => $teamName,
        'next_cleaning_date'  => isset($config['next_cleaning_date']) ? $config['next_cleaning_date'] : '',
        'next_cleaning_date_formatted' => $cleaningDateFormatted,
        'is_cleaning_week'    => $isCleaningWeek,
        'is_overdue'          => $isOverdue,
        'days_until'          => $daysUntil
    ]);
}

// --- POST : update (auth requise) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update') {
    requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        sendJSON(['error' => 'Données invalides.'], 400);
    }

    $config = loadCleaningConfig();

    // Mise à jour de la date
    if (isset($input['next_cleaning_date'])) {
        $dateStr = trim($input['next_cleaning_date']);
        // Validation basique du format date
        $d = DateTime::createFromFormat('Y-m-d', $dateStr);
        if (!$d) {
            sendJSON(['error' => 'Format de date invalide. Utilisez AAAA-MM-JJ.'], 400);
        }
        $config['next_cleaning_date'] = $dateStr;
    }

    // Mise à jour de l'équipe courante
    if (isset($input['current_team_index'])) {
        $idx = intval($input['current_team_index']);
        if ($idx >= 0 && $idx < count($config['teams'])) {
            $config['current_team_index'] = $idx;
        }
    }

    if (!saveCleaningConfig($config)) {
        sendJSON(['error' => 'Erreur lors de la sauvegarde de la configuration.'], 500);
    }

    // Re-synchronise l'alerte
    syncCleaningAlert($config);

    sendJSON(['success' => true, 'message' => 'Configuration du nettoyage mise à jour.']);
}

// --- POST : update_teams (auth requise) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_teams') {
    requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['teams']) || !is_array($input['teams'])) {
        sendJSON(['error' => 'Liste d\'équipes invalide.'], 400);
    }

    // Nettoyage : retire les entrées vides
    $teams = array_values(array_filter(array_map('trim', $input['teams']), function($t) {
        return $t !== '';
    }));

    if (count($teams) < 1) {
        sendJSON(['error' => 'Il faut au moins une équipe.'], 400);
    }

    $config = loadCleaningConfig();
    $config['teams'] = $teams;

    // Ajuste l'index si hors limites
    if ($config['current_team_index'] >= count($teams)) {
        $config['current_team_index'] = 0;
    }

    if (!saveCleaningConfig($config)) {
        sendJSON(['error' => 'Erreur lors de la sauvegarde.'], 500);
    }

    // Re-synchronise l'alerte
    syncCleaningAlert($config);

    sendJSON(['success' => true, 'message' => 'Liste des équipes mise à jour.']);
}

// --- GET : export_pdf (auth requise) ---
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'export_pdf') {
    requireAuth();

    $scriptPath = __DIR__ . '/../cleaning_rapport.py';
    $python     = '/usr/local/bin/python3';

    if (!file_exists($scriptPath)) {
        sendJSON(['error' => 'Script de génération PDF introuvable.'], 500);
    }

    // Exécute le script Python ; stdout = chemin absolu du PDF généré
    // stderr redirigé vers un log pour diagnostiquer les erreurs Python
    $logFile = DATA_DIR . '/cleaning_pdf.log';
    $cmd     = escapeshellarg($python) . ' ' . escapeshellarg($scriptPath)
             . ' 2>' . escapeshellarg($logFile);
    $output  = trim(shell_exec($cmd));

    if (empty($output) || !file_exists($output)) {
        $logContent = file_exists($logFile) ? file_get_contents($logFile) : 'Aucun log disponible.';
        error_log('[cleaning.php] Échec génération PDF. Log Python : ' . $logContent);
        sendJSON(['error' => 'Échec de la génération du PDF.', 'detail' => $logContent], 500);
    }

    // Stream le PDF vers le navigateur
    $filename = basename($output);
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($output));
    header('Cache-Control: no-cache, no-store');
    readfile($output);
    @unlink($output); // Supprime le PDF de /tmp après stream
    exit;
}

sendJSON(['error' => 'Action non supportée.'], 400);
?>

