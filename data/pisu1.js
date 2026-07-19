const pisuData = {
    id: "pisu",
    name: "Espace PISU - Pharmacie",
    type: "Lot",
    description: "Gestion des médicaments et des péremptions",
    image: "./images/pisu.jpg", // Prévoyez une image ici
    icon: "fa-briefcase-medical",
    responsible_admin: "infirmier_login", // Identifiant de l'infirmier
    locations: [
        {
            id: "armoire-principale",
            name: "Armoire Pharmacie",
            icon: "fa-pills",
            items: [
                { 
                    name: "Paracétamol", 
                    dosage: "500mg", 
                    forme: "Comprimé", 
                    peremption: "2026-12-31", 
                    quantity: 50 
                }
            ]
        }
    ]
};