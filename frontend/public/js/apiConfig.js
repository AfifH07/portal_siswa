window.API_BASE_URL = window.API_BASE_URL || '/api';
window.API_TIMEOUT = window.API_TIMEOUT || 30000;

window.API_CONFIG = {
    BASE_URL: window.API_BASE_URL,
    TIMEOUT: window.API_TIMEOUT,

    getBaseUrl() {
        return this.BASE_URL;
    },

    buildUrl(path) {
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
        const normalizedBaseUrl = this.BASE_URL.endsWith('/') ? this.BASE_URL.slice(0, -1) : this.BASE_URL;
        const url = `${normalizedBaseUrl}/${normalizedPath}`;
        return url;
    }
};

