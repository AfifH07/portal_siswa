"""
Test script untuk memverifikasi bahwa attendance bisa di-insert ke database.
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

from apps.attendance.models import Attendance
from apps.students.models import Student
from datetime import date

def test_insert_attendance():
    print("=" * 70)
    print("TEST: INSERT ATTENDANCE KE DATABASE")
    print("=" * 70)

    # 1. Cek data awal
    print("\n1. Data Awal:")
    initial_count = Attendance.objects.count()
    print(f"   - Total Attendance: {initial_count}")

    # 2. Cari student untuk test
    print("\n2. Mencari student untuk test...")
    student = Student.objects.filter(aktif=True).first()
    if not student:
        print("   - Tidak ada student aktif! EXIT...")
        return False
    print(f"   - Student: {student.nisn} - {student.nama} - {student.kelas}")

    # 3. Insert attendance baru
    print("\n3. Membuat attendance record baru...")
    try:
        new_attendance = Attendance.objects.create(
            nisn=student,
            tanggal=date.today(),
            waktu='Siang',
            status='Hadir',
            keterangan='Test insert via script'
        )
        print(f"   - ID: {new_attendance.id}")
        print(f"   - NISN: {new_attendance.nisn.nisn}")
        print(f"   - Tanggal: {new_attendance.tanggal}")
        print(f"   - Waktu: {new_attendance.waktu}")
        print(f"   - Status: {new_attendance.status}")
        print(f"   - Keterangan: {new_attendance.keterangan}")
    except Exception as e:
        print(f"   - ERROR: {str(e)}")
        return False

    # 4. Cek setelah insert
    print("\n4. Data Setelah Insert:")
    final_count = Attendance.objects.count()
    print(f"   - Total Attendance: {final_count}")

    if final_count == initial_count + 1:
        print("   - Record baru berhasil ditambahkan!")
    else:
        print("   - WARNING: Count tidak sesuai ekspektasi!")

    # 5. Verifikasi record
    print("\n5. Verifikasi Record:")
    try:
        latest = Attendance.objects.filter(
            nisn=student,
            tanggal=date.today(),
            waktu='Siang'
        ).first()
        if latest:
            print(f"   - Record ditemukan: ID={latest.id}")
            print(f"   - Status: {latest.status}")
            print(f"   - SUKSES!")
            return True
        else:
            print("   - ERROR: Record tidak ditemukan!")
            return False
    except Exception as e:
        print(f"   - ERROR: {str(e)}")
        return False

def test_student_data():
    """Verifikasi bahwa ada student yang tersedia"""
    print("\n" + "=" * 70)
    print("VERIFIKASI: DATA STUDENT")
    print("=" * 70)

    active_students = Student.objects.filter(aktif=True)
    print(f"\nTotal active students: {active_students.count()}")

    if active_students.count() == 0:
        print("ERROR: Tidak ada student aktif!")
        return False

    print("\nList Students:")
    for student in active_students:
        print(f"  - {student.nisn} | {student.nama} | {student.kelas}")

    return True

if __name__ == '__main__':
    try:
        # Verifikasi student data
        if not test_student_data():
            print("\n" + "=" * 70)
            print("FAILED: Data student tidak tersedia")
            print("=" * 70)
            sys.exit(1)

        # Test insert attendance
        success = test_insert_attendance()

        print("\n" + "=" * 70)
        if success:
            print("SUCCESS: Attendance insert berhasil!")
        else:
            print("FAILED: Attendance insert gagal!")
        print("=" * 70)

        sys.exit(0 if success else 1)

    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
