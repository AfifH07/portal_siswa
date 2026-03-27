from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finance'
    verbose_name = 'Modul Keuangan'

    def ready(self):
        """
        Import signals when app is ready.

        Signals yang terdaftar:
        1. pre_save Tagihan  -> Auto-generate no_invoice
        2. post_save Tagihan -> Log creation dengan invoice number
        3. pre_save Pembayaran -> Capture old state untuk deteksi perubahan
        4. post_save Pembayaran -> Update sisa tagihan & status jika terverifikasi
        5. post_delete Pembayaran -> Update sisa tagihan jika verified payment dihapus
        """
        # Import signals module to register all signal handlers
        from . import signals  # noqa: F401
