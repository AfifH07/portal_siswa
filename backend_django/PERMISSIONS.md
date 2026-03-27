# Permission Matrix - Portal Siswa Backend

## Role-Based Access Control

| Action | SuperAdmin | Pimpinan | Guru | Walisantri |
|--------|-----------|----------|------|-----------|
| **Student Management** | | | | |
| View Students | ✅ | ✅ | ✅ (own class) | ❌ (own child only) |
| Create Student | ✅ | ❌ | ❌ | ❌ |
| Update Student | ✅ | ✅ | ✅ (own class) | ❌ |
| Delete Student | ✅ | ❌ | ❌ | ❌ |
| **Attendance Management** | | | | |
| View Attendance | ✅ | ✅ | ✅ (own class) | ✅ (own child) |
| Create Attendance | ✅ | ✅ | ✅ (own class) | ❌ |
| Update Attendance | ✅ | ✅ | ✅ (own class) | ❌ |
| Delete Attendance | ✅ | ✅ | ✅ (own class) | ❌ |
| **Grades Management** | | | | |
| View Grades | ✅ | ✅ | ✅ (own class) | ✅ (own child) |
| Create Grade | ✅ | ✅ | ✅ (own class) | ❌ |
| Update Grade | ✅ | ✅ | ✅ (own only) | ❌ |
| Delete Grade | ✅ | ✅ | ✅ (own only) | ❌ |
| **Evaluations Management** | | | | |
| View Evaluations | ✅ | ✅ | ✅ (own) | ✅ (own child) |
| Create Evaluation | ✅ | ✅ | ✅ (own) | ❌ |
| Update Evaluation | ✅ | ✅ | ✅ (own only) | ❌ |
| Delete Evaluation | ✅ | ✅ | ✅ (own only) | ❌ |

## Permission Classes

### IsSuperAdmin
- **Roles:** superadmin
- **Access:** Full access to all resources

### IsPimpinan
- **Roles:** superadmin, pimpinan
- **Access:** View and update most resources (except create/delete students)

### IsGuru
- **Roles:** superadmin, pimpinan, guru
- **Access:** View and update resources (attendance, grades, evaluations, students - update only)
- **Object-level check:** Can only update students in their assigned class

### CanUpdateStudent
- **Roles:** superadmin, pimpinan, guru
- **Access:** Update student records
- **Object-level check:**
  - SuperAdmin: Can update any student
  - Pimpinan: Can update any student
  - Guru: Can only update students in their assigned class

### IsWalisantri
- **Roles:** superadmin, pimpinan, walisantri
- **Access:** View their linked child's data
- **Object-level check:** Can only view their own linked student

## Key Changes Made

### 1. Updated permissions.py
- Added `has_object_permission` to `IsPimpinan` class
- Enhanced `IsGuru` class with `has_object_permission` for class-based filtering
- Created new `CanUpdateStudent` permission class for student updates with class-based access control

### 2. Updated students/views.py
- Changed update/partial_update permission from `IsPimpinan` to `IsAuthenticated, CanUpdateStudent`
- Added `perform_update` method with class-based validation for Guru
- Maintained existing restrictions (create/destroy = IsSuperAdmin only)

### 3. Guru Access for Students
**What Guru CAN do:**
- ✅ View students in their assigned class
- ✅ Update student records in their assigned class
- ✅ Update fields: nama, kelas, program, email, phone, wali_nama, wali_phone, tanggal_masuk, target_hafalan, current_hafalan, target_nilai, aktif

**What Guru CANNOT do:**
- ❌ Create new student records
- ❌ Delete student records
- ❌ Change NISN (not in update serializer)
- ❌ Update students in other classes

### 4. Pimpinan Access
**What Pimpinan CAN do:**
- ✅ View all students
- ✅ Update any student
- ✅ View and manage attendance, grades, evaluations
- ✅ Create/update/delete attendance, grades, evaluations

**What Pimpinan CANNOT do:**
- ❌ Create new student records
- ❌ Delete student records

## Security Notes

1. **Defense in Depth:**
   - View-level permissions (`get_permissions`)
   - Query-level filtering (`get_queryset`)
   - Object-level checks (`perform_update`, `has_object_permission`)

2. **Guru Class Isolation:**
   - Guru can only see students in their assigned class
   - Guru can only update students in their assigned class
   - Multiple validation layers prevent cross-class access

3. **SuperAdmin Unrestricted:**
   - SuperAdmin has full access to all operations
   - SuperAdmin bypasses all role-based restrictions
