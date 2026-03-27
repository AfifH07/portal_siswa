"""
Quick Server Test Script
Verifies Django server can start and login API is accessible
"""

import subprocess
import time
import requests

def test_server_startup():
    """Test if Django server starts successfully"""
    print("=" * 60)
    print("TESTING DJANGO SERVER STARTUP")
    print("=" * 60)
    
    try:
        # Start server in background
        print("\n🚀 Starting Django development server...")
        server_process = subprocess.Popen(
            ['python', 'manage.py', 'runserver'],
            cwd='.',
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for server to start
        print("⏳ Waiting for server to start (10 seconds)...")
        time.sleep(10)
        
        # Test if server is responding
        print("\n🔍 Testing server response...")
        try:
            response = requests.get('http://localhost:8000/', timeout=5)
            if response.status_code == 200:
                print(f"✅ Server is running! Status: {response.status_code}")
                print(f"   Response length: {len(response.content)} bytes")
                return True
            else:
                print(f"⚠️  Server responding but status code: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Server not responding: {str(e)}")
            return False
            
    except Exception as e:
        print(f"❌ Error starting server: {str(e)}")
        return False
    finally:
        print("\n" + "=" * 60)
        print("Server test complete")
        print("=" * 60)

def test_login_api():
    """Test login API endpoint"""
    print("\n" + "=" * 60)
    print("TESTING LOGIN API ENDPOINT")
    print("=" * 60)
    
    test_cases = {
        'Valid Superadmin Login': {
            'username': 'admin1',
            'password': 'admin123',
            'expected_status': 200,
            'expected_success': True
        },
        'Invalid Login': {
            'username': 'invalid',
            'password': 'wrongpass',
            'expected_status': 400,
            'expected_success': False
        }
    }
    
    results = []
    
    for test_name, test_data in test_cases.items():
        print(f"\n🔐 Testing: {test_name}")
        
        try:
            response = requests.post(
                'http://localhost:8000/api/auth/login/',
                json={
                    'username': test_data['username'],
                    'password': test_data['password']
                },
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == test_data['expected_status']:
                data = response.json()
                
                success = data.get('success', False)
                has_access_token = 'access' in data
                has_refresh_token = 'refresh' in data
                has_user = 'user' in data
                has_redirect = 'redirect' in data
                
                if success == test_data['expected_success']:
                    print(f"   ✅ Success status correct: {success}")
                    
                    if has_access_token and has_refresh_token and has_user and has_redirect:
                        print(f"   ✅ All required fields present")
                        print(f"   ✅ Access Token: {data['access'][:20]}...")
                        print(f"   ✅ Refresh Token: {data['refresh'][:20]}...")
                        print(f"   ✅ User Role: {data['user'].get('role', 'N/A')}")
                        print(f"   ✅ Redirect URL: {data.get('redirect', 'N/A')}")
                        
                        # Verify redirect URL based on role
                        role = data['user'].get('role')
                        expected_redirect = {
                            'superadmin': '/dashboard/admin',
                            'pimpinan': '/dashboard/pimpinan',
                            'guru': '/dashboard/guru',
                            'walisantri': '/dashboard/walisantri',
                            'pendaftar': '/registration'
                        }
                        
                        actual_redirect = data.get('redirect', '')
                        if actual_redirect == expected_redirect.get(role):
                            print(f"   ✅ Redirect URL matches role!")
                        else:
                            print(f"   ⚠️  Redirect URL: {actual_redirect}")
                            print(f"      Expected: {expected_redirect.get(role)}")
                    else:
                        print(f"   ❌ Missing required fields")
                else:
                    print(f"   ❌ Success status incorrect")
                    
            else:
                print(f"   ❌ Status code mismatch")
                print(f"      Expected: {test_data['expected_status']}")
                print(f"      Actual: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Request failed: {str(e)}")
        except Exception as e:
            print(f"   ❌ Unexpected error: {str(e)}")
    
    print("\n" + "=" * 60)
    print("API test complete")
    print("=" * 60)

if __name__ == "__main__":
    print("\n🚀 LOGIN API VERIFICATION TESTS")
    
    # Test server startup first
    server_running = test_server_startup()
    
    if server_running:
        # Test login API
        test_login_api()
    else:
        print("\n⚠️  Server is not running. Please start it manually:")
        print("   python manage.py runserver")
        print("\nThen run this script again to test the API.")
