<?php
/**
 * api/upload.php
 * Script d'upload d'images de véhicules.
 * Permet de téléverser des photos de véhicules de manière sécurisée.
 * Restreint aux administrateurs authentifiés, vérifie les types mime et les extensions
 * pour éviter toute exécution de fichier malveillant (ex: script PHP déguisé en JPG).
 */

require_once __DIR__ . '/config.php';

// Vérifie que l'utilisateur est bien connecté en tant qu'administrateur
requireAuth();

// Méthode de requête uniquement POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJSON(['error' => 'Méthode non autorisée.'], 405);
}

// Vérifie que le fichier image a bien été envoyé dans la requête multipart/form-data
if (!isset($_FILES['image'])) {
    sendJSON(['error' => 'Aucun fichier image fourni.'], 400);
}

$file = $_FILES['image'];
$vehicleId = isset($_POST['vehicle_id']) ? trim($_POST['vehicle_id']) : 'temp';

// Validation de l'absence d'erreurs d'upload PHP standard (ex: dépassement upload_max_filesize dans php.ini)
if ($file['error'] !== UPLOAD_ERR_OK) {
    sendJSON(['error' => 'Erreur lors du téléchargement du fichier (code d\'erreur PHP : ' . $file['error'] . ').'], 400);
}

// Validation de la taille (taille maximale autorisée : 5 Mo)
if ($file['size'] > 5 * 1024 * 1024) {
    sendJSON(['error' => 'Fichier trop volumineux. La taille maximale autorisée est de 5 Mo.'], 400);
}

// Validation de l'extension de fichier autorisée (uniquement formats d'images classiques)
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($extension, $allowedExtensions)) {
    sendJSON(['error' => 'Format de fichier non autorisé. Formats acceptés : JPG, JPEG, PNG, GIF, WEBP.'], 400);
}

// Validation stricte du contenu réel du fichier via son type MIME
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!in_array($mimeType, $allowedMimeTypes)) {
    sendJSON(['error' => 'Le fichier n\'est pas une image valide (le type mime détecté est incorrect).'], 400);
}

// Création du dossier cible '/images' s'il n'existe pas encore
$imagesDir = __DIR__ . '/../images';
if (!file_exists($imagesDir)) {
    mkdir($imagesDir, 0755, true);
}

// Génération d'un nom de fichier unique et sécurisé.
// On force l'extension .webp pour le fichier final.
$cleanVehicleId = preg_replace('/[^a-zA-Z0-9\-]/', '_', $vehicleId);
$fileName = $cleanVehicleId . '_' . time() . '.webp';
$destination = $imagesDir . '/' . $fileName;

$conversionSuccess = false;

// Tentative de lecture de l'image source selon son type MIME
$sourceImage = null;
switch ($mimeType) {
    case 'image/jpeg':
        $sourceImage = @imagecreatefromjpeg($file['tmp_name']);
        break;
    case 'image/png':
        $sourceImage = @imagecreatefrompng($file['tmp_name']);
        if ($sourceImage !== false) {
            // Conversion de la palette et gestion de la transparence
            imagepalettetotruecolor($sourceImage);
            imagealphablending($sourceImage, true);
            imagesavealpha($sourceImage, true);
        }
        break;
    case 'image/gif':
        $sourceImage = @imagecreatefromgif($file['tmp_name']);
        if ($sourceImage !== false) {
            imagepalettetotruecolor($sourceImage);
        }
        break;
    case 'image/webp':
        $sourceImage = @imagecreatefromwebp($file['tmp_name']);
        break;
}

// Si l'image a été lue avec succès et que la fonction imagewebp existe sur le serveur
if ($sourceImage !== false && $sourceImage !== null) {
    if (function_exists('imagewebp')) {
        // Sauvegarde de l'image en WebP avec qualité 80%
        $conversionSuccess = imagewebp($sourceImage, $destination, 80);
    }
    imagedestroy($sourceImage);
}

// Solution de repli (Fallback) :
// Si la conversion a échoué ou que GD/WebP n'est pas supporté, on sauvegarde l'image originale
if (!$conversionSuccess) {
    $fileName = $cleanVehicleId . '_' . time() . '.' . $extension;
    $destination = $imagesDir . '/' . $fileName;
    $conversionSuccess = move_uploaded_file($file['tmp_name'], $destination);
} else {
    // Nettoyage du fichier temporaire puisqu'il n'a pas été déplacé par move_uploaded_file
    @unlink($file['tmp_name']);
}

if ($conversionSuccess) {
    // Retourne le chemin relatif du fichier sauvegardé pour qu'il soit inséré dans l'éditeur
    sendJSON([
        'success' => true,
        'filePath' => './images/' . $fileName
    ]);
} else {
    sendJSON(['error' => 'Impossible d\'enregistrer ou de convertir l\'image sur le serveur. Vérifiez les permissions du dossier images.'], 500);
}
?>
