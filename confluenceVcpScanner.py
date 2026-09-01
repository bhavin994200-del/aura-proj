from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import pandas as pd
import yfinance as yf
from watchlistData import fullFnoList


def scan_confluence_vcp(
    symbol: str, account_capital: float = 500000.0, risk_pct: float = 0.01
):
  """Scans NSE stock for Hybrid Confluence VCP Strategy & calculates 1% risk position size (Fast Version)."""
  try:
    ticker = (
        f'{symbol.upper()}.NS' if not symbol.endswith('.NS') else symbol.upper()
    )
    df = yf.download(ticker, period='1y', interval='1d', progress=False)

    if df.empty or len(df) < 200:
      return None

    if isinstance(df.columns, pd.MultiIndex):
      df.columns = df.columns.get_level_values(0)

    # 1. Technical Indicators
    df['EMA20'] = df['Close'].ewm(span=20, adjust=False).mean()
    df['EMA50'] = df['Close'].ewm(span=50, adjust=False).mean()
    df['EMA200'] = df['Close'].ewm(span=200, adjust=False).mean()
    df['Vol_SMA20'] = df['Volume'].rolling(window=20).mean()
    df['Daily_Range_Pct'] = (df['High'] - df['Low']) / df['Close']

    latest = df.iloc[-1]
    prev_1 = df.iloc[-2]
    prev_2 = df.iloc[-3]

    # 2. Strategy Rules Evaluation
    uptrend = (latest['Close'] > latest['EMA200']) and (
        latest['EMA20'] > latest['EMA50']
    )

    near_ema20 = (
        abs(latest['Low'] - latest['EMA20']) / latest['EMA20'] <= 0.015
    )
    near_ema50 = (
        abs(latest['Low'] - latest['EMA50']) / latest['EMA50'] <= 0.015
    )
    at_support_zone = near_ema20 or near_ema50

    volatility_tight = (prev_1['Daily_Range_Pct'] < 0.03) and (
        prev_2['Daily_Range_Pct'] < 0.03
    )
    volume_dryup = (prev_1['Volume'] < prev_1['Vol_SMA20']) or (
        prev_2['Volume'] < prev_2['Vol_SMA20']
    )
    vcp_condition = volatility_tight and volume_dryup

    bullish_candle = latest['Close'] > latest['Open']
    volume_surge = latest['Volume'] > (latest['Vol_SMA20'] * 1.30)
    trigger = bullish_candle and volume_surge

    buy_signal = uptrend and at_support_zone and vcp_condition and trigger

    if not buy_signal:
      return None

    # 3. 1% Risk Position Sizing Calculation
    entry_price = round(float(latest['Close']), 2)
    swing_low = round(float(df['Low'].iloc[-5:].min()), 2)
    stop_loss = (
        swing_low
        if swing_low < entry_price
        else round(entry_price * 0.96, 2)
    )

    risk_per_share = entry_price - stop_loss
    max_risk_amount = account_capital * risk_pct

    calculated_qty = (
        int(max_risk_amount // risk_per_share) if risk_per_share > 0 else 0
    )

    max_capital_allowed = account_capital * 0.25
    max_qty_allowed = int(max_capital_allowed // entry_price)
    final_qty = min(calculated_qty, max_qty_allowed)

    target_1_2 = round(entry_price + (risk_per_share * 2.5), 2)

    return {
        'Symbol': symbol.upper(),
        'Signal Triggered': buy_signal,
        'Entry Price (₹)': entry_price,
        'Stop Loss (₹)': stop_loss,
        'Target (1:2.5) (₹)': target_1_2,
        'Risk Per Share (₹)': round(risk_per_share, 2),
        'Position Size (Shares)': final_qty,
        'Capital Deployed (₹)': round(final_qty * entry_price, 2),
        'Max Loss (1% Account Risk)': round(final_qty * risk_per_share, 2),
    }
  except Exception:
    return None


def scan_all_vcp(account_capital: float = 500000.0):
  """Scans all stocks in parallel using ThreadPoolExecutor for high-speed response."""
  results = []
  with ThreadPoolExecutor(max_workers=10) as executor:
    future_to_stock = {
        executor.submit(scan_confluence_vcp, stock, account_capital, 0.01): stock
        for stock in fullFnoList
    }
    for future in as_completed(future_to_stock):
      res = future.result()
      if res and res.get('Signal Triggered'):
        results.append(res)
  return results


if __name__ == '__main__':
  my_capital = 500000
  print(f'=== FAST SCANNING {len(fullFnoList)} F&O STOCKS ===')
  sigs = scan_all_vcp(my_capital)
  print(f'Found: {len(sigs)} signals')