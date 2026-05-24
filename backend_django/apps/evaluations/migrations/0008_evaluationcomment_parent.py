from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('evaluations', '0007_seed_poin_integritas'),
    ]

    operations = [
        migrations.AddField(
            model_name='evaluationcomment',
            name='parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='replies',
                to='evaluations.evaluationcomment',
            ),
        ),
    ]
