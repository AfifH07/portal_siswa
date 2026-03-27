# =============================================================================
#  LAYER SHIFT MARTINGALE (LSM) — Python Backtest
#  v1 : run_layer_shift()       → Backtest + Parameter Scan
#  v2 : Simulasi Unlimited Redeposit + Withdraw Strategy
#
#  Strategi:
#  - Entry mengikuti trend (EMA20 > EMA50 + Close > EMA200 + ADX filter)
#  - Setiap SL hit → buka layer berikutnya di harga SL sebelumnya
#  - Lot dikali multiplier setiap layer
#  - TP = 2x SL setiap layer
#  - Max layers sebagai safety cap
#
#  Cara pakai:
#  1. Jalankan section "SETUP" dulu (Cell 1)
#  2. Jalankan "ENGINE V1" (Cell 2)
#  3. Jalankan "SCAN + VISUALISASI" (Cell 3) → lihat parameter terbaik
#  4. Jalankan "SIMULASI V2 UNLIMITED REDEPOSIT" (Cell 4) → simulasi realistis
# =============================================================================


# ===========================================================================
# CELL 1 — SETUP & DOWNLOAD DATA
# ===========================================================================

import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from itertools import product
from datetime import datetime, timedelta

plt.style.use('dark_background')

# Download data 2 tahun terakhir (1H candle)
end_date   = datetime.today().strftime('%Y-%m-%d')
start_date = (datetime.today() - timedelta(days=720)).strftime('%Y-%m-%d')

xau_raw = yf.download("GC=F", start=start_date, end=end_date,
                       interval="1h", progress=False)
if isinstance(xau_raw.columns, pd.MultiIndex):
    xau_raw.columns = xau_raw.columns.get_level_values(0)

df_raw = xau_raw[['Open', 'High', 'Low', 'Close']].dropna()


def calc_trend(df):
    """Hitung semua indikator yang dibutuhkan untuk entry filter."""
    df = df.copy()

    # EMA
    df['ema20']  = df['Close'].ewm(span=20).mean()
    df['ema50']  = df['Close'].ewm(span=50).mean()
    df['ema200'] = df['Close'].ewm(span=200).mean()

    # Trend direction
    df['trend_major'] = np.where(df['Close'] > df['ema200'], 1, -1)
    df['trend_minor'] = np.where(df['ema20']  > df['ema50'],  1, -1)

    # True Range untuk ADX
    df['tr'] = np.maximum(
        df['High'] - df['Low'],
        np.maximum(
            abs(df['High'] - df['Close'].shift(1)),
            abs(df['Low']  - df['Close'].shift(1))
        )
    )
    atr14 = df['tr'].rolling(14).mean()

    # Directional Movement
    df['dm_plus'] = np.where(
        (df['High'] - df['High'].shift(1)) > (df['Low'].shift(1) - df['Low']),
        np.maximum(df['High'] - df['High'].shift(1), 0), 0
    )
    df['dm_minus'] = np.where(
        (df['Low'].shift(1) - df['Low']) > (df['High'] - df['High'].shift(1)),
        np.maximum(df['Low'].shift(1) - df['Low'], 0), 0
    )

    # ADX
    di_plus  = 100 * df['dm_plus'].rolling(14).mean()  / atr14
    di_minus = 100 * df['dm_minus'].rolling(14).mean() / atr14
    dx       = 100 * abs(di_plus - di_minus) / (di_plus + di_minus)
    df['adx'] = dx.rolling(14).mean()

    # Session filter (07:00–21:00 UTC = London + NY)
    df['hour']       = df.index.hour
    df['in_session'] = df['hour'].between(7, 21)

    return df.dropna()


df = calc_trend(df_raw)

print(f"Total candle 1H : {len(df)}")
print(f"Periode         : {df.index[0].date()} → {df.index[-1].date()}")


# ===========================================================================
# CELL 2 — ENGINE V1: run_layer_shift()
# ===========================================================================

def run_layer_shift(df,
                    sl_pips     = 50,    # SL per layer (dalam pips XAU)
                    lot_base    = 0.01,  # lot layer pertama
                    lot_mult    = 2.0,   # multiplier lot setiap layer baru
                    max_layers  = 6,     # maksimum layer sebelum stop
                    adx_min     = 15,    # minimum ADX untuk entry
                    capital     = 200,   # modal awal ($)
                    spread_pips = 3):    # estimasi spread (pips)
    """
    Layer Shift Martingale Backtest Engine.

    Mekanisme:
    - Entry saat trend_major=1 & trend_minor=1 → BUY
    - Entry saat trend_major=-1 & trend_minor=-1 → SELL
    - Setiap layer kena SL → buka layer berikutnya tepat di harga SL
    - Lot dikali lot_mult setiap layer
    - TP setiap layer = 2x SL
    - Sequence selesai saat semua layer closed (TP atau max layers)
    """
    pip_size = 0.1   # 1 pip XAU = $0.10 movement
    pip_val  = 0.1   # nilai 1 pip per 0.01 lot = $0.10

    cap      = float(capital)
    peak_cap = float(capital)
    blown    = False

    layers    = []   # list of dict: {entry, sl, tp, lot, status, layer}
    direction = None # 'buy' atau 'sell'

    trades_log = []
    equity_log = []
    daily_pnl  = {}
    total_tr   = 0
    win_tr     = 0

    for i in range(1, len(df)):
        row   = df.iloc[i]
        price = row['Close']
        high  = row['High']
        low   = row['Low']
        date  = df.index[i].date()

        if date not in daily_pnl:
            daily_pnl[date] = 0.0

        if blown:
            equity_log.append(cap)
            continue

        # ── Hitung floating semua layer aktif ─────────────────────────────
        floating = 0.0
        for ly in layers:
            if ly['status'] != 'open':
                continue
            if direction == 'buy':
                floating += (price - ly['entry']) * ly['lot'] / 0.01 * pip_val / pip_size
            else:
                floating += (ly['entry'] - price) * ly['lot'] / 0.01 * pip_val / pip_size

        total_eq = cap + floating
        if total_eq > peak_cap:
            peak_cap = total_eq

        # ── Cek SL / TP setiap layer ──────────────────────────────────────
        closed_this_bar = []  # list of ('SL'/'TP', pnl_amount, layer_dict)

        for ly in layers:
            if ly['status'] != 'open':
                continue

            sl_hit = tp_hit = False

            if direction == 'buy':
                if low  <= ly['sl']: sl_hit = True
                if high >= ly['tp']: tp_hit = True
            else:
                if high >= ly['sl']: sl_hit = True
                if low  <= ly['tp']: tp_hit = True

            if sl_hit:
                # Hitung loss layer ini
                loss  = -(sl_pips * ly['lot'] / 0.01 * pip_val)
                loss -= spread_pips * ly['lot'] / 0.01 * pip_val * 0.1
                cap  += loss
                daily_pnl[date] += loss
                ly['status'] = 'sl'
                closed_this_bar.append(('SL', loss, ly))

                # Buka layer berikutnya jika belum max
                active_count = sum(1 for l in layers if l['status'] != 'cancelled')
                if active_count < max_layers:
                    new_lot   = max(0.01, round(ly['lot'] * lot_mult / 0.01) * 0.01)
                    new_entry = ly['sl']  # entry tepat di SL layer sebelumnya
                    if direction == 'buy':
                        new_sl = new_entry - sl_pips * pip_size
                        new_tp = new_entry + sl_pips * pip_size * 2
                    else:
                        new_sl = new_entry + sl_pips * pip_size
                        new_tp = new_entry - sl_pips * pip_size * 2

                    layers.append({
                        'entry' : new_entry,
                        'sl'    : new_sl,
                        'tp'    : new_tp,
                        'lot'   : new_lot,
                        'status': 'open',
                        'layer' : active_count + 1
                    })

            elif tp_hit:
                # Hitung profit layer ini
                profit  = sl_pips * 2 * ly['lot'] / 0.01 * pip_val
                profit -= spread_pips * ly['lot'] / 0.01 * pip_val * 0.1
                cap    += profit
                daily_pnl[date] += profit
                ly['status'] = 'tp'
                closed_this_bar.append(('TP', profit, ly))

        # ── Cek apakah seluruh sequence sudah selesai ─────────────────────
        open_layers = [l for l in layers if l['status'] == 'open']

        if layers and not open_layers:
            total_tr += 1
            win_tr   += 1 if cap >= peak_cap * 0.99 else 0

            trades_log.append({
                'date'   : df.index[i],
                'layers' : len(layers),
                'net'    : round(sum(c[1] for c in closed_this_bar), 4),
                'result' : 'WIN' if cap >= peak_cap * 0.99 else 'LOSS'
            })

            layers    = []
            direction = None

            # Blown check
            if cap <= capital * 0.1:
                blown = True
                print(f"💀 BLOWN di {date} | Sisa: ${cap:.2f}")

        # ── Entry baru jika tidak ada posisi aktif ────────────────────────
        if not layers and not blown and row['in_session']:
            if row['adx'] >= adx_min:
                if row['trend_major'] == 1 and row['trend_minor'] == 1:
                    side = 'buy'
                elif row['trend_major'] == -1 and row['trend_minor'] == -1:
                    side = 'sell'
                else:
                    # Trend tidak jelas, skip
                    eq_now = cap + floating
                    equity_log.append(eq_now)
                    continue

                direction = side
                if side == 'buy':
                    entry_px = price + spread_pips * 0.01
                    sl_px    = entry_px - sl_pips * pip_size
                    tp_px    = entry_px + sl_pips * pip_size * 2
                else:
                    entry_px = price
                    sl_px    = entry_px + sl_pips * pip_size
                    tp_px    = entry_px - sl_pips * pip_size * 2

                layers.append({
                    'entry' : entry_px,
                    'sl'    : sl_px,
                    'tp'    : tp_px,
                    'lot'   : lot_base,
                    'status': 'open',
                    'layer' : 1
                })

        # ── Log equity ────────────────────────────────────────────────────
        open_fl = sum(
            (price - ly['entry']) * ly['lot'] / 0.01 * pip_val / pip_size
            if direction == 'buy'
            else (ly['entry'] - price) * ly['lot'] / 0.01 * pip_val / pip_size
            for ly in layers if ly['status'] == 'open'
        ) if layers else 0.0

        equity_log.append(cap + open_fl)

    # ── Hasil akhir ────────────────────────────────────────────────────────
    if not trades_log:
        print("Tidak ada trade!")
        return None

    td   = pd.DataFrame(trades_log)
    eq   = np.array(equity_log)
    pk   = np.maximum.accumulate(np.maximum(eq, 0.01))
    dd   = (eq - pk) / pk * 100
    ds   = pd.Series(daily_pnl)

    wins = td[td['result'] == 'WIN']
    loss = td[td['result'] != 'WIN']
    gp   = wins['net'].sum() if len(wins) > 0 else 0.0
    gl   = abs(loss['net'].sum()) if len(loss) > 0 else 0.0001

    return {
        'total_ret' : round((cap - capital) / capital * 100, 2),
        'winrate'   : round(len(wins) / len(td) * 100, 1),
        'pf'        : round(gp / gl, 3),
        'n_trades'  : len(td),
        'max_dd'    : round(dd.min(), 2),
        'avg_daily' : round(ds[ds != 0].mean(), 4),
        'final_cap' : round(cap, 2),
        'blown'     : blown,
        'trades_df' : td,
        'equity_arr': eq,
        'daily_s'   : ds
    }


print("Layer Shift Martingale engine siap.")


# ===========================================================================
# CELL 3 — SCAN PARAMETER + VISUALISASI TERBAIK
# ===========================================================================

param_grid = list(product(
    [30, 50, 80],      # sl_pips
    [2.0, 2.5, 3.0],  # lot_mult
    [4, 6, 8],         # max_layers
    [15, 20],          # adx_min
))

print(f"Total kombinasi: {len(param_grid)}")

results = []
for sl, mult, maxl, adx in param_grid:
    r = run_layer_shift(df, sl_pips=sl, lot_mult=mult,
                        max_layers=maxl, adx_min=adx)
    if r and r['n_trades'] >= 10:
        results.append({
            'sl'       : sl,
            'mult'     : mult,
            'maxl'     : maxl,
            'adx'      : adx,
            'total_ret': r['total_ret'],
            'winrate'  : r['winrate'],
            'pf'       : r['pf'],
            'n_trades' : r['n_trades'],
            'max_dd'   : r['max_dd'],
            'avg_daily': r['avg_daily'],
            'blown'    : r['blown']
        })

res_df = pd.DataFrame(results)

# Filter: tidak blown, DD > -50%, return positif
safe = res_df[
    (~res_df['blown']) &
    (res_df['max_dd'] > -50) &
    (res_df['total_ret'] > 0)
].sort_values('pf', ascending=False)

print(f"\nValid    : {len(res_df)}")
print(f"Aman     : {len(safe)}")

# Tampilkan top 10
target = safe if len(safe) > 0 else res_df.sort_values('total_ret', ascending=False)
print("\nTop 10:")
print(target[['sl', 'mult', 'maxl', 'adx', 'total_ret',
              'winrate', 'pf', 'n_trades', 'max_dd', 'avg_daily']
             ].head(10).to_string(index=False))

# ── Visualisasi parameter terbaik ─────────────────────────────────────────
best = target.iloc[0]
r    = run_layer_shift(df,
                       sl_pips    = int(best['sl']),
                       lot_mult   = best['mult'],
                       max_layers = int(best['maxl']),
                       adx_min    = int(best['adx']))

eq = r['equity_arr']
pk = np.maximum.accumulate(np.maximum(eq, 0.01))
dd = (eq - pk) / pk * 100
ds = r['daily_s'][r['daily_s'] != 0]

fig, axes = plt.subplots(3, 1, figsize=(14, 11))

# Equity curve
axes[0].plot(eq, color='lime', linewidth=0.8)
axes[0].axhline(200, color='white', linestyle='--', alpha=0.4, label='Modal $200')
axes[0].fill_between(range(len(eq)), eq, 200,
                     where=(eq >= 200), color='lime', alpha=0.15)
axes[0].fill_between(range(len(eq)), eq, 200,
                     where=(eq  < 200), color='red',  alpha=0.3)
axes[0].set_title(f"Equity | SL={int(best['sl'])}pip "
                  f"Mult={best['mult']}x MaxL={int(best['maxl'])} ADX>={int(best['adx'])}")
axes[0].set_ylabel('USD')
axes[0].legend(fontsize=8)
axes[0].grid(alpha=0.3)

# Drawdown
axes[1].fill_between(range(len(dd)), dd, 0, color='red', alpha=0.6)
axes[1].set_title(f"Drawdown | Max: {dd.min():.1f}%")
axes[1].set_ylabel('%')
axes[1].grid(alpha=0.3)

# Daily PnL
axes[2].bar(range(len(ds)), ds.values,
            color=['lime' if v > 0 else 'red' for v in ds.values],
            alpha=0.8, width=0.8)
axes[2].axhline(0, color='white', linestyle='--', alpha=0.4)
axes[2].set_title(f"Daily PnL | Avg: ${r['avg_daily']:.2f}/hari")
axes[2].set_ylabel('USD')
axes[2].grid(alpha=0.3)

status = "TIDAK BLOWN" if not r['blown'] else "BLOWN"
plt.suptitle(f"Layer Shift Martingale V1 | {status} | "
             f"WR={r['winrate']}% PF={r['pf']} "
             f"DD={r['max_dd']}% Return={r['total_ret']}%",
             fontsize=12)
plt.tight_layout()
plt.show()

print(f"\n{'='*48}")
print(f"  Parameter Terbaik V1")
print(f"{'='*48}")
print(f"  SL per layer  : {int(best['sl'])} pips")
print(f"  Lot Mult      : {best['mult']}x")
print(f"  Max Layers    : {int(best['maxl'])}")
print(f"  ADX Min       : {int(best['adx'])}")
print(f"  Return        : {r['total_ret']}%")
print(f"  Win Rate      : {r['winrate']}%")
print(f"  Profit Factor : {r['pf']}")
print(f"  Max DD        : {r['max_dd']}%")
print(f"  Avg Daily     : ${r['avg_daily']:.4f}")
print(f"  Status        : {status}")
print(f"{'='*48}")


# ===========================================================================
# CELL 4 — SIMULASI V2: UNLIMITED REDEPOSIT + WITHDRAW STRATEGY
#
#  Filosofi:
#  - Setiap kali equity turun ke $20 (stop out) → deposit ulang $200
#  - Setiap kali profit mencapai +$100 → withdraw 80%, sisakan 20%
#  - Tujuan: apakah total_withdrawn > total_deposited setelah N tahun?
#
#  Gunakan parameter terbaik dari Cell 3, atau ubah manual di bawah
# ===========================================================================

# ── Parameter untuk simulasi V2 ───────────────────────────────────────────
LSM_SL_PIPS    = 80    # hasil scan terbaik: 80 pips
LSM_LOT_MULT   = 2.5   # 2.5x multiplier
LSM_MAX_LAYERS = 6     # max 6 layer
LSM_ADX_MIN    = 20    # ADX minimum 20

# ── Parameter withdraw/deposit ────────────────────────────────────────────
CAPITAL        = 200   # modal per deposit
WITHDRAW_THR   = 100   # trigger withdraw setiap profit +$100
WITHDRAW_PCT   = 0.80  # ambil 80%, sisakan 20%
MIN_BALANCE    = 20    # batas stop out (broker biasanya 20-50%)

# ── Jalankan engine dengan parameter terpilih ─────────────────────────────
r_ls = run_layer_shift(df,
                       sl_pips    = LSM_SL_PIPS,
                       lot_mult   = LSM_LOT_MULT,
                       max_layers = LSM_MAX_LAYERS,
                       adx_min    = LSM_ADX_MIN,
                       capital    = CAPITAL)

if r_ls:
    equity_orig   = r_ls['equity_arr'].copy().astype(float)
    balance_base  = float(CAPITAL)
    withdrawn     = 0.0
    deposited     = float(CAPITAL)
    deposit_count = 0
    withdraw_log  = []
    deposit_log   = []
    equity_adj    = []
    offset        = 0.0

    for i, raw_eq in enumerate(equity_orig):
        adj_eq = raw_eq - offset

        # ── Stop out / MC → deposit ulang ─────────────────────────────────
        if adj_eq <= MIN_BALANCE:
            deposit_log.append({
                'candle'   : i,
                'hari'     : i // 24,
                'saldo_pre': round(adj_eq, 2),
                'deposit'  : CAPITAL,
                'total_dep': round(deposited + CAPITAL, 2)
            })
            offset       += adj_eq - CAPITAL
            adj_eq        = float(CAPITAL)
            balance_base  = float(CAPITAL)
            deposited    += CAPITAL
            deposit_count += 1
            print(f"💀 MC #{deposit_count} di hari ~{i // 24} "
                  f"| Total deposited: ${deposited:.0f}")

        # ── Withdraw setiap profit +$100 ───────────────────────────────────
        current_profit = adj_eq - balance_base
        if current_profit >= WITHDRAW_THR:
            wd_amt       = current_profit * WITHDRAW_PCT
            withdrawn   += wd_amt
            offset      += wd_amt
            adj_eq      -= wd_amt
            balance_base = adj_eq
            withdraw_log.append({
                'candle'   : i,
                'hari'     : i // 24,
                'saldo'    : round(adj_eq,   2),
                'withdrew' : round(wd_amt,   2),
                'total_wd' : round(withdrawn, 2),
                'total_dep': round(deposited, 2),
                'net'      : round(withdrawn - deposited, 2)
            })
            print(f"💰 WD #{len(withdraw_log)} hari ~{i // 24} "
                  f"| +${wd_amt:.0f} "
                  f"| Total WD: ${withdrawn:.0f} "
                  f"| Net: ${withdrawn - deposited:.0f}")

        equity_adj.append(max(adj_eq, 0.0))

    # ── Hasil akhir V2 ────────────────────────────────────────────────────
    eq_adj     = np.array(equity_adj)
    net_profit = withdrawn - deposited + eq_adj[-1]
    wd_df      = pd.DataFrame(withdraw_log)
    dep_df     = pd.DataFrame(deposit_log)

    print(f"\n{'='*55}")
    print(f"  HASIL SIMULASI LSM V2 — UNLIMITED REDEPOSIT")
    print(f"{'='*55}")
    print(f"  Parameter       : SL={LSM_SL_PIPS}pip Mult={LSM_LOT_MULT}x "
          f"MaxL={LSM_MAX_LAYERS} ADX>={LSM_ADX_MIN}")
    print(f"  Modal awal      : ${CAPITAL} per deposit")
    print(f"  Total deposited : ${deposited:.0f} ({deposit_count + 1}x deposit)")
    print(f"  Total withdrawn : ${withdrawn:.2f}")
    print(f"  Saldo akhir     : ${eq_adj[-1]:.2f}")
    print(f"  NET PROFIT      : ${net_profit:.2f}")
    print(f"  Jumlah withdraw : {len(wd_df)}x")
    print(f"  Jumlah MC       : {deposit_count}x")
    print(f"  ROI total       : {net_profit / deposited * 100:.1f}%")
    if len(wd_df) > 0:
        wd_intervals = np.diff([0] + wd_df['hari'].tolist())
        print(f"  Avg hari antar WD: {wd_intervals.mean():.0f} hari")
        print(f"  Avg per withdraw : ${wd_df['withdrew'].mean():.2f}")
    print(f"{'='*55}")

    # ── Visualisasi V2 ────────────────────────────────────────────────────
    fig, axes = plt.subplots(3, 1, figsize=(14, 12))

    # Panel 1: Equity curve
    axes[0].plot(eq_adj, color='lime', linewidth=0.6)
    axes[0].axhline(CAPITAL, color='white', linestyle='--',
                    alpha=0.4, label=f'${CAPITAL}')
    axes[0].fill_between(range(len(eq_adj)), eq_adj, CAPITAL,
                         where=(eq_adj >= CAPITAL), color='lime', alpha=0.15)
    axes[0].fill_between(range(len(eq_adj)), eq_adj, CAPITAL,
                         where=(eq_adj  < CAPITAL), color='red',  alpha=0.3)
    # Tandai event withdraw (garis kuning)
    for _, row in wd_df.iterrows():
        axes[0].axvline(x=row['candle'], color='gold', alpha=0.5, linewidth=0.8)
    # Tandai event MC/deposit (garis merah)
    for _, row in dep_df.iterrows():
        axes[0].axvline(x=row['candle'], color='red',  alpha=0.8, linewidth=1.5)

    axes[0].set_title(f"Equity Curve | MC: {deposit_count}x (merah) | "
                      f"WD: {len(wd_df)}x (kuning)")
    axes[0].set_ylabel('USD')
    axes[0].legend(fontsize=8)
    axes[0].grid(alpha=0.3)

    # Panel 2: Kumulatif withdrawn vs deposited
    if len(wd_df) > 0:
        axes[1].plot(range(len(wd_df)), wd_df['total_wd'],
                     color='gold', linewidth=2, label='Total Withdrawn',
                     marker='o', markersize=3)
        axes[1].plot(range(len(wd_df)), wd_df['total_dep'],
                     color='red',  linewidth=2, label='Total Deposited',
                     linestyle='--')
        axes[1].fill_between(range(len(wd_df)),
                             wd_df['total_wd'], wd_df['total_dep'],
                             where=(wd_df['total_wd'] >= wd_df['total_dep']),
                             color='lime', alpha=0.3, label='NET PROFIT')
        axes[1].fill_between(range(len(wd_df)),
                             wd_df['total_wd'], wd_df['total_dep'],
                             where=(wd_df['total_wd'] <  wd_df['total_dep']),
                             color='red',  alpha=0.3, label='NET LOSS')
        axes[1].set_title('Kumulatif Withdrawn vs Deposited')
        axes[1].set_ylabel('USD')
        axes[1].legend(fontsize=8)
        axes[1].grid(alpha=0.3)

    # Panel 3: Net profit per withdraw event
    if len(wd_df) > 0:
        net_timeline = wd_df['net'].values
        colors = ['lime' if v >= 0 else 'red' for v in net_timeline]
        axes[2].bar(range(len(net_timeline)), net_timeline,
                    color=colors, alpha=0.8, width=0.6)
        axes[2].axhline(0, color='white', linestyle='--', alpha=0.5)
        axes[2].set_title(f"Net Profit Timeline | Final Net: ${net_profit:.2f}")
        axes[2].set_xlabel('Withdraw ke-N')
        axes[2].set_ylabel('USD')
        axes[2].grid(alpha=0.3)

    profit_color = 'lime' if net_profit >= 0 else 'red'
    plt.suptitle(
        f"Layer Shift Martingale V2 | Unlimited Redeposit\n"
        f"Net: ${net_profit:.2f} | "
        f"Deposit: ${deposited:.0f} ({deposit_count + 1}x) | "
        f"Withdrawn: ${withdrawn:.2f}",
        fontsize=11, color=profit_color
    )
    plt.tight_layout()
    plt.show()

else:
    print("Tidak ada trade — coba turunkan adx_min atau ubah parameter.")