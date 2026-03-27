"""
Login API Test Script
Tests all aspects of login functionality
"""

import requests
import json

BASE_URL = "http://localhost:8000"

# Test credentials for each role
TEST_CREDENTIALS = {
    'superadmin': {'username': 'admin1', 'password': 'admin123'},
    'pimpinan': {'username': 'pimpinan', 'password': 'pimpinan123'},
    'guru': {'username': 'guru', 'password': 'guru123'},
    'walisantri': {'username': 'walisantri', 'password': 'walisantri123'},
    'pendaftar': {'username': 'pendaftar', 'password': 'pendaftar123'},
}

EXPECTED_REDIRECTS = {
    'superadmin': '/dashboard/admin',
    'pimpinan': '/dashboard/pimpinan',
    'guru': '/dashboard/guru',
    'walisantri': '/dashboard/walisantri',
    'pendaftar': '/registration',
}

def test_login_api():
    """Test login API endpoint"""
    print("=" * 60)
    print("TESTING LOGIN API")
    print("=" * 60)
    
    all_passed = True
    
    for role, credentials in TEST_CREDENTIALS.items():
        print(f"\n🔐 Testing {role} login...")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login/",
                json=credentials,
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"   ✅ Success: {data.get('success', False)}")
                print(f"   🎫 Access Token: {data.get('access', 'N/A')[:20]}...")
                print(f"   🔄 Refresh Token: {data.get('refresh', 'N/A')[:20]}...")
                print(f"   👤 User: {data.get('user', {}).get('name', 'N/A')}")
                print(f"   🎯 Role: {data.get('user', {}).get('role', 'N/A')}")
                print(f"   📎 Redirect: {data.get('redirect', 'N/A')}")
                
                # Verify redirect URL
                expected_redirect = EXPECTED_REDIRECTS[role]
                actual_redirect = data.get('redirect', '')
                
                if actual_redirect == expected_redirect:
                    print(f"   ✅ Redirect URL correct: {actual_redirect}")
                else:
                    print(f"   ❌ Redirect URL mismatch!")
                    print(f"      Expected: {expected_redirect}")
                    print(f"      Actual: {actual_redirect}")
                    all_passed = False
                
                # Verify tokens exist
                if 'access' in data and 'refresh' in data:
                    print(f"   ✅ Both tokens present")
                else:
                    print(f"   ❌ Tokens missing")
                    all_passed = False
                    
            else:
                print(f"   ❌ Login failed: {response.text}")
                all_passed = False
                
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 60)

def test_invalid_login():
    """Test login with invalid credentials"""
    print("\n" + "=" * 60)
    print("TESTING INVALID LOGIN")
    print("=" * 60)
    
    invalid_credentials = {
        'username': 'invalid',
        'password': 'wrongpassword'
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login/",
            json=invalid_credentials,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            print(f"✅ Invalid login correctly rejected")
            print(f"   Response: {data}")
        else:
            print(f"❌ Expected 400, got {response.status_code}")
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
    
    print("=" * 60)

def test_token_refresh():
    """Test token refresh endpoint"""
    print("\n" + "=" * 60)
    print("TESTING TOKEN REFRESH")
    print("=" * 60)
    
    # First, get a token
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login/",
        json=TEST_CREDENTIALS['superadmin'],
        headers={'Content-Type': 'application/json'}
    )
    
    if login_response.status_code == 200:
        refresh_token = login_response.json().get('refresh')
        
        try:
            refresh_response = requests.post(
                f"{BASE_URL}/api/auth/token/refresh/",
                json={'refresh': refresh_token},
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"Status Code: {refresh_response.status_code}")
            
            if refresh_response.status_code == 200:
                data = refresh_response.json()
                print(f"✅ Token refresh successful")
                print(f"   New Access Token: {data.get('access', 'N/A')[:20]}...")
            else:
                print(f"❌ Token refresh failed")
                
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
    else:
        print("❌ Login failed, cannot test token refresh")
    
    print("=" * 60)

def test_logout():
    """Test logout endpoint"""
    print("\n" + "=" * 60)
    print("TESTING LOGOUT")
    print("=" * 60)
    
    # First, get a token
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login/",
        json=TEST_CREDENTIALS['superadmin'],
        headers={'Content-Type': 'application/json'}
    )
    
    if login_response.status_code == 200:
        access_token = login_response.json().get('access')
        refresh_token = login_response.json().get('refresh')
        
        try:
            logout_response = requests.post(
                f"{BASE_URL}/api/auth/logout/",
                json={'refresh': refresh_token},
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {access_token}'
                }
            )
            
            print(f"Status Code: {logout_response.status_code}")
            
            if logout_response.status_code == 200:
                print(f"✅ Logout successful")
                print(f"   Response: {logout_response.json()}")
            else:
                print(f"❌ Logout failed")
                
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
    else:
        print("❌ Login failed, cannot test logout")
    
    print("=" * 60)

if __name__ == "__main__":
    print("\n🚀 STARTING LOGIN API TESTS\n")
    
    # Test 1: Valid login for all roles
    test_login_api()
    
    # Test 2: Invalid login
    test_invalid_login()
    
    # Test 3: Token refresh
    test_token_refresh()
    
    # Test 4: Logout
    test_logout()
    
    print("\n✨ ALL TESTS COMPLETED!\n")
