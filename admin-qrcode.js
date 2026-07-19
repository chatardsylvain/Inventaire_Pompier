/**
 * admin-qrcode.js
 * Génération et impression du QR code d'accès au site, dans l'onglet Administrateurs.
 *
 * Extrait d'un <script> inline vers ce fichier externe : la Content-Security-Policy
 * (script-src 'self') bloque désormais l'exécution de JS inline dans la page, seuls les
 * fichiers .js chargés via <script src="..."> restent autorisés.
 *
 * L'URL d'accès (contenant la clé secrète) est fournie par admin.php via un bloc
 * <script type="application/json" id="access-url-data">, qui n'est PAS un script exécutable
 * et n'est donc pas soumis à la CSP script-src — uniquement un conteneur de données.
 */
(function () {
    const dataEl = document.getElementById('access-url-data');
    const ACCESS_URL = dataEl ? JSON.parse(dataEl.textContent) : '';

    const btnShow = document.getElementById('btn-show-access-qrcode');
    const container = document.getElementById('access-qrcode-container');
    const imgDiv = document.getElementById('access-qrcode-img');
    const urlLabel = document.getElementById('access-qrcode-url');
    const btnPrint = document.getElementById('btn-print-access-qrcode');

    if (!btnShow || !container || !imgDiv || !urlLabel || !btnPrint) return;

    let qrGenerated = false;

    btnShow.addEventListener('click', function () {
        if (container.style.display === 'none' || container.style.display === '') {
            if (!qrGenerated) {
                new QRCode(imgDiv, {
                    text: ACCESS_URL,
                    width: 200,
                    height: 200,
                    correctLevel: QRCode.CorrectLevel.M
                });
                urlLabel.textContent = ACCESS_URL;
                qrGenerated = true;
            }
            container.style.display = 'flex';
            btnShow.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Masquer le QR Code';
        } else {
            container.style.display = 'none';
            btnShow.innerHTML = '<i class="fa-solid fa-qrcode"></i> Générer le QR Code d\'accès';
        }
    });

    btnPrint.addEventListener('click', function () {
        const printSection = document.getElementById('print-section');
        const canvas = imgDiv.querySelector('canvas');
        if (!canvas) return;
        printSection.innerHTML = `
            <div style="text-align:center; padding: 2rem; font-family: Inter, sans-serif;">
                <h2 style="margin-bottom: 0.5rem;">Inventaire TMC</h2>
                <p style="margin-bottom: 1rem; color: #555;">Scannez ce QR code pour accéder au site</p>
                <img src="${canvas.toDataURL()}" style="width:200px; height:200px;">
            </div>`;
        // Active le mode d'impression QR code sur le body (requis par le CSS @media print)
        document.body.classList.add('print-mode-qrcodes');
        window.print();
        setTimeout(() => {
            printSection.innerHTML = '';
            document.body.classList.remove('print-mode-qrcodes');
        }, 1000);
    });
})();
