const vfiData = {
        id: "vfi-1",
        name: "VFI",
        type: "Véhicule",
        description: "Véhicule de Fourgonette d'Intervention",
        image: "./images/vfi.jpeg", // Mettez une image ici
        icon: "fa-kit-medical",
        locations: [
            {
                id: "cabine-vfi",
                name: "Cabine",
                icon: "fa-kit-medical",
                items: [
                    { name: "Gilet Haute Visibilité", quantity: 3 },
                    { name: "Lampe coudée", quantity: 1 }
                ]
            },
            {
                id: "coffre",
                name: "Coffre",
                icon: "fa-car",
                items: [
                    { name: "Extincteur poudre ABC 2 kg", quantity: 1 }
                ]
            }
        ]
    };
