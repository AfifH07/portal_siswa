# Generated migration for Incident Case Management System
# Portal Kesantrian v2.3

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('students', '0001_initial'),
        ('kesantrian', '0003_blp_inval_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='Incident',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('judul', models.CharField(max_length=200, verbose_name='Judul Catatan')),
                ('deskripsi', models.TextField(verbose_name='Deskripsi Lengkap')),
                ('kategori', models.CharField(choices=[
                    ('perilaku', 'Perilaku/Akhlak'),
                    ('kedisiplinan', 'Kedisiplinan'),
                    ('akademik', 'Akademik'),
                    ('sosial', 'Sosial'),
                    ('kesehatan', 'Kesehatan'),
                    ('keluarga', 'Keluarga'),
                    ('lainnya', 'Lainnya')
                ], default='perilaku', max_length=20)),
                ('tingkat', models.CharField(choices=[
                    ('ringan', 'Ringan'),
                    ('sedang', 'Sedang'),
                    ('berat', 'Berat'),
                    ('kritis', 'Kritis')
                ], default='sedang', max_length=10)),
                ('tanggal_kejadian', models.DateField(verbose_name='Tanggal Kejadian')),
                ('status', models.CharField(choices=[
                    ('open', 'Open'),
                    ('in_discussion', 'In Discussion'),
                    ('resolved', 'Resolved'),
                    ('closed', 'Closed')
                ], default='open', max_length=20)),
                ('pelapor_role', models.CharField(blank=True, max_length=50, verbose_name='Role Pelapor')),
                ('pelapor_role_display', models.CharField(blank=True, max_length=100, verbose_name='Nama Role Pelapor')),
                ('keputusan_final', models.TextField(blank=True, null=True, verbose_name='Keputusan Final')),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('pelapor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reported_incidents', to=settings.AUTH_USER_MODEL)),
                ('resolved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='resolved_incidents', to=settings.AUTH_USER_MODEL)),
                ('siswa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='incidents', to='students.student')),
            ],
            options={
                'verbose_name': 'Incident',
                'verbose_name_plural': 'Incidents',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='IncidentComment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField(verbose_name='Isi Komentar')),
                ('author_role', models.CharField(blank=True, max_length=50, verbose_name='Role Penulis')),
                ('author_role_display', models.CharField(blank=True, max_length=100, verbose_name='Nama Role Penulis')),
                ('visibility', models.CharField(choices=[
                    ('internal', 'Internal'),
                    ('public', 'Public'),
                    ('final_decision', 'Final Decision')
                ], default='internal', max_length=20)),
                ('comment_type', models.CharField(choices=[
                    ('observation', 'Observasi'),
                    ('suggestion', 'Saran'),
                    ('decision', 'Keputusan'),
                    ('follow_up', 'Follow Up'),
                    ('note', 'Catatan')
                ], default='observation', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('author', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incident_comments', to=settings.AUTH_USER_MODEL)),
                ('incident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='kesantrian.incident')),
                ('parent_comment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='replies', to='kesantrian.incidentcomment')),
            ],
            options={
                'verbose_name': 'Incident Comment',
                'verbose_name_plural': 'Incident Comments',
                'ordering': ['created_at'],
            },
        ),
        # Add indexes for better query performance
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['status', 'created_at'], name='kesantrian_inc_status_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['siswa', 'status'], name='kesantrian_inc_siswa_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['kategori', 'tingkat'], name='kesantrian_inc_kat_idx'),
        ),
        migrations.AddIndex(
            model_name='incidentcomment',
            index=models.Index(fields=['incident', 'created_at'], name='kesantrian_cmt_inc_idx'),
        ),
        migrations.AddIndex(
            model_name='incidentcomment',
            index=models.Index(fields=['visibility'], name='kesantrian_cmt_vis_idx'),
        ),
    ]
