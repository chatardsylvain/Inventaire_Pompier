#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
dev_server.py
Serveur de développement Python autonome pour tester l'application d'inventaire localement.
Ce script émule le comportement de l'API PHP (auth, data, users, upload) et sert les fichiers statiques.
Il permet de visualiser et d'éditer l'inventaire en local sans affecter la version de production du NAS.
"""

import http.server
import socketserver
import json
import os
import hashlib
import urllib.parse
import mimetypes
import uuid
import re

PORT = 8000
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
USERS_FILE = os.path.join(os.path.dirname(__file__), 'api', 'users.json')

# Sessions en mémoire (clé: session_id, valeur: dict utilisateur)
sessions = {}

def get_session_id_from_headers(headers):
    cookie_header = headers.get('Cookie', '')
    if not cookie_header:
        return None
    # Parse cookie string e.g. "session_id=123; foo=bar"
    cookies = {}
    for part in cookie_header.split(';'):
        part = part.strip()
        if '=' in part:
            k, v = part.split('=', 1)
            cookies[k.strip()] = v.strip()
    return cookies.get('session_id')

def ensure_default_users():
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    if not os.path.exists(USERS_FILE):
        # Création d'un utilisateur démo par défaut
        # Matricule/Mot de passe : admin
        # Hash sha256 de "admin" : 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
        default_user = [
            {
                "id": 1,
                "login": "admin",
                "password_hash": "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
                "role": "admin",
                "name": "Administrateur Démo"
            }
        ]
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_user, f, indent=4, ensure_ascii=False)
        print("Fichier de démo api/users.json créé automatiquement. (Login: admin, Password: admin)")

class InventoryDevHandler(http.server.BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # Surcharge pour rendre les logs plus lisibles
        print(f"[SERVEUR] {self.address_string()} - - [{self.log_date_time_string()}] {format%args}")

    def send_json(self, data, status=200, headers_list=None):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        if headers_list:
            for k, v in headers_list:
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=4, ensure_ascii=False).encode('utf-8'))

    def require_auth(self):
        session_id = get_session_id_from_headers(self.headers)
        if not session_id or session_id not in sessions:
            self.send_json({'error': 'Non authentifié. Veuillez vous connecter.'}, 401)
            return None
        return sessions[session_id]

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)
        
        # 1. API: api/data.php (Lecture de l'inventaire)
        if path == '/api/data.php':
            action = query.get('action', [''])[0]
            if action == 'get_all' or not action:
                manifest_path = os.path.join(DATA_DIR, 'manifest.json')
                if not os.path.exists(manifest_path):
                    self.send_json([])
                    return
                try:
                    with open(manifest_path, 'r', encoding='utf-8') as f:
                        manifest = json.load(f)
                except Exception as e:
                    self.send_json({'error': f'Erreur lecture manifest: {str(e)}'}, 500)
                    return
                
                vehicles = []
                for v_id in manifest:
                    # Sécurité : autorise uniquement les IDs valides
                    if not re.match(r'^[a-zA-Z0-9\-]+$', v_id):
                        continue
                    v_file = os.path.join(DATA_DIR, f'{v_id}.json')
                    if os.path.exists(v_file):
                        try:
                            with open(v_file, 'r', encoding='utf-8') as f:
                                vehicle_data = json.load(f)
                                vehicles.append(vehicle_data)
                        except Exception:
                            continue
                self.send_json(vehicles)
                return
            else:
                self.send_json({'error': 'Action GET non supportée.'}, 400)
                return

        # 2. API: api/users.php (Liste des administrateurs)
        elif path == '/api/users.php':
            if not self.require_auth():
                return
            ensure_default_users()
            try:
                with open(USERS_FILE, 'r', encoding='utf-8') as f:
                    users = json.load(f)
            except Exception as e:
                self.send_json({'error': f'Erreur lecture users: {str(e)}'}, 500)
                return
            
            # Ne pas renvoyer le password_hash par sécurité
            public_users = []
            for u in users:
                public_users.append({
                    'id': u['id'],
                    'login': u['login'],
                    'name': u['name'],
                    'role': u.get('role', 'admin')
                })
            self.send_json(public_users)
            return

        # 3. API: api/auth.php?action=status (État session)
        elif path == '/api/auth.php':
            action = query.get('action', [''])[0]
            if action == 'status':
                session_id = get_session_id_from_headers(self.headers)
                if session_id and session_id in sessions:
                    user = sessions[session_id]
                    self.send_json({
                        'logged_in': True,
                        'user': {
                            'login': user['login'],
                            'name': user['name']
                        }
                    })
                else:
                    self.send_json({'logged_in': False})
                return
            else:
                self.send_json({'error': 'Action GET non supportée.'}, 400)
                return

        # 4. Fichiers statiques
        else:
            # Nettoyage du chemin de fichier
            local_path = path.lstrip('/')
            if local_path == '' or local_path == 'index.html':
                local_path = 'index.html'
            elif local_path == 'admin':
                local_path = 'admin.html'
                
            local_path = os.path.join(os.path.dirname(__file__), local_path)
            
            # Élimination des tentatives de directory traversal
            abs_current = os.path.abspath(os.path.dirname(__file__))
            abs_target = os.path.abspath(local_path)
            if not abs_target.startswith(abs_current):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Acc\xc3\xa8s refus\xc3\xa9.")
                return

            if os.path.exists(local_path) and os.path.isfile(local_path):
                # Détermination du mime type
                mime_type, _ = mimetypes.guess_type(local_path)
                if not mime_type:
                    mime_type = 'application/octet-stream'
                
                # Encodage utf-8 pour le web
                if mime_type.startswith('text/') or mime_type in ['application/javascript', 'application/json']:
                    mime_type += '; charset=utf-8'

                self.send_response(200)
                self.send_header('Content-Type', mime_type)
                # Anti-cache pour dev
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.end_headers()
                
                with open(local_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Fichier non trouv\xc3\xa9.")
                return

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)
        
        # Lecture du corps de la requête
        content_length = int(self.headers.get('Content-Length', 0))
        
        # 1. API: api/upload.php (Téléversement d'image)
        if path == '/api/upload.php':
            if not self.require_auth():
                return
            
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' in content_type:
                try:
                    # Extraction du boundary
                    boundary = content_type.split("boundary=")[1].encode('utf-8')
                    body = self.rfile.read(content_length)
                    
                    parts = body.split(b'--' + boundary)
                    for part in parts:
                        if b'Content-Disposition' in part and b'name="image"' in part:
                            headers_part, file_data = part.split(b'\r\n\r\n', 1)
                            file_data = file_data.rstrip(b'\r\n')
                            
                            # Recherche du nom de fichier original
                            match = re.search(r'filename="([^"]+)"', headers_part.decode('utf-8', errors='ignore'))
                            filename = match.group(1) if match else "image.png"
                            
                            # Sécurisation du nom de fichier
                            filename = "".join(c for c in filename if c.isalnum() or c in "._-")
                            if not filename:
                                filename = str(uuid.uuid4()) + ".png"
                            
                            images_dir = os.path.join(os.path.dirname(__file__), 'images')
                            os.makedirs(images_dir, exist_ok=True)
                            out_path = os.path.join(images_dir, filename)
                            
                            with open(out_path, 'wb') as f:
                                f.write(file_data)
                                
                            self.send_json({
                                'success': True,
                                'image_url': f'images/{filename}'
                            })
                            return
                    
                    self.send_json({'error': 'Aucune image trouvée dans le formulaire.'}, 400)
                except Exception as e:
                    self.send_json({'error': f'Erreur upload: {str(e)}'}, 500)
                return
            else:
                self.send_json({'error': 'Format de formulaire non supporté.'}, 400)
                return

        # Lecture standard du JSON pour les autres endpoints POST
        post_data = self.rfile.read(content_length)
        try:
            input_json = json.loads(post_data.decode('utf-8')) if post_data else {}
        except Exception:
            input_json = {}

        # 2. API: api/auth.php (Authentification)
        if path == '/api/auth.php':
            action = query.get('action', [''])[0]
            if action == 'login':
                login = input_json.get('login', '').strip()
                password = input_json.get('password', '').strip()
                
                if not login or not password:
                    self.send_json({'error': 'Identifiant et mot de passe requis.'}, 400)
                    return
                
                ensure_default_users()
                try:
                    with open(USERS_FILE, 'r', encoding='utf-8') as f:
                        users = json.load(f)
                except Exception as e:
                    self.send_json({'error': f'Erreur lecture users: {str(e)}'}, 500)
                    return
                
                password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
                found_user = None
                for u in users:
                    if u['login'] == login and u['password_hash'] == password_hash:
                        found_user = u
                        break
                        
                if found_user:
                    session_id = str(uuid.uuid4())
                    sessions[session_id] = found_user
                    
                    # Définit le cookie de session sur le client
                    self.send_json({
                        'success': True,
                        'user': {
                            'login': found_user['login'],
                            'name': found_user['name']
                        }
                    }, headers_list=[('Set-Cookie', f'session_id={session_id}; Path=/; HttpOnly')])
                else:
                    self.send_json({'error': 'Identifiant ou mot de passe incorrect.'}, 401)
                return
                
            elif action == 'logout':
                session_id = get_session_id_from_headers(self.headers)
                if session_id in sessions:
                    del sessions[session_id]
                self.send_json({'success': True}, headers_list=[('Set-Cookie', 'session_id=; Path=/; Max-Age=0; HttpOnly')])
                return
            else:
                self.send_json({'error': 'Action POST non supportée.'}, 400)
                return

        # 3. API: api/data.php (Sauvegarde/Suppression d'inventaire)
        elif path == '/api/data.php':
            if not self.require_auth():
                return
                
            action = query.get('action', [''])[0]
            if action == 'save_vehicle':
                v_id = input_json.get('id', '').strip()
                v_name = input_json.get('name', '').strip()
                if not v_id or not v_name:
                    self.send_json({'error': 'Identifiant et nom de véhicule requis.'}, 400)
                    return
                    
                if not re.match(r'^[a-zA-Z0-9\-]+$', v_id):
                    self.send_json({'error': 'Identifiant invalide.'}, 400)
                    return
                
                # Écriture du fichier JSON du véhicule
                v_file = os.path.join(DATA_DIR, f'{v_id}.json')
                os.makedirs(DATA_DIR, exist_ok=True)
                try:
                    with open(v_file, 'w', encoding='utf-8') as f:
                        json.dump(input_json, f, indent=4, ensure_ascii=False)
                except Exception as e:
                    self.send_json({'error': f'Erreur écriture fichier véhicule: {str(e)}'}, 500)
                    return
                
                # Mise à jour du manifest
                manifest_path = os.path.join(DATA_DIR, 'manifest.json')
                manifest = []
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest = json.load(f)
                    except Exception:
                        pass
                
                if v_id not in manifest:
                    manifest.append(v_id)
                    try:
                        with open(manifest_path, 'w', encoding='utf-8') as f:
                            json.dump(manifest, f, indent=4, ensure_ascii=False)
                    except Exception as e:
                        self.send_json({'error': f'Erreur écriture manifest: {str(e)}'}, 500)
                        return
                        
                self.send_json({'success': True, 'message': 'Véhicule et inventaire sauvegardés avec succès.'})
                return
                
            elif action == 'delete_vehicle':
                v_id = input_json.get('id', '').strip()
                if not v_id:
                    self.send_json({'error': 'Identifiant de véhicule requis.'}, 400)
                    return
                    
                v_file = os.path.join(DATA_DIR, f'{v_id}.json')
                if os.path.exists(v_file):
                    try:
                        os.remove(v_file)
                    except Exception as e:
                        self.send_json({'error': f'Erreur suppression fichier: {str(e)}'}, 500)
                        return
                
                # Retrait du manifest
                manifest_path = os.path.join(DATA_DIR, 'manifest.json')
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest = json.load(f)
                        if v_id in manifest:
                            manifest.remove(v_id)
                            with open(manifest_path, 'w', encoding='utf-8') as f:
                                json.dump(manifest, f, indent=4, ensure_ascii=False)
                    except Exception:
                        pass
                        
                self.send_json({'success': True, 'message': 'Véhicule supprimé de la base de données.'})
                return
            else:
                self.send_json({'error': 'Action POST non supportée.'}, 400)
                return

        # 4. API: api/users.php (Gestion des utilisateurs)
        elif path == '/api/users.php':
            if not self.require_auth():
                return
                
            action = query.get('action', [''])[0]
            ensure_default_users()
            try:
                with open(USERS_FILE, 'r', encoding='utf-8') as f:
                    users = json.load(f)
            except Exception as e:
                self.send_json({'error': f'Erreur lecture users: {str(e)}'}, 500)
                return

            if action == 'create':
                u_login = input_json.get('login', '').strip().lower()
                u_name = input_json.get('name', '').strip()
                u_pwd = input_json.get('password', '').strip()
                
                if not u_login or not u_name or not u_pwd:
                    self.send_json({'error': 'Données d\'utilisateur incomplètes.'}, 400)
                    return
                    
                if not re.match(r'^[a-z0-9_]+$', u_login):
                    self.send_json({'error': 'Identifiant invalide (minuscules, chiffres et tirets bas uniquement).'}, 400)
                    return
                
                for u in users:
                    if u['login'] == u_login:
                        self.send_json({'error': 'Identifiant déjà utilisé.'}, 400)
                        return
                
                max_id = max([u['id'] for u in users]) if users else 0
                new_user = {
                    'id': max_id + 1,
                    'login': u_login,
                    'name': u_name,
                    'password_hash': hashlib.sha256(u_pwd.encode('utf-8')).hexdigest(),
                    'role': 'admin'
                }
                users.append(new_user)
                try:
                    with open(USERS_FILE, 'w', encoding='utf-8') as f:
                        json.dump(users, f, indent=4, ensure_ascii=False)
                except Exception as e:
                    self.send_json({'error': f'Erreur écriture users: {str(e)}'}, 500)
                    return
                    
                self.send_json({'success': True, 'message': 'Utilisateur créé avec succès.'})
                return
                
            elif action == 'delete':
                u_id = input_json.get('id')
                if u_id is None:
                    self.send_json({'error': 'Identifiant requis.'}, 400)
                    return
                u_id = int(u_id)
                
                if len(users) <= 1:
                    self.send_json({'error': 'Impossible de supprimer le dernier utilisateur restant.'}, 400)
                    return
                
                # Récupère l'user connecté
                session_id = get_session_id_from_headers(self.headers)
                current_user = sessions.get(session_id)
                if current_user and current_user['id'] == u_id:
                    self.send_json({'error': 'Vous ne pouvez pas supprimer votre propre compte.'}, 400)
                    return
                
                found_key = None
                for idx, u in enumerate(users):
                    if u['id'] == u_id:
                        found_key = idx
                        break
                        
                if found_key is not None:
                    users.pop(found_key)
                    try:
                        with open(USERS_FILE, 'w', encoding='utf-8') as f:
                            json.dump(users, f, indent=4, ensure_ascii=False)
                    except Exception as e:
                        self.send_json({'error': f'Erreur écriture users: {str(e)}'}, 500)
                        return
                    self.send_json({'success': True, 'message': 'Utilisateur supprimé avec succès.'})
                else:
                    self.send_json({'error': 'Utilisateur non trouvé.'}, 404)
                return
            else:
                self.send_json({'error': 'Action POST non supportée.'}, 400)
                return

        self.send_json({'error': 'Endpoint non supporté.'}, 400)

if __name__ == '__main__':
    # Ajout du type mime pour JS si Windows est mal configuré
    mimetypes.add_type('application/javascript', '.js')
    mimetypes.add_type('text/css', '.css')
    
    # Prépare l'admin par défaut
    ensure_default_users()
    
    # Lancement du serveur
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), InventoryDevHandler) as httpd:
        print("\n" + "="*60)
        print(f"  SERVEUR DE DÉVELOPPEMENT D'INVENTAIRE ACTIF  ")
        print(f"  --> Accédez à l'application : http://localhost:{PORT}")
        print(f"  --> Accédez à l'administration : http://localhost:{PORT}/admin")
        print(f"  --> Identifiants démo : Compte = admin | Mot de passe = admin")
        print("="*60)
        print("Appuyez sur Ctrl+C dans ce terminal pour arrêter le serveur.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nArrêt du serveur. Au revoir !")
