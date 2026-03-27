"""
Script untuk import data siswa dan nilai dari Excel
Jalankan dengan: python manage.py shell < import_students_grades.py
atau: python import_students_grades.py (setelah setup Django)
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

import pandas as pd
from apps.students.models import Student
from apps.grades.models import Grade

# Path ke file Excel
EXCEL_FILE = os.path.join(os.path.dirname(__file__), '..', 'f_legersemua_XII-A (2).xlsx')

def parse_excel():
    """Parse Excel file and extract students + grades"""
    df = pd.read_excel(EXCEL_FILE, header=None)

    # Get subject mapping from row 4 (subjects at specific columns)
    row4 = df.iloc[4]
    subjects = {}
    current_col = 4

    # Each subject spans 7 columns: Smt1, Smt2, Smt3, Smt4, Smt5, Smt6, rerata
    subject_names = [
        'Pendidikan Agama Islam dan Budi Pekerti',
        'Pendidikan Pancasila',
        'Bahasa Indonesia',
        'Bahasa Inggris',
        'Bahasa Inggris Tingkat Lanjut',
        'Muatan Lokal Bahasa Daerah',
        'Matematika (Umum)',
        'Matematika Tingkat Lanjut',
        'Ilmu Pengetahuan Alam (IPA)',
        'Biologi',
        'Fisika',
        'Kimia',
        'Ilmu Pengetahuan Sosial (IPS)',
        'Geografi',
        'Sejarah',
        'Ekonomi',
        'Pendidikan Jasmani, Olahraga, dan Kesehatan',
        'Prakarya dan Kewirausahaan',
        'Informatika',
        'Seni Rupa'
    ]

    for i, subject in enumerate(subject_names):
        start_col = 4 + (i * 7)
        subjects[subject] = {
            'start_col': start_col,
            'smt1': start_col,
            'smt2': start_col + 1,
            'smt3': start_col + 2,
            'smt4': start_col + 3,
            'smt5': start_col + 4,
            'smt6': start_col + 5,
        }

    # Parse students (starting from row 7)
    students = []
    for i in range(7, len(df)):
        row = df.iloc[i]
        nisn = row[2]
        nama = row[1]

        if pd.isna(nisn) or pd.isna(nama):
            continue

        # Convert NISN to string, handle float
        if isinstance(nisn, float):
            nisn = str(int(nisn))
        else:
            nisn = str(nisn).strip()

        if not nisn or nisn == 'nan':
            continue

        # Pad NISN with leading zeros if needed
        nisn = nisn.zfill(10)

        student_data = {
            'nisn': nisn,
            'nama': str(nama).strip(),
            'grades': []
        }

        # Extract grades for each subject
        for subject_name, cols in subjects.items():
            for sem_key, col in cols.items():
                if sem_key.startswith('smt'):
                    nilai = row[col] if col < len(row) else None
                    if pd.notna(nilai) and nilai != 'NaN':
                        try:
                            nilai_int = int(float(nilai))
                            if 0 <= nilai_int <= 100:
                                # Map semester number to Ganjil/Genap
                                sem_num = int(sem_key.replace('smt', ''))
                                semester = 'Ganjil' if sem_num % 2 == 1 else 'Genap'
                                tahun_ajaran = f'202{(sem_num-1)//2}/202{(sem_num-1)//2 + 1}'

                                student_data['grades'].append({
                                    'mata_pelajaran': subject_name,
                                    'nilai': nilai_int,
                                    'semester': semester,
                                    'tahun_ajaran': tahun_ajaran,
                                    'jenis': 'UAS',  # Default to UAS for report grades
                                    'kelas': 'XII A'
                                })
                        except (ValueError, TypeError):
                            pass

        students.append(student_data)

    return students


def import_data():
    """Import students and grades to database"""
    print("="*60)
    print("IMPORT DATA SISWA DAN NILAI")
    print("="*60)

    # Parse Excel
    print("\n[1] Parsing Excel file...")
    students = parse_excel()
    print(f"    Found {len(students)} students")

    # Delete existing data
    print("\n[2] Deleting existing data...")
    existing_students = Student.objects.count()
    existing_grades = Grade.objects.count()
    print(f"    Existing students: {existing_students}")
    print(f"    Existing grades: {existing_grades}")

    Grade.objects.all().delete()
    print("    Deleted all grades")
    Student.objects.all().delete()
    print("    Deleted all students")

    # Import students
    print("\n[3] Importing students...")
    imported_students = 0
    for student_data in students:
        try:
            student = Student.objects.create(
                nisn=student_data['nisn'],
                nama=student_data['nama'],
                kelas='XII A',
                program='IPA',  # Default program
                wali_nama='-',
                wali_phone='-',
                aktif=True
            )
            imported_students += 1
            print(f"    [OK] {student.nama} ({student.nisn})")
        except Exception as e:
            print(f"    [ERR] Error importing {student_data['nama']}: {e}")

    print(f"\n    Imported {imported_students} students")

    # Import grades
    print("\n[4] Importing grades...")
    imported_grades = 0
    for student_data in students:
        try:
            student = Student.objects.get(nisn=student_data['nisn'])
            for grade_data in student_data['grades']:
                Grade.objects.create(
                    nisn=student,
                    mata_pelajaran=grade_data['mata_pelajaran'],
                    nilai=grade_data['nilai'],
                    semester=grade_data['semester'],
                    tahun_ajaran=grade_data['tahun_ajaran'],
                    jenis=grade_data['jenis'],
                    kelas=grade_data['kelas'],
                    guru='Admin Import'
                )
                imported_grades += 1
        except Exception as e:
            print(f"    [ERR] Error importing grades for {student_data['nama']}: {e}")

    print(f"\n    Imported {imported_grades} grades")

    # Summary
    print("\n" + "="*60)
    print("IMPORT COMPLETE")
    print("="*60)
    print(f"Total students imported: {imported_students}")
    print(f"Total grades imported: {imported_grades}")
    print(f"Average grades per student: {imported_grades/imported_students if imported_students > 0 else 0:.1f}")


if __name__ == '__main__':
    import_data()
