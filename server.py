from flask import Flask, request
import time
import random

app = Flask(__name__)

# Token Aktif (Tetap 1 biar susah dicarinya)
TOKEN_AKTIF = ["cpak4"]
percobaan_ip = {}

@app.route('/login', methods=['GET', 'POST'])
def login():
    ip = request.remote_addr
    percobaan_ip[ip] = percobaan_ip.get(ip, 0) + 1
    
    # --- 1. RANDOM DELAY (Jitter) ---
    # Simulasi beban router yang naik turun
    time.sleep(random.uniform(0.1, 1.5))

    # --- 2. CONNECTION DROPPER (Simulasi RTO) ---
    # 5% kemungkinan server sengaja mutusin koneksi
    if random.random() < 0.05:
        return "Internal Server Error", 500 

    # --- 3. SIZE MIMICRY (Penyamaran Ukuran) ---
    # Tambahkan spasi acak di belakang agar ukurannya nggak persis 2218
    padding = " " * random.randint(0, 50)
    html_login = ("A" * 2218) + padding
    html_success = ("B" * 1284) + padding

    username = request.form.get('username')
    
    # Logika Deteksi
    if username in TOKEN_AKTIF:
        print(f"[!!!] TOKEN TEMBUS: {username} dari {ip}")
        return html_success
    
    return html_login

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, threaded=True)