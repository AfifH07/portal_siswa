# BLUEPRINT — Portal Baron Android (React Native)
> **Proyek:** Portal Akademik Pondok Pesantren Baron  
> **Platform target:** Android (min SDK 24 / Android 7.0+)  
> **Tech stack:** React Native 0.74+ (CLI, bukan Expo Go) + Backend Django yang sudah di-deploy  
> **Tanggal dibuat:** 2026-03-28  
> **Status:** Blueprint final — siap implementasi  

---

## DAFTAR ISI

1. [Prasyarat & Alat](#1-prasyarat--alat)
2. [Arsitektur Aplikasi](#2-arsitektur-aplikasi)
3. [Struktur Direktori Lengkap](#3-struktur-direktori-lengkap)
4. [Setup Lingkungan (Step-by-step)](#4-setup-lingkungan-step-by-step)
5. [Inisialisasi Proyek](#5-inisialisasi-proyek)
6. [Semua Library & Versinya](#6-semua-library--versinya)
7. [Konfigurasi API Client](#7-konfigurasi-api-client)
8. [Sistem Autentikasi & State Global](#8-sistem-autentikasi--state-global)
9. [Sistem Navigasi](#9-sistem-navigasi)
10. [Pemetaan Screen per Role](#10-pemetaan-screen-per-role)
11. [Detail Setiap Screen](#11-detail-setiap-screen)
12. [Komponen Reusable](#12-komponen-reusable)
13. [Pemetaan Endpoint API](#13-pemetaan-endpoint-api)
14. [Penanganan Error & Offline](#14-penanganan-error--offline)
15. [Styling & Design System](#15-styling--design-system)
16. [Testing](#16-testing)
17. [Build & Distribusi APK](#17-build--distribusi-apk)
18. [Checklist Implementasi](#18-checklist-implementasi)
19. [Estimasi Waktu](#19-estimasi-waktu)

---

## 1. Prasyarat & Alat

### 1.1 Spesifikasi PC Minimum

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| RAM | 8 GB | 16 GB |
| Storage kosong | 15 GB | 30 GB |
| OS | Windows 10 64-bit | Windows 11 / macOS 13+ |
| Prosesor | Intel Core i5 Gen 8 / Ryzen 5 3000 | i7 Gen 10+ / Ryzen 7 |

> **Catatan:** Android Studio + Emulator sangat berat. Jika RAM 8 GB, gunakan device fisik Android untuk testing agar lebih lancar.

### 1.2 Software yang Wajib Diinstall

| Software | Versi | Link Download | Keterangan |
|---|---|---|---|
| Node.js | 18 LTS (min) | https://nodejs.org/en/download | Pilih LTS, bukan Current |
| JDK | 17 (Temurin) | https://adoptium.net/temurin/releases/?version=17 | Wajib versi 17 |
| Android Studio | Ladybug 2024.2.1+ | https://developer.android.com/studio | Sudah include SDK |
| Git | 2.x | https://git-scm.com/downloads | Sudah ada biasanya |
| VS Code | Latest | https://code.visualstudio.com | Editor utama |

### 1.3 Extension VS Code yang Disarankan

- **React Native Tools** (Microsoft)
- **ES7+ React/Redux/React-Native snippets**
- **Prettier - Code formatter**
- **GitLens**
- **Thunder Client** (untuk test API langsung dari VS Code)

### 1.4 Device / Emulator

Pilih salah satu:
- **Opsi A (Rekomendasi jika RAM terbatas):** Device Android fisik + kabel USB. Aktifkan Developer Options → USB Debugging.
- **Opsi B:** Emulator di Android Studio. Buat AVD: Pixel 7, Android API 33, x86_64.

---

## 2. Arsitektur Aplikasi

```
┌─────────────────────────────────────────────────────────┐
│                  REACT NATIVE APP                       │
│                                                         │
│  ┌─────────────┐   ┌──────────────┐  ┌──────────────┐  │
│  │  Navigation │   │  Zustand     │  │  AsyncStorage│  │
│  │  (Stack +   │   │  (Auth state,│  │  (JWT token, │  │
│  │   Bottom    │   │   user info) │  │   role, nisn)│  │
│  │   Tabs)     │   └──────────────┘  └──────────────┘  │
│  └─────────────┘                                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Screens (per role)                 │    │
│  │  Walisantri | Guru | Musyrif | Shared           │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │           API Layer (Axios + Interceptor)       │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
         ┌───────────────────────────────┐
         │   Django REST API (deployed)  │
         │   https://your-domain.com/api │
         │                               │
         │  /auth/login                  │
         │  /students/                   │
         │  /grades/                     │
         │  /attendance/                 │
         │  /kesantrian/                 │
         │  /evaluations/                │
         └───────────────────────────────┘
```

### 2.1 Pola Arsitektur: Feature-based

Setiap fitur (auth, walisantri, guru, musyrif) berdiri sendiri dalam foldernya masing-masing. Bukan MVC, bukan MVVM murni — melainkan **React hooks + Zustand** untuk state management.

### 2.2 Alur Data

```
User Action
    │
    ▼
Screen Component
    │ memanggil
    ▼
Custom Hook (useStudents, useAttendance, dll)
    │ memanggil
    ▼
API Service (src/api/services/xxx.js)
    │ memanggil
    ▼
Axios Client (src/api/client.js) ← auto-attach JWT
    │
    ▼
Backend Django API
```

---

## 3. Struktur Direktori Lengkap

```
PortalBaronApp/
│
├── android/                    ← File native Android (jangan ubah manual kecuali perlu)
│   ├── app/
│   │   ├── build.gradle        ← Konfigurasi build, signing config
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── res/            ← Icon, splash screen, dll
│   └── build.gradle
│
├── ios/                        ← Abaikan (tidak kita build)
│
├── src/
│   ├── api/
│   │   ├── client.js           ← Instance Axios + interceptor JWT
│   │   └── services/
│   │       ├── authService.js
│   │       ├── studentService.js
│   │       ├── gradeService.js
│   │       ├── attendanceService.js
│   │       ├── kesantrianService.js
│   │       └── evaluationService.js
│   │
│   ├── navigation/
│   │   ├── AppNavigator.js     ← Root navigator (Auth vs Main)
│   │   ├── AuthNavigator.js    ← Stack untuk login
│   │   ├── WalisantriNavigator.js
│   │   ├── GuruNavigator.js
│   │   └── MusyrifNavigator.js
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.js
│   │   │   └── ForgotPasswordScreen.js
│   │   │
│   │   ├── walisantri/
│   │   │   ├── WalisantriDashboardScreen.js
│   │   │   ├── ChildSelectorScreen.js
│   │   │   ├── GradesScreen.js
│   │   │   ├── AttendanceScreen.js
│   │   │   ├── HafalanScreen.js
│   │   │   ├── IbadahScreen.js
│   │   │   └── EvaluationScreen.js
│   │   │
│   │   ├── guru/
│   │   │   ├── GuruDashboardScreen.js
│   │   │   ├── StudentListScreen.js
│   │   │   ├── AttendanceInputScreen.js
│   │   │   ├── GradeInputScreen.js
│   │   │   └── EvaluationInputScreen.js
│   │   │
│   │   ├── musyrif/
│   │   │   ├── MusyrifDashboardScreen.js
│   │   │   ├── IbadahRecordScreen.js
│   │   │   ├── IbadahBulkScreen.js
│   │   │   └── PembinaanScreen.js
│   │   │
│   │   └── shared/
│   │       ├── ProfileScreen.js
│   │       └── ChangePasswordScreen.js
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.js
│   │   │   ├── Input.js
│   │   │   ├── Card.js
│   │   │   ├── Badge.js
│   │   │   ├── Avatar.js
│   │   │   ├── Divider.js
│   │   │   ├── LoadingSkeleton.js
│   │   │   ├── EmptyState.js
│   │   │   └── ErrorBoundary.js
│   │   │
│   │   ├── walisantri/
│   │   │   ├── ChildCard.js
│   │   │   ├── GradeCard.js
│   │   │   ├── AttendanceSummary.js
│   │   │   └── IbadahTracker.js
│   │   │
│   │   ├── guru/
│   │   │   ├── StudentRow.js
│   │   │   ├── AttendanceRow.js
│   │   │   └── GradeInput.js
│   │   │
│   │   └── musyrif/
│   │       ├── IbadahForm.js
│   │       └── PembinaanForm.js
│   │
│   ├── store/
│   │   ├── authStore.js        ← Zustand: token, user, role
│   │   └── appStore.js         ← Zustand: selected child (walisantri), dll
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useStudents.js
│   │   ├── useGrades.js
│   │   ├── useAttendance.js
│   │   ├── useKesantrian.js
│   │   └── useEvaluations.js
│   │
│   ├── utils/
│   │   ├── constants.js        ← BASE_URL, ROLES, STATUS_MAP, dll
│   │   ├── formatters.js       ← format tanggal, nilai, dll
│   │   ├── validators.js       ← validasi form
│   │   └── storage.js          ← wrapper AsyncStorage
│   │
│   └── theme/
│       ├── colors.js
│       ├── typography.js
│       └── spacing.js
│
├── __tests__/                  ← File test
├── .env                        ← Environment variables (jangan di-commit!)
├── .env.example
├── .gitignore
├── babel.config.js
├── metro.config.js
├── package.json
└── README.md
```

---

## 4. Setup Lingkungan (Step-by-step)

### 4.1 Install Node.js

1. Download Node.js 18 LTS dari https://nodejs.org
2. Install, pastikan opsi "Add to PATH" dicentang
3. Verifikasi:
```bash
node --version   # harus v18.x.x
npm --version    # harus 9.x atau 10.x
```

### 4.2 Install JDK 17

1. Download Temurin JDK 17 dari https://adoptium.net
2. Install dengan default settings
3. Set environment variable:
   - **Windows:** Buka System Properties → Advanced → Environment Variables
   - Tambah `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot`
   - Tambah `%JAVA_HOME%\bin` ke `Path`
4. Verifikasi:
```bash
java --version   # harus openjdk 17
```

### 4.3 Install Android Studio

1. Download dari https://developer.android.com/studio, install dengan default settings
2. Buka Android Studio → More Actions → SDK Manager
3. Pastikan terinstall (tab SDK Platforms):
   - Android 14.0 (API 34) ✓
   - Android 13.0 (API 33) ✓
4. Pastikan terinstall (tab SDK Tools):
   - Android SDK Build-Tools ✓
   - Android Emulator ✓
   - Android SDK Platform-Tools ✓
   - Intel x86 Emulator Accelerator (HAXM) ✓ — jika Intel
5. Set environment variable:
   - Tambah `ANDROID_HOME` = `C:\Users\<username>\AppData\Local\Android\Sdk`
   - Tambah ke `Path`: `%ANDROID_HOME%\platform-tools` dan `%ANDROID_HOME%\emulator`
6. Verifikasi:
```bash
adb --version    # harus muncul versi adb
```

### 4.4 Buat Emulator (jika tidak pakai device fisik)

1. Android Studio → More Actions → Virtual Device Manager
2. Create Device → Pilih "Pixel 7"
3. Pilih System Image: API 33 (Android 13), x86_64
4. Finish → Klik tombol ▶ untuk jalankan emulator

### 4.5 Device Fisik (alternatif emulator)

1. Di HP Android: Settings → About Phone → ketuk "Build Number" 7x
2. Settings → Developer Options → aktifkan USB Debugging
3. Hubungkan ke PC via USB, pilih "File Transfer" di notifikasi
4. Verifikasi: `adb devices` → harus muncul device-mu

---

## 5. Inisialisasi Proyek

```bash
# 1. Buat proyek React Native
npx react-native@0.74.0 init PortalBaronApp

# 2. Masuk ke folder proyek
cd PortalBaronApp

# 3. Test apakah berhasil (emulator/device harus aktif)
npx react-native run-android
```

Jika muncul splash screen React Native default → setup berhasil ✅

### 5.1 Setup .env

Install library environment:
```bash
npm install react-native-dotenv
```

Buat file `.env` di root proyek:
```env
API_BASE_URL=https://domain-kamu.com/api
APP_NAME=Portal Baron
```

Buat `.env.example`:
```env
API_BASE_URL=https://your-domain.com/api
APP_NAME=Portal Baron
```

Tambahkan `.env` ke `.gitignore`:
```
# .gitignore (tambahkan baris ini)
.env
```

Update `babel.config.js`:
```javascript
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['module:react-native-dotenv', {
      moduleName: '@env',
      path: '.env',
    }],
  ],
};
```

---

## 6. Semua Library & Versinya

Install semua sekaligus:

```bash
# Navigasi
npm install @react-navigation/native@6.x @react-navigation/stack@6.x @react-navigation/bottom-tabs@6.x
npm install react-native-screens react-native-safe-area-context

# HTTP & Storage
npm install axios
npm install @react-native-async-storage/async-storage

# State Management
npm install zustand

# UI Library
npm install react-native-paper
npm install react-native-vector-icons

# Chart
npm install react-native-chart-kit react-native-svg

# Form & validasi
npm install react-hook-form

# Environment
npm install react-native-dotenv

# Tanggal
npm install dayjs

# Infinite list / refresh
npm install @shopify/flash-list

# Gesture (diperlukan react-navigation stack)
npm install react-native-gesture-handler

# Loading / Skeleton
npm install react-native-skeleton-placeholder

# Toast notifikasi
npm install react-native-toast-message
```

### Link native modules (otomatis di RN 0.60+, tapi vector icons perlu langkah ekstra):

```bash
# Untuk react-native-vector-icons di Android
# Tambahkan ke android/app/build.gradle (bagian paling bawah):
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

### Tabel lengkap library:

| Library | Versi | Fungsi |
|---|---|---|
| `@react-navigation/native` | 6.x | Core navigasi |
| `@react-navigation/stack` | 6.x | Stack navigator (push/pop screen) |
| `@react-navigation/bottom-tabs` | 6.x | Tab bar bawah |
| `react-native-screens` | latest | Performa navigasi native |
| `react-native-safe-area-context` | latest | Handle notch/status bar |
| `axios` | latest | HTTP client |
| `@react-native-async-storage/async-storage` | latest | Simpan token ke storage lokal |
| `zustand` | 4.x | State management ringan |
| `react-native-paper` | 5.x | Komponen Material UI |
| `react-native-vector-icons` | latest | Icon set |
| `react-native-chart-kit` | latest | Chart/grafik |
| `react-native-svg` | latest | SVG (diperlukan chart-kit) |
| `react-hook-form` | 7.x | Manajemen form & validasi |
| `react-native-dotenv` | latest | Env variables |
| `dayjs` | latest | Format tanggal ringan |
| `@shopify/flash-list` | latest | FlatList berperforma tinggi |
| `react-native-gesture-handler` | latest | Gesture (swipe, dll) |
| `react-native-skeleton-placeholder` | latest | Loading skeleton UI |
| `react-native-toast-message` | latest | Notifikasi toast |

---

## 7. Konfigurasi API Client

### `src/api/client.js`

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '@env';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 detik timeout
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── REQUEST INTERCEPTOR: auto-attach JWT token ───────────────────────
client.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// ─── RESPONSE INTERCEPTOR: handle 401 (token expired) ─────────────────
client.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        const res = await axios.post(`${API_BASE_URL}/auth/token/refresh`, {
          refresh: refreshToken,
        });

        const newAccessToken = res.data.access;
        await AsyncStorage.setItem('access_token', newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        // Refresh token juga expired → paksa logout
        await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_data']);
        // Navigasi ke login akan ditangani oleh AppNavigator via authStore
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default client;
```

### `src/utils/constants.js`

```javascript
export const ROLES = {
  SUPERADMIN: 'superadmin',
  PIMPINAN: 'pimpinan',
  GURU: 'guru',
  MUSYRIF: 'musyrif',
  WALISANTRI: 'walisantri',
};

export const ATTENDANCE_STATUS = {
  HADIR: 'hadir',
  IZIN: 'izin',
  SAKIT: 'sakit',
  ALPHA: 'alpha',
};

export const IBADAH_WAKTU = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];

export const IBADAH_STATUS = {
  BERJAMAAH: 'berjamaah',
  SENDIRI: 'sendiri',
  TIDAK: 'tidak',
};

export const PREDIKAT = {
  M: 'Mumtaz',
  JJ: 'Jayyid Jiddan',
  J: 'Jayyid',
  PP: 'Perlu Pembinaan',
};
```

---

## 8. Sistem Autentikasi & State Global

### `src/store/authStore.js`

```javascript
import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create(set => ({
  isAuthenticated: false,
  isLoading: true,       // true saat app pertama buka (cek token)
  user: null,            // { username, name, role, nisn, kelas, program }
  accessToken: null,
  refreshToken: null,

  // Dipanggil saat login berhasil
  login: async loginData => {
    const {token, refresh, username, name, role, nisn, kelas, program} = loginData;
    await AsyncStorage.setItem('access_token', token);
    await AsyncStorage.setItem('refresh_token', refresh);
    await AsyncStorage.setItem('user_data', JSON.stringify({username, name, role, nisn, kelas, program}));

    set({
      isAuthenticated: true,
      accessToken: token,
      refreshToken: refresh,
      user: {username, name, role, nisn, kelas, program},
    });
  },

  // Dipanggil saat logout atau token expired
  logout: async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_data', 'selected_child']);
    set({isAuthenticated: false, user: null, accessToken: null, refreshToken: null});
  },

  // Dipanggil saat app pertama dibuka (restore session)
  restoreSession: async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userData = await AsyncStorage.getItem('user_data');

      if (token && userData) {
        set({
          isAuthenticated: true,
          accessToken: token,
          user: JSON.parse(userData),
        });
      }
    } catch (e) {
      // Token korup atau tidak ada
    } finally {
      set({isLoading: false});
    }
  },
}));
```

### `src/store/appStore.js`

```javascript
import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAppStore = create(set => ({
  // Untuk walisantri yang punya lebih dari 1 anak
  selectedChild: null,   // { nisn, nama, kelas, program }

  setSelectedChild: async child => {
    await AsyncStorage.setItem('selected_child', JSON.stringify(child));
    set({selectedChild: child});
  },

  // Data cache (opsional, untuk mengurangi request berulang)
  cachedData: {},
  setCachedData: (key, data) =>
    set(state => ({cachedData: {...state.cachedData, [key]: data}})),
}));
```

---

## 9. Sistem Navigasi

### `src/navigation/AppNavigator.js`

```javascript
import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {ActivityIndicator, View} from 'react-native';
import {useAuthStore} from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import WalisantriNavigator from './WalisantriNavigator';
import GuruNavigator from './GuruNavigator';
import MusyrifNavigator from './MusyrifNavigator';
import {ROLES} from '../utils/constants';

const AppNavigator = () => {
  const {isAuthenticated, isLoading, user, restoreSession} = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  // Tampilkan loading saat cek session awal
  if (isLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const getMainNavigator = () => {
    if (!user) return <AuthNavigator />;
    switch (user.role) {
      case ROLES.WALISANTRI:
        return <WalisantriNavigator />;
      case ROLES.GURU:
        return <GuruNavigator />;
      case ROLES.MUSYRIF:
        return <MusyrifNavigator />;
      case ROLES.PIMPINAN:
      case ROLES.SUPERADMIN:
        return <GuruNavigator />; // Pimpinan/superadmin pakai navigator guru (full akses)
      default:
        return <AuthNavigator />;
    }
  };

  return (
    <NavigationContainer>
      {isAuthenticated ? getMainNavigator() : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;
```

### `src/navigation/WalisantriNavigator.js`

```javascript
import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import WalisantriDashboardScreen from '../screens/walisantri/WalisantriDashboardScreen';
import GradesScreen from '../screens/walisantri/GradesScreen';
import AttendanceScreen from '../screens/walisantri/AttendanceScreen';
import HafalanScreen from '../screens/walisantri/HafalanScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import {colors} from '../theme/colors';

const Tab = createBottomTabNavigator();

const WalisantriNavigator = () => (
  <Tab.Navigator
    screenOptions={({route}) => ({
      tabBarIcon: ({color, size}) => {
        const icons = {
          Beranda: 'home',
          Nilai: 'book-open-variant',
          Absensi: 'calendar-check',
          Hafalan: 'quran',
          Profil: 'account',
        };
        return <Icon name={icons[route.name]} size={size} color={color} />;
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.gray,
      headerShown: true,
    })}>
    <Tab.Screen name="Beranda" component={WalisantriDashboardScreen} />
    <Tab.Screen name="Nilai" component={GradesScreen} />
    <Tab.Screen name="Absensi" component={AttendanceScreen} />
    <Tab.Screen name="Hafalan" component={HafalanScreen} />
    <Tab.Screen name="Profil" component={ProfileScreen} />
  </Tab.Navigator>
);

export default WalisantriNavigator;
```

> Navigator Guru dan Musyrif mengikuti pola yang sama, dengan tab yang berbeda sesuai fiturnya.

---

## 10. Pemetaan Screen per Role

### 10.1 Walisantri

| Screen | Fungsi | API Endpoint |
|---|---|---|
| `LoginScreen` | Form login | `POST /auth/login` |
| `WalisantriDashboardScreen` | Summary semua anak, pilih anak aktif | `GET /kesantrian/my-children-summary/` |
| `ChildSelectorScreen` | Modal pilih anak (jika multi-child) | Dari data dashboard |
| `GradesScreen` | Lihat nilai akademik & diniyah | `GET /grades/?nisn=xxx` |
| `AttendanceScreen` | Rekap kehadiran anak | `GET /attendance/?nisn=xxx` |
| `HafalanScreen` | Progress hafalan & halaqoh | `GET /grades/?nisn=xxx&jenis=diniyah` |
| `IbadahScreen` | Tracker sholat 5 waktu 7 hari | `GET /kesantrian/worship-tracker/<nisn>/` |
| `EvaluationScreen` | Catatan prestasi/pelanggaran | `GET /evaluations/?nisn=xxx` |
| `ProfileScreen` | Info akun, ganti password | `GET /auth/me`, `POST /auth/change-password` |

### 10.2 Guru

| Screen | Fungsi | API Endpoint |
|---|---|---|
| `LoginScreen` | Form login | `POST /auth/login` |
| `GuruDashboardScreen` | Ringkasan kelas & quick actions | `GET /dashboard/stats` |
| `StudentListScreen` | Daftar siswa (bisa filter kelas) | `GET /students/` |
| `AttendanceInputScreen` | Input absensi harian per kelas | `POST /attendance/batch` |
| `GradeInputScreen` | Input nilai per mapel/semester | `POST /grades/` |
| `EvaluationInputScreen` | Input prestasi/pelanggaran santri | `POST /evaluations/` |
| `ProfileScreen` | Info akun, ganti password | — |

### 10.3 Musyrif

| Screen | Fungsi | API Endpoint |
|---|---|---|
| `LoginScreen` | Form login | `POST /auth/login` |
| `MusyrifDashboardScreen` | Summary ibadah hari ini | `GET /dashboard/stats` |
| `IbadahRecordScreen` | Catat ibadah 1 santri | `POST /kesantrian/ibadah/record/` |
| `IbadahBulkScreen` | Catat ibadah banyak santri sekaligus | `POST /kesantrian/ibadah/record-bulk/` |
| `PembinaanScreen` | Tambah catatan BLP / pembinaan | `POST /kesantrian/pembinaan/` (jika ada endpoint-nya) |
| `ProfileScreen` | Info akun, ganti password | — |

---

## 11. Detail Setiap Screen

### 11.1 LoginScreen

**File:** `src/screens/auth/LoginScreen.js`

**Elemen UI:**
- Logo pesantren Baron (gambar)
- Judul "Portal Baron"
- Input: Username (teks)
- Input: Password (teks tersembunyi + ikon mata untuk show/hide)
- Tombol "Masuk"
- Link "Lupa password?"
- Loading state saat submit

**Logika:**
1. User submit → panggil `authService.login(username, password)`
2. Jika sukses → `authStore.login(responseData)` → navigasi otomatis (AppNavigator detect auth state)
3. Jika gagal 401 → tampilkan "Username atau password salah"
4. Jika gagal network → tampilkan "Tidak ada koneksi internet"

**Validasi form (react-hook-form):**
- Username: wajib diisi, min 3 karakter
- Password: wajib diisi, min 6 karakter

---

### 11.2 WalisantriDashboardScreen

**File:** `src/screens/walisantri/WalisantriDashboardScreen.js`

**Elemen UI:**
- Header: "Assalamu'alaikum, [Nama Wali]"
- Jika multi-child: Chip/pill selector nama anak (horizontal scroll)
- Card anak aktif: Nama, Kelas, Program
- Card ringkasan (4 kotak):
  - Total nilai rata-rata
  - Kehadiran bulan ini (%)
  - Ibadah 7 hari (%)
  - Predikat kesantrian (Mumtaz/dll)
- Tombol "Lihat Detail" untuk setiap modul

**Logika:**
1. `useEffect` → fetch `my-children-summary/`
2. Jika hanya 1 anak → langsung set `selectedChild`
3. Jika >1 anak → tampilkan selector
4. Saat ganti anak → reset semua data dan fetch ulang

---

### 11.3 AttendanceInputScreen (Guru)

**File:** `src/screens/guru/AttendanceInputScreen.js`

**Elemen UI:**
- Dropdown pilih kelas (XII-A, XII-B, XII-C, dst)
- Date picker (default: hari ini)
- Daftar siswa dengan radio button per baris: Hadir / Izin / Sakit / Alpha
- Tombol "Simpan Semua" (sticky di bawah)
- Indikator berapa yang sudah diisi

**Logika:**
1. Pilih kelas → fetch daftar siswa kelas tersebut dari `GET /students/?kelas=XII-A`
2. Inisialisasi semua status → `hadir` by default
3. User ubah status per siswa → update state lokal
4. Tekan Simpan → kirim `POST /attendance/batch` dengan array semua record
5. Sukses → tampilkan toast "Absensi berhasil disimpan"

**Payload batch attendance:**
```json
{
  "records": [
    {"nisn": "001", "tanggal": "2026-03-28", "status": "hadir"},
    {"nisn": "002", "tanggal": "2026-03-28", "status": "izin"},
    ...
  ]
}
```

---

### 11.4 IbadahBulkScreen (Musyrif)

**File:** `src/screens/musyrif/IbadahBulkScreen.js`

**Elemen UI:**
- Pilih waktu sholat (Subuh / Dzuhur / Ashar / Maghrib / Isya) — button group
- Date picker (default: hari ini)
- Daftar santri dengan pilihan status per baris: Berjamaah / Sendiri / Tidak
- Tombol "Simpan"

**Logika:**
1. Load semua santri dari `GET /students/`
2. User pilih waktu sholat & tanggal
3. Set status per santri
4. Submit → `POST /kesantrian/ibadah/record-bulk/`

---

### 11.5 GradeInputScreen (Guru)

**File:** `src/screens/guru/GradeInputScreen.js`

**Elemen UI:**
- Dropdown: Mata pelajaran (list 20 mapel dari constants)
- Dropdown: Semester (1-6)
- Dropdown: Tahun ajaran (mis. 2025/2026)
- Dropdown: Jenis nilai (UH, UTS, UAS, dll)
- Daftar siswa dengan field input angka per baris
- Tombol "Simpan"

**Logika:**
- Validasi nilai antara 0–100
- Submit satu per satu atau bulk (tergantung kemampuan endpoint)
- Tampilkan progress jika bulk (mis. "Menyimpan 15/30...")

---

## 12. Komponen Reusable

### 12.1 `Button.js`

```javascript
// src/components/common/Button.js
import React from 'react';
import {TouchableOpacity, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {colors} from '../../theme/colors';

const Button = ({title, onPress, loading = false, variant = 'primary', disabled = false, style}) => {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}>
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={[styles.text, variant === 'outline' && styles.textOutline]}>{title}</Text>
      }
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16},
  primary: {backgroundColor: colors.primary},
  outline: {backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary},
  danger: {backgroundColor: colors.danger},
  disabled: {opacity: 0.5},
  text: {color: '#fff', fontSize: 15, fontWeight: '600'},
  textOutline: {color: colors.primary},
});

export default Button;
```

### 12.2 `LoadingSkeleton.js`

Gunakan library `react-native-skeleton-placeholder` untuk tampilan loading yang baik, bukan hanya spinner.

```javascript
// src/components/common/LoadingSkeleton.js
import React from 'react';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

export const CardSkeleton = () => (
  <SkeletonPlaceholder>
    <SkeletonPlaceholder.Item flexDirection="column" gap={12}>
      <SkeletonPlaceholder.Item width="100%" height={100} borderRadius={12} />
      <SkeletonPlaceholder.Item width="100%" height={100} borderRadius={12} />
      <SkeletonPlaceholder.Item width="100%" height={100} borderRadius={12} />
    </SkeletonPlaceholder.Item>
  </SkeletonPlaceholder>
);
```

### 12.3 `EmptyState.js`

```javascript
// src/components/common/EmptyState.js
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const EmptyState = ({icon = 'inbox-outline', title = 'Tidak ada data', subtitle}) => (
  <View style={styles.container}>
    <Icon name={icon} size={64} color="#ccc" />
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  title: {fontSize: 16, color: '#999', marginTop: 12, fontWeight: '600'},
  subtitle: {fontSize: 13, color: '#bbb', marginTop: 6, textAlign: 'center'},
});

export default EmptyState;
```

---

## 13. Pemetaan Endpoint API

Semua endpoint sudah tersedia di backend. Tabel ini menghubungkan screen → endpoint:

| Screen | Method | Endpoint | Body/Params |
|---|---|---|---|
| Login | POST | `/auth/login` | `{username, password}` |
| Ganti Password | POST | `/auth/change-password` | `{old_password, new_password}` |
| Lupa Password | POST | `/auth/request-reset` | `{username}` |
| Refresh Token | POST | `/auth/token/refresh` | `{refresh}` |
| Dashboard Guru | GET | `/dashboard/stats` | — |
| Daftar Siswa | GET | `/students/` | `?kelas=XII-A&search=nama` |
| Kelas Tersedia | GET | `/students/classes/` | — |
| Input Absensi Batch | POST | `/attendance/batch` | array records |
| Rekap Absensi | GET | `/attendance/` | `?nisn=xxx&tanggal_mulai=&tanggal_akhir=` |
| Input Nilai | POST | `/grades/` | `{nisn, mata_pelajaran, nilai, semester, ...}` |
| Daftar Nilai | GET | `/grades/` | `?nisn=xxx&semester=1` |
| Input Evaluasi | POST | `/evaluations/` | `{nisn, jenis, kategori, judul, deskripsi}` |
| Daftar Evaluasi | GET | `/evaluations/` | `?nisn=xxx` |
| Dashboard Walisantri | GET | `/kesantrian/my-children-summary/` | — |
| Ibadah Tracker | GET | `/kesantrian/worship-tracker/<nisn>/` | — |
| Catat Ibadah | POST | `/kesantrian/ibadah/record/` | `{nisn, tanggal, jenis, waktu, status}` |
| Catat Ibadah Bulk | POST | `/kesantrian/ibadah/record-bulk/` | array records |
| Skor Santri | GET | `/kesantrian/student-metrics/<nisn>/` | — |
| Chart Data | GET | `/kesantrian/chart-data/<nisn>/` | — |

### Service file (contoh authService):

```javascript
// src/api/services/authService.js
import client from '../client';

export const authService = {
  login: (username, password) =>
    client.post('/auth/login', {username, password}),

  changePassword: (oldPassword, newPassword) =>
    client.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    }),

  refreshToken: refreshToken =>
    client.post('/auth/token/refresh', {refresh: refreshToken}),
};
```

---

## 14. Penanganan Error & Offline

### 14.1 Penanganan Error HTTP

```javascript
// src/utils/errorHandler.js
export const getErrorMessage = error => {
  if (!error.response) {
    return 'Tidak ada koneksi internet. Periksa jaringan Anda.';
  }
  switch (error.response.status) {
    case 400:
      return error.response.data?.message || 'Data tidak valid.';
    case 401:
      return 'Sesi habis. Silakan login kembali.';
    case 403:
      return 'Anda tidak punya akses ke fitur ini.';
    case 404:
      return 'Data tidak ditemukan.';
    case 500:
      return 'Server sedang bermasalah. Coba lagi nanti.';
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
};
```

### 14.2 Custom Hook dengan Error Handling

```javascript
// src/hooks/useStudents.js
import {useState, useCallback} from 'react';
import {studentService} from '../api/services/studentService';
import {getErrorMessage} from '../utils/errorHandler';

export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStudents = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentService.getStudents(params);
      setStudents(res.data.students || res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return {students, loading, error, fetchStudents};
};
```

### 14.3 ErrorBoundary

```javascript
// src/components/common/ErrorBoundary.js
import React from 'react';
import {View, Text, Button} from 'react-native';

class ErrorBoundary extends React.Component {
  state = {hasError: false};

  static getDerivedStateFromError() {
    return {hasError: true};
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24}}>
          <Text style={{fontSize: 16, marginBottom: 16}}>Terjadi kesalahan tak terduga.</Text>
          <Button title="Coba Lagi" onPress={() => this.setState({hasError: false})} />
        </View>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## 15. Styling & Design System

### `src/theme/colors.js`

```javascript
export const colors = {
  // Brand — Baron Islamic color scheme
  primary: '#178560',       // Emerald (warna utama Baron)
  primaryDark: '#0F6E56',
  primaryLight: '#E1F5EE',
  accent: '#C8961C',        // Baron Gold
  accentLight: '#FFF8E7',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',
  gray: '#6B7280',
  grayLight: '#F3F4F6',
  grayBorder: '#E5E7EB',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Background
  background: '#F9FAFB',
  card: '#FFFFFF',
};
```

### `src/theme/typography.js`

```javascript
export const typography = {
  h1: {fontSize: 28, fontWeight: '700', lineHeight: 36},
  h2: {fontSize: 22, fontWeight: '700', lineHeight: 30},
  h3: {fontSize: 18, fontWeight: '600', lineHeight: 26},
  h4: {fontSize: 16, fontWeight: '600', lineHeight: 24},
  body: {fontSize: 14, fontWeight: '400', lineHeight: 22},
  bodySmall: {fontSize: 12, fontWeight: '400', lineHeight: 18},
  label: {fontSize: 11, fontWeight: '500', letterSpacing: 0.5},
};
```

### `src/theme/spacing.js`

```javascript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

---

## 16. Testing

### 16.1 Unit Test dengan Jest

Jest sudah include di React Native. Buat test untuk utility functions:

```javascript
// __tests__/utils/formatters.test.js
import {formatGrade, formatDate} from '../../src/utils/formatters';

describe('formatters', () => {
  test('formatGrade returns correct predikat', () => {
    expect(formatGrade(90)).toBe('A');
    expect(formatGrade(75)).toBe('B');
  });

  test('formatDate formats correctly', () => {
    expect(formatDate('2026-03-28')).toBe('28 Maret 2026');
  });
});
```

Jalankan:
```bash
npm test
```

### 16.2 Testing Manual di Device

Urutan testing yang disarankan:

1. **Login** — coba login dengan user `admin/admin123`, `wali_multi/wali123`, `musyrif_demo/password123`
2. **Navigasi** — pastikan setiap role diarahkan ke navigator yang benar
3. **Fetch data** — pastikan data muncul setelah loading
4. **Input data** — coba input absensi / nilai / ibadah, pastikan tersimpan
5. **Error handling** — matikan internet, pastikan muncul pesan error yang ramah
6. **Token expired** — tunggu 60 menit atau set JWT_ACCESS_TOKEN_LIFETIME=1 di backend, pastikan refresh token bekerja
7. **Logout** — pastikan semua data terhapus dari storage

### 16.3 Test Akun yang Tersedia

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | superadmin |
| `wali_multi` | `wali123` | walisantri (2 anak) |
| `musyrif_demo` | `password123` | musyrif |

---

## 17. Build & Distribusi APK

### 17.1 Buat Keystore (Signing Key) — Hanya sekali

```bash
cd android/app

keytool -genkey -v -keystore portal-baron-release.keystore \
  -alias portal-baron-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Isi informasi yang diminta (nama, organisasi, dll). **Simpan file `.keystore` ini dengan aman — jika hilang, kamu tidak bisa update APK ke Play Store!**

### 17.2 Konfigurasi Signing di Gradle

Edit `android/gradle.properties`:
```properties
MYAPP_UPLOAD_STORE_FILE=portal-baron-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=portal-baron-key
MYAPP_UPLOAD_STORE_PASSWORD=password_yang_kamu_set
MYAPP_UPLOAD_KEY_PASSWORD=password_yang_kamu_set
```

Edit `android/app/build.gradle` — tambahkan di dalam `android { ... }`:
```groovy
signingConfigs {
    release {
        storeFile file(MYAPP_UPLOAD_STORE_FILE)
        storePassword MYAPP_UPLOAD_STORE_PASSWORD
        keyAlias MYAPP_UPLOAD_KEY_ALIAS
        keyPassword MYAPP_UPLOAD_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

### 17.3 Build APK Release

```bash
cd android
./gradlew assembleRelease
```

File APK ada di:
```
android/app/build/outputs/apk/release/app-release.apk
```

### 17.4 Distribusi Internal (tanpa Play Store)

1. Upload file `.apk` ke Google Drive atau server
2. Bagikan link ke pengguna
3. Di HP penerima: Settings → Install Unknown Apps → aktifkan untuk browser yang dipakai download
4. Download dan install

### 17.5 Play Store (Jika Ingin Dipublish)

Kebutuhan tambahan:
- Akun Google Play Console: https://play.google.com/console ($25 sekali bayar)
- Build AAB (bukan APK): `./gradlew bundleRelease` → file di `android/app/build/outputs/bundle/release/app-release.aab`
- Siapkan: icon 512x512, screenshot, deskripsi app, privacy policy URL
- Target API minimal 34 (Android 14) untuk Play Store baru

---

## 18. Checklist Implementasi

Gunakan checklist ini untuk melacak progress:

### ☐ Setup & Fondasi
- [ ] Node.js 18 LTS terinstall
- [ ] JDK 17 terinstall dan `JAVA_HOME` diset
- [ ] Android Studio terinstall dengan SDK yang benar
- [ ] `ANDROID_HOME` dan PATH diset
- [ ] Emulator/device terhubung, `adb devices` muncul
- [ ] Proyek React Native berhasil dibuat dengan `npx react-native init`
- [ ] `npx react-native run-android` berhasil jalan (muncul splash screen)
- [ ] Semua library terinstall tanpa error
- [ ] File `.env` dikonfigurasi dengan `API_BASE_URL` yang benar
- [ ] Axios client dengan interceptor JWT berjalan

### ☐ Autentikasi
- [ ] `LoginScreen` UI selesai
- [ ] Login API terhubung dan token tersimpan di AsyncStorage
- [ ] `authStore` (Zustand) berfungsi
- [ ] Restore session saat app dibuka
- [ ] Auto-refresh token saat 401
- [ ] Logout menghapus semua data storage
- [ ] Navigasi berdasarkan role berfungsi (walisantri/guru/musyrif diarahkan berbeda)

### ☐ Walisantri
- [ ] `WalisantriDashboardScreen` — fetch dan tampilkan summary
- [ ] Multi-child selector berfungsi (ganti anak → data refresh)
- [ ] `GradesScreen` — tampilkan nilai akademik & diniyah
- [ ] `AttendanceScreen` — tampilkan rekap kehadiran
- [ ] `HafalanScreen` — tampilkan progress hafalan
- [ ] `IbadahScreen` — tampilkan worship tracker 7 hari
- [ ] `EvaluationScreen` — tampilkan catatan evaluasi

### ☐ Guru
- [ ] `GuruDashboardScreen` — tampilkan stats
- [ ] `StudentListScreen` — daftar siswa dengan filter kelas
- [ ] `AttendanceInputScreen` — input absensi batch berfungsi
- [ ] `GradeInputScreen` — input nilai berfungsi
- [ ] `EvaluationInputScreen` — input evaluasi berfungsi

### ☐ Musyrif
- [ ] `MusyrifDashboardScreen`
- [ ] `IbadahRecordScreen` — catat 1 santri
- [ ] `IbadahBulkScreen` — catat banyak santri
- [ ] `PembinaanScreen` — catat BLP/pembinaan

### ☐ Shared
- [ ] `ProfileScreen` — tampilkan info akun
- [ ] `ChangePasswordScreen` — ganti password berfungsi
- [ ] Toast notifikasi berfungsi (sukses/error)
- [ ] Loading skeleton tampil saat fetch data
- [ ] Empty state tampil saat data kosong
- [ ] Error message tampil saat gagal fetch

### ☐ Kualitas & Testing
- [ ] Semua screen diuji di emulator
- [ ] Semua screen diuji di device fisik
- [ ] Tes dengan internet mati (error handling berfungsi)
- [ ] Tes pergantian role (login dengan akun berbeda)
- [ ] Tidak ada crash yang tidak tertangani

### ☐ Build & Distribusi
- [ ] Keystore dibuat dan disimpan aman
- [ ] Signing config dikonfigurasi di gradle
- [ ] `./gradlew assembleRelease` berhasil tanpa error
- [ ] APK release diuji di device (bukan dari Metro bundler)
- [ ] APK didistribusikan ke pengguna pertama (admin, musyrif, walisantri test)

---

## 19. Estimasi Waktu

Asumsi: solo developer, sudah paham JavaScript, baru mulai mobile, kerja part-time (~3–4 jam/hari).

| Fase | Task | Estimasi |
|---|---|---|
| **Setup** | Install semua tools, konfigurasi, init proyek, pastikan run | 1–2 hari |
| **Fondasi** | API client, auth store, navigasi dasar, login screen | 2–3 hari |
| **Walisantri** | Semua 7 screen + komponen | 5–7 hari |
| **Guru** | Semua 5 screen | 4–5 hari |
| **Musyrif** | Semua 4 screen | 3–4 hari |
| **Polish** | Error handling, skeleton, toast, UX fix | 2–3 hari |
| **Testing** | Testing manual semua role + bug fix | 2–3 hari |
| **Build** | Setup signing, build APK, distribusi | 1 hari |
| **Total** | | **~3–5 minggu** |

> **Tips:** Mulai dari Walisantri karena ini yang paling sering dipakai dan paling "read-only" — lebih mudah dan hasilnya cepat kelihatan. Guru & Musyrif mengikuti pola yang sama.

---

## Catatan Penting

1. **Jangan simpan credential apapun di kode.** Gunakan `.env` untuk `API_BASE_URL` dan pastikan `.env` ada di `.gitignore`.

2. **Backend harus HTTPS di production.** Jika backend pakai HTTP, Android 9+ akan memblokir request. Jika terpaksa pakai HTTP untuk development, tambahkan di `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">your-dev-ip</domain>
  </domain-config>
</network-security-config>
```
Dan daftarkan di `AndroidManifest.xml`: `android:networkSecurityConfig="@xml/network_security_config"`

3. **Jangan edit folder `android/` secara manual** kecuali mengikuti panduan ini. Jika error gradle, coba: `cd android && ./gradlew clean` lalu jalankan ulang.

4. **Backup keystore.** Simpan file `.keystore` + password-nya di tempat yang aman (Google Drive, password manager). Jika hilang, kamu tidak bisa update APK yang sama ke Play Store.

5. **API_BASE_URL saat development** — jika backend di PC lokal dan testing di emulator: gunakan `http://10.0.2.2:8000/api` (10.0.2.2 adalah alias localhost di Android Emulator). Jika testing di device fisik: gunakan IP lokal PC (mis. `http://192.168.1.5:8000/api`) dan pastikan HP dan PC terhubung ke WiFi yang sama.

---

*Blueprint ini mencakup semua yang dibutuhkan untuk membangun aplikasi Android Portal Baron dari nol hingga distribusi. Tidak ada langkah yang terlewat atau ambigu. Ikuti urutan fase secara berurutan.*
