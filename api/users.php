<?php
/**
 * api/users.php
 * API de gestion des utilisateurs administrateurs (CRUD).
 * Seuls les utilisateurs authentifiés ont accès à ces fonctionnalités.
 * Les mots de passe sont hachés en SHA-256 avant stockage.
 */

require_once __DIR__ . '/config.php';

// Sécurise la page : bloque si l'utilisateur n'est pas connecté
requireAuth();

$action = isset($_GET['action']) ? $_GET['action'] : '';

/**
 * Charge la liste complète des utilisateurs depuis users.json.
 */
function loadUsers() {
    if (!file_exists(USERS_FILE)) {
        return [];
    }
    return json_decode(file_get_contents(USERS_FILE), true) ?: [];
}

/**
 * Sauvegarde la liste complète des utilisateurs dans users.json.
 */
function saveUsers($users) {
    $jsonContent = json_encode(array_values($users), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        return false;
    }
    $result = @file_put_contents(USERS_FILE, $jsonContent);
    return $result !== false;
}

// -------------------------------------------------------------------------
// 1. GET : Renvoie la liste publique des administrateurs (sans mot de passe)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = loadUsers();
    $publicUsers = [];
    foreach ($users as $u) {
        $publicUsers[] = [
            'id'    => $u['id'],
            'login' => $u['login'],
            'name'  => $u['name'],
            'email' => isset($u['email']) ? $u['email'] : '',
            'role'  => isset($u['role']) ? $u['role'] : 'admin'
        ];
    }
    sendJSON($publicUsers);
}

// -------------------------------------------------------------------------
// 2. POST : Créer, modifier ou supprimer des utilisateurs
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $users = loadUsers();

    // SOUS-ACTION : create -> Ajoute un nouvel administrateur
    if ($action === 'create') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['login']) || !isset($input['name']) || !isset($input['password'])) {
            sendJSON(['error' => 'Données d\'utilisateur incomplètes.'], 400);
        }
    // ✅ NOUVEAU : Validation du rôle
    $role = isset($input['role']) && in_array($input['role'], ['admin', 'infirmier']) 
            ? $input['role'] 
            : 'admin'; // Par défaut : admin

        $login    = trim(strtolower($input['login']));
        $name     = trim($input['name']);
        $password = trim($input['password']);
        $email    = isset($input['email']) ? trim($input['email']) : '';

        if (!preg_match('/^[a-z0-9_]+$/', $login)) {
            sendJSON(['error' => 'Identifiant invalide. Utilisez uniquement des lettres minuscules, chiffres et tirets bas (_). Exemple: sylvain_chatard'], 400);
        }

        if (strlen($password) < 1) {
            sendJSON(['error' => 'Le mot de passe (numéro de matricule) ne peut pas être vide.'], 400);
        }

        foreach ($users as $u) {
            if ($u['login'] === $login) {
                sendJSON(['error' => 'Cet identifiant de connexion est déjà utilisé.'], 400);
            }
        }

        $maxId = 0;
        foreach ($users as $u) {
            if ($u['id'] > $maxId) $maxId = $u['id'];
        }

        $newUser = [
            'id'            => $maxId + 1,
            'login'         => $login,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'role'          => $role,
            'name'          => $name,
            'email'         => $email
        ];

        $users[] = $newUser;

        if (!saveUsers($users)) {
            $error = error_get_last();
            $errorMsg = isset($error['message']) ? $error['message'] : 'Permission d\'écriture refusée sur le fichier users.json.';
            sendJSON(['error' => 'Erreur technique de sauvegarde : ' . $errorMsg], 500);
        }

        sendJSON(['success' => true, 'message' => 'Utilisateur créé avec succès.']);
    }

    // SOUS-ACTION : edit -> Modifie un administrateur existant
    elseif ($action === 'edit') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id']) || !isset($input['login']) || !isset($input['name'])) {
            sendJSON(['error' => 'Données incomplètes pour la modification.'], 400);
        }

        $userId   = intval($input['id']);
        $login    = trim(strtolower($input['login']));
        $name     = trim($input['name']);
        $email    = isset($input['email']) ? trim($input['email']) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';

        if (!preg_match('/^[a-z0-9_]+$/', $login)) {
            sendJSON(['error' => 'Identifiant invalide. Utilisez uniquement des lettres minuscules, chiffres et tirets bas (_).'], 400);
        }

        // Vérification unicité du login (sauf pour l'utilisateur en cours d'édition)
        foreach ($users as $u) {
            if ($u['login'] === $login && $u['id'] !== $userId) {
                sendJSON(['error' => 'Cet identifiant est déjà utilisé par un autre compte.'], 400);
            }
        }

        $found = false;
        foreach ($users as &$u) {
            if ($u['id'] === $userId) {
                $u['login'] = $login;
                $u['name']  = $name;
                $u['email'] = $email;
                if (isset($input['role']) && in_array($input['role'], ['admin', 'infirmier'])) {
                    $u['role'] = $input['role'];
                }

                // Ne change le mot de passe que si un nouveau est fourni
                if ($password !== '') {
                    $u['password_hash'] = hash('sha256', $password);
                }
                $found = true;
                break;
            }
        }
        unset($u);

        if (!$found) {
            sendJSON(['error' => 'Utilisateur introuvable.'], 404);
        }

        if (!saveUsers($users)) {
            sendJSON(['error' => 'Erreur lors de la sauvegarde.'], 500);
        }

        sendJSON(['success' => true, 'message' => 'Compte modifié avec succès.']);
    }

    // SOUS-ACTION : delete -> Supprime un administrateur existant
    elseif ($action === 'delete') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) {
            sendJSON(['error' => 'Identifiant d\'utilisateur manquant.'], 400);
        }

        $userId = intval($input['id']);

        // Règle : impossible de supprimer le dernier administrateur
        if (count($users) <= 1) {
            sendJSON(['error' => 'Impossible de supprimer le dernier utilisateur restant du système.'], 400);
        }

        // Règle : un admin ne peut pas s'auto-supprimer
        if ($userId === intval($_SESSION['user_id'])) {
            sendJSON(['error' => 'Vous ne pouvez pas supprimer votre propre compte alors que vous êtes connecté avec celui-ci.'], 400);
        }

        $foundKey = null;
        foreach ($users as $k => $u) {
            if ($u['id'] === $userId) {
                $foundKey = $k;
                break;
            }
        }

        if ($foundKey !== null) {
            unset($users[$foundKey]);
            if (!saveUsers($users)) {
                $error = error_get_last();
                $errorMsg = isset($error['message']) ? $error['message'] : 'Permission d\'écriture refusée sur le fichier users.json.';
                sendJSON(['error' => 'Erreur technique lors de la suppression : ' . $errorMsg], 500);
            }
            sendJSON(['success' => true, 'message' => 'Utilisateur supprimé avec succès.']);
        } else {
            sendJSON(['error' => 'Utilisateur non trouvé dans le système.'], 404);
        }
    }
}

// Méthode ou action non supportée
sendJSON(['error' => 'Action ou méthode non supportée.'], 400);
?>
