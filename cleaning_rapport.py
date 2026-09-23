#!/usr/local/bin/env python3
# -*- coding: utf-8 -*-
"""
cleaning_rapport.py
G�f©n�f¨re le planning annuel de d�f©sinfection mensuelle du VSAV.
Reproduit fid�f¨lement la logique de rotation de cleaning.php :
  - Rotation d'�f©quipe �f  chaque passage
  - Avance de date : +35 jours (identique �f  autoRotateIfNeeded())
  - Semaine d'astreinte : vendredi â�?��?T jeudi
  - P�f©riode : septembre de l'ann�f©e courante â�?��?T juillet de l'ann�f©e suivante

Usage:
    python3 cleaning_rapport.py
    # Le PDF est �f©crit dans /tmp/cleaning_rapport_YYYY-YYYY.pdf
    # Le chemin absolu du PDF est imprim�f© sur stdout (pour PHP).

D�f©pendances:
    pip install reportlab --break-system-packages
# g�f©n�f©r�f© le 07/09/2026 â�,��?� modifi�f© le 10/09/2026
"""

import sys
import json
import os
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image as RLImage

# ============================================================================
# Configuration chemins
# ============================================================================
DATA_DIR   = '/volume1/Web/Inventaire_Pompier/data'
IMAGES_DIR = '/volume1/Web/Inventaire_Pompier/images'
LOGO_CASERNE = os.path.join(IMAGES_DIR, 'logo.webp')
LOGO_SDIS   = os.path.join(IMAGES_DIR, 'sdis_logo.webp')
CLEANING_CONFIG = os.path.join(DATA_DIR, 'cleaning_config.json')

# ============================================================================
# Couleurs (identiques �f  asup_rapport_annuel.py)
# ============================================================================
C_BLACK  = colors.HexColor('#000000')
C_DARK   = colors.HexColor('#1a1a1a')
C_GREY   = colors.HexColor('#4a4a4a')
C_LIGHT  = colors.HexColor('#f0f0f0')
C_BORDER = colors.HexColor('#cccccc')
C_WHITE  = colors.white
C_GREEN  = colors.HexColor('#006600')
C_BLUE   = colors.HexColor('#003399')

# ============================================================================
# Polices
# ============================================================================
FONT_DIR = '/usr/share/fonts/truetype/dejavu'
try:
    pdfmetrics.registerFont(TTFont('DejaVu',      os.path.join(FONT_DIR, 'DejaVuSans.ttf')))
    pdfmetrics.registerFont(TTFont('DejaVu-Bold', os.path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')))
    FONT      = 'DejaVu'
    FONT_BOLD = 'DejaVu-Bold'
except Exception:
    FONT      = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'

# ============================================================================
# Styles
# ============================================================================
def make_styles():
    s = {}
    s['normal'] = ParagraphStyle('normal', fontName=FONT, fontSize=9,
                                  textColor=C_DARK, leading=13)
    s['bold']   = ParagraphStyle('bold', fontName=FONT_BOLD, fontSize=9,
                                  textColor=C_DARK, leading=13)
    s['small']  = ParagraphStyle('small', fontName=FONT, fontSize=8,
                                  textColor=C_GREY, leading=11)
    s['center'] = ParagraphStyle('center', fontName=FONT, fontSize=9,
                                  textColor=C_DARK, alignment=TA_CENTER, leading=13)
    s['title']  = ParagraphStyle('title', fontName=FONT_BOLD, fontSize=14,
                                  textColor=C_BLACK, alignment=TA_CENTER, leading=20)
    s['h2']     = ParagraphStyle('h2', fontName=FONT_BOLD, fontSize=11,
                                  textColor=C_BLACK, leading=16, spaceBefore=6)
    s['footer'] = ParagraphStyle('footer', fontName=FONT, fontSize=7,
                                  textColor=C_GREY, alignment=TA_CENTER, leading=10)
    s['th']     = ParagraphStyle('th', fontName=FONT_BOLD, fontSize=9,
                                  textColor=C_WHITE, alignment=TA_CENTER, leading=13)
    return s

def p(text, style):
    return Paragraph(str(text) if text is not None else 'â�,��?�', style)

# ============================================================================
# Logique de rotation â�,��?� miroir exact de cleaning.php::autoRotateIfNeeded()
# ============================================================================
def compute_planning(config, nb_months=11):
    """
    Calcule la liste des passages de d�f©sinfection �f  partir de la config courante.
    Reproduit la logique PHP :
      $nextDate->modify('+35 jours');

    Retourne une liste de dicts :
      { 'date': date, 'team': str, 'week_start': date, 'week_end': date }
    """
    teams         = config.get('teams', [])
    team_index    = config.get('current_team_index', 0)
    date_str      = config.get('next_cleaning_date', '')

    if not teams or not date_str:
        return []

    try:
        current_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return []

    nb_teams = len(teams)
    planning = []

    for _ in range(nb_months):
        team_name = teams[team_index % nb_teams]

        # Semaine d'astreinte vendrediâ�?��?Tjeudi autour de current_date
        # current_date EST le vendredi de d�f©but ; on recule au vendredi si besoin
        dow = current_date.weekday()   # 0=lun â�,�¦ 4=ven â�,�¦ 6=dim
        days_back = (dow - 4) % 7      # nb de jours �f  reculer pour atteindre ven
        week_start = current_date - timedelta(days=days_back)
        week_end   = week_start + timedelta(days=6)   # vendredi + 6 = jeudi

        planning.append({
            'date':       current_date,
            'team':       team_name,
            'week_start': week_start,
            'week_end':   week_end,
        })

        # Rotation : +1 �f©quipe, +35 jours (identique PHP)
        team_index   = (team_index + 1) % nb_teams
        current_date = current_date + timedelta(days=35)

    return planning

# ============================================================================
# En-t�fªte de page
# ============================================================================
def build_header(styles, label_period):
    W = A4[0] - 3*cm

    header_data = [[]]
    try:
        if os.path.exists(LOGO_CASERNE):
            img = RLImage(LOGO_CASERNE, width=1.3*cm, height=1.3*cm)
            header_data[0].append(img)
        else:
            header_data[0].append(p('', styles['normal']))
    except Exception:
        header_data[0].append(p('', styles['normal']))

    org_text = (
        '<b>Nom du Centre de Secours</b><br/>'
        'Service D�f©partemental et m�f©tropolitain d\'Incendie et de Secours<br/>'
        'Cellule VSAV â�,��?� Protocole D�f©sinfection (R�f©f. FT 18.6)'
    )
    header_data[0].append(p(org_text, ParagraphStyle(
        'org', fontName=FONT_BOLD, fontSize=10, textColor=C_BLACK, leading=15
    )))

    header_data[0].append(p(
        f"G�f©n�f©r�f© le {datetime.now().strftime('%d/%m/%Y')}",
        ParagraphStyle('date', fontName=FONT, fontSize=8, textColor=C_GREY,
                        alignment=TA_RIGHT, leading=12)
    ))

    header_table = Table(header_data, colWidths=[2.2*cm, W - 5.5*cm, 3*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return header_table

# ============================================================================
# Tableau du planning
# ============================================================================
MOIS_FR = [
    '', 'Janvier', 'F�f©vrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Ao�f»t', 'Septembre', 'Octobre', 'Novembre', 'D�f©cembre'
]

def build_planning_table(planning, styles):
    W = A4[0] - 3*cm

    headers = [
        p('Mois', styles['th']),
        p('Date pr�f©vue', styles['th']),
        p('Semaine concern�f©e', styles['th']),
        p('�f�?�quipe d�f©sign�f©e', styles['th']),
        p('Visa / Signature', styles['th']),
    ]
    rows = [headers]

    for entry in planning:
        d          = entry['date']
        team       = entry['team']
        week_start = entry['week_start']
        week_end   = entry['week_end']

        mois_label = f"{MOIS_FR[d.month]} {d.year}"
        date_label = d.strftime('%d/%m/%Y')
        semaine    = f"Ven. {week_start.strftime('%d/%m')} â�?��?T Jeu. {week_end.strftime('%d/%m/%Y')}"

        rows.append([
            p(mois_label, styles['normal']),
            p(date_label, styles['normal']),
            p(semaine, styles['normal']),
            p(team, styles['normal']),
            p('', styles['normal']),   # colonne signature â�,��?� vide, �f  remplir �f  la main
        ])

    col_widths = [3*cm, 2.8*cm, 5*cm, 4*cm, W - 14.8*cm]

    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # En-t�fªte
        ('BACKGROUND', (0, 0), (-1, 0), C_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
        ('TOPPADDING', (0, 0), (-1, 0), 7),
        # Corps
        ('FONTNAME', (0, 1), (-1, -1), FONT),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        # Grille
        ('GRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        # Alternance de fond
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_LIGHT]),
    ]))
    return table

# ============================================================================
# Footer
# ============================================================================
def on_page(canvas_obj, doc, period_label):
    canvas_obj.saveState()
    W, H = A4
    margin = 1.5*cm

    canvas_obj.setStrokeColor(C_BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(margin, 1.7*cm, W - margin, 1.7*cm)

    canvas_obj.setFont(FONT, 7)
    canvas_obj.setFillColor(C_GREY)
    canvas_obj.drawString(margin, 1.5*cm,
        f'Planning d�f©sinfection VSAV (R�f©f. FT 18.6) â�,��?� {period_label} â�,��?� Document �f  conserver en caserne')

    canvas_obj.drawRightString(W - margin, 1.5*cm, f'Page {doc.page}')

    logo_h = 1.0*cm
    logo_w = logo_h * (300 / 150)
    logo_x = (W - logo_w) / 2
    logo_y = 0.2*cm

    try:
        if os.path.exists(LOGO_SDIS):
            canvas_obj.drawImage(
                LOGO_SDIS, logo_x, logo_y,
                width=logo_w, height=logo_h,
                preserveAspectRatio=True, mask='auto'
            )
        else:
            canvas_obj.setFont(FONT_BOLD, 7)
            canvas_obj.setFillColor(C_GREY)
            canvas_obj.drawCentredString(W / 2, 0.5*cm, 'SDIS â�,��?� Sapeurs-Pompiers')
    except Exception:
        canvas_obj.setFont(FONT_BOLD, 7)
        canvas_obj.setFillColor(C_GREY)
        canvas_obj.drawCentredString(W / 2, 0.5*cm, 'SDIS â�,��?� Sapeurs-Pompiers')

    canvas_obj.restoreState()

# ============================================================================
# G�f©n�f©ration principale
# ============================================================================
def generate():
    if not os.path.exists(CLEANING_CONFIG):
        print(f"Erreur : {CLEANING_CONFIG} introuvable.", file=sys.stderr)
        return False

    with open(CLEANING_CONFIG, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # P�f©riode : septembre â�?��?T juillet de l'ann�f©e suivante = 10 mois
    planning = compute_planning(config, nb_months=10)
    if not planning:
        print("Erreur : impossible de calculer le planning (config incompl�f¨te).", file=sys.stderr)
        return False

    # Label de p�f©riode pour le titre et le footer
    year_start = planning[0]['date'].year
    year_end   = planning[-1]['date'].year
    if year_start == year_end:
        period_label = f"Septembreâ�,��?oJuillet {year_start}"
    else:
        period_label = f"Septembre {year_start} â�,��?o Juillet {year_end}"

    pdf_file = os.path.join('/tmp', f'cleaning_rapport_{year_start}-{year_end}.pdf')  # /tmp : �f©vite conflits permissions SSH vs web

    styles = make_styles()

    doc = SimpleDocTemplate(
        pdf_file,
        pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1*cm, bottomMargin=2*cm,
        title=f'Planning D�f©sinfection VSAV â�,��?� {period_label}',
        author='Inventaire Pompier',
    )

    story = []

    # En-t�fªte
    story.append(build_header(styles, period_label))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width='100%', thickness=1.5, color=C_BLACK))
    story.append(Spacer(1, 0.3*cm))

    # Titre
    story.append(p(
        f'Planning de D�f©sinfection â�,��?� Cellule VSAV<br/>{period_label}',
        ParagraphStyle('main_title', fontName=FONT_BOLD, fontSize=13,
                        textColor=C_BLACK, alignment=TA_CENTER, leading=22)
    ))
    story.append(Spacer(1, 0.5*cm))

    # Note explicative
    story.append(p(
        '<i>Les dates indiqu�f©es correspondent �f  la semaine cible de d�f©sinfection. '
        'La date pr�f©cise est �f  adapter selon les disponibilit�f©s de l\'�f©quipe d�f©sign�f©e. '
        'Les dates indiqu�f©es correspondent au vendredi de d�f©but de la semaine d\'astreinte.</i>',
        ParagraphStyle('note_intro', fontName=FONT, fontSize=8, textColor=C_GREY,
                        leading=12, alignment=TA_LEFT)
    ))
    story.append(Spacer(1, 0.4*cm))

    # Tableau planning
    story.append(build_planning_table(planning, styles))
    story.append(Spacer(1, 0.5*cm))

    # Pr�f©cisions r�f©glementaires (R�f©f. FT 18.6 & FT 18.6.1 / FT 18.6.2)
    obligatoire_text = (
        '<b>Rappel r�f©glementaire (R�f©f. Fiche Technique FT 18.6) :</b><br/>'
        'Le protocole de nettoyage et d�f©sinfection de la cellule VSAV '
        'est rendu <b>obligatoire</b> dans les circonstances suivantes :<br/>'
        'â�,�¢ <b>De mani�f¨re p�f©riodique :</b> R�f©alisation syst�f©matique selon le pr�f©sent planning.<br/>'
        'â�,�¢ <b>Risque infectieux :</b> Apr�f¨s le transport dâ�,��"�une victime pr�f©sentant un risque infectieux important.<br/>'
        'â�,�¢ <b>Souillure :</b> Dans le cas o�f¹ la cellule sanitaire est fortement souill�f©e lors d\'une intervention.'
    )
    story.append(p(obligatoire_text, ParagraphStyle(
        'obligatoire_box', fontName=FONT, fontSize=8.5, textColor=C_DARK,
        leading=13, alignment=TA_LEFT
    )))

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 0.3*cm))

    # Note de bas de document
    story.append(p(
        '<i>Planning �f©tabli automatiquement par l\'application Inventaire Pompier. '
        'La rotation des �f©quipes est calcul�f©e selon le protocole de d�f©sinfection '
        'en vigueur au Nom du Centre de Secours.</i>',
        ParagraphStyle('note', fontName=FONT, fontSize=8, textColor=C_GREY,
                        leading=12, alignment=TA_LEFT)
    ))

    doc.build(
        story,
        onFirstPage=lambda c, d: on_page(c, d, period_label),
        onLaterPages=lambda c, d: on_page(c, d, period_label),
    )

    # Imprime le chemin absolu sur stdout â�?��?T lu par cleaning.php pour le stream
    print(pdf_file)
    print(f"â�"�?o PDF g�f©n�f©r�f© : {pdf_file}", file=sys.stderr)
    return True


if __name__ == '__main__':
    success = generate()
    sys.exit(0 if success else 1)