"""
Test Kesantrian API Endpoints
=============================
Quick test script to verify the kesantrian API endpoints work correctly.
"""

import os
import sys
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def login(username, password):
    """Login and get JWT token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login/",
        json={"username": username, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get('access') or data.get('token')
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        return None

def test_my_children_summary(token):
    """Test /api/kesantrian/my-children-summary/ endpoint."""
    print("\n" + "=" * 60)
    print("TEST: GET /api/kesantrian/my-children-summary/")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/api/kesantrian/my-children-summary/",
        headers={"Authorization": f"Bearer {token}"}
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success')}")
        print(f"Total Children: {data.get('total_children')}")

        for child in data.get('children', []):
            print(f"\n  Child: {child['nama']} (NISN: {child['nisn']})")
            print(f"    Kelas: {child.get('kelas')}")
            print(f"    Ibadah Summary: {child.get('ibadah_summary', {}).get('week_percentage', 0)}% this week")
            print(f"    Hafalan Progress: {child.get('hafalan_progress', {})}")
            print(f"    Recent Pembinaan: {len(child.get('recent_pembinaan', []))} records")
            print(f"    Halaqoh: {len(child.get('halaqoh', []))} groups")
    else:
        print(f"Error: {response.text}")

    return response.status_code == 200

def test_worship_tracker(token, nisn):
    """Test /api/kesantrian/worship-tracker/<nisn>/ endpoint."""
    print("\n" + "=" * 60)
    print(f"TEST: GET /api/kesantrian/worship-tracker/{nisn}/")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/api/kesantrian/worship-tracker/{nisn}/",
        headers={"Authorization": f"Bearer {token}"}
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success')}")
        print(f"Student: {data.get('nama')}")
        print(f"Summary: {data.get('summary')}")

        week_data = data.get('week_data', [])
        print(f"\nWeek Data ({len(week_data)} days):")
        for day in week_data[:3]:  # Show first 3 days
            print(f"  {day['hari']} ({day['tanggal']}): subuh={day.get('subuh')}, dzuhur={day.get('dzuhur')}, ...")
    else:
        print(f"Error: {response.text}")

    return response.status_code == 200

def test_ibadah_detail(token, nisn):
    """Test /api/kesantrian/ibadah/<nisn>/ endpoint."""
    print("\n" + "=" * 60)
    print(f"TEST: GET /api/kesantrian/ibadah/{nisn}/")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/api/kesantrian/ibadah/{nisn}/",
        headers={"Authorization": f"Bearer {token}"}
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success')}")
        print(f"Student: {data.get('nama')}")
        print(f"Total Records: {data.get('count')}")
    else:
        print(f"Error: {response.text}")

    return response.status_code == 200

def test_pembinaan(token, nisn):
    """Test /api/kesantrian/pembinaan/<nisn>/ endpoint."""
    print("\n" + "=" * 60)
    print(f"TEST: GET /api/kesantrian/pembinaan/{nisn}/")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/api/kesantrian/pembinaan/{nisn}/",
        headers={"Authorization": f"Bearer {token}"}
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success')}")
        print(f"Student: {data.get('nama')}")
        print(f"Total Records: {data.get('count')}")

        for p in data.get('data', [])[:3]:
            print(f"  - {p['judul']} ({p['kategori_display']})")
    else:
        print(f"Error: {response.text}")

    return response.status_code == 200

def main():
    print("=" * 60)
    print("KESANTRIAN API TEST")
    print("=" * 60)

    # Login as walisantri
    print("\nLogging in as wali_multi...")
    token = login("wali_multi", "wali123")

    if not token:
        print("Failed to get token. Make sure the server is running.")
        return False

    print(f"Token obtained: {token[:20]}...")

    # Test endpoints
    all_passed = True

    # Get children summary first to get NISNs
    print("\nLogging in and getting children data...")

    success = test_my_children_summary(token)
    all_passed = all_passed and success

    # Get first child's NISN for other tests
    response = requests.get(
        f"{BASE_URL}/api/kesantrian/my-children-summary/",
        headers={"Authorization": f"Bearer {token}"}
    )

    if response.status_code == 200:
        children = response.json().get('children', [])
        if children:
            nisn = children[0]['nisn']

            success = test_worship_tracker(token, nisn)
            all_passed = all_passed and success

            success = test_ibadah_detail(token, nisn)
            all_passed = all_passed and success

            success = test_pembinaan(token, nisn)
            all_passed = all_passed and success

    print("\n" + "=" * 60)
    print(f"TEST RESULT: {'ALL PASSED' if all_passed else 'SOME FAILED'}")
    print("=" * 60)

    return all_passed

if __name__ == "__main__":
    main()
