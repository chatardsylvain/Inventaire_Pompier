const lotChefGroupeData =     {
        id: "lot-chef-groupe",
        name: "Lot Chef de Groupe",
        type: "Lot",
        description: "Équipement de commandement",
        image: "./images/lot-chef-groupe.jpg", // Mettez une image ici
        icon: "fa-clipboard-user",
        locations: [
            {
                id: "cdg-commandement",
                name: "Commandement",
                icon: "fa-walkie-talkie",
                items: [
                    { name: "Gilet haute visibilité jaune \"Commandant des Opérations de Secours\"", quantity: 1 },
                    { name: "Gilet haute visibilité orange \"Chef de Secteur\"", quantity: 1 },
                    { name: "Valise GOC", quantity: 1 }
                ]
            },
            {
                id: "cdg-divers",
                name: "Divers",
                icon: "fa-box-open",
                items: [
                    { name: "Clé triangle de 14", quantity: 1 },
                    { name: "Caméra thermique", quantity: 1 },
                    { name: "Kit premier secours", quantity: 1 },
                    { name: "Mégaphone avec sirène 18W", quantity: 1 }
                ]
            },
            {
                id: "cdg-exploration",
                name: "Exploration",
                icon: "fa-magnifying-glass",
                items: [
                    { name: "Kit clé de dérivation", quantity: 1 },
                    { name: "Valise gestion binômes exploration", quantity: 1 }
                ]
            },
            {
                id: "cdg-protection",
                name: "Protection - Balisage",
                icon: "fa-traffic-cone",
                items: [
                    { name: "Lot de rubalise (rouge, jaune, rouge/blanche)", quantity: 1 }
                ]
            }
        ]
    };
