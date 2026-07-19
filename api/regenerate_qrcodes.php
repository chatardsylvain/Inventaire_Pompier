<?php
/**
 * api/regenerate_qrcodes.php
 * Génère les QR codes de tous les véhicules du manifest, entièrement en PHP
 * via l'extension GD (native). Aucune dépendance Python ou module externe requis.
 * Réservé aux administrateurs authentifiés.
 *
 * Format produit : PNG 370×420 px, QR code noir/blanc + label centré en dessous.
 * Identique au rendu précédent du script Python generate_qrcodes.py.
 */

require_once __DIR__ . '/config.php';

// Seuls les admins connectés peuvent déclencher la régénération
requireAuth();

// Seules les requêtes POST sont acceptées
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJSON(['error' => 'Méthode non autorisée.'], 405);
}

// Vérifier que l'extension GD est disponible (quasi systématique sur tout hébergement PHP)
if (!extension_loaded('gd')) {
    sendJSON([
        'error'   => 'Extension GD non disponible sur ce serveur.',
        'details' => 'Activez l\'extension php-gd dans votre configuration PHP.'
    ], 500);
}

// --- Constantes de configuration ---
define('BASE_URL',    'https://ocylvain.freeboxos.fr/Inventaire_TMC/');
define('ROOT_DIR',    realpath(__DIR__ . '/..'));
define('QR_DATA_DIR', ROOT_DIR . '/data');
define('QR_OUT_DIR',  ROOT_DIR . '/images/qrcodes');

// Créer le dossier de sortie s'il n'existe pas
if (!is_dir(QR_OUT_DIR)) {
    if (!mkdir(QR_OUT_DIR, 0755, true)) {
        sendJSON(['error' => 'Impossible de créer le dossier images/qrcodes.'], 500);
    }
}

// --- Charger le manifest ---
$manifestPath = QR_DATA_DIR . '/manifest.json';
if (!file_exists($manifestPath)) {
    sendJSON(['error' => 'manifest.json introuvable.'], 500);
}
$manifest = json_decode(file_get_contents($manifestPath), true);
if (empty($manifest)) {
    sendJSON(['error' => 'manifest.json est vide ou invalide.'], 500);
}

// --- Générer un QR code pour chaque entrée du manifest ---
$log    = [];
$errors = 0;

foreach ($manifest as $key) {
    $jsonPath = QR_DATA_DIR . "/{$key}.json";
    if (!file_exists($jsonPath)) {
        $log[] = "ERREUR : fichier manquant {$key}.json";
        $errors++;
        continue;
    }

    $vehicleData = json_decode(file_get_contents($jsonPath), true);
    $vehicleId   = $vehicleData['id']   ?? null;
    $vehicleName = $vehicleData['name'] ?? null;

    if (!$vehicleId || !$vehicleName) {
        $log[] = "ERREUR : id ou name manquant dans {$key}.json";
        $errors++;
        continue;
    }

    $url        = BASE_URL . '#' . $vehicleId;
    $outputPath = QR_OUT_DIR . "/{$key}_qrcode.png";

    $log[] = "Génération : {$vehicleName} → {$url}";

    $ok = generateQRCodePNG($url, $vehicleName, $outputPath);
    if ($ok) {
        $log[] = "  → Sauvegardé : {$outputPath}";
    } else {
        $log[] = "  → ERREUR lors de la sauvegarde de {$outputPath}";
        $errors++;
    }
}

if ($errors > 0) {
    sendJSON([
        'error'   => "{$errors} erreur(s) lors de la génération.",
        'details' => implode("\n", $log),
    ], 500);
}

sendJSON([
    'message' => 'QR codes régénérés avec succès.',
    'output'  => implode("\n", $log),
]);


// ==========================================================================
// FONCTIONS
// ==========================================================================

/**
 * Génère un QR code PNG avec un label centré en dessous.
 *
 * @param string $data       Données encodées dans le QR code (URL)
 * @param string $label      Texte affiché sous le QR code
 * @param string $outputPath Chemin absolu du fichier PNG à écrire
 * @return bool              true si succès, false sinon
 */
function generateQRCodePNG(string $data, string $label, string $outputPath): bool
{
    // -----------------------------------------------------------------------
    // 1. Construire la matrice QR (algorithme Reed-Solomon simplifié)
    //    On utilise une implémentation PHP pure intégrée ci-dessous.
    // -----------------------------------------------------------------------
    $matrix = buildQRMatrix($data);
    if ($matrix === null) {
        return false;
    }

    $modules   = count($matrix);       // Nombre de modules (cellules) par côté
    $boxSize   = 10;                   // Pixels par module
    $border    = 4;                    // Modules de marge blanche (spec QR)
    $qrPx      = ($modules + $border * 2) * $boxSize;  // Taille QR en pixels
    $labelH    = 50;                   // Hauteur zone texte en pixels
    $totalH    = $qrPx + $labelH;

    // -----------------------------------------------------------------------
    // 2. Créer l'image GD
    // -----------------------------------------------------------------------
    $img   = imagecreatetruecolor($qrPx, $totalH);
    $white = imagecolorallocate($img, 255, 255, 255);
    $black = imagecolorallocate($img, 0,   0,   0);

    // Fond blanc total
    imagefilledrectangle($img, 0, 0, $qrPx, $totalH, $white);

    // -----------------------------------------------------------------------
    // 3. Dessiner les modules QR
    // -----------------------------------------------------------------------
    $offsetPx = $border * $boxSize;

    foreach ($matrix as $row => $cols) {
        foreach ($cols as $col => $val) {
            if ($val) {
                $x1 = $offsetPx + $col * $boxSize;
                $y1 = $offsetPx + $row * $boxSize;
                $x2 = $x1 + $boxSize - 1;
                $y2 = $y1 + $boxSize - 1;
                imagefilledrectangle($img, $x1, $y1, $x2, $y2, $black);
            }
        }
    }

    // -----------------------------------------------------------------------
    // 4. Écrire le label centré dans la zone du bas
    // -----------------------------------------------------------------------
    $fontSize = 5;   // Taille police GD built-in (1-5)

    // Largeur du texte avec la police GD intégrée
    $charW    = imagefontwidth($fontSize);
    $textW    = strlen($label) * $charW;
    $textX    = (int)(($qrPx - $textW) / 2);
    $textY    = $qrPx + (int)(($labelH - imagefontheight($fontSize)) / 2);

    imagestring($img, $fontSize, $textX, $textY, $label, $black);

    // -----------------------------------------------------------------------
    // 5. Sauvegarder en PNG
    // -----------------------------------------------------------------------
    $result = imagepng($img, $outputPath);
    imagedestroy($img);

    return $result;
}

/**
 * Génère la matrice binaire d'un QR code version 1-10 (mode Byte, correction L).
 * Implémentation PHP pure — pas de bibliothèque externe.
 *
 * @param  string     $data Données à encoder
 * @return array|null       Matrice 2D de booléens, null si trop long
 */
function buildQRMatrix(string $data): ?array
{
    // -----------------------------------------------------------------------
    // Tables de référence QR (ISO 18004)
    // -----------------------------------------------------------------------

    // Capacités max en octets, correction L, versions 1-10
    $maxBytes = [17,32,53,78,106,134,154,192,230,271];

    // Blocs de correction Reed-Solomon (version, [nbBlocsTotal, nbBlocsL, nbMots, nbCorrection])
    $ecTable = [
        1  => [1,  1,  19, 7],
        2  => [1,  1,  34, 10],
        3  => [1,  1,  55, 15],
        4  => [1,  1,  80, 20],
        5  => [1,  1,  108,26],
        6  => [2,  2,  68, 18],
        7  => [2,  2,  78, 20],
        8  => [2,  2,  97, 24],
        9  => [2,  2,  116,30],
        10 => [4,  4,  68, 18],
    ];

    // Choisir la version minimale
    $version = null;
    foreach ($maxBytes as $v => $cap) {
        if (strlen($data) <= $cap) {
            $version = $v + 1;
            break;
        }
    }
    if ($version === null) {
        return null; // Données trop longues pour version ≤ 10
    }

    $size = $version * 4 + 17;

    // -----------------------------------------------------------------------
    // Initialiser la matrice (-1 = non placé, 0 = blanc, 1 = noir)
    // -----------------------------------------------------------------------
    $mat = array_fill(0, $size, array_fill(0, $size, -1));

    // Helper : placer un module si non réservé
    $place = function(int $r, int $c, int $v) use (&$mat, $size): void {
        if ($r >= 0 && $r < $size && $c >= 0 && $c < $size) {
            $mat[$r][$c] = $v;
        }
    };

    // -----------------------------------------------------------------------
    // Finder patterns (3 coins)
    // -----------------------------------------------------------------------
    $drawFinder = function(int $row, int $col) use (&$mat, $place): void {
        for ($r = -1; $r <= 7; $r++) {
            for ($c = -1; $c <= 7; $c++) {
                $v = (($r === -1 || $r === 7 || $c === -1 || $c === 7)
                    ? 0
                    : (($r === 0 || $r === 6 || $c === 0 || $c === 6)
                        ? 1
                        : (($r >= 2 && $r <= 4 && $c >= 2 && $c <= 4) ? 1 : 0)));
                $place($row + $r, $col + $c, $v);
            }
        }
    };
    $drawFinder(0, 0);
    $drawFinder(0, $size - 7);
    $drawFinder($size - 7, 0);

    // -----------------------------------------------------------------------
    // Timing patterns
    // -----------------------------------------------------------------------
    for ($i = 8; $i < $size - 8; $i++) {
        $v = ($i % 2 === 0) ? 1 : 0;
        if ($mat[6][$i] === -1) $mat[6][$i] = $v;
        if ($mat[$i][6] === -1) $mat[$i][6] = $v;
    }

    // -----------------------------------------------------------------------
    // Dark module
    // -----------------------------------------------------------------------
    $mat[$size - 8][8] = 1;

    // -----------------------------------------------------------------------
    // Alignment pattern (version ≥ 2)
    // -----------------------------------------------------------------------
    if ($version >= 2) {
        $alignPos = [
            2  => [6, 18],
            3  => [6, 22],
            4  => [6, 26],
            5  => [6, 30],
            6  => [6, 34],
            7  => [6, 22, 38],
            8  => [6, 24, 42],
            9  => [6, 28, 46],
            10 => [6, 28, 50],
        ];
        $positions = $alignPos[$version] ?? [];
        foreach ($positions as $ar) {
            foreach ($positions as $ac) {
                // Ne pas chevaucher les finders
                if (($ar <= 8 && $ac <= 8) || ($ar <= 8 && $ac >= $size - 8) || ($ar >= $size - 8 && $ac <= 8)) continue;
                for ($dr = -2; $dr <= 2; $dr++) {
                    for ($dc = -2; $dc <= 2; $dc++) {
                        $v = (abs($dr) === 2 || abs($dc) === 2) ? 1 : (($dr === 0 && $dc === 0) ? 1 : 0);
                        $place($ar + $dr, $ac + $dc, $v);
                    }
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Réserver zones format (autour des finders) — on les remplira plus tard
    // -----------------------------------------------------------------------
    $reserved = array_fill(0, $size, array_fill(0, $size, false));
    for ($i = 0; $i < $size; $i++) {
        $reserved[6][$i] = true;
        $reserved[$i][6] = true;
    }
    for ($i = 0; $i < 9; $i++) {
        for ($j = 0; $j < 9; $j++) { $reserved[$i][$j] = true; }
        for ($j = $size - 8; $j < $size; $j++) { $reserved[$i][$j] = true; $reserved[$j][$i] = true; }
    }
    $reserved[$size - 8][8] = true;

    // -----------------------------------------------------------------------
    // Encoder les données (mode Byte)
    // -----------------------------------------------------------------------
    $dataBytes = encodeByte($data, $version);

    // Reed-Solomon
    [, , $codewords, $ecCount] = $ecTable[$version];
    $ecBytes = reedSolomon($dataBytes, $ecCount);

    $allBytes = array_merge($dataBytes, $ecBytes);

    // -----------------------------------------------------------------------
    // Placer les bits de données dans la matrice (chemin en zigzag)
    // -----------------------------------------------------------------------
    $bits = [];
    foreach ($allBytes as $byte) {
        for ($b = 7; $b >= 0; $b--) {
            $bits[] = ($byte >> $b) & 1;
        }
    }

    $bitIdx = 0;
    $col    = $size - 1;
    $goUp   = true;

    while ($col > 0) {
        if ($col === 6) $col--; // Sauter la colonne de timing

        for ($i = 0; $i < $size; $i++) {
            $row = $goUp ? ($size - 1 - $i) : $i;
            foreach ([0, 1] as $dc) {
                $c = $col - $dc;
                if ($c < 0 || $reserved[$row][$c]) continue;
                if ($mat[$row][$c] === -1) {
                    $mat[$row][$c] = ($bitIdx < count($bits)) ? $bits[$bitIdx++] : 0;
                }
            }
        }
        $col -= 2;
        $goUp = !$goUp;
    }

    // -----------------------------------------------------------------------
    // Appliquer le masque 0 (pattern (row+col) % 2 == 0)  — masque recommandé
    // -----------------------------------------------------------------------
    for ($r = 0; $r < $size; $r++) {
        for ($c = 0; $c < $size; $c++) {
            if (!$reserved[$r][$c] && $mat[$r][$c] !== -1) {
                if (($r + $c) % 2 === 0) {
                    $mat[$r][$c] ^= 1;
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Écrire les bits de format (masque 0, correction L = 0b01)
    // Format word pour L+masque0 : 0x77C4 (pré-calculé ISO 18004)
    // -----------------------------------------------------------------------
    $fmt = 0x77C4; // L (01) + masque 000 + générateur + XOR 101010000010010
    $fmtBits = [];
    for ($b = 14; $b >= 0; $b--) {
        $fmtBits[] = ($fmt >> $b) & 1;
    }

    // Positions format autour du finder TL
    $fmtPos = [
        [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
        [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
    ];
    foreach ($fmtPos as $idx => [$fr, $fc]) {
        $mat[$fr][$fc] = $fmtBits[$idx];
    }

    // Positions format autour des finders TR et BL
    for ($i = 0; $i < 8; $i++) {
        $mat[8][$size - 1 - $i]   = $fmtBits[$i];
        $mat[$size - 7 + $i][8]   = $fmtBits[7 + $i];
    }

    // Convertir -1 restants en blanc
    for ($r = 0; $r < $size; $r++) {
        for ($c = 0; $c < $size; $c++) {
            if ($mat[$r][$c] === -1) $mat[$r][$c] = 0;
        }
    }

    return $mat;
}

/**
 * Encode les données en mode Byte (séquence d'octets ISO-8859-1).
 *
 * @param  string $data
 * @param  int    $version
 * @return int[]  Tableau d'octets
 */
function encodeByte(string $data, int $version): array
{
    $bits   = [];
    // Indicateur de mode : Byte = 0100
    $bits[] = 0; $bits[] = 1; $bits[] = 0; $bits[] = 0;

    // Longueur (8 bits pour version 1-9)
    $len = strlen($data);
    for ($b = 7; $b >= 0; $b--) {
        $bits[] = ($len >> $b) & 1;
    }

    // Données
    for ($i = 0; $i < $len; $i++) {
        $byte = ord($data[$i]);
        for ($b = 7; $b >= 0; $b--) {
            $bits[] = ($byte >> $b) & 1;
        }
    }

    // Terminateur (0000, max 4 bits)
    for ($i = 0; $i < 4; $i++) $bits[] = 0;

    // Padding pour aligner sur 8 bits
    while (count($bits) % 8 !== 0) $bits[] = 0;

    // Convertir en octets
    $bytes = [];
    for ($i = 0; $i < count($bits); $i += 8) {
        $byte = 0;
        for ($b = 0; $b < 8; $b++) {
            $byte = ($byte << 1) | ($bits[$i + $b] ?? 0);
        }
        $bytes[] = $byte;
    }

    // Remplissage avec 0xEC / 0x11 jusqu'à la capacité
    $maxBytes = [17,32,53,78,106,134,154,192,230,271];
    $cap      = $maxBytes[$version - 1];
    $pad      = [0xEC, 0x11];
    $pi       = 0;
    while (count($bytes) < $cap) {
        $bytes[] = $pad[$pi % 2];
        $pi++;
    }

    return $bytes;
}

/**
 * Calcule les octets de correction d'erreur Reed-Solomon.
 *
 * @param  int[] $data    Octets de données
 * @param  int   $ecCount Nombre d'octets de correction souhaités
 * @return int[]
 */
function reedSolomon(array $data, int $ecCount): array
{
    // Polynômes générateurs pré-calculés (log antilog GF(256))
    static $expTable = null;
    static $logTable = null;

    if ($expTable === null) {
        $expTable = array_fill(0, 256, 0);
        $logTable = array_fill(0, 256, 0);
        $x = 1;
        for ($i = 0; $i < 255; $i++) {
            $expTable[$i] = $x;
            $logTable[$x] = $i;
            $x <<= 1;
            if ($x & 0x100) $x ^= 0x11D;
        }
        $expTable[255] = $expTable[0];
    }

    $gfMul = function(int $a, int $b) use ($expTable, $logTable): int {
        if ($a === 0 || $b === 0) return 0;
        return $expTable[($logTable[$a] + $logTable[$b]) % 255];
    };

    // Polynôme générateur pour $ecCount octets
    $generator = [1];
    for ($i = 0; $i < $ecCount; $i++) {
        $factor = [1, $expTable[$i]];
        $product = array_fill(0, count($generator) + 1, 0);
        foreach ($generator as $gi => $gv) {
            foreach ($factor as $fi => $fv) {
                $product[$gi + $fi] ^= $gfMul($gv, $fv);
            }
        }
        $generator = $product;
    }

    // Division polynomiale
    $msg = array_merge($data, array_fill(0, $ecCount, 0));
    for ($i = 0; $i < count($data); $i++) {
        $coef = $msg[$i];
        if ($coef !== 0) {
            for ($j = 1; $j < count($generator); $j++) {
                $msg[$i + $j] ^= $gfMul($generator[$j], $coef);
            }
        }
    }

    return array_slice($msg, count($data));
}
