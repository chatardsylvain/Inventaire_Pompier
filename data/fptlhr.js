const fptlhrData = {
        id: "fptlhr-1",
        name: "FPTLHR",
        type: "Véhicule",
        description: "Fourgon Pompe Tonne",
        image: "./images/fpt.jpg", // Placez une image nommée fpt.jpg dans le dossier images
        icon: "fa-truck-fast",
        locations: [
            {
                id: "cabine-fpt",
                name: "Cabine",
                icon: "fa-truck-front",
                items: [
                    { name: "ARI (Appareil Respiratoire Isolant)", quantity: 4 },
                    { name: "Liaisons personnelles", quantity: 4 },
					{ name: "OFD", quantity: 1 },
					{ name: "Tricoise", quantity: 4 },
                    { name: "Caméra thermique (au standard)", quantity: 1 },
                    { name: "Détecteur CO", quantity: 1 },
					{ name: "Masque ARI", quantity: 4 },
					{ name: "Casque feu de structure dont 2 avec micro", quantity: 6 },
					{ name: "Lampe coudée", quantity: 3 },
					{ name: "Gilet haute visibilité", quantity: 6 },
					{ name: "Sac + Commande", quantity: 2 },
					{ name: "Courroie équipier", quantity: 4 },
					{ name: "Câle de porte", quantity: 8 },
					{ name: "LSPCC (sous la banquette)", quantity: 1 },
					{ name: "Paire de gants électrique 1000V (sous la banquette)", quantity: 1 },
					{ name: "Gilet d'aide à la flotabilité", quantity: 1 },
					{ name: "Clé de barrage", quantity: 1 },
					{ name: "Pince", quantity: 1 },
					{ name: "Curette", quantity: 1 },
					{ name: "Pioche", quantity: 1 },
					{ name: "Halligan Tool (sous la banquette", quantity: 1 },
					{ name: "Rubalise Jaune ''Ne pas franchir''", quantity: 1 },
					{ name: "Rubalise Rouge/Blanche ", quantity: 1 },
					{ name: "Rubalise Rouge ''Danger de mort''", quantity: 1 },
					{ name: "Lot gaz", quantity: 1 }
                ]
            },
			{
                id: "coffre-g1",
                name: "Coffre Gauche Avant",
                icon: "fa-fire",
                items: [
					{ name: "Clé gaz ''multi G''", quantity: 1 },
					{ name: "Clé gaz ''Pauline''", quantity: 1 },
					{ name: "Clé gaz carré 50", quantity: 1 },
					{ name: "Clé gaz carré 30", quantity: 1 },
					{ name: "Clé gaz carré 14", quantity: 1 },
					{ name: "Douille gaz carré 23", quantity: 1 },
					{ name: "Douille gaz carré 40", quantity: 1 },
					{ name: "Etiquette ''GAZ BARRE''", quantity: 5 }
				]
			},
            {
                id: "coffre-g1",
                name: "Coffre Gauche Avant",
                icon: "fa-fire",
                items: [
                    { name: "Coude d'alimentation", quantity: 1 },
                    { name: "Collecteur d'alimentation", quantity: 1 },
                    { name: "Retenue", quantity: 1 },
					{ name: "Réduction 100 x 65", quantity: 1 },
					{ name: "Réduction 65 x 40", quantity: 1 },
					{ name: "Réduction 40 x 20 GFR mâle", quantity: 1 },
					{ name: "Réduction 40 x 20 GFR femelle", quantity: 1 },
					{ name: "Bouchon 100", quantity: 2 },
					{ name: "Bouchon 65", quantity: 2 },
                    { name: "Manche de 110 - 10 m", quantity: 1 },
					{ name: "Manche de 70 - 20 m", quantity: 2 },
					{ name: "Balai", quantity: 1 },
					{ name: "Scie égoïne dans sa housse", quantity: 1 },
					{ name: "ARI + Masque", quantity: 2 }
                ]
            },
            {
                id: "coffre-g2",
                name: "Coffre Gauche Arrière ",
                icon: "fa-fire",
                items: [
                    { name: "MFT", quantity: 2 },
					{ name: "Clé de poteau", quantity: 1 },
					{ name: "Clé fédéral", quantity: 1 },
					{ name: "Clé de tampon", quantity: 2 },
					{ name: "Pelle", quantity: 1 },
                    { name: "Tuyau de 70 5 m + Division 65/2*40", quantity: 1 },
                    { name: "Cône de signalisation", quantity: 4 },
					{ name: "Coupe Boulon", quantity: 1 },
					{ name: "Lot feu de cheminée", quantity: 1 },
					{ name: "Trépied pour Projecteur", quantity: 1 },
					{ name: "Projecteur", quantity: 1 },
					{ name: "Enrouleur électrique 25 m prise Maréchal", quantity: 1 }
                ]
            },
			{
                id: "coffre-d1",
                name: "Coffre Droit Avant ",
                icon: "fa-fire",
                items: [
                    { name: "Tuyau 70 - 20 m", quantity: 3 },
					{ name: "Tuyau 45 - 20 m", quantity: 4 },
					{ name: "Boite à outils", quantity: 1 },
					{ name: "Extincteur CO2", quantity: 1 },
					{ name: "Extincteur à poudre ABC 9 kg", quantity: 1 },
                    { name: "Crépine + Flotteur", quantity: 1 },
                    { name: "Commande pour ligne d'aspiration", quantity: 4 },
					{ name: "Ligne-guide", quantity: 1 }
                ]
            },
			{
                id: "coffre-d2",
                name: "Coffre Droit Arrière ",
                icon: "fa-fire",
                items: [
                    { name: "Tuyau 70 - 20 m en échevaux + division mixte", quantity: 1 },
					{ name: "Tuyau 70 - 20 m en échevaux", quantity: 1 },
					{ name: "Tuyau 45 - 20 m en O + LDV", quantity: 1 },
					{ name: "Tuyau 45 - 20 m en échevaux", quantity: 2 },
					{ name: "Lance à mousse - bas foisonnement", quantity: 1 },
					{ name: "Lance à mousse - moyen foisonnement", quantity: 1 },
					{ name: "Lance queue de paon", quantity: 1 },
					{ name: "LDV", quantity: 1 },
                    { name: "Lance canon", quantity: 1 }
                ]
            },
            
			{
                id: "arriere",
                name: "Coffre Arrière",
                icon: "fa-droplet",
                items: [
                    { name: "LDT - 40 m", quantity: 1 },
                    { name: "Dévidoir + 200 m tuyau 70", quantity: 2 },
                    { name: "Division Mixte 65 / 65 + 2 x 40 sur dévidoir de droite", quantity: 1 },
					
                ]
            },
			{
                id: "toit",
                name: "Toit",
                icon: "fa-arrow-up",
                items: [
                    { name: "Échelle à coulisse", quantity: 1 },
                    { name: "Échelle à crochets", quantity: 1 },
                    { name: "aspiraux 110 - 2 m", quantity: 5 },
					{ name: "Batte à feu", quantity: 2 },
					{ name: "Croissant", quantity: 1 },
					{ name: "Grappin", quantity: 1 },
					{ name: "Coupe latte démontable", quantity: 1 }
                ]
            }
        ]
    };
