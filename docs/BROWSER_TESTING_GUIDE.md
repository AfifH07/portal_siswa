# 🧪 BROWSER TESTING GUIDE - LOGIN FUNCTIONALITY

## Quick Start

1. **Start Server:**
   ```bash
   cd backend_django
   python manage.py runserver
   ```

2. **Open Browser:**
   ```
   http://localhost:8000/login/
   ```

3. **Open Developer Tools:**
   - Press `F12`
   - Or right-click → Inspect

---

## 📋 STEP-BY-STEP TESTING

### Step 1: Console Check (Before Login)

**Console Tab:**
```
Expected Output:
✓ Auth module loaded
```

**If you see errors:**
- `Uncaught ReferenceError: $ is not defined` → JavaScript syntax error
- `Failed to load resource: auth.js` → File path issue
- `GET http://localhost:8000/static/js/auth.js 404` → Django static files not configured

**Check:**
- Network tab → Filter by "auth.js" → Status should be 200

---

### Step 2: Visual Check (Glassmorphism)

**What to check:**
1. ✅ Background is animated gradient
2. ✅ Glass card is semi-transparent with blur
3. ✅ Input fields have glass effect
4. ✅ Background has floating radial gradients
5. ✅ Button shows shimmer on hover

**How to test:**
- Move mouse over login button → Should see shimmer effect
- Click on input field → Should see focus glow
- Scroll page → Background should animate

---

### Step 3: Test Valid Login

**For Superadmin:**
1. Enter Username: `admin1`
2. Enter Password: `admin123`
3. Click Login button

**Expected Behavior:**
- Button shows "Loading..."
- Button is disabled
- No error message

**After Login:**
- Redirects to: `http://localhost:8000/dashboard/admin/`
- Or if redirect logic kicks in: `http://localhost:8000/dashboard/admin`

**Check Console:**
```
Expected: No errors
```

**Check Network Tab:**
1. Click on `login` request
2. Check **Status**: Should be `200`
3. Check **Response** tab
4. Verify JSON:
```json
{
  "success": true,
  "access": "eyJ0eXAiOiJKV1Q...",
  "refresh": "eyJ0eXAiOiJKV1Q...",
  "user": {
    "username": "admin1",
    "role": "superadmin",
    "name": "Super Admin 1",
    "nisn": null,
    ...
  },
  "redirect": "/dashboard/admin"
}
```

**Check Application Tab:**
1. Click **Local Storage** → `http://localhost:8000`
2. Verify keys exist:
   - `access_token` → Should have JWT token
   - `refresh_token` → Should have JWT token
   - `user` → JSON string with user object
   - `user_role` → Should be "superadmin"
   - `user_name` → Should be "Super Admin 1"
   - `user_username` → Should be "admin1"

---

### Step 4: Test Other Roles

**Test each role:**

| Role | Username | Password | Redirect URL |
|------|----------|----------|-------------|
| Pimpinan | pimpinan | pimpinan123 | /dashboard/pimpinan |
| Guru | guru | guru123 | /dashboard/guru |
| Walisantri | walisantri | walisantri123 | /dashboard/walisantri |
| Pendaftar | pendaftar | pendaftar123 | /registration |

**For each role:**
1. Logout (if logged in)
2. Open `/login/`
3. Enter credentials
4. Click Login
5. Verify:
   - Redirect URL matches role
   - Console shows no errors
   - Network status is 200
   - LocalStorage updated with role

---

### Step 5: Test Invalid Login

**Test Case:**
1. Enter Username: `invalid`
2. Enter Password: `wrongpass`
3. Click Login

**Expected Behavior:**
- Button returns to normal state
- Error message appears: "Username atau password salah"
- No redirect

**Check Console:**
```
Expected: Login error: [error details]
```

**Check Network Tab:**
1. Click on `login` request
2. Check **Status**: Should be `400` (Bad Request)
3. Check **Response** tab
4. Verify error message

---

### Step 6: Test Password Toggle

**How to test:**
1. Click 👁️ icon in password field
2. Verify password becomes visible
3. Click again
4. Verify password becomes hidden

---

### Step 7: Test Remember Me

**Test Case 1: With Remember Me checked**
1. Check "Ingat saya"
2. Login with valid credentials
3. Check **Session Storage** in Developer Tools
4. Verify: `remember_me` = "true"

**Test Case 2: Without Remember Me**
1. Don't check "Ingat saya"
2. Login with valid credentials
3. Check **Session Storage**
4. Verify: `remember_me` key doesn't exist

---

### Step 8: Test Responsive Design

**Desktop (1920x1080+):**
- Glass card centered
- Proper spacing
- All elements visible

**Tablet (768px - 1023px):**
- Use browser DevTools device mode or resize window
- Glass card adapts to screen
- Font sizes adjusted

**Mobile (375px - 767px):**
- Use browser DevTools device mode
- Glass card takes full width
- Input fields touch-friendly
- Buttons properly sized

---

## 🔍 COMMON ISSUES & SOLUTIONS

### Issue: "GET http://localhost:8000/static/js/auth.js 404"

**Solution:**
```bash
# Make sure static files are configured
cd backend_django
python manage.py collectstatic
```

### Issue: "CSRF token missing"

**Note:** This API doesn't require CSRF (uses JWT tokens). If you see this error:
- Check that the endpoint uses `@permission_classes([permissions.AllowAny])` in views.py

### Issue: "CORS policy error"

**Solution:**
```python
# Check backend_django/backend_django/settings.py
CORS_ALLOW_ALL_ORIGINS = True  # For development
```

### Issue: "Login button not working"

**Check:**
1. Open Console tab
2. Look for JavaScript errors
3. Verify `handleLogin` function is defined
4. Verify event listener is attached

**Debug in Console:**
```javascript
// Type in console:
document.getElementById('login-form')
document.querySelector('.btn-login')
window.handleLogin
// All should return elements/functions, not null/undefined
```

### Issue: "Redirect not happening"

**Check:**
1. Console should show redirect URL
2. Check if there's an error in console
3. Verify URL pattern exists in backend_django/urls.py

**Debug in Console:**
```javascript
// Check redirect URL
localStorage.getItem('user_role')
localStorage.getItem('access_token')

// Manually test redirect
window.location.href = '/dashboard/admin'
```

---

## 📊 COMPREHENSIVE TEST CHECKLIST

### Pre-Testing
- [ ] Django server running on port 8000
- [ ] No console errors on page load
- [ ] CSS and JS files loading (check Network tab)
- [ ] Login form visible and styled

### Visual Tests
- [ ] Background gradient animates
- [ ] Glass card visible with blur effect
- [ ] Input fields have glass style
- [ ] Button shows shimmer on hover
- [ ] Form elements responsive on mobile
- [ ] Touch targets large enough on mobile (44px+)

### Functionality Tests - Superadmin
- [ ] Login with admin1/admin123
- [ ] Network request sent to /api/auth/login/
- [ ] Status code is 200
- [ ] Response contains access token
- [ ] Response contains refresh token
- [ ] Response contains user object
- [ ] Response contains redirect URL
- [ ] Redirect URL is /dashboard/admin
- [ ] Access token stored in localStorage
- [ ] Refresh token stored in localStorage
- [ ] User role stored as 'superadmin'
- [ ] No console errors

### Functionality Tests - Pimpinan
- [ ] Login with pimpinan/pimpinan123
- [ ] Redirects to /dashboard/pimpinan
- [ ] User role stored as 'pimpinan'

### Functionality Tests - Guru
- [ ] Login with guru/guru123
- [ ] Redirects to /dashboard/guru
- [ ] User role stored as 'guru'

### Functionality Tests - Walisantri
- [ ] Login with walisantri/walisantri123
- [ ] Redirects to /dashboard/walisantri
- [ ] User role stored as 'walisantri'

### Functionality Tests - Pendaftar
- [ ] Login with pendaftar/pendaftar123
- [ ] Redirects to /registration
- [ ] User role stored as 'pendaftar'

### Error Handling Tests
- [ ] Invalid credentials show error message
- [ ] Network errors show error message
- [ ] Error message auto-hides after 5 seconds
- [ ] Button resets to normal state after error

### Additional Tests
- [ ] Password show/hide toggle works
- [ ] Remember me checkbox works
- [ ] "Lupa password" link shows alert
- [ ] Form validation prevents empty fields

---

## 🎯 SUCCESS CRITERIA

Login functionality is **WORKING CORRECTLY** when:

1. ✅ All 5 roles can login successfully
2. ✅ Each role redirects to correct dashboard
3. ✅ JWT tokens are stored in localStorage
4. ✅ Console shows no errors during login flow
5. ✅ Network requests complete successfully (200 status)
6. ✅ API response contains all required data
7. ✅ Glassmorphism UI displays correctly
8. ✅ Responsive design works on all devices
9. ✅ Error handling shows user-friendly messages
10. ✅ Password toggle and remember me features work

---

**Testing Date:** January 23, 2026  
**Tested By:** [Fill in name]  
**Browser:** [Fill in browser and version]

**Results:** [✅ PASS / ❌ FAIL]
