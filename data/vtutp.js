const vtutpData = {
        id: "vtutp-1",
        name: "VTUTP",
        type: "Véhicule",
        description: "Véhicule Tous Usages - Tracteur - Présignalisation",
        image: "./images/vtutp.jpg", // Mettez une image ici (ex: "./images/vtutp.jpg")
        icon: "fa-van-shuttle",
        locations: [
            {
                id: "vtutp-cabine",
                name: "Matériel Cabine & Rangement",
                icon: "fa-truck-front",
                items: [
                    { name: "Lampe coudée sur piles", quantity: 2 },
                    { name: "Extincteur Poudre ABC 9 kg", quantity: 1 },
                    { name: "Anneau remorquage", quantity: 1 },
                    { name: "Manivelle", quantity: 1 },
                    { name: "Cric", quantity: 1 },
                    { name: "Papiers véhicule", quantity: 1 },
                    { name: "Triangle pré-signalisation", quantity: 2 },
                    { name: "Caisse 600x400x210", quantity: 1 },
                    { name: "Caisse 600x400x320", quantity: 1 },
                    { name: "Caisse 600x400x420", quantity: 4 },
                    { name: "Sangle arrimage", quantity: 2 },
                    { name: "Gilet HV orange", quantity: 3 }
                ]
            },
            {
                id: "vtutp-balisage",
                name: "Lot Balisage",
                icon: "fa-traffic-cone",
                items: [
                    { name: "Cône 750 mm", quantity: 6 },
                    { name: "Piquet", quantity: 10 },
                    { name: "Rubalise rouge danger mort", quantity: 2 },
                    { name: "Rubalise rouge/blanc", quantity: 2 },
                    { name: "Bidon d'absorbant 30L", quantity: 1 },
                    { name: "Rubalise jaune", quantity: 2 },
                    { name: "Triangle signalisation", quantity: 1 },
                    { name: "Housse piquet", quantity: 1 }
                ]
            },
            {
                id: "vtutp-divers",
                name: "Lot Divers",
                icon: "fa-box-open",
                items: [
                    { name: "Bidon sciure 60L", quantity: 2 },
                    { name: "Caisse outils", quantity: 1 },
                    { name: "Clé barrage", quantity: 1 },
                    { name: "Clé poteau", quantity: 1 },
                    { name: "Clé tampon", quantity: 2 },
                    { name: "Clé triangle 14", quantity: 1 },
                    { name: "Commande Ø8 - 25m", quantity: 2 },
                    { name: "Curette", quantity: 1 },
                    { name: "Échelle coulisse", quantity: 1 },
                    { name: "Gilet flotabilité", quantity: 1 },
                    { name: "Halligan tool", quantity: 1 },
                    { name: "Outil force déblai", quantity: 1 },
                    { name: "Pince", quantity: 1 },
                    { name: "Scie égoïne", quantity: 1 }
                ]
            },
            {
                id: "vtutp-eclairage",
                name: "Lot Éclairage - Dénoyage",
                icon: "fa-lightbulb",
                items: [
                    { name: "Adaptateur Maréchal/ménager", quantity: 1 },
                    { name: "Adaptateur ménager/Maréchal", quantity: 1 },
                    { name: "Bec verseur", quantity: 1 },
                    { name: "Boitier dérivation", quantity: 1 },
                    { name: "Enrouleur 25m", quantity: 2 },
                    { name: "Groupe électrogène 3.5kVA", quantity: 1 },
                    { name: "Jerrican acier 5L", quantity: 1 },
                    { name: "Pompe épuisement", quantity: 1 },
                    { name: "Projecteur halogène", quantity: 2 },
                    { name: "Tuyau Ø45 - 20m", quantity: 2 }
                ]
            },
            {
                id: "vtutp-protection",
                name: "Lot Protection - Déblai",
                icon: "fa-helmet-safety",
                items: [
                    { name: "Accessoires aspirateur", quantity: 1 },
                    { name: "Aspirateur 70L", quantity: 1 },
                    { name: "Bâche 10x3m", quantity: 2 },
                    { name: "Balai", quantity: 1 },
                    { name: "Coupe boulon", quantity: 1 },
                    { name: "Drisse Ø10 - 30m", quantity: 1 },
                    { name: "Écope", quantity: 2 },
                    { name: "Masse tranche", quantity: 1 },
                    { name: "Waders", quantity: 2 },
                    { name: "Pelle", quantity: 1 },
                    { name: "Pioche", quantity: 1 },
                    { name: "Raclette", quantity: 2 },
                    { name: "Scotch toilé", quantity: 2 },
                    { name: "Sac gravats", quantity: 5 },
                    { name: "Seau maçon", quantity: 2 },
                    { name: "Tuyau annelé 10m", quantity: 1 },
                    { name: "Vêtement pluie", quantity: 3 }
                ]
            },
            {
                id: "vtutp-tronconnage",
                name: "Lot Tronçonnage",
                icon: "fa-screwdriver-wrench",
                items: [
                    { name: "Bidon mélange", quantity: 1 },
                    { name: "Casque F2", quantity: 1 },
                    { name: "Kit entretien tronçonneuse", quantity: 1 },
                    { name: "Jambières", quantity: 1 },
                    { name: "Tronçonneuse", quantity: 1 }
                ]
            },
            {
                id: "vtutp-controle",
                name: "Matériel soumis à contrôle",
                icon: "fa-clipboard-check",
                items: [
                    { name: "Lot sauvetage et de protection contre les chutes", quantity: 1 }
                ]
            }
        ]
    };
