<?php
/**
 * api/users.php
 * API de gestion des utilisateurs administrateurs (CRUD).
 * Seuls les utilisateurs authentifiés ont accès à ces fonctionnalités.
 * Les mots de passe sont hachés en bcrypt avant stockage.
 * Un utilisateur peut avoir plusieurs rôles (tableau `roles`).
 */

require_once __DIR__ . '/config.php';

requireAuth();

$action = isset($_GET['action']) ? $_GET['action'] : '';

function loadUsers() {
    if (!file_exists(USERS_FILE)) {
        return [];
    }
    return json_decode(file_get_contents(USERS_FILE), true) ?: [];
}

function saveUsers($users) {
    $jsonContent = json_encode(array_values($users), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($jsonContent === false) {
        return false;
    }
    $result = @file_put_contents(USERS_FILE, $jsonContent);
    return $result !== false;
}

function publicUserPayload($u) {
    $roles = normalizeUserRoles($u);
    $first = isset($u['first_name']) ? $u['first_name'] : '';
    $last  = isset($u['last_name']) ? $u['last_name'] : '';
    if ($first === '' && $last === '' && !empty($u['name'])) {
        $parts = preg_split('/\s+/', trim($u['name']));
        $first = $parts[0];
        $last  = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '';
    }
    $name = !empty($u['name']) ? $u['name'] : fullNameFromParts($first, $last);
    return [
        'id'         => $u['id'],
        'login'      => $u['login'],
        'name'       => $name,
        'first_name' => $first,
        'last_name'  => $last,
        'email'      => isset($u['email']) ? $u['email'] : '',
        'roles'      => $roles,
        'role'       => primaryRoleFromList($roles),
    ];
}

function countSuperadmins($users) {
    $n = 0;
    foreach ($users as $u) {
        if (in_array('superadmin', normalizeUserRoles($u), true)) {
            $n++;
        }
    }
    return $n;
}

function applyRolesToUser(&$u, array $requestedRoles) {
    $canSuper = sessionHasAnyRole(['superadmin']);
    $current  = normalizeUserRoles($u);
    $wasSuper = in_array('superadmin', $current, true);

    if ($wasSuper && !$canSuper) {
        return ['error' => 'Vous n\'avez pas les droits pour modifier un Super Administrateur.', 'status' => 403];
    }

    if (!$canSuper) {
        $requestedRoles = array_values(array_diff($requestedRoles, ['superadmin']));
        if ($wasSuper) {
            $requestedRoles[] = 'superadmin';
        }
    }

    $newRoles = expandAssignedRoles($requestedRoles, $canSuper);

    if ($wasSuper && !in_array('superadmin', $newRoles, true)) {
        return ['need_super_check' => true, 'roles' => $newRoles];
    }

    $u['roles'] = $newRoles;
    $u['role']  = primaryRoleFromList($newRoles);
    return ['roles' => $newRoles];
}

// -------------------------------------------------------------------------
// 1. GET : liste publique (sans mot de passe)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = loadUsers();
    $publicUsers = [];
    foreach ($users as $u) {
        $publicUsers[] = publicUserPayload($u);
    }
    sendJSON($publicUsers);
}

// -------------------------------------------------------------------------
// 2. POST : Créer, modifier, supprimer, mettre à jour les rôles
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $users = loadUsers();

    if ($action === 'create') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['login']) || !isset($input['password'])) {
            sendJSON(['error' => 'Données d\'utilisateur incomplètes.'], 400);
        }

        $login     = trim(strtolower($input['login']));
        $firstName = isset($input['first_name']) ? trim($input['first_name']) : '';
        $lastName  = isset($input['last_name']) ? trim($input['last_name']) : '';
        $name      = isset($input['name']) ? trim($input['name']) : fullNameFromParts($firstName, $lastName);
        $password  = trim($input['password']);
        $email     = isset($input['email']) ? trim($input['email']) : '';

        if ($firstName === '' || $lastName === '') {
            sendJSON(['error' => 'Le nom et le prénom sont obligatoires.'], 400);
        }
        if ($name === '') {
            $name = fullNameFromParts($firstName, $lastName);
        }

        $canSuper = sessionHasAnyRole(['superadmin']);
        $rolesIn  = isset($input['roles']) && is_array($input['roles']) ? $input['roles'] : ['contributeur'];
        if (isset($input['role']) && empty($input['roles'])) {
            $rolesIn = [$input['role']];
        }
        if (!$canSuper) {
            $rolesIn = array_values(array_diff($rolesIn, ['superadmin']));
        }
        $roles = expandAssignedRoles($rolesIn, $canSuper);

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

        $users[] = [
            'id'            => $maxId + 1,
            'login'         => $login,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'roles'         => $roles,
            'role'          => primaryRoleFromList($roles),
            'first_name'    => $firstName,
            'last_name'     => $lastName,
            'name'          => $name,
            'email'         => $email
        ];

        if (!saveUsers($users)) {
            $error = error_get_last();
            $errorMsg = isset($error['message']) ? $error['message'] : 'Permission d\'écriture refusée sur le fichier users.json.';
            sendJSON(['error' => 'Erreur technique de sauvegarde : ' . $errorMsg], 500);
        }

        sendJSON(['success' => true, 'message' => 'Utilisateur créé avec succès.']);
    }

    elseif ($action === 'edit') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id']) || !isset($input['login'])) {
            sendJSON(['error' => 'Données incomplètes pour la modification.'], 400);
        }

        $userId    = intval($input['id']);
        $login     = trim(strtolower($input['login']));
        $firstName = isset($input['first_name']) ? trim($input['first_name']) : '';
        $lastName  = isset($input['last_name']) ? trim($input['last_name']) : '';
        $name      = isset($input['name']) ? trim($input['name']) : fullNameFromParts($firstName, $lastName);
        $email     = isset($input['email']) ? trim($input['email']) : '';
        $password  = isset($input['password']) ? trim($input['password']) : '';

        if ($firstName === '' || $lastName === '') {
            sendJSON(['error' => 'Le nom et le prénom sont obligatoires.'], 400);
        }
        if ($name === '') {
            $name = fullNameFromParts($firstName, $lastName);
        }

        if (!preg_match('/^[a-z0-9_]+$/', $login)) {
            sendJSON(['error' => 'Identifiant invalide. Utilisez uniquement des lettres minuscules, chiffres et tirets bas (_).'], 400);
        }

        foreach ($users as $u) {
            if ($u['login'] === $login && $u['id'] !== $userId) {
                sendJSON(['error' => 'Cet identifiant est déjà utilisé par un autre compte.'], 400);
            }
        }

        $found = false;
        foreach ($users as &$u) {
            if ($u['id'] === $userId) {
                $u['login']      = $login;
                $u['first_name'] = $firstName;
                $u['last_name']  = $lastName;
                $u['name']       = $name;
                $u['email']      = $email;

                if (isset($input['roles']) && is_array($input['roles'])) {
                    $applied = applyRolesToUser($u, $input['roles']);
                    if (isset($applied['error'])) {
                        sendJSON(['error' => $applied['error']], $applied['status']);
                    }
                    if (!empty($applied['need_super_check']) && countSuperadmins($users) <= 1) {
                        sendJSON(['error' => 'Impossible de retirer le rôle Super Admin du dernier Super Administrateur.'], 400);
                    }
                    if (!empty($applied['need_super_check'])) {
                        $u['roles'] = $applied['roles'];
                        $u['role']  = primaryRoleFromList($applied['roles']);
                    }
                } elseif (isset($input['role'])) {
                    $applied = applyRolesToUser($u, [$input['role']]);
                    if (isset($applied['error'])) {
                        sendJSON(['error' => $applied['error']], $applied['status']);
                    }
                    if (!empty($applied['need_super_check']) && countSuperadmins($users) <= 1) {
                        sendJSON(['error' => 'Impossible de retirer le rôle Super Admin du dernier Super Administrateur.'], 400);
                    }
                    if (!empty($applied['need_super_check'])) {
                        $u['roles'] = $applied['roles'];
                        $u['role']  = primaryRoleFromList($applied['roles']);
                    }
                }

                if ($password !== '') {
                    $u['password_hash'] = password_hash($password, PASSWORD_BCRYPT);
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

    elseif ($action === 'update_roles') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['users']) || !is_array($input['users'])) {
            sendJSON(['error' => 'Aucune modification de rôles à enregistrer.'], 400);
        }

        $indexById = [];
        foreach ($users as $k => $u) {
            $indexById[intval($u['id'])] = $k;
        }

        foreach ($input['users'] as $upd) {
            if (!isset($upd['id']) || !isset($upd['roles']) || !is_array($upd['roles'])) {
                sendJSON(['error' => 'Données de rôles incomplètes.'], 400);
            }
            $userId = intval($upd['id']);
            if (!isset($indexById[$userId])) {
                sendJSON(['error' => 'Utilisateur introuvable (id ' . $userId . ').'], 404);
            }
            $k = $indexById[$userId];
            $applied = applyRolesToUser($users[$k], $upd['roles']);
            if (isset($applied['error'])) {
                sendJSON(['error' => $applied['error']], $applied['status']);
            }
            if (!empty($applied['need_super_check'])) {
                $users[$k]['roles'] = $applied['roles'];
                $users[$k]['role']  = primaryRoleFromList($applied['roles']);
            }
        }

        if (countSuperadmins($users) < 1) {
            sendJSON(['error' => 'Impossible de retirer le rôle Super Admin du dernier Super Administrateur.'], 400);
        }

        if (!saveUsers($users)) {
            sendJSON(['error' => 'Erreur lors de la sauvegarde.'], 500);
        }

        sendJSON(['success' => true, 'message' => 'Rôles enregistrés.']);
    }

    elseif ($action === 'delete') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) {
            sendJSON(['error' => 'Identifiant d\'utilisateur manquant.'], 400);
        }

        $userId = intval($input['id']);

        if (count($users) <= 1) {
            sendJSON(['error' => 'Impossible de supprimer le dernier utilisateur restant du système.'], 400);
        }

        if ($userId === intval($_SESSION['user_id'])) {
            sendJSON(['error' => 'Vous ne pouvez pas supprimer votre propre compte alors que vous êtes connecté avec celui-ci.'], 400);
        }

        $foundKey = null;
        foreach ($users as $k => $u) {
            if ($u['id'] === $userId) {
                if (in_array('superadmin', normalizeUserRoles($u), true) && !sessionHasAnyRole(['superadmin'])) {
                    sendJSON(['error' => 'Vous n\'avez pas les droits pour supprimer un Super Administrateur.'], 403);
                }
                $foundKey = $k;
                break;
            }
        }

        if ($foundKey !== null) {
            $wasSuper = in_array('superadmin', normalizeUserRoles($users[$foundKey]), true);
            unset($users[$foundKey]);
            if ($wasSuper && countSuperadmins($users) < 1) {
                sendJSON(['error' => 'Impossible de supprimer le dernier Super Administrateur.'], 400);
            }
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

sendJSON(['error' => 'Action ou méthode non supportée.'], 400);
