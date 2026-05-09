from django.db import migrations


def seed_poin_integritas(apps, schema_editor):
    PoinIntegritas = apps.get_model('evaluations', 'PoinIntegritas')
    default_points = [
        ('Jujur', 1),
        ('Mandiri', 2),
        ('Tanggung Jawab', 3),
        ('Berani', 4),
        ('Sederhana', 5),
        ('Peduli', 6),
        ('Disiplin', 7),
        ('Adil', 8),
        ('Kerja Keras', 9),
    ]

    for nama, urutan in default_points:
        PoinIntegritas.objects.get_or_create(
            nama=nama,
            defaults={
                'urutan': urutan,
                'is_active': True,
            }
        )


def reverse_seed_poin_integritas(apps, schema_editor):
    PoinIntegritas = apps.get_model('evaluations', 'PoinIntegritas')
    PoinIntegritas.objects.filter(
        nama__in=[
            'Jujur', 'Mandiri', 'Tanggung Jawab', 'Berani', 'Sederhana',
            'Peduli', 'Disiplin', 'Adil', 'Kerja Keras'
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('evaluations', '0006_poin_integritas_and_penilaian'),
    ]

    operations = [
        migrations.RunPython(seed_poin_integritas, reverse_seed_poin_integritas),
    ]
