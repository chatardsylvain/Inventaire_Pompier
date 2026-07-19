<?php
/**
 * api/auth.php
 * API de gestion de la session utilisateur (Connexion, Déconnexion et Vérification d'état).
 * Les administrateurs s'authentifient avec leur identifiant (prenom_nom) et leur mot de passe (matricule).
 * Le mot de passe envoyé est converti en SHA-256 pour comparaison sécurisée.
 */

require_once __DIR__ . '/config.php';

// Récupération de l'action demandée en GET (ex: login, logout, status)
$action = isset($_GET['action']) ? $_GET['action'] : '';

// -------------------------------------------------------------------------
// 1. GESTION DES REQUÊTES POST (Tentatives de connexion ou de déconnexion)
// -------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // ACTION : login -> Tente d'ouvrir une session d'administration
    if ($action === 'login') {
		// Vérifie qu'on n'est pas bloqué avant toute tentative
		checkRateLimit('login');
        // Lecture et décodage du corps brut de la requête JSON (payload)
        $input = json_decode(file_get_contents('php://input'), true);
        $login = isset($input['login']) ? trim($input['login']) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';

        // Validation simple
        if (empty($login) || empty($password)) {
			
            sendJSON(['error' => 'Veuillez saisir votre identifiant et votre mot de passe.'], 400);
        }

        // Vérification de l'existence du fichier des utilisateurs (initialisation requise via setup.php)
        if (!file_exists(USERS_FILE)) {
            sendJSON(['error' => "Le système n'est pas encore configuré. Exécutez le script d'installation api/setup.php."], 500);
        }

        // Chargement de la base d'utilisateurs
		$users = json_decode(file_get_contents(USERS_FILE), true);
		$foundUser = null;
		$foundIndex = null;

		// Recherche de l'utilisateur par login
		foreach ($users as $index => $user) {
			if ($user['login'] === $login) {
				$storedHash = $user['password_hash'];

				// Ancien format : SHA-256 brut (64 caractères hexadécimaux, pas de préfixe $)
				$isLegacySha256 = (strlen($storedHash) === 64 && ctype_xdigit($storedHash));

				if ($isLegacySha256) {
					// Comparaison à l'ancien format
					if (hash('sha256', $password) === $storedHash) {
						$foundUser = $user;
						$foundIndex = $index;

						// Migration transparente : on re-hache avec password_hash() et on sauvegarde
						$users[$index]['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
						@file_put_contents(
							USERS_FILE,
							json_encode(array_values($users), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
						);
					}
				} else {
					// Nouveau format : password_hash() / password_verify()
					if (password_verify($password, $storedHash)) {
						$foundUser = $user;
						$foundIndex = $index;
					}
				}
				break;
			}
		}

        // Si l'utilisateur est trouvé, on initie la session PHP
        if ($foundUser) {
			// Connexion réussie : on efface le compteur d'échecs pour cette IP
			clearRateLimit('login');

			$_SESSION['logged_in'] = true;
			$_SESSION['user_id'] = $foundUser['id'];
            $_SESSION['name'] = $foundUser['name'];
            $_SESSION['login'] = $foundUser['login'];
			// Renvoie une réponse positive avec le nom d'affichage de l'utilisateur
            sendJSON([
                'success' => true,
                'user' => [
                    'login' => $foundUser['login'],
                    'name' => $foundUser['name']
                ]
            ]);
		} else {
			// Échec : on enregistre la tentative
			recordFailedAttempt('login');
			sendJSON(['error' => 'Identifiant ou mot de passe (numéro de matricule) incorrect.'], 401);
		} 
	}
    
    // ACTION : logout -> Ferme la session de l'administrateur
    elseif ($action === 'logout') {
        // Vide le tableau global $_SESSION
        $_SESSION = array();
        
        // Détruit le cookie de session sur le navigateur du client
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        // Détruit la session sur le serveur
        session_destroy();
        
        sendJSON(['success' => true]);
    }
} 

// -------------------------------------------------------------------------
// 2. GESTION DES REQUÊTES GET (Vérification de l'état de la connexion)
// -------------------------------------------------------------------------
elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    
    // ACTION : status -> Vérifie à chaque chargement de page si l'admin est déjà connecté
    if ($action === 'status') {
        if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
            sendJSON([
                'logged_in' => true,
                'user' => [
                    'login' => $_SESSION['login'],
                    'name' => $_SESSION['name']
                ]
            ]);
        } else {
            sendJSON(['logged_in' => false]);
        }
    }
}

// Si la méthode HTTP ou l'action est incorrecte
sendJSON(['error' => 'Action ou méthode non supportée.'], 400);
?>
