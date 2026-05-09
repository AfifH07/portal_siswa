import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('evaluations', '0005_evaluation_closed_at_evaluation_closed_by_and_more'),
        ('students', '0008_add_schedule_jam_range_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PoinIntegritas',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nama', models.CharField(max_length=100)),
                ('urutan', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['urutan', 'nama'],
            },
        ),
        migrations.CreateModel(
            name='PenilaianIntegritasGuru',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('skala', models.IntegerField(choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4'), (5, '5')])),
                ('catatan', models.TextField(blank=True, default='')),
                ('tanggal', models.DateField(auto_now_add=True)),
                ('guru', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='penilaian_integritas_diterima', to=settings.AUTH_USER_MODEL)),
                ('penilai', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='penilaian_integritas_guru_dibuat', to=settings.AUTH_USER_MODEL)),
                ('poin', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='evaluations.poinintegritas')),
            ],
            options={
                'ordering': ['-tanggal', '-id'],
            },
        ),
        migrations.CreateModel(
            name='PenilaianIntegritasSantri',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('skala', models.IntegerField(choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4'), (5, '5')])),
                ('catatan', models.TextField(blank=True, default='')),
                ('tanggal', models.DateField(auto_now_add=True)),
                ('penilai', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='penilaian_integritas_santri_dibuat', to=settings.AUTH_USER_MODEL)),
                ('poin', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='evaluations.poinintegritas')),
                ('santri', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='penilaian_integritas', to='students.student')),
            ],
            options={
                'ordering': ['-tanggal', '-id'],
            },
        ),
    ]
