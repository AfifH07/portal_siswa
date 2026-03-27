"""
Test script untuk memverifikasi endpoint /api/students/ berfungsi dengan benar
untuk berbagai role user (superadmin, pimpinan, guru, walisantri).
"""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.settings')
django.setup()

import requests

BASE_URL = 'http://localhost:8000'


def login(username, password):
    """Login dan return access token"""
    response = requests.post(
        f'{BASE_URL}/api/auth/login/',
        json={'username': username, 'password': password}
    )
    data = response.json()
    return data.get('access')


def get_students(token, role_name):
    """Get students list dan return result"""
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(
        f'{BASE_URL}/api/students/',
        headers=headers
    )
    data = response.json()
    return {
        'role': role_name,
        'count': data.get('count', 0),
        'students': [
            {
                'nisn': s.get('nisn'),
                'nama': s.get('nama'),
                'kelas': s.get('kelas'),
                'program': s.get('program')
            }
            for s in data.get('results', [])
        ]
    }


def main():
    print("=" * 70)
    print("TEST: GET /api/students/ untuk berbagai role")
    print("=" * 70)

    test_cases = [
        {
            'username': 'superuser',
            'password': 'admin123',
            'role_name': 'Superadmin',
            'expected_count': 6,
            'description': 'Harus melihat SEMUA siswa tanpa filter'
        },
        {
            'username': 'pimpinan',
            'password': 'pimpinan123',
            'role_name': 'Pimpinan',
            'expected_count': 6,
            'description': 'Harus melihat SEMUA siswa tanpa filter'
        },
        {
            'username': 'guru',
            'password': 'guru123',
            'role_name': 'Guru (kelas X-IPA-1)',
            'expected_count': 2,
            'description': 'Harus hanya melihat siswa di kelas X-IPA-1'
        },
        {
            'username': 'testuser',
            'password': 'test123',
            'role_name': 'Guru (kelas X-IPA-2)',
            'expected_count': 1,
            'description': 'Harus hanya melihat siswa di kelas X-IPA-2'
        }
    ]

    all_passed = True

    for test_case in test_cases:
        print(f"\nTest: {test_case['role_name']}")
        print(f"  {test_case['description']}")

        try:
            # Login
            token = login(test_case['username'], test_case['password'])
            if not token:
                print(f"  ✗ Gagal login")
                all_passed = False
                continue

            # Get students
            result = get_students(token, test_case['role_name'])

            # Verify
            if result['count'] == test_case['expected_count']:
                print(f"  ✓ PASSED: {result['count']} siswa (expected: {test_case['expected_count']})")
                for student in result['students']:
                    print(f"    - {student['nama']} ({student['kelas']})")
            else:
                print(f"  ✗ FAILED: {result['count']} siswa (expected: {test_case['expected_count']})")
                all_passed = False

        except requests.exceptions.ConnectionError:
            print("  ✗ Gagal: Server tidak berjalan. Jalankan 'python manage.py runserver' terlebih dahulu.")
            return
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            all_passed = False

    print("\n" + "=" * 70)
    if all_passed:
        print("✓ SEMUA TEST PASSED")
    else:
        print("✗ BEBERAPA TEST FAILED")
    print("=" * 70)


if __name__ == '__main__':
    main()
