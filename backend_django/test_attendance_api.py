"""
Test script untuk memverifikasi endpoint /api/attendance/initialize/ dan /api/attendance/batch/
berfungsi dengan benar dari API ke database.
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

import requests
from datetime import date

BASE_URL = 'http://localhost:8000'

def login(username='superuser', password='admin123'):
    """Login dan return access token"""
    response = requests.post(
        f'{BASE_URL}/api/auth/login/',
        json={'username': username, 'password': password}
    )
    data = response.json()
    return data.get('access')

def test_initialize_endpoint():
    """Test /api/attendance/initialize/ endpoint"""
    print("=" * 70)
    print("TEST: POST /api/attendance/initialize/")
    print("=" * 70)

    token = login()
    if not token:
        print("ERROR: Gagal login!")
        return False

    headers = {'Authorization': f'Bearer {token}'}

    # Test dengan kelas yang ada di database
    payload = {
        'kelas': 'X-IPA-1',
        'tanggal': str(date.today()),
        'mata_pelajaran': 'Biologi'
    }

    print(f"\n1. Request Payload:")
    print(f"   - Kelas: {payload['kelas']}")
    print(f"   - Tanggal: {payload['tanggal']}")
    print(f"   - Mata Pelajaran: {payload['mata_pelajaran']}")

    response = requests.post(
        f'{BASE_URL}/api/attendance/initialize/',
        headers=headers,
        json=payload
    )

    print(f"\n2. Response:")
    print(f"   - Status Code: {response.status_code}")
    print(f"   - Content-Type: {response.headers.get('Content-Type')}")

    if response.status_code == 200:
        data = response.json()
        print(f"   - Success: {data.get('success')}")
        print(f"   - Message: {data.get('message')}")
        print(f"   - Draft ID: {data.get('draft_id')}")
        print(f"   - Total Students: {data.get('total_students')}")
        print(f"   - Students Count: {len(data.get('data', []))}")

        # Tampilkan data siswa
        students = data.get('data', [])
        if students:
            print(f"\n3. Data Siswa yang Dimuat:")
            for i, student in enumerate(students, 1):
                print(f"   {i}. {student['nisn']} - {student['nama']} - {student['status']}")

        return {
            'success': True,
            'draft_id': data.get('draft_id'),
            'students': students
        }
    else:
        print(f"   - ERROR: {response.text}")
        return False

def test_batch_endpoint(draft_id, students_data):
    """Test /api/attendance/batch/ endpoint"""
    print("\n" + "=" * 70)
    print("TEST: POST /api/attendance/batch/")
    print("=" * 70)

    token = login()
    if not token:
        print("ERROR: Gagal login!")
        return False

    headers = {'Authorization': f'Bearer {token}'}

    # Modifikasi status siswa untuk test
    attendance_data = []
    for student in students_data:
        # Ubah status ke random untuk test
        import random
        statuses = ['Hadir', 'Sakit', 'Izin', 'Alpha']
        new_status = random.choice(statuses)

        attendance_data.append({
            'nisn': student['nisn'],
            'status': new_status,
            'keterangan': f'Test via API - {new_status}'
        })

    payload = {
        'draft_id': draft_id,
        'attendance_data': attendance_data
    }

    print(f"\n1. Request Payload:")
    print(f"   - Draft ID: {payload['draft_id']}")
    print(f"   - Attendance Data Count: {len(payload['attendance_data'])}")

    print(f"\n2. Data yang Akan Disimpan:")
    for i, data in enumerate(attendance_data, 1):
        print(f"   {i}. NISN: {data['nisn']} | Status: {data['status']} | Ket: {data['keterangan']}")

    response = requests.post(
        f'{BASE_URL}/api/attendance/batch/',
        headers=headers,
        json=payload
    )

    print(f"\n3. Response:")
    print(f"   - Status Code: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"   - Success: {data.get('success')}")
        print(f"   - Message: {data.get('message')}")
        print(f"   - Saved: {data.get('saved', 0)}")
        print(f"   - Updated: {data.get('updated', 0)}")
        print(f"   - Errors: {data.get('errors', 0)}")

        if data.get('error_details'):
            print(f"\n4. Error Details:")
            for error in data['error_details']:
                print(f"   - {error}")

        return data.get('success', False)
    else:
        print(f"   - ERROR: {response.text}")
        return False

def verify_database():
    """Verifikasi data di database"""
    print("\n" + "=" * 70)
    print("VERIFIKASI: DATABASE")
    print("=" * 70)

    from apps.attendance.models import Attendance

    # Cek attendance hari ini
    today_attendance = Attendance.objects.filter(tanggal=date.today())
    print(f"\n1. Attendance Hari Ini ({date.today()}):")
    print(f"   - Total Records: {today_attendance.count()}")

    if today_attendance.count() > 0:
        print(f"\n2. Detail Attendance:")
        for att in today_attendance:
            print(f"   - ID: {att.id} | NISN: {att.nisn.nisn} | {att.nisn.nama} | Status: {att.status} | Waktu: {att.waktu}")
    else:
        print("   - Tidak ada data attendance hari ini")

    return today_attendance.count()

if __name__ == '__main__':
    try:
        # Step 1: Cek data awal di database
        initial_count = verify_database()

        # Step 2: Test initialize endpoint
        initialize_result = test_initialize_endpoint()
        if not initialize_result:
            print("\n" + "=" * 70)
            print("FAILED: Initialize endpoint gagal!")
            print("=" * 70)
            sys.exit(1)

        # Step 3: Test batch endpoint
        batch_success = test_batch_endpoint(
            initialize_result['draft_id'],
            initialize_result['students']
        )

        # Step 4: Verifikasi data akhir di database
        print("\n" + "=" * 70)
        final_count = verify_database()

        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"Initial Attendance Count: {initial_count}")
        print(f"Final Attendance Count: {final_count}")
        print(f"New Records Added: {final_count - initial_count}")

        if batch_success:
            print("\n" + "=" * 70)
            print("SUCCESS: Semua endpoint attendance berfungsi dengan benar!")
            print("=" * 70)
            sys.exit(0)
        else:
            print("\n" + "=" * 70)
            print("FAILED: Batch endpoint gagal!")
            print("=" * 70)
            sys.exit(1)

    except requests.exceptions.ConnectionError:
        print("\nERROR: Server tidak berjalan. Jalankan 'python manage.py runserver' terlebih dahulu.")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
