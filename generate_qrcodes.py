import os
import sys
import json
import qrcode
from PIL import Image, ImageDraw, ImageFont

# -----------------------------------------------------------------------
# Résolution des chemins : toujours calculé depuis l'emplacement du script
# lui-même, indépendamment du répertoire courant lors de l'exécution.
# Cela garantit le bon fonctionnement aussi bien en CLI que via PHP exec().
# -----------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Constantes de configuration
BASE_URL  = "https://ocylvain.freeboxos.fr/Inventaire_TMC/"
DATA_DIR  = os.path.join(SCRIPT_DIR, "data")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "images", "qrcodes")


def generate_labeled_qr(url_data, label_text, output_path):
    print(f"Génération du QR Code pour : {label_text} -> {url_data}")

    # 1. Configuration du QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url_data)
    qr.make(fit=True)

    # Génération de l'image de base (noir et blanc)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    qr_width, qr_height = qr_img.size

    # 2. Ajout d'une zone blanche en bas pour le texte
    padding_bottom = 50
    new_height = qr_height + padding_bottom

    final_img = Image.new('RGB', (qr_width, new_height), 'white')
    final_img.paste(qr_img, (0, 0))

    # 3. Écriture du nom du véhicule
    draw = ImageDraw.Draw(final_img)

    font = None
    font_paths = [
        "arial.ttf",                                                    # Windows PATH
        "C:/Windows/Fonts/arial.ttf",                                   # Windows absolu
        "LiberationSans-Bold.ttf",                                      # Linux PATH
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", # Linux absolu
        "DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]

    for font_path in font_paths:
        try:
            font = ImageFont.truetype(font_path, 20)
            break
        except (IOError, OSError):
            continue

    if font is None:
        font = ImageFont.load_default()
        print("Avertissement : Police TTF non trouvée, utilisation de la police par défaut.")

    # Calcul de la largeur du texte pour le centrer
    try:
        text_width = draw.textlength(label_text, font=font)
    except AttributeError:
        text_width = draw.textsize(label_text, font=font)[0]

    text_x = (qr_width - text_width) // 2
    text_y = qr_height - 5

    draw.text((text_x, text_y), label_text, fill="black", font=font)

    # Sauvegarde finale du fichier
    final_img.save(output_path)
    print(f"  -> Sauvegardé : {output_path}")


def main():
    print(f"Script dir  : {SCRIPT_DIR}")
    print(f"Data dir    : {DATA_DIR}")
    print(f"Output dir  : {OUTPUT_DIR}")

    # Crée le dossier de sortie s'il n'existe pas
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Charge le manifest
    manifest_path = os.path.join(DATA_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        print(f"Erreur : manifest.json introuvable : {manifest_path}", file=sys.stderr)
        sys.exit(1)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    if not manifest:
        print("Erreur : manifest.json est vide.", file=sys.stderr)
        sys.exit(1)

    errors = 0
    for manifest_key in manifest:
        json_path = os.path.join(DATA_DIR, f"{manifest_key}.json")

        if not os.path.exists(json_path):
            print(f"Fichier manquant : {json_path}", file=sys.stderr)
            errors += 1
            continue

        with open(json_path, "r", encoding="utf-8") as jf:
            vehicle_data = json.load(jf)

        vehicle_id   = vehicle_data.get("id")
        vehicle_name = vehicle_data.get("name")

        if not vehicle_id or not vehicle_name:
            print(f"Données incomplètes dans {json_path}", file=sys.stderr)
            errors += 1
            continue

        url_target = f"{BASE_URL}#{vehicle_id}"
        output_filename  = f"{manifest_key}_qrcode.png"
        output_path      = os.path.join(OUTPUT_DIR, output_filename)

        generate_labeled_qr(url_target, vehicle_name, output_path)

    if errors:
        print(f"\n{errors} erreur(s) rencontrée(s) lors de la génération.", file=sys.stderr)
        sys.exit(1)

    print("\nTous les QR Codes ont été générés avec succès !")


if __name__ == "__main__":
    main()
