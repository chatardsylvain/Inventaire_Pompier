# Mode Opératoire de l'Application

Ce document explique le fonctionnement général et l'utilisation au quotidien de l'application **Inventaire Pompier**.

---

## 🚒 1. Réalisation des Inventaires
C'est le cœur de l'application, conçu pour être utilisé sur smartphone ou tablette lors de la prise de garde.
- **Accès** : L'agent scanne le QR code du véhicule qu'il souhaite vérifier.
- **Vérification** : L'application affiche les emplacements du véhicule (ex: "Sac PS - Extérieur", "Coffre gauche"). L'agent pointe le matériel présent.
- **Anomalies** : Si du matériel est manquant ou défectueux, il n'est pas coché.
- **Clôture** : À la fin de l'inventaire, la session est enregistrée dans l'historique et des alertes peuvent être déclenchées si l'inventaire est incomplet.

## 📅 2. Suivi des Contrôles Techniques (CT)
L'application intègre un suivi rigoureux des dates de validité des véhicules.
- **Tableau de bord** : Le menu d'administration permet de voir d'un coup d'œil les échéances de tous les véhicules.
- **Anticipation** : Des codes couleurs (Vert, Orange, Rouge) indiquent l'imminence du contrôle technique ou des révisions.

## 💊 3. Suivi et Gestion du Matériel Médical (ASUP & PISU)
L'application gère de manière distincte les lots médicaux critiques avec suivi des dates de péremption.

### Module ASUP (Acte de Soins d'Urgence sur Prescription)
- Suivi du matériel de secours d'urgence, vérification régulière.
- Historisation complète des relevés.
- **Rapports PDF** : L'application peut générer automatiquement un rapport annuel PDF de la tenue des ASUP pour l'archivage réglementaire.

### Module PISU (Médicaments Infirmiers)
- Dédié au suivi fin des médicaments (dates d'expiration strictes) pour les infirmiers de sapeurs-pompiers.
- Chaque infirmier peut avoir sa propre dotation configurée.
- Notifications d'expiration (anticipation pour le renouvellement du stock).

## ⚠️ 4. Système d'Alertes et Notifications (Emails)
L'application est capable de communiquer de manière autonome avec la hiérarchie.
- **Destinataires** : Chef de centre, Adjoints, et Responsables de véhicules.
- **Déclencheurs** : 
  - Matériel critique manquant signalé lors d'un inventaire.
  - Médicament (ASUP/PISU) arrivant à date de péremption.
  - Contrôle technique d'un véhicule arrivant à échéance.
  - Véhicule déclaré indisponible.
- Ces alertes garantissent une grande réactivité logistique sans obliger la chaîne de commandement à consulter l'application tous les jours.

## 👥 5. Gestion des Comptes Utilisateurs (Administration)
L'accès à l'interface de paramétrage est restreint.
- **Sécurité** : Connexion par code PIN à 4 chiffres (adapté aux environnements tactiles).
- **Rôles** : Plusieurs niveaux de droits existent :
  - *Superadmin* : Accès total technique.
  - *Chef de Caserne / Adjoint* : Accès aux rapports, habilitations et alertes globales.
  - *Responsable de module (ex: Infirmier)* : Gestion restreinte à son périmètre (ex: PISU).
- **Gestion** : La création/suppression des utilisateurs, l'affectation des rôles et la modification des codes PIN se font directement depuis l'interface d'administration en ligne.

---
*Ce mode opératoire est modifiable pour coller au plus près des protocoles spécifiques de votre propre Centre d'Incendie et de Secours.*
