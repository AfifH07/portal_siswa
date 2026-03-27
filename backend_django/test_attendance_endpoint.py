"""
Test script untuk memverifikasi endpoint attendance.
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

import requests
import json

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
        print("✗ Gagal login")
        return False
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # Test dengan kelas yang ada di database
    test_cases = [
        {
            'kelas': 'X-IPA-1',
            'tanggal': '2026-01-31',
            'mata_pelajaran': 'Matematika',
            'expected': 'Success'
        },
        {
            'kelas': 'X A',  # Format salah (spasi)
            'tanggal': '2026-01-31',
            'mata_pelajaran': 'Matematika',
            'expected': '404 - Kelas tidak ada siswa aktif'
        }
    ]
    
    for test in test_cases:
        print(f"\nTest: Kelas='{test['kelas']}'")
        response = requests.post(
            f'{BASE_URL}/api/attendance/initialize/',
            headers=headers,
            json={
                'kelas': test['kelas'],
                'tanggal': test['tanggal'],
                'mata_pelajaran': test['mata_pelajaran']
            }
        )
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.json()}")
        
        if 'success' in response.json():
            print(f"  Result: {response.json()['success']}")
        else:
            print(f"  Error: {response.json().get('message', 'Unknown error')}")

def test_students_endpoint():
    """Test /api/students/ endpoint dengan filter kelas"""
    print("\n" + "=" * 70)
    print("TEST: GET /api/students/ dengan filter kelas")
    print("=" * 70)
    
    token = login()
    if not token:
        print("✗ Gagal login")
        return False
    
    headers = {'Authorization': f'Bearer {token}'}
    
    test_cases = [
        {'kelas': 'X-IPA-1', 'expected_count': 2},
        {'kelas': 'X A', 'expected_count': 0},  # Format salah
    ]
    
    for test in test_cases:
        print(f"\nTest: Kelas='{test['kelas']}'")
        response = requests.get(
            f'{BASE_URL}/api/students/?kelas={test["kelas"]}&aktif=true&page_size=1000',
            headers=headers
        )
        data = response.json()
        count = len(data.get('results', []))
        print(f"  Status: {response.status_code}")
        print(f"  Count: {count} (expected: {test['expected_count']})")
        
        if count == test['expected_count']:
            print(f"  ✓ PASSED")
        else:
            print(f"  ✗ FAILED")
            if count > 0:
                for s in data['results'][:3]:
                    print(f"    - {s['nama']} ({s['kelas']})")

def test_classes_endpoint():
    """Test /api/students/classes/ endpoint"""
    print("\n" + "=" * 70)
    print("TEST: GET /api/students/classes/")
    print("=" * 70)
    
    token = login()
    if not token:
        print("✗ Gagal login")
        return False
    
    headers = {'Authorization': f'Bearer {token}'}
    
    response = requests.get(
        f'{BASE_URL}/api/students/classes/',
        headers=headers
    )
    data = response.json()
    print(f"  Status: {response.status_code}")
    print(f"  Classes: {data.get('classes', [])}")

if __name__ == '__main__':
    try:
        test_classes_endpoint()
        test_students_endpoint()
        test_initialize_endpoint()
        print("\n" + "=" * 70)
        print("TEST SELESAI")
        print("=" * 70)
    except requests.exceptions.ConnectionError:
        print("✗ Gagal: Server tidak berjalan. Jalankan 'python manage.py runserver' terlebih dahulu.")
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()
