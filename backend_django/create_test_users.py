from apps.accounts.models import User

def create_test_users():
    try:
        # Superadmin
        User.objects.create_superuser(
            username='admin',
            password='admin123',
            email='admin@ponpesbaron.id',
            name='Super Admin',
            role='superadmin'
        )
        print("Superadmin created successfully")
        
        # Pimpinan
        User.objects.create_user(
            username='pimpinan',
            password='pimpinan123',
            email='pimpinan@ponpesbaron.id',
            name='Pimpinan Pondok',
            role='pimpinan'
        )
        print("Pimpinan created successfully")
        
        # Guru
        User.objects.create_user(
            username='guru',
            password='guru123',
            email='guru@ponpesbaron.id',
            name='Guru Ustadz',
            role='guru',
            kelas='X A'
        )
        print("Guru created successfully")
        
        # Walisantri
        walisantri = User.objects.create_user(
            username='walisantri',
            password='walisantri123',
            email='walisantri@ponpesbaron.id',
            name='Walisantri Ananda',
            role='walisantri',
            linked_student_nisn='12345'
        )
        print("Walisantri created successfully")
        
        # Pendaftar
        User.objects.create_user(
            username='pendaftar',
            password='pendaftar123',
            email='pendaftar@ponpesbaron.id',
            name='Calon Santri',
            role='pendaftar'
        )
        print("Pendaftar created successfully")
        
        print("\nAll test users created successfully!")
        print("====================================")
        print("Username: admin, Password: admin123 (Superadmin)")
        print("Username: pimpinan, Password: pimpinan123 (Pimpinan)")
        print("Username: guru, Password: guru123 (Guru)")
        print("Username: walisantri, Password: walisantri123 (Walisantri)")
        print("Username: pendaftar, Password: pendaftar123 (Pendaftar)")
        print("====================================")
        
    except Exception as e:
        print(f"Error creating users: {e}")

if __name__ == '__main__':
    create_test_users()
