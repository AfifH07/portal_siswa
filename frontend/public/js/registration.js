// Registration Form JavaScript
let currentStep = 1;
const totalSteps = 5;

document.addEventListener('DOMContentLoaded', function() {

    document.getElementById('registration-form').addEventListener('submit', handleSubmit);
    
    setupDragAndDrop();
});

function nextStep(current) {
    if (!validateStep(current)) {
        return;
    }
    
    if (current === 1) {
        checkNISNUniqueness();
        return;
    }
    
    showStep(current + 1);
}

function previousStep(current) {
    showStep(current - 1);
}

function showStep(step) {
    const steps = document.querySelectorAll('.form-step');
    const progressSteps = document.querySelectorAll('.step');
    
    steps.forEach(s => s.classList.remove('active'));
    progressSteps.forEach(s => {
        s.classList.remove('active', 'completed');
    });
    
    const currentStepEl = document.querySelector(`.form-step[data-step="${step}"]`);
    const currentProgressStep = document.querySelector(`.step[data-step="${step}"]`);
    
    if (currentStepEl) {
        currentStepEl.classList.add('active');
    }
    
    progressSteps.forEach((s, index) => {
        if (index + 1 < step) {
            s.classList.add('completed');
        } else if (index + 1 === step) {
            s.classList.add('active');
        }
    });
    
    currentStep = step;
    
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function validateStep(step) {
    const errors = [];
    
    if (step === 1) {
        const nisn = document.getElementById('nisn').value.trim();
        const nama = document.getElementById('nama-lengkap').value.trim();
        
        if (!nisn) {
            errors.push('NISN harus diisi');
        } else if (!/^\d{1,20}$/.test(nisn)) {
            errors.push('NISN harus berupa angka (maksimal 20 digit)');
        }
        
        if (!nama) {
            errors.push('Nama lengkap harus diisi');
        } else if (nama.length < 3) {
            errors.push('Nama lengkap minimal 3 karakter');
        }
    }
    
    if (step === 2) {
        const noHp = document.getElementById('no-hp').value.trim();
        
        if (!noHp) {
            errors.push('Nomor HP harus diisi');
        } else if (!/^08\d{8,12}$/.test(noHp)) {
            errors.push('Nomor HP harus dimulai dengan 08 (8-12 digit)');
        }
        
        const email = document.getElementById('email').value.trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Format email tidak valid');
        }
    }
    
    if (step === 3) {
        const program = document.getElementById('program').value;
        const tanggalMasuk = document.getElementById('tanggal-masuk').value;
        
        if (!program) {
            errors.push('Program harus dipilih');
        }
        
        if (!tanggalMasuk) {
            errors.push('Tanggal masuk harus diisi');
        } else {
            const today = new Date().toISOString().split('T')[0];
            if (tanggalMasuk > today) {
                errors.push('Tanggal masuk tidak boleh di masa depan');
            }
        }
    }
    
    if (step === 4) {
        const namaWali = document.getElementById('nama-wali').value.trim();
        const noHpWali = document.getElementById('no-hp-wali').value.trim();
        const hubungan = document.getElementById('hubungan-wali').value;
        
        if (!namaWali) {
            errors.push('Nama wali harus diisi');
        } else if (namaWali.length < 3) {
            errors.push('Nama wali minimal 3 karakter');
        }
        
        if (!noHpWali) {
            errors.push('Nomor HP wali harus diisi');
        } else if (!/^08\d{8,12}$/.test(noHpWali)) {
            errors.push('Nomor HP wali harus dimulai dengan 08');
        }
        
        if (!hubungan) {
            errors.push('Hubungan dengan wali harus dipilih');
        }
    }
    
    if (step === 5) {
        const targetHafalan = document.getElementById('target-hafalan').value;
        const targetNilai = document.getElementById('target-nilai-reg').value;
        const setuju = document.getElementById('setuju-data').checked;
        
        if (!targetHafalan || targetHafalan < 0 || targetHafalan > 30) {
            errors.push('Target hafalan harus antara 0-30 juz');
        }
        
        if (!targetNilai || targetNilai < 0 || targetNilai > 100) {
            errors.push('Target nilai harus antara 0-100');
        }
        
        if (!setuju) {
            errors.push('Harap setujui pernyataan data');
        }
    }
    
    if (errors.length > 0) {
        alert('Error:\n' + errors.join('\n'));
        return false;
    }
    
    return true;
}

async function checkNISNUniqueness() {
    const nisn = document.getElementById('nisn').value.trim();
    
    if (!nisn) {
        alert('NISN harus diisi');
        return;
    }
    
    if (!/^\d{1,20}$/.test(nisn)) {
        alert('NISN harus berupa angka');
        return;
    }
    
    try {
        const url = window.API_CONFIG && window.API_CONFIG.buildUrl
            ? window.API_CONFIG.buildUrl(`students/${nisn}/`)
            : `/api/students/${nisn}/`;

        const response = await fetch(url);
        
        if (response.ok) {
            alert(`NISN ${nisn} sudah terdaftar! Silakan gunakan NISN yang berbeda.`);
            return;
        }
        
        showStep(2);
    } catch (error) {
        showStep(2);
    }
}

function previewPhoto(input) {
    const preview = document.getElementById('photo-preview');
    const filenameDisplay = input.nextElementSibling.querySelector('.upload-filename');
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.size > 2 * 1024 * 1024) {
            alert('Ukuran foto maksimal 2MB');
            input.value = '';
            return;
        }
        
        if (!file.type.match('image.*')) {
            alert('File harus berupa gambar (JPG, PNG)');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            preview.classList.add('active');
            filenameDisplay.textContent = file.name;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
        preview.classList.remove('active');
        filenameDisplay.textContent = 'atau drag & drop';
    }
}

function setupDragAndDrop() {
    const dropZone = document.querySelector('.file-upload-label');
    const fileInput = document.getElementById('foto-profil');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    dropZone.addEventListener('dragenter', () => {
        dropZone.style.borderColor = 'var(--accent)';
        dropZone.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        dropZone.style.background = '';
    });
    
    dropZone.addEventListener('drop', (e) => {
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        dropZone.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            previewPhoto(fileInput);
        }
    });
}

async function handleSubmit(e) {
    e.preventDefault();
    
    if (!validateStep(5)) {
        return;
    }
    
    const formData = {
        nisn: document.getElementById('nisn').value.trim(),
        nama: document.getElementById('nama-lengkap').value.trim(),
        tempat_lahir: document.getElementById('tempat-lahir').value,
        tanggal_lahir: document.getElementById('tanggal-lahir').value,
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('no-hp').value.trim(),
        alamat: document.getElementById('alamat').value.trim(),
        program: document.getElementById('program').value,
        kelas: document.getElementById('kelas-akademik').value,
        tanggal_masuk: document.getElementById('tanggal-masuk').value,
        sekolah_asal: document.getElementById('sekolah-asal').value,
        wali_nama: document.getElementById('nama-wali').value.trim(),
        wali_phone: document.getElementById('no-hp-wali').value.trim(),
        alamat_wali: document.getElementById('alamat-wali').value.trim(),
        hubungan_wali: document.getElementById('hubungan-wali').value,
        target_hafalan: parseInt(document.getElementById('target-hafalan').value) || 30,
        target_nilai: parseInt(document.getElementById('target-nilai-reg').value) || 75
    };
    
    try {
        const url = window.API_CONFIG && window.API_CONFIG.buildUrl
            ? window.API_CONFIG.buildUrl('registration/')
            : '/api/registration/';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessModal(formData.nisn, formData.nama);
        } else {
            alert('Error: ' + (data.message || 'Gagal mengirim formulir pendaftaran'));
        }
    } catch (error) {
        console.error('Error submitting registration:', error);
        alert('Terjadi kesalahan saat mengirim formulir. Silakan coba lagi.');
    }
}

function showSuccessModal(nisn, nama) {
    document.getElementById('success-nisn').textContent = nisn;
    document.getElementById('success-nama').textContent = nama;
    document.getElementById('success-modal').classList.add('active');
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
    window.location.href = '/';
}
