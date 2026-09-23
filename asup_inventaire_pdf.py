#!/usr/local/bin/env python3
# -*- coding: utf-8 -*-
"""
asup_inventaire_pdf.py
G�f©n�f¨re le PDF d'inventaire des m�f©dicaments ASUP (VSAV) avec ReportLab.
Align�f© sur la structure et la gestion des logos de asup_rapport_annuel.py.
"""

import sys
import json
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable, Image as RLImage
)
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ============================================================================
# Configuration chemins (align�f©e sur asup_rapport_annuel.py)
# ============================================================================
DATA_DIR   = '/volume1/Web/Inventaire_Pompier/data'
IMAGES_DIR = '/volume1/Web/Inventaire_Pompier/images'
LOGO_CASERNE = os.path.join(IMAGES_DIR, 'logo.webp')
LOGO_SDIS   = os.path.join(IMAGES_DIR, 'sdis_logo.webp')

# Fallback si les logos en webp ne sont pas trouv�f©s, essayer en png
if not os.path.exists(LOGO_CASERNE) and os.path.exists(os.path.join(IMAGES_DIR, 'logo.png')):
    LOGO_CASERNE = os.path.join(IMAGES_DIR, 'logo.png')
if not os.path.exists(LOGO_SDIS) and os.path.exists(os.path.join(IMAGES_DIR, 'sdis_logo.png')):
    LOGO_SDIS = os.path.join(IMAGES_DIR, 'sdis_logo.png')

# ============================================================================
# Couleurs
# ============================================================================
C_BLACK  = colors.HexColor('#000000')
C_DARK   = colors.HexColor('#1a1a1a')
C_GREY   = colors.HexColor('#4a4a4a')
C_LIGHT  = colors.HexColor('#f0f0f0')
C_BORDER = colors.HexColor('#cccccc')
C_RED    = colors.HexColor('#cc0000')
C_ORANGE = colors.HexColor('#c2410c')
C_GREEN  = colors.HexColor('#166534')
C_WHITE  = colors.white

# ============================================================================
# Polices
# ============================================================================
FONT_DIR = '/usr/share/fonts/truetype/dejavu'
try:
    pdfmetrics.registerFont(TTFont('DejaVu', os.path.join(FONT_DIR, 'DejaVuSans.ttf')))
    pdfmetrics.registerFont(TTFont('DejaVu-Bold', os.path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')))
    FONT      = 'DejaVu'
    FONT_BOLD = 'DejaVu-Bold'
except Exception:
    FONT      = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'

def make_styles():
    s = {}
    s['normal']  = ParagraphStyle('normal', fontName=FONT, fontSize=9, textColor=C_DARK, leading=13)
    s['bold']    = ParagraphStyle('bold', fontName=FONT_BOLD, fontSize=9, textColor=C_DARK, leading=13)
    s['small']   = ParagraphStyle('small', fontName=FONT, fontSize=8, textColor=C_GREY, leading=11)
    s['center']  = ParagraphStyle('center', fontName=FONT, fontSize=9, textColor=C_DARK, alignment=TA_CENTER, leading=13)
    s['th']      = ParagraphStyle('th', fontName=FONT_BOLD, fontSize=8, textColor=C_WHITE, alignment=TA_CENTER, leading=11)
    s['th_left'] = ParagraphStyle('th_left', fontName=FONT_BOLD, fontSize=8, textColor=C_WHITE, alignment=TA_LEFT, leading=11)
    return s

def fmt_date(iso):
    if not iso:
        return 'â�,��?�'
    try:
        parts = iso.split(' ')[0].split('-')
        if len(parts) == 3:
            return f"{parts[2]}/{parts[1]}/{parts[0]}"
    except Exception:
        pass
    return iso

def p(text, style):
    return Paragraph(str(text) if text is not None else 'â�,��?�', style)

# ============================================================================
# En-t�fªte avec les deux logos (identique �f  asup_rapport_annuel.py)
# ============================================================================
def build_header(styles, vehicle_name="VSAV"):
    W = A4[0] - 3*cm  # Largeur utile
    header_data = [[]]

    # 1. Logo Caserne �f  gauche (taille r�f©duite �f  1.0 cm de large)
    caserne_cell = p('', styles['normal'])
    try:
        if os.path.exists(LOGO_CASERNE):
            caserne_cell = RLImage(LOGO_CASERNE, width=2.0*cm, height=2.0*cm)
        else:
            caserne_cell = p(f"<font color='red'>[Introuvable: {os.path.basename(LOGO_CASERNE)}]</font>", styles['small'])
    except Exception as e:
        caserne_cell = p(f"<font color='red'>[Erreur img: {str(e)}]</font>", styles['small'])
    header_data[0].append(caserne_cell)

    # 2. Texte central
    org_text = (
        '<b>Nom du Centre de Secours</b><br/>'
        'Service D�f©partemental et m�f©tropolitain d\'Incendie et de Secours<br/>'
        f'<b>Inventaire ASUP â�,��?� V�f©hicule {vehicle_name.upper()}</b>'
    )
    header_data[0].append(p(org_text, ParagraphStyle(
        'org', fontName=FONT, fontSize=9, textColor=C_BLACK, leading=14, alignment=TA_CENTER
    )))

    # 3. Logo SDIS �f  droite (taille r�f©duite �f  1.2 cm de large pour garder l'�f©quilibre)
    sdis_cell = p('', styles['normal'])
    try:
        if os.path.exists(LOGO_SDIS):
            sdis_cell = RLImage(LOGO_SDIS, width=3.2*cm, height=2.0*cm)
        else:
            sdis_cell = p(f"<font color='red'>[Introuvable: {os.path.basename(LOGO_SDIS)}]</font>", styles['small'])
    except Exception as e:
        sdis_cell = p(f"<font color='red'>[Erreur img: {str(e)}]</font>", styles['small'])
    header_data[0].append(sdis_cell)

    # Ajustement des largeurs de colonnes du tableau d'en-t�fªte en cons�f©quence
    header_table = Table(header_data, colWidths=[1.8*cm, W - 3.8*cm, 2.0*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
    ]))
    return header_table

# ============================================================================
# Pied de page (Pagination)
# ============================================================================
def on_page(canvas_obj, doc):
    canvas_obj.saveState()
    W, H = A4
    margin = 1.5*cm

    canvas_obj.setStrokeColor(C_BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(margin, 1.2*cm, W - margin, 1.2*cm)

    canvas_obj.setFont(FONT, 7)
    canvas_obj.setFillColor(C_GREY)
    canvas_obj.drawString(margin, 0.9*cm, 'Inventaire M�f©dicamenteux ASUP â�,��?� VSAV')
    canvas_obj.drawRightString(W - margin, 0.9*cm, f'Page {doc.page}')
    canvas_obj.restoreState()

# ============================================================================
# G�f©n�f©ration principale du PDF
# ============================================================================
def generate_pdf(json_data_path, output_pdf_path):
    if not os.path.exists(json_data_path):
        print(f"Erreur : Fichier de donn�f©es {json_data_path} introuvable.", file=sys.stderr)
        return False

    with open(json_data_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    medications = raw_data.get('medications', raw_data if isinstance(raw_data, list) else [])
    if not medications:
        print("Aucun m�f©dicament trouv�f© dans les donn�f©es.", file=sys.stderr)
        return False

    styles = make_styles()
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1.2*cm, bottomMargin=1.8*cm,
        title='Inventaire ASUP VSAV',
        author='Correpodant pharmacie'
    )

    story = []

    # En-t�fªte avec les logos
    story.append(build_header(styles))
    story.append(Spacer(1, 0.3*cm))
    story.append(HRFlowable(width='100%', thickness=1.5, color=C_BLACK))
    story.append(Spacer(1, 0.4*cm))

    # M�f©tadonn�f©es d'�f©dition
    now_str = datetime.now().strftime('%d/%m/%Y �f  %H:%M')
    last_check_raw = raw_data.get('last_check_date')
    last_check_str = fmt_date(last_check_raw) if last_check_raw else 'â�,��?�'
    meta_text = f"<b>Date d'�f©dition :</b> {now_str} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Total articles :</b> {len(medications)} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Dernier contr�f´le :</b> {last_check_str}"
    story.append(p(meta_text, styles['small']))
    story.append(Spacer(1, 0.3*cm))

    # Calcul des alertes globales
    expired = sum(1 for m in medications if m.get('_status') == 'expired')
    expiring = sum(1 for m in medications if m.get('_status') == 'expiring')

    if expired > 0 or expiring > 0:
        alert_text = f"<b>âš  Attention :</b> "
        parts = []
        if expired: parts.append(f"<font color='#cc0000'><b>{expired} p�f©rim�f©(s), �f  retirer</b></font>")
        if expiring: parts.append(f"<font color='#c2410c'><b>{expiring} �f  p�f©remption imminente (â�?�¤ 14j)</b></font>")
        alert_text += " â�,��?� ".join(parts)
        
        alert_table = Table([[Paragraph(alert_text, styles['normal'])]], colWidths=[A4[0] - 3*cm])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff5f5')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cc0000')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(alert_table)
        story.append(Spacer(1, 0.4*cm))

    # Grouper par localisation
    by_location = {}
    for med in medications:
        loc = med.get('location', 'G�f©n�f©ral')
        if loc not in by_location:
            by_location[loc] = []
        by_location[loc].append(med)

    W = A4[0] - 3*cm

    for loc in sorted(by_location.keys()):
        loc_meds = by_location[loc]
        
        # Titre de la localisation
        loc_header_data = [[
            p(f"<b>{loc.upper()}</b>", ParagraphStyle('loctitle', fontName=FONT_BOLD, fontSize=9, textColor=C_WHITE, leading=12)),
            p(f"{len(loc_meds)} article(s)", ParagraphStyle('loccount', fontName=FONT, fontSize=8, textColor=C_WHITE, alignment=TA_RIGHT, leading=12))
        ]]
        loc_table = Table(loc_header_data, colWidths=[W*0.7, W*0.3])
        loc_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), C_DARK),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(loc_table)

        # Tableau des m�f©dicaments de cette localisation
        rows = [[
            p('M�f©dicament / Mat�f©riel', styles['th_left']),
            p('N�,° de lot', styles['th_left']),
            p('Qt�f©', styles['th']),
            p('P�f©remption', styles['th']),
            p('�f�?�tat', styles['th']),
        ]]

        row_backgrounds = [C_WHITE]

        for idx, med in enumerate(loc_meds):
            status = med.get('_status')
            days = med.get('_days', 0)
            
            if status == 'expired':
                status_p = p('<b>âš  P�f�?�RIM�f�?�, A RETIRER</b>', ParagraphStyle('st_exp', fontName=FONT_BOLD, fontSize=8, textColor=C_RED, alignment=TA_CENTER, leading=11))
                row_bg = colors.HexColor('#fff0f0')
            elif status == 'expiring':
                status_p = p(f'<b>âš  J-{days}</b>', ParagraphStyle('st_ing', fontName=FONT_BOLD, fontSize=8, textColor=C_ORANGE, alignment=TA_CENTER, leading=11))
                row_bg = colors.HexColor('#fff8f0')
            elif not med.get('peremption'):
                status_p = p('â�,��?�', styles['center'])
                row_bg = C_WHITE if idx % 2 == 0 else C_LIGHT
            else:
                status_p = p('<font color="#166534"><b>â�"�?o OK</b></font>', styles['center'])
                row_bg = C_WHITE if idx % 2 == 0 else C_LIGHT

            row_backgrounds.append(row_bg)

            rows.append([
                p(med.get('name', 'â�,��?�'), styles['bold']),
                p(med.get('lot', 'â�,��?�'), styles['small']),
                p(str(med.get('quantity', 'â�,��?�')), styles['center']),
                p(fmt_date(med.get('peremption')), styles['center']),
                status_p
            ])

        med_table = Table(rows, colWidths=[W*0.44, W*0.22, W*0.08, W*0.14, W*0.12], repeatRows=1)
        med_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#666666')),
            ('GRID', (0, 0), (-1, -1), 0.5, C_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), row_backgrounds[1:]),
        ]))
        story.append(med_table)
        story.append(Spacer(1, 0.4*cm))

    # L�f©gende finale
    story.append(Spacer(1, 0.2*cm))
    legend_text = "<font color='#166534'><b>â�"�?o OK</b></font> : Dans les d�f©lais &nbsp;&nbsp;|&nbsp;&nbsp; <font color='#c2410c'><b>âš  J-X</b></font> : P�f©remption imminente (â�?�¤ 14j) &nbsp;&nbsp;|&nbsp;&nbsp; <font color='#cc0000'><b>âš  P�f�?�RIM�f�?�, A RETIRER</b></font> : Date d�f©pass�f©e"
    story.append(p(legend_text, ParagraphStyle('leg', fontName=FONT, fontSize=7, textColor=C_GREY, leading=10)))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"â�"�?o PDF g�f©n�f©r�f© avec succ�f¨s : {output_pdf_path}")
    return True

if __name__ == '__main__':
    json_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DATA_DIR, 'asup_medications_vsav.json')
    pdf_path  = sys.argv[2] if len(sys.argv) > 2 else os.path.join(DATA_DIR, 'inventaire_asup_vsav.pdf')
    
    success = generate_pdf(json_path, pdf_path)
    sys.exit(0 if success else 1)