"""
PDF Report Generator - Portal Ponpes Baron v2.3
================================================

Generates comprehensive PDF rapor using ReportLab.
Includes:
- Kop Surat Pondok Pesantren Al-Ihsan Baron
- Academic grades
- Kesantrian (BLP) scores
- Hafalan progress
- Attendance summary
- Pembinaan records

Usage:
    from apps.kesantrian.pdf_generator import generate_rapor_pdf
    pdf_buffer = generate_rapor_pdf(nisn, semester, tahun_ajaran)
"""

import io
from datetime import datetime
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from apps.students.models import Student
from apps.grades.models import Grade
from apps.attendance.models import Attendance
from apps.kesantrian.models import BLPEntry, Pembinaan, TargetHafalan, Ibadah, BLP_INDICATORS
from django.db.models import Avg, Count, Q


# ============================================
# CONSTANTS
# ============================================
PESANTREN_NAME = "PONDOK PESANTREN AL-IHSAN BARON"
PESANTREN_ADDRESS = "Jl. Baron No. 123, Kecamatan Baron, Kabupaten Nganjuk, Jawa Timur 64473"
PESANTREN_PHONE = "Telp: (0358) 123456 | Email: info@ppalihsanbaron.sch.id"

# Colors (Baron Emerald Theme)
EMERALD_DARK = colors.HexColor('#0f6347')
EMERALD_MID = colors.HexColor('#178560')
EMERALD_LIGHT = colors.HexColor('#d6f5ec')
BARON_GOLD = colors.HexColor('#c8961c')
TEXT_DARK = colors.HexColor('#0a2e20')
TEXT_MUTED = colors.HexColor('#7aaa94')


# ============================================
# STYLES
# ============================================
def get_custom_styles():
    """Create custom paragraph styles for the report."""
    styles = getSampleStyleSheet()

    # Title style
    styles.add(ParagraphStyle(
        name='ReportTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=EMERALD_DARK,
        alignment=TA_CENTER,
        spaceAfter=6,
        fontName='Helvetica-Bold'
    ))

    # Section header
    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=EMERALD_DARK,
        spaceBefore=12,
        spaceAfter=6,
        fontName='Helvetica-Bold',
        borderPadding=4,
        backColor=EMERALD_LIGHT
    ))

    # Normal text
    styles.add(ParagraphStyle(
        name='ReportBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=TEXT_DARK,
        alignment=TA_JUSTIFY,
        spaceAfter=4
    ))

    # Small text
    styles.add(ParagraphStyle(
        name='SmallText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=TEXT_MUTED,
        alignment=TA_CENTER
    ))

    # Table header
    styles.add(ParagraphStyle(
        name='TableHeader',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.white,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER
    ))

    return styles


# ============================================
# HEADER / KOP SURAT
# ============================================
def create_header(canvas, doc):
    """Draw the letterhead (kop surat) on each page."""
    canvas.saveState()

    width, height = A4
    margin = 2 * cm

    # Logo placeholder (circle with mosque icon)
    canvas.setFillColor(BARON_GOLD)
    canvas.circle(margin + 1.5*cm, height - margin - 1.5*cm, 1.2*cm, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica-Bold', 16)
    canvas.drawCentredString(margin + 1.5*cm, height - margin - 1.7*cm, "B")

    # Pesantren name
    canvas.setFillColor(EMERALD_DARK)
    canvas.setFont('Helvetica-Bold', 14)
    canvas.drawString(margin + 3.5*cm, height - margin - 0.8*cm, PESANTREN_NAME)

    # Address
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(TEXT_DARK)
    canvas.drawString(margin + 3.5*cm, height - margin - 1.4*cm, PESANTREN_ADDRESS)
    canvas.drawString(margin + 3.5*cm, height - margin - 1.9*cm, PESANTREN_PHONE)

    # Horizontal line
    canvas.setStrokeColor(EMERALD_DARK)
    canvas.setLineWidth(2)
    canvas.line(margin, height - margin - 2.5*cm, width - margin, height - margin - 2.5*cm)

    canvas.setStrokeColor(BARON_GOLD)
    canvas.setLineWidth(1)
    canvas.line(margin, height - margin - 2.7*cm, width - margin, height - margin - 2.7*cm)

    # Footer
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(width / 2, 1.5*cm, f"Dicetak pada: {datetime.now().strftime('%d %B %Y %H:%M')} | Portal Akademik Ponpes Baron v2.3")
    canvas.drawCentredString(width / 2, 1*cm, f"Halaman {doc.page}")

    canvas.restoreState()


# ============================================
# MAIN PDF GENERATOR
# ============================================
def generate_rapor_pdf(nisn, semester='Ganjil', tahun_ajaran='2025/2026'):
    """
    Generate comprehensive PDF rapor for a student.

    Args:
        nisn: Student NISN
        semester: 'Ganjil' or 'Genap'
        tahun_ajaran: Academic year (e.g., '2025/2026')

    Returns:
        BytesIO buffer containing PDF data
    """
    # Get student data
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        raise ValueError(f"Student with NISN {nisn} not found")

    # Create PDF buffer
    buffer = io.BytesIO()

    # Create document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5*cm,  # Space for header
        bottomMargin=2*cm,
        leftMargin=2*cm,
        rightMargin=2*cm
    )

    # Get styles
    styles = get_custom_styles()

    # Build content
    content = []

    # ========== TITLE ==========
    content.append(Paragraph(
        f"RAPOR SEMESTER {semester.upper()}",
        styles['ReportTitle']
    ))
    content.append(Paragraph(
        f"Tahun Ajaran {tahun_ajaran}",
        styles['SmallText']
    ))
    content.append(Spacer(1, 0.5*cm))

    # ========== STUDENT INFO ==========
    content.append(Paragraph("DATA SANTRI", styles['SectionHeader']))

    student_data = [
        ['Nama Lengkap', ':', student.nama],
        ['NISN', ':', student.nisn],
        ['Kelas', ':', student.kelas or '-'],
        ['Tempat, Tanggal Lahir', ':', f"{student.tempat_lahir or '-'}, {student.tanggal_lahir.strftime('%d %B %Y') if student.tanggal_lahir else '-'}"],
        ['Alamat', ':', student.alamat or '-'],
        ['Nama Wali', ':', student.wali_name or '-'],
    ]

    student_table = Table(student_data, colWidths=[4*cm, 0.5*cm, 10*cm])
    student_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), EMERALD_DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    content.append(student_table)
    content.append(Spacer(1, 0.5*cm))

    # ========== ACADEMIC GRADES ==========
    content.append(Paragraph("NILAI AKADEMIK", styles['SectionHeader']))

    grades = Grade.objects.filter(
        nisn=student,
        semester=semester,
        tahun_ajaran=tahun_ajaran
    ).order_by('mata_pelajaran')

    if grades.exists():
        grade_data = [['No', 'Mata Pelajaran', 'Nilai', 'Predikat']]

        for idx, grade in enumerate(grades, 1):
            predikat = get_grade_predikat(grade.nilai)
            grade_data.append([
                str(idx),
                grade.mata_pelajaran,
                str(round(grade.nilai, 1)),
                predikat
            ])

        # Average row
        avg = grades.aggregate(avg=Avg('nilai'))['avg'] or 0
        grade_data.append(['', 'Rata-rata', str(round(avg, 2)), get_grade_predikat(avg)])

        grade_table = Table(grade_data, colWidths=[1*cm, 8*cm, 2*cm, 3*cm])
        grade_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), EMERALD_DARK),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),

            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),
            ('ALIGN', (2, 1), (3, -1), 'CENTER'),

            # Average row
            ('BACKGROUND', (0, -1), (-1, -1), EMERALD_LIGHT),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),

            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, EMERALD_MID),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        content.append(grade_table)
    else:
        content.append(Paragraph("Belum ada data nilai untuk semester ini.", styles['ReportBody']))

    content.append(Spacer(1, 0.5*cm))

    # ========== BLP (CHARACTER ASSESSMENT) ==========
    content.append(Paragraph("PENILAIAN KARAKTER (BLP)", styles['SectionHeader']))

    blp_entry = BLPEntry.objects.filter(
        siswa=student,
        semester=semester,
        tahun_ajaran=tahun_ajaran
    ).order_by('-week_start').first()

    if blp_entry:
        blp_info = [
            ['Total Skor', ':', f"{blp_entry.total_score} / 390"],
            ['Predikat', ':', blp_entry.predikat],
            ['Periode', ':', f"{blp_entry.week_start.strftime('%d %b')} - {blp_entry.week_end.strftime('%d %b %Y')}"],
        ]

        blp_info_table = Table(blp_info, colWidths=[4*cm, 0.5*cm, 10*cm])
        blp_info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), EMERALD_DARK),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        content.append(blp_info_table)
        content.append(Spacer(1, 0.3*cm))

        # Domain scores
        if blp_entry.domain_scores:
            domain_data = [['Domain', 'Skor', 'Maks', 'Persentase']]

            domain_labels = {
                'akhlak': 'Akhlak & Adab',
                'kedisiplinan': 'Kedisiplinan',
                'ibadah': 'Ibadah & Spiritual',
                'akademik': 'Akademik Keagamaan',
                'sosial': 'Interaksi Sosial',
                'pengembangan_diri': 'Pengembangan Diri'
            }

            for domain, scores in blp_entry.domain_scores.items():
                label = domain_labels.get(domain, domain)
                domain_data.append([
                    label,
                    str(scores.get('score', 0)),
                    str(scores.get('max_score', 0)),
                    f"{scores.get('percentage', 0):.1f}%"
                ])

            domain_table = Table(domain_data, colWidths=[6*cm, 2*cm, 2*cm, 3*cm])
            domain_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), EMERALD_DARK),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, EMERALD_MID),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
            ]))
            content.append(domain_table)
    else:
        content.append(Paragraph("Belum ada data penilaian BLP untuk semester ini.", styles['ReportBody']))

    content.append(Spacer(1, 0.5*cm))

    # ========== HAFALAN PROGRESS ==========
    content.append(Paragraph("PROGRESS HAFALAN AL-QURAN", styles['SectionHeader']))

    hafalan = TargetHafalan.objects.filter(
        siswa=student,
        semester=semester,
        tahun_ajaran=tahun_ajaran
    ).first()

    if hafalan:
        hafalan_data = [
            ['Target Hafalan', ':', f"{hafalan.target_juz} Juz"],
            ['Capaian', ':', f"{hafalan.tercapai_juz} Juz"],
            ['Persentase', ':', f"{hafalan.persentase_tercapai:.1f}%"],
            ['Status', ':', 'Tercapai' if hafalan.persentase_tercapai >= 100 else 'Dalam Proses'],
        ]
    else:
        # Use student's general hafalan data
        target = student.target_hafalan or 0
        current = student.current_hafalan or 0
        pct = (current / target * 100) if target > 0 else 0

        hafalan_data = [
            ['Target Hafalan', ':', f"{target} Juz"],
            ['Capaian', ':', f"{current} Juz"],
            ['Persentase', ':', f"{pct:.1f}%"],
        ]

    hafalan_table = Table(hafalan_data, colWidths=[4*cm, 0.5*cm, 10*cm])
    hafalan_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), EMERALD_DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    content.append(hafalan_table)
    content.append(Spacer(1, 0.5*cm))

    # ========== ATTENDANCE SUMMARY ==========
    content.append(Paragraph("RINGKASAN KEHADIRAN", styles['SectionHeader']))

    # Get attendance stats
    attendance_stats = Attendance.objects.filter(nisn=student).values('status').annotate(count=Count('id'))
    stats_dict = {s['status']: s['count'] for s in attendance_stats}

    hadir = stats_dict.get('Hadir', 0)
    izin = stats_dict.get('Izin', 0)
    sakit = stats_dict.get('Sakit', 0)
    alpha = stats_dict.get('Alpha', 0)
    total = hadir + izin + sakit + alpha

    attendance_data = [
        ['Status', 'Jumlah', 'Persentase'],
        ['Hadir', str(hadir), f"{(hadir/total*100):.1f}%" if total > 0 else "0%"],
        ['Izin', str(izin), f"{(izin/total*100):.1f}%" if total > 0 else "0%"],
        ['Sakit', str(sakit), f"{(sakit/total*100):.1f}%" if total > 0 else "0%"],
        ['Alpha', str(alpha), f"{(alpha/total*100):.1f}%" if total > 0 else "0%"],
        ['Total', str(total), '100%'],
    ]

    att_table = Table(attendance_data, colWidths=[5*cm, 3*cm, 3*cm])
    att_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), EMERALD_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, -1), (-1, -1), EMERALD_LIGHT),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, EMERALD_MID),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    content.append(att_table)
    content.append(Spacer(1, 0.5*cm))

    # ========== PEMBINAAN NOTES ==========
    content.append(Paragraph("CATATAN PEMBINAAN", styles['SectionHeader']))

    pembinaan_records = Pembinaan.objects.filter(siswa=student).order_by('-tanggal')[:5]

    if pembinaan_records.exists():
        for p in pembinaan_records:
            content.append(Paragraph(
                f"<b>{p.tanggal.strftime('%d %b %Y')}</b> - {p.get_kategori_display()}: {p.judul}",
                styles['ReportBody']
            ))
            if p.deskripsi:
                content.append(Paragraph(f"<i>{p.deskripsi[:200]}...</i>" if len(p.deskripsi) > 200 else f"<i>{p.deskripsi}</i>", styles['SmallText']))
            content.append(Spacer(1, 0.2*cm))
    else:
        content.append(Paragraph("Tidak ada catatan pembinaan khusus.", styles['ReportBody']))

    content.append(Spacer(1, 1*cm))

    # ========== SIGNATURES ==========
    content.append(Paragraph("PENGESAHAN", styles['SectionHeader']))

    sig_date = datetime.now().strftime('%d %B %Y')
    sig_data = [
        ['Mengetahui,', '', f'Baron, {sig_date}'],
        ['Kepala Pondok Pesantren', '', 'Wali Kelas'],
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['_________________________', '', '_________________________'],
        ['NIP. .....................', '', 'NIP. .....................'],
    ]

    sig_table = Table(sig_data, colWidths=[6*cm, 3*cm, 6*cm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    content.append(sig_table)

    # Build PDF
    doc.build(content, onFirstPage=create_header, onLaterPages=create_header)

    buffer.seek(0)
    return buffer


# ============================================
# HELPER FUNCTIONS
# ============================================
def get_grade_predikat(nilai):
    """Convert numeric grade to predikat."""
    if nilai >= 90:
        return 'A (Mumtaz)'
    elif nilai >= 80:
        return 'B (Jayyid Jiddan)'
    elif nilai >= 70:
        return 'C (Jayyid)'
    elif nilai >= 60:
        return 'D (Maqbul)'
    else:
        return 'E (Perlu Pembinaan)'


def generate_blp_report_pdf(nisn, week_start=None):
    """
    Generate BLP-specific report PDF.

    Args:
        nisn: Student NISN
        week_start: Optional specific week start date

    Returns:
        BytesIO buffer containing PDF data
    """
    try:
        student = Student.objects.get(nisn=nisn)
    except Student.DoesNotExist:
        raise ValueError(f"Student with NISN {nisn} not found")

    # Get BLP entry
    query = BLPEntry.objects.filter(siswa=student)
    if week_start:
        query = query.filter(week_start=week_start)
    blp_entry = query.order_by('-week_start').first()

    if not blp_entry:
        raise ValueError(f"No BLP entry found for student {nisn}")

    # Similar structure to main rapor but focused on BLP details
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=3.5*cm,
        bottomMargin=2*cm,
        leftMargin=2*cm,
        rightMargin=2*cm
    )

    styles = get_custom_styles()
    content = []

    # Title
    content.append(Paragraph("LAPORAN BUKU LAPANGAN PESANTREN (BLP)", styles['ReportTitle']))
    content.append(Paragraph(
        f"Periode: {blp_entry.week_start.strftime('%d %B')} - {blp_entry.week_end.strftime('%d %B %Y')}",
        styles['SmallText']
    ))
    content.append(Spacer(1, 0.5*cm))

    # Student info
    content.append(Paragraph("DATA SANTRI", styles['SectionHeader']))
    student_info = [
        ['Nama', ':', student.nama],
        ['NISN', ':', student.nisn],
        ['Kelas', ':', student.kelas or '-'],
    ]
    info_table = Table(student_info, colWidths=[4*cm, 0.5*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), EMERALD_DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ]))
    content.append(info_table)
    content.append(Spacer(1, 0.5*cm))

    # Score summary
    content.append(Paragraph("RINGKASAN SKOR", styles['SectionHeader']))
    score_info = [
        ['Total Skor', ':', f"{blp_entry.total_score} / 390 poin"],
        ['Predikat', ':', blp_entry.predikat],
        ['Bonus Poin', ':', f"{blp_entry.bonus_points} poin"],
    ]
    score_table = Table(score_info, colWidths=[4*cm, 0.5*cm, 10*cm])
    score_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), EMERALD_DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ]))
    content.append(score_table)
    content.append(Spacer(1, 0.5*cm))

    # Detailed indicators by domain
    content.append(Paragraph("DETAIL PENILAIAN PER DOMAIN", styles['SectionHeader']))

    for domain, domain_info in BLP_INDICATORS.items():
        content.append(Paragraph(f"<b>{domain_info['label']}</b>", styles['ReportBody']))

        indicator_data = [['Indikator', 'Skor']]
        domain_values = blp_entry.indicator_values.get(domain, {})

        for code, label in domain_info['indicators']:
            score = domain_values.get(code, 0)
            indicator_data.append([label, f"{score}/5"])

        ind_table = Table(indicator_data, colWidths=[12*cm, 2*cm])
        ind_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), EMERALD_LIGHT),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
        ]))
        content.append(ind_table)
        content.append(Spacer(1, 0.3*cm))

    # Build PDF
    doc.build(content, onFirstPage=create_header, onLaterPages=create_header)

    buffer.seek(0)
    return buffer
