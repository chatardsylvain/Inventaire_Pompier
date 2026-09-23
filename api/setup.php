<?php
// api/setup.php
require_once __DIR__ . '/config.php';

if (file_exists(USERS_FILE)) {
    $users = json_decode(file_get_contents(USERS_FILE), true);
    if (!empty($users)) {
        die("Le système est déjà configuré. Ce script de configuration est désactivé.");
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $matricule = isset($_POST['matricule']) ? trim($_POST['matricule']) : '';
    if (empty($matricule)) {
        $error = "Le matricule ne peut pas être vide.";
    } else {
        $first_user = [
            [
                'id' => 1,
                'login' => 'chatard_sylvain',
                'password_hash' => hash('sha256', $matricule),
                'role' => 'admin',
                'name' => 'Sylvain Chatard'
            ]
        ];
        
        file_put_contents(USERS_FILE, json_encode($first_user, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        $success = "Compte créé avec succès ! Login : chatard_sylvain. Vous pouvez maintenant supprimer ce fichier setup.php.";
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Initialisation Inventaire</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; display: flex; justify-content: center; }
        .box { background: #1e293b; padding: 2rem; border-radius: 8px; max-width: 400px; width: 100%; border: 1px solid #334155; }
        h2 { color: #ef4444; margin-top: 0; }
        input { width: 100%; padding: 0.5rem; margin: 1rem 0; border: 1px solid #334155; border-radius: 4px; background: #0f172a; color: #f8fafc; box-sizing: border-box; }
        button { background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold; }
        .error { color: #ef4444; }
        .success { color: #10b981; }
    </style>
</head>
<body>
    <div class="box">
        <h2>Initialisation de l'Admin</h2>
        <p>Création du compte super-utilisateur : <strong>chatard_sylvain</strong></p>
        
        <?php if (isset($error)): ?>
            <p class="error"><?php echo htmlspecialchars($error); ?></p>
        <?php endif; ?>
        
        <?php if (isset($success)): ?>
            <p class="success"><?php echo htmlspecialchars($success); ?></p>
            <p>Pensez à supprimer le fichier <code>api/setup.php</code> pour des raisons de sécurité !</p>
        <?php else: ?>
            <form method="POST">
                <label>Saisissez le matricule (Mot de passe) :</label>
                <input type="password" name="matricule" required placeholder="Votre matricule">
                <button type="submit">Créer le compte</button>
            </form>
        <?php endif; ?>
    </div>
</body>
</html>
