#!/usr/local/bin/env python3
# -*- coding: utf-8 -*-
"""
asup_rapport_annuel.py
G�f©n�f¨re le rapport annuel ASUP PDF selon NS_2026-053.

Usage:
    python3 asup_rapport_annuel.py [ann�f©e]

D�f©pendances:
    pip install reportlab --break-system-packages
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
    Spacer, HRFlowable, KeepTogether
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

# ============================================================================
# Couleurs sobres (rapport administratif)
# ============================================================================
C_BLACK  = colors.HexColor('#000000')
C_DARK   = colors.HexColor('#1a1a1a')
C_GREY   = colors.HexColor('#4a4a4a')
C_LIGHT  = colors.HexColor('#f0f0f0')
C_BORDER = colors.HexColor('#cccccc')
C_RED    = colors.HexColor('#cc0000')
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
    s['th'] = ParagraphStyle('th', fontName=FONT_BOLD, fontSize=9,
                          textColor=C_WHITE,           # â�?� blanc
                          alignment=TA_CENTER, leading=13)
    return s

# ============================================================================
# Utilitaires
# ============================================================================
def fmt_date(iso):
    if not iso:
        return 'â�,��?�'
    try:
        d = iso.split(' ')[0].split('-')
        return f"{d[2]}/{d[1]}/{d[0]}"
    except Exception:
        return iso

def fmt_datetime(iso):
    if not iso:
        return 'â�,��?�'
    try:
        dt = datetime.fromisoformat(iso)
        return dt.strftime('%d/%m/%Y %H:%M')
    except Exception:
        return iso

def p(text, style):
    return Paragraph(str(text) if text is not None else 'â�,��?�', style)

# ============================================================================
# En-t�fªte de page (logo + titre organisme + titre rapport)
# ============================================================================
def build_header(styles, year):
    W = A4[0] - 3*cm  # largeur utile

    # Ligne 1 : logo caserne �f  gauche + texte organisme
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
        'Correspondant PUI'
    )
    header_data[0].append(p(org_text, ParagraphStyle(
        'org', fontName=FONT_BOLD, fontSize=10, textColor=C_BLACK, leading=15
    )))

    # Date �f  droite
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
# Tableau synth�f©tique annuel
# ============================================================================
def build_annual_table(history, styles):
    W = A4[0] - 3*cm

    # En-t�fªtes
    headers = [
        p('Mois / Date', styles['th']),
        p('Correspondant pharmacie', styles['th']),
        p('Pointage', styles['th']),
        p('R�f©sultat', styles['th']),
    ]
    rows = [headers]

    for idx, check in enumerate(history):
        date_str   = fmt_date(check.get('finished_at', ''))
        agent      = check.get('agent', 'â�,��?�')
        checked    = check.get('checked_count', 0)
        total      = check.get('total_count', 0)
        anomalies  = check.get('anomalies', [])
        unchecked  = check.get('unchecked_count', 0)
        pointage   = f"{checked}/{total}"

        # R�f©sultat de la v�f©rification
        if anomalies or unchecked > 0:
            result_cell = [p('âš  Anomalie(s) d�f©tect�f©e(s) :', ParagraphStyle(
                f'warn_{idx}', fontName=FONT_BOLD, fontSize=8, textColor=C_RED, leading=11
            ))]
            # D�f©tail des anomalies
            for med in anomalies:
                name     = med.get('name', 'â�,��?�')
                expected = med.get('quantity', 'â�,��?�')
                real     = med.get('_real_quantity')
                real_str = str(real) if real is not None else 'â�,��?�'
                comment  = med.get('_comment', '')
                detail   = f"â�,�¢ {name} : pr�f©vu {expected} / r�f©el {real_str}"
                if comment:
                    detail += f" â�,��?� {comment}"
                result_cell.append(p(detail, styles['small']))
            # Non v�f©rifi�f©s
            for med in check.get('unchecked_items', []):
                result_cell.append(p(
                    f"â�,�¢ {med.get('name', 'â�,��?�')} : non v�f©rifi�f©",
                    ParagraphStyle(f'nv_{idx}', fontName=FONT, fontSize=8,
                                    textColor=C_GREY, leading=11)
                ))
        else:
            result_cell = [p('â�"�?o V�f©rification OK', ParagraphStyle(
                f'ok_{idx}', fontName=FONT_BOLD, fontSize=8,
                textColor=colors.HexColor('#006600'), leading=11
            ))]

        rows.append([
            p(date_str, styles['normal']),
            p(agent, styles['normal']),
            p(pointage, styles['center']),
            result_cell if isinstance(result_cell, list) else [result_cell],
        ])

    # Convertir les cellules liste en TableCells correctement
    # (ReportLab accepte les listes de Flowables dans les cellules de Table)
    col_widths = [2.5*cm, 5.8*cm, 2*cm, W - 9.8*cm]

    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # En-t�fªte
        ('BACKGROUND', (0, 0), (-1, 0), C_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        # Corps
        ('FONTNAME', (0, 1), (-1, -1), FONT),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (2, 1), (3, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        # Grille
        ('GRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        # Alternance de fond
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_LIGHT]),
    ]))
    return table

# ============================================================================
# Footer : num�f©ro de page + logo SDIS texte
# ============================================================================
def on_page(canvas_obj, doc, year):
    canvas_obj.saveState()
    W, H = A4
    margin = 1.5*cm

    # Ligne s�f©paratrice
    canvas_obj.setStrokeColor(C_BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(margin, 1.7*cm, W - margin, 1.7*cm)

    # Gauche : mention archivage
    canvas_obj.setFont(FONT, 7)
    canvas_obj.setFillColor(C_GREY)
    canvas_obj.drawString(margin, 1.5*cm,
        'Document �f  archiver 24 mois â�,��?� Responsabilit�f© du chef de caserne (NS_2026-053)')

    # Droite : num�f©ro de page
    canvas_obj.drawRightString(W - margin, 1.5*cm, f'Page {doc.page}')

    # Centre : logo SDIS (r�f©duit en pied de page)
    logo_h = 1.0*cm
    logo_w = logo_h * (300 / 150)  # ratio approximatif du logo (largeur/hauteur)
    logo_x = (W - logo_w) / 2
    logo_y = 0.2*cm

    try:
        if os.path.exists(LOGO_SDIS):
            canvas_obj.drawImage(
                LOGO_SDIS,
                logo_x, logo_y,
                width=logo_w, height=logo_h,
                preserveAspectRatio=True,
                mask='auto'
            )
        else:
            canvas_obj.setFont(FONT_BOLD, 7)
            canvas_obj.setFillColor(C_GREY)
            canvas_obj.drawCentredString(W / 2, 0.5*cm,
                'SDIS â�,��?� Sapeurs-Pompiers')
    except Exception:
        canvas_obj.setFont(FONT_BOLD, 7)
        canvas_obj.setFillColor(C_GREY)
        canvas_obj.drawCentredString(W / 2, 0.5*cm,
            'SDIS â�,��?� Sapeurs-Pompiers')

    canvas_obj.restoreState()

# ============================================================================
# Construction du rapport JSON depuis asup_history.json (fallback)
# ============================================================================
def build_report_data_from_history(year):
    """
    Lit data/asup_history.json et construit la structure attendue par generate().
    Utilis�f© quand asup_rapport_{year}.json n'existe pas encore (g�f©n�f©ration manuelle
    en dehors du cron du 31 d�f©cembre).
    """
    history_file = os.path.join(DATA_DIR, 'asup_history.json')
    if not os.path.exists(history_file):
        print(f"Erreur : {history_file} introuvable.", file=sys.stderr)
        return None

    with open(history_file, 'r', encoding='utf-8') as f:
        all_history = json.load(f)

    year_history = sorted(
        [h for h in all_history
         if isinstance(h.get('finished_at'), str)
         and h['finished_at'][:4] == str(year)],
        key=lambda h: h.get('finished_at', '')
    )

    complete_checks = sum(
        1 for h in year_history if (h.get('unchecked_count') or 1) == 0
    )

    data = {
        'year':             year,
        'generated_at':     datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_checks':     len(year_history),
        'complete_checks':  complete_checks,
        'history':          year_history,
        'note_archivage':   (
            'Ce rapport doit �fªtre archiv�f© pendant 24 mois sous la responsabilit�f© '
            'du chef de caserne (r�f©glementation SDIS).'
        ),
    }

    # Sauvegarde du JSON pour usage futur (coh�f©rence avec le cron du 31/12)
    json_file = os.path.join(DATA_DIR, f'asup_rapport_{year}.json')
    try:
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"â�"�?o JSON g�f©n�f©r�f© depuis l'historique : {json_file}", file=sys.stderr)
    except OSError as e:
        print(f"Avertissement : impossible d'�f©crire {json_file} : {e}", file=sys.stderr)

    return data


# ============================================================================
# G�f©n�f©ration principale
# ============================================================================
def generate(year, pdf_path=None, force=False):
    json_file = os.path.join(DATA_DIR, f'asup_rapport_{year}.json')

    if not force and os.path.exists(json_file):
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"â�"�?o JSON existant charg�f© : {json_file}", file=sys.stderr)
    else:
        if force:
            print(f"--force : reconstruction depuis asup_history.jsonâ�,�¦", file=sys.stderr)
        else:
            print(f"JSON {json_file} absent â�,��?� reconstruction depuis asup_history.jsonâ�,�¦", file=sys.stderr)
        data = build_report_data_from_history(year)
        if data is None:
            return False

    history         = data.get('history', [])
    total_checks    = data.get('total_checks', 0)
    complete_checks = data.get('complete_checks', 0)
    # Chemin de sortie : argument explicite (ex: /tmp/) ou fichier permanent dans data/
    pdf_file = pdf_path if pdf_path else os.path.join(DATA_DIR, f'asup_rapport_{year}.pdf')

    styles = make_styles()

    doc = SimpleDocTemplate(
        pdf_file,
        pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1*cm,  bottomMargin=2*cm,
        title=f'Rapport ASUP {year} â�,��?� NS_2026-053',
        author='Inventaire Pompier',
    )

    story = []

    # --- En-t�fªte ---
    story.append(build_header(styles, year))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width='100%', thickness=1.5, color=C_BLACK))
    story.append(Spacer(1, 0.3*cm))

    # --- Titre principal ---
    story.append(p(
        f'Suivi de la v�f©rification des substances ASUP '
        f'selon NS_2026-053 â�,��?� Ann�f©e {year}',
        ParagraphStyle('main_title', fontName=FONT_BOLD, fontSize=13,
                        textColor=C_BLACK, alignment=TA_CENTER, leading=20)
    ))
    story.append(Spacer(1, 0.5*cm))

    # --- R�f©sum�f© statistiques ---
    summary_data = [
        [p('Nombre de contr�f´les effectu�f©s', styles['bold']),
         p(str(total_checks), styles['center'])],
        [p('Contr�f´les sans anomalie', styles['bold']),
         p(str(complete_checks), styles['center'])],
        [p('Contr�f´les avec anomalie(s)', styles['bold']),
         p(str(total_checks - complete_checks), styles['center'])],
    ]
    summary_table = Table(summary_data, colWidths=[10*cm, 3*cm])
    summary_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('BACKGROUND', (0, 0), (0, -1), C_LIGHT),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [C_LIGHT, C_WHITE]),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.6*cm))

    # --- Tableau annuel d�f©taill�f© ---
    story.append(p('D�f©tail mensuel des v�f©rifications', styles['h2']))
    story.append(Spacer(1, 0.2*cm))

    if not history:
        story.append(p('Aucun contr�f´le enregistr�f© pour cette ann�f©e.', styles['normal']))
    else:
        story.append(build_annual_table(history, styles))

    story.append(Spacer(1, 0.8*cm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 0.3*cm))

    # --- Note de conformit�f© ---
    story.append(p(
        '<i>Rapport �f©tabli conform�f©ment �f  la note de service NS_2026-053 relative �f  la gestion '
        'des substances m�f©dicamenteuses ASUP dans les v�f©hicules de secours.</i>',
        ParagraphStyle('note', fontName=FONT, fontSize=8, textColor=C_GREY,
                        leading=12, alignment=TA_LEFT)
    ))

    # --- Signature ---
    story.append(Spacer(1, 1.5*cm))
    sig_data = [[
        p('Le correspondant pharmacie', styles['center']),
        p('Le chef de caserne', styles['center']),
    ]]
    sig_data.append([
        p('\n\n_________________________', styles['center']),
        p('\n\n_________________________', styles['center']),
    ])
    sig_table = Table(sig_data, colWidths=[8*cm, 8*cm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(sig_table)

    # --- Build ---
    doc.build(
        story,
        onFirstPage=lambda c, d: on_page(c, d, year),
        onLaterPages=lambda c, d: on_page(c, d, year),
    )
    print(f"â�"�?o PDF g�f©n�f©r�f© : {pdf_file}", file=sys.stderr)
    return True


if __name__ == '__main__':
    args  = sys.argv[1:]
    force = '--force' in args
    args  = [a for a in args if a != '--force']

    year    = int(args[0]) if len(args) > 0 else datetime.now().year
    pdf_out = args[1] if len(args) > 1 else None

    success = generate(year, pdf_out, force=force)
    sys.exit(0 if success else 1)
