const vsavData = {
        id: "vsav-1",
        name: "VSAV",
        type: "Véhicule",
        description: "Véhicule de Secours et d'Assistance aux Victimes",
        image: "./images/vsav.jpg", // Placez une image nommée vsav.jpg dans le dossier images
        icon: "fa-ambulance",
        locations: [
            {
                id: "sac-ps",
                name: "Sac PS - Extérieur",
                icon: "fa-suitcase-medical",
                items: [
                    { name: "Détecteur CO (Accroché au sac)", quantity: 1 }
                ]
            },
			{
                id: "sac-ps-poche-av-sup",
                name: "Sac PS - Poche avant supérieure",
                icon: "fa-suitcase-medical",
                items: [
                    { name: "Lampe à pupille", quantity: 1 },
                    { name: "Glucomètre + accessoires", quantity: 1 },
                    { name: "Règle EVA", quantity: 1 },
                    { name: "Ciseau de dégagement", quantity: 1 },
                    { name: "Thermomètre", quantity: 1 },
                    { name: "Tensiomètre manuel + 3 brassards", quantity: 1 },
                    { name: "Stéthoscope", quantity: 1 },
                    { name: "Sac à vomi / urine", quantity: 2 },
                    { name: "Oxymètre de pouls", quantity: 1 }
                ]
            },
            {
                id: "sac-ps-poche-av-inf",
                name: "Sac PS - Poche avant inférieure",
                icon: "fa-suitcase-medical",
                items: [
                    { name: "Défibrillateur + électrodes adulte", quantity: 1 }
                ]
            },
            {
                id: "sac-ps-interieur",
                name: "Sac PS - Intérieur",
                icon: "fa-suitcase-medical",
                items: [
                    { name: "Brulstop 10x10", quantity: 2 },
                    { name: "Brulstop 20x20", quantity: 2 },
                    { name: "Brulstop Facial", quantity: 1 },
                    { name: "Collecteur aiguille", quantity: 1 },
                    { name: "Gants S/M/L/XL", quantity: 1 },
                    { name: "Rasoir jetable", quantity: 1 },
                    { name: "Gel Hydroalcoolique", quantity: 1 }
                ]
            },
            {
                id: "sacoche-rouge",
                name: "Sacoche rouge",
                icon: "fa-briefcase",
                items: [
                    { name: "Bande 10 cm", quantity: 2 },
                    { name: "Bande 5 cm", quantity: 2 },
                    { name: "Compresses", quantity: 5 },
                    { name: "Dosiseptine", quantity: 5 },
                    { name: "NaCl 0,9% 50 mL", quantity: 2 },
                    { name: "Garrot tourniquet", quantity: 2 },
                    { name: "Garrot coton", quantity: 2 },
                    { name: "Pansement compressif", quantity: 2 },
                    { name: "Bande hémostatique", quantity: 1 },
                    { name: "Champ stérile", quantity: 2 },
                    { name: "Sparaplaie", quantity: 2 },
                    { name: "Sparadrap", quantity: 2 },
                    { name: "Ciseau Jesco", quantity: 1 }
                ]
            },
            {
                id: "sacoche-verte",
                name: "Sacoche verte",
                icon: "fa-briefcase",
                items: [
                    { name: "Couverture de survie", quantity: 2 },
                    { name: "Echarpes triangulaires", quantity: 2 },
                    { name: "Glucopulse", quantity: 1 },
                    { name: "Poche de froid", quantity: 1 },
                    { name: "Sac DASRI", quantity: 3 },
                    { name: "Electrode DSA (1 enfant / 1 adulte)", quantity: 2 }
                ]
            },
            {
                id: "sacoche-asup",
                name: "Sacoche ASUP",
                icon: "fa-briefcase",
                items: [
                    { name: "Anapen 150", quantity: 2 },
                    { name: "Anapen 300", quantity: 2 },
                    { name: "Anapen 500", quantity: 2 },
                    { name: "Nyxoid (boite de 2 inhalateurs)", quantity: 1 },
                    { name: "Compresses", quantity: 1 }
                ]
            },
            {
                id: "sac-oxygene",
                name: "Sac Oxygénothérapie",
                icon: "fa-lungs",
                items: [
                    { name: "Bouteille O2 5L", quantity: 1 },
                    { name: "Canule de Guedel (1 de chaque taille)", quantity: 1 },
                    { name: "Chlorure de sodium 500 mL", quantity: 1 },
                    { name: "Sonde CH26", quantity: 1 },
                    { name: "Embout bicône", quantity: 1 },
                    { name: "Masque HC adulte", quantity: 1 },
                    { name: "Insufflateur adulte", quantity: 1 },
                    { name: "Masque chirurgical", quantity: 1 },
                    { name: "Lunettes de protection", quantity: 1 },
                    { name: "Masque HC enfant", quantity: 1 },
                    { name: "Insufflateur pédiatrique", quantity: 1 },
                    { name: "Insufflateur néonat", quantity: 1 },
                    { name: "Filtre antibactérien", quantity: 3 },
                    { name: "Aspirateur de mucosité enfant", quantity: 1 },
                    { name: "Kit Aérosol Adulte", quantity: 2 },
                    { name: "Kit Aérosol Pédiatrie", quantity: 2 },
                    { name: "Pochette isotherme (Dosettes NaCl/Salbutamol/Ipratropium)", quantity: 1 }
                ]
            },
            {
                id: "tiroir-vert",
                name: "Tiroir Vert",
                icon: "fa-box",
                items: [
                    { name: "Aspirateur de mucosité enfant", quantity: 1 },
                    { name: "Aspirateur TWIN POMP", quantity: 1 },
                    { name: "Canule de Guedel (toutes tailles)", quantity: 1 },
                    { name: "Sonde CH26", quantity: 2 }
                ]
            },
            {
                id: "tiroir-bleu",
                name: "Tiroir Bleu",
                icon: "fa-box",
                items: [
                    { name: "Masque HC adulte", quantity: 1 },
                    { name: "Masque HC enfant", quantity: 1 },
                    { name: "Insufflateur adulte", quantity: 1 },
                    { name: "Filtre antibactérien", quantity: 1 },
                    { name: "Masque nébulisation adulte", quantity: 2 }
                ]
            },
            {
                id: "tiroir-rouge",
                name: "Tiroir rouge",
                icon: "fa-box",
                items: [
                    { name: "Bande 10 cm", quantity: 3 },
                    { name: "Bande 5 cm", quantity: 3 },
                    { name: "Compresses", quantity: 5 },
                    { name: "Dosiseptine", quantity: 10 },
                    { name: "NaCl 0,9% 50 mL", quantity: 2 },
                    { name: "Garrot coton", quantity: 2 },
                    { name: "Pansement compressif", quantity: 2 },
                    { name: "Champ stérile", quantity: 3 },
                    { name: "Sparaplaie", quantity: 2 },
                    { name: "Sparadrap", quantity: 2 },
                    { name: "Ciseau Jesco", quantity: 1 }
                ]
            },
            {
                id: "tiroir-blanc",
                name: "Tiroir Blanc",
                icon: "fa-box",
                items: [
                    { name: "Couverture de survie", quantity: 2 },
                    { name: "Echarpes triangulaires", quantity: 2 },
                    { name: "Sac à vomis / urine", quantity: 8 },
                    { name: "Poche de froid", quantity: 2 },
                    { name: "Spray désinfectant", quantity: 1 },
                    { name: "Spray nettoyant détachant", quantity: 1 },
                    { name: "Collecteur aiguille", quantity: 1 },
                    { name: "Rouleau Sac DASRI", quantity: 1 }
                ]
            },
            {
                id: "capucine",
                name: "Capucine",
                icon: "fa-truck-medical",
                items: [
                    { name: "Attelle Cervico Thoracique", quantity: 1 },
                    { name: "Couverture bactériostatique", quantity: 1 },
                    { name: "Housse mortuaire", quantity: 1 },
                    { name: "Alèse portoir souple", quantity: 1 },
                    { name: "Attelle à traction", quantity: 1 },
                    { name: "Trousse TCHESE", quantity: 1 },
                    { name: "Sangle araignée", quantity: 1 }
                ]
            },
            {
                id: "cellule-vsav",
                name: "Cellule VSAV",
                icon: "fa-truck-medical",
                items: [
                    { name: "Couverture bactériostatique", quantity: 1 },
                    { name: "Colliers cervicaux (1 de chaque taille)", quantity: 1 },
                    { name: "Boite de gants (1 de chaque taille)", quantity: 1 },
                    { name: "Gel hydroalcoolique", quantity: 1 },
                    { name: "Aspirateur de mucosité électrique", quantity: 1 },
                    { name: "kit jetable pour aspirateur de mucosité", quantity: 1 },
                    { name: "Shiller", quantity: 1 },
                    { name: "Bouteille O2 15 L", quantity: 1 },
                    { name: "Bouteille O2 5 L", quantity: 1 },
                    { name: "Gilet Haute Visibilité", quantity: 2 },
                    { name: "Sangle de contention chevilles", quantity: 1 },
                    { name: "Sangle de contention poignet", quantity: 2 },
                    { name: "Sangle de portage équipier", quantity: 2 },
                    { name: "Drap jetable", quantity: 5 },
                    { name: "Attelles à dépression", quantity: 1 },
                    { name: "Kit AES", quantity: 1 },
                    { name: "Kit membre sectionné", quantity: 1 },
                    { name: "Kit accouchement", quantity: 1 },
                    { name: "Ceinture trochantérienne", quantity: 1 },
                    { name: "Sangle de portage", quantity: 2 },
                    { name: "Pompe à vide pour MID", quantity: 1 },
                    { name: "Brancard cuillère", quantity: 1 },
                    { name: "Chaise portoir + sangles", quantity: 1 },
                    { name: "Plan dur sous brancard", quantity: 1 },
                    { name: "Immobilisateur de tête", quantity: 1 },
                    { name: "MID Adulte", quantity: 1 },
                    { name: "MID Pédiatrique", quantity: 1 }
                ]
            },
            {
                id: "lot-covid",
                name: "Lot COVID",
                icon: "fa-virus-covid",
                items: [
                    { name: "Masques chirurgicaux", quantity: 10 },
                    { name: "Masques FFP2", quantity: 6 },
                    { name: "Masques sourire", quantity: 2 },
                    { name: "Lunettes protection étanches", quantity: 4 },
                    { name: "Lunettes protection branches", quantity: 4 },
                    { name: "Blouse", quantity: 4 },
                    { name: "Charlottes", quantity: 4 }
                ]
            },
            {
                id: "kit-membre",
                name: "Kit Membre sectionné",
                icon: "fa-kit-medical",
                items: [
                    { name: "CHAMPS STERILES 75*90", quantity: 1 },
                    { name: "GANT CHIR POLYISO SENSICARE T7", quantity: 1 },
                    { name: "GANT CHIR POLYISO SENSICARE T8.5", quantity: 1 },
                    { name: "POCHE DE FROID", quantity: 2 },
                    { name: "POCHETTE ISOTHERME", quantity: 1 },
                    { name: "SAC DASRI", quantity: 1 }
                ]
            },
            {
                id: "tchese",
                name: "TCHESE",
                icon: "fa-briefcase-medical",
                items: [
                    { name: "Bande adhésive de contention 15 cm", quantity: 1 },
                    { name: "Bande cohésive 10 cm", quantity: 1 },
                    { name: "Compresses 7,5 x 7,5 cm", quantity: 10 },
                    { name: "Couverture de survie", quantity: 5 },
                    { name: "Garrot tourniquet", quantity: 5 },
                    { name: "Garrot coton", quantity: 5 },
                    { name: "Marqueur indélébile", quantity: 1 },
                    { name: "Ciseaux JESCO", quantity: 1 },
                    { name: "Paire de gants", quantity: 5 },
                    { name: "Pansement absorbant stérile", quantity: 4 },
                    { name: "Pansement compressif", quantity: 2 },
                    { name: "Pansement hémostatique", quantity: 1 },
                    { name: "Scotch de combat", quantity: 2 }
                ]
            },
            {
                id: "kit-aes",
                name: "Kit AES",
                icon: "fa-kit-medical",
                items: [
                    { name: "CHLORURE DE SODIUM 0.9% 50ML VERSABLE", quantity: 2 },
                    { name: "COMPRESSES STERILES 10 X 10CM", quantity: 4 },
                    { name: "DAKIN COOPER STABILISE HOP 60 ML", quantity: 1 },
                    { name: "CONDUITE A TENIR", quantity: 1 },
                    { name: "PRINCIPE DE DECLARATION SPP ET PATS", quantity: 1 },
                    { name: "PRINCIPE DE DECLARATION SPV", quantity: 1 },
                    { name: "PROCEDURE ORANGE", quantity: 1 },
                    { name: "PROCEDURE ROUGE", quantity: 1 },
                    { name: "ORDONNANCE (PHARMACIE@SDMIS.FR)", quantity: 1 }
                ]
            },
            {
                id: "kit-accouchement",
                name: "Kit Accouchement",
                icon: "fa-baby",
                items: [
                    { name: "ALESE", quantity: 2 },
                    { name: "ASPIRATEUR DE MUCOSITES ENFANT", quantity: 1 },
                    { name: "BANDE EXTENSIBLE 10CM * 4M", quantity: 1 },
                    { name: "BISEPTINE FLACON 40 ML", quantity: 1 },
                    { name: "BLOUSE", quantity: 1 },
                    { name: "BONNET BEBE", quantity: 1 },
                    { name: "CHAMP ACCUEIL BEBE 100*100CM", quantity: 1 },
                    { name: "CHARLOTTE", quantity: 2 },
                    { name: "CISEAU OMBILICAL", quantity: 1 },
                    { name: "CLAMP DE BAHR OMBILICAL", quantity: 4 },
                    { name: "DUVET PEDIATRIQUE", quantity: 1 },
                    { name: "GANT CHIR POLYISO SENSICARE T7", quantity: 1 },
                    { name: "GANT CHIR POLYISO SENSICARE T8.5", quantity: 1 },
                    { name: "MASQUE CHIRURGICAL", quantity: 2 },
                    { name: "PANSEMENT GYNECOLOGIQUE", quantity: 2 },
                    { name: "SAC PLACENTA", quantity: 1 },
                    { name: "SPARADRAP", quantity: 1 }
                ]
            },
            {
                id: "lot-bord",
                name: "Lot de bord",
                icon: "fa-car",
                items: [
                    { name: "Cale de roue", quantity: 2 },
                    { name: "Clef triangle de 14", quantity: 1 },
                    { name: "Cric", quantity: 1 },
                    { name: "Démonte roue", quantity: 1 },
                    { name: "Extincteur Poudre ABC 9 kg", quantity: 1 },
                    { name: "Papiers du véhicule", quantity: 1 },
                    { name: "Triangle de pré-signalisation", quantity: 2 }
                ]
            },
            {
                id: "protection-balisage",
                name: "Protection - Balisage",
                icon: "fa-traffic-cone",
                items: [
                    { name: "Brassard auto-enroulable", quantity: 1 },
                    { name: "Casque anti-bruit", quantity: 1 },
                    { name: "Cône de balisage télescopique 500 mm", quantity: 4 },
                    { name: "Coupe boulon 750 mm", quantity: 1 },
                    { name: "Gilet de sauvetage", quantity: 1 },
                    { name: "Gilet de signalisation haute visibilité (orange)", quantity: 4 },
                    { name: "Lampe de sécurité", quantity: 2 },
                    { name: "Rouleau de rubalise Jaune \"SDMIS - Danger ne pas franchir\"", quantity: 1 },
                    { name: "Tricoise", quantity: 1 }
                ]
            },
            {
                id: "transmission",
                name: "Transmission",
                icon: "fa-walkie-talkie",
                items: [
                    { name: "Accessoires tablette", quantity: 3 },
                    { name: "Fiche \"refus de transport\"", quantity: 5 },
                    { name: "Fiche bilan", quantity: 10 },
                    { name: "Fiche DAE", quantity: 5 },
                    { name: "Kit SINUS", quantity: 1 },
                    { name: "Plaquette (support fiche bilan)", quantity: 1 },
                    { name: "Pochette cartonnée SSUAP", quantity: 1 },
                    { name: "Tablette", quantity: 1 },
                    { name: "Téléphone portable + chargeur", quantity: 1 }
                ]
            }
        ]
    };
