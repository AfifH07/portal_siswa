from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    """
    Permission: Hanya superadmin yang diizinkan.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'superadmin'


class IsPimpinan(permissions.BasePermission):
    """
    Permission: Superadmin dan Pimpinan diizinkan.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['superadmin', 'pimpinan']

    def has_object_permission(self, request, view, obj):
        return True


class IsGuru(permissions.BasePermission):
    """
    Permission: Superadmin, Pimpinan, dan Guru diizinkan.

    Object-level: Guru hanya bisa akses data kelas yang di-assign ke mereka.
    Superadmin dan Pimpinan bisa akses semua.

    BUG FIX #1: Tambahkan validasi user.kelas tidak None/kosong untuk guru.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['superadmin', 'pimpinan', 'guru']

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Superadmin dan Pimpinan: full access
        if user.role in ['superadmin', 'pimpinan']:
            return True

        # Guru: harus punya kelas yang valid
        if user.role == 'guru':
            user_kelas = getattr(user, 'kelas', None)

            # FIX: Jika guru tidak punya kelas assigned, tolak akses
            if not user_kelas or user_kelas.strip() == '':
                return False

            # Bandingkan kelas objek dengan kelas guru
            obj_kelas = getattr(obj, 'kelas', None)
            if obj_kelas:
                return obj_kelas == user_kelas

            # Jika objek tidak punya field kelas langsung, cek via nisn (FK)
            if hasattr(obj, 'nisn') and hasattr(obj.nisn, 'kelas'):
                return obj.nisn.kelas == user_kelas

            return False

        return False


class IsWalisantri(permissions.BasePermission):
    """
    Permission: Superadmin, Pimpinan, dan Walisantri diizinkan.

    Object-level: Walisantri hanya bisa akses data anak yang terhubung via linked_student_nisn.

    BUG FIX #2: obj.nisn adalah FK object, gunakan obj.nisn.nisn atau str(obj.nisn_id)
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['superadmin', 'pimpinan', 'walisantri']

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Superadmin dan Pimpinan: full access
        if user.role in ['superadmin', 'pimpinan']:
            return True

        # Walisantri: hanya akses data anak yang terhubung
        if user.role == 'walisantri':
            linked_nisn = getattr(user, 'linked_student_nisn', None)

            # Jika walisantri tidak punya linked student, tolak akses
            if not linked_nisn or linked_nisn.strip() == '':
                return False

            # FIX: Handle obj.nisn sebagai FK object atau string
            if hasattr(obj, 'nisn'):
                obj_nisn = obj.nisn

                # Jika nisn adalah FK object (Student), ambil field nisn-nya
                if hasattr(obj_nisn, 'nisn'):
                    return str(obj_nisn.nisn) == str(linked_nisn)

                # Jika nisn adalah string langsung
                return str(obj_nisn) == str(linked_nisn)

            # Fallback: cek nisn_id jika ada
            if hasattr(obj, 'nisn_id'):
                return str(obj.nisn_id) == str(linked_nisn)

            return False

        return False


class CanUpdateStudent(permissions.BasePermission):
    """
    Permission: Untuk update data siswa.
    Superadmin: full access
    Pimpinan: full access
    Guru: hanya siswa di kelas mereka
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['superadmin', 'pimpinan', 'guru']

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role in ['superadmin', 'pimpinan']:
            return True

        if user.role == 'guru':
            user_kelas = getattr(user, 'kelas', None)

            # Guru harus punya kelas assigned
            if not user_kelas or user_kelas.strip() == '':
                return False

            obj_kelas = getattr(obj, 'kelas', None)
            if obj_kelas:
                return obj_kelas == user_kelas

            return False

        return False


class IsPendaftar(permissions.BasePermission):
    """
    Permission: Untuk akses modul pendaftaran.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['superadmin', 'pimpinan', 'pendaftar']


class IsBendahara(permissions.BasePermission):
    """
    Permission: Untuk akses modul keuangan.
    Superadmin dan Bendahara diizinkan.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['superadmin', 'bendahara']

    def has_object_permission(self, request, view, obj):
        # Bendahara bisa akses semua data keuangan
        return request.user.role in ['superadmin', 'bendahara']


class IsStaffOrReadOnly(permissions.BasePermission):
    """
    Permission: Staff (superadmin, pimpinan, guru, bendahara) bisa CRUD.
    Walisantri hanya bisa read.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Read-only untuk semua authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write access hanya untuk staff
        return request.user.role in ['superadmin', 'pimpinan', 'guru', 'bendahara']


class IsAsatidzEvaluationAllowed(permissions.BasePermission):
    """
    Permission untuk Evaluasi Asatidz (RBAC ketat).

    WRITE Access (POST, PUT, PATCH, DELETE):
        - superadmin: Full access
        - pimpinan/mudir: Full access (yang membuat evaluasi)

    READ Access (GET):
        - superadmin, pimpinan: Bisa lihat semua
        - guru, musyrif, wali_kelas: Hanya lihat evaluasi diri sendiri

    Object-level:
        - Ustadz hanya bisa lihat record di mana ustadz=request.user
        - Tidak ada yang bisa edit/delete kecuali pimpinan/superadmin
    """

    # Roles yang boleh CREATE/UPDATE/DELETE
    WRITE_ROLES = ['superadmin', 'pimpinan']

    # Roles yang boleh READ (semua staff kecuali walisantri)
    READ_ROLES = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'wali_kelas', 'bk']

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        user_role = request.user.role

        # SAFE_METHODS = GET, HEAD, OPTIONS
        if request.method in permissions.SAFE_METHODS:
            return user_role in self.READ_ROLES

        # WRITE methods (POST, PUT, PATCH, DELETE)
        return user_role in self.WRITE_ROLES

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        user = request.user

        # Superadmin & Pimpinan: full access ke semua record
        if user.role in self.WRITE_ROLES:
            return True

        # Ustadz/Guru: hanya bisa READ record milik sendiri
        if request.method in permissions.SAFE_METHODS:
            # Cek apakah evaluasi ini untuk user ini
            return obj.ustadz_id == user.id

        # Ustadz tidak boleh UPDATE/DELETE
        return False

