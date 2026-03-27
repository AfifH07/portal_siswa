from django.apps import AppConfig


class KesantrianConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.kesantrian'
    verbose_name = 'Kesantrian'

    def ready(self):
        """Import signals saat app ready"""
        import apps.kesantrian.signals  # noqa
