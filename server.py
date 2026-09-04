import asyncio
import calendar
from datetime import datetime
import math
import warnings
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
import swisseph as swe
import yfinance as yf

# 👇 ફાસ્ટ મલ્ટિથ્રેડેડ VCP સ્કેનર અને લિસ્ટ ઇમ્પોર્ટ કર્યા
from confluenceVcpScanner import scan_all_vcp
from watchlistData import fullFnoList

warnings.filterwarnings('ignore')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


# 🔥 UptimeRobot અને Cron-job પિંગ એરર દૂર કરવા માટેનો સેફ રૂટ (GET અને HEAD બંને સાથે)
@app.api_route('/ping', methods=['GET', 'HEAD'])
async def ping_server():
  return {'status': 'active', 'message': 'Aura Terminal Backend is Awake'}


# 🔥 WebSocket Connection Manager & Endpoint (Error 500 Fix)
class ConnectionManager:

  def __init__(self):
    self.active_connections: list[WebSocket] = []

  async def connect(self, websocket: WebSocket):
    await websocket.accept()
    self.active_connections.append(websocket)

  def disconnect(self, websocket: WebSocket):
    self.active_connections.remove(websocket)


manager = ConnectionManager()


@app.websocket('/ws/market-live')
async def websocket_endpoint(websocket: WebSocket):
  await manager.connect(websocket)
  try:
    while True:
      res_data = await scan_static_pivot(Request(scope={'type': 'http'}))
      await websocket.send_json(res_data)
      await asyncio.sleep(5)
  except WebSocketDisconnect:
    manager.disconnect(websocket)


rashi_names = [
    'મેષ (Aries)',
    'વૃષભ (Taurus)',
    'મિથુન (Gemini)',
    'કર્ક (Cancer)',
    'સિંહ (Leo)',
    'કન્યા (Virgo)',
    'તુલા (Libra)',
    'વૃશ્ચિક (Scorpio)',
    'ધનુ (Sagittarius)',
    'મકર (Capricorn)',
    'કુંભ (Aquarius)',
    'મીન (Pisces)',
]


@app.api_route('/get-bias-data', methods=['GET', 'POST'])
async def get_bias_data(req: Request):
  try:
    if req.method == 'POST':
      body = await req.json()
      month_str = body.get('month', '2026-08')
      symbol = body.get('symbol', 'NIFTY')
    else:
      month_str = req.query_params.get('month', '2026-08')
      symbol = req.query_params.get('symbol', 'NIFTY')
  except:
    month_str = '2026-08'
    symbol = 'NIFTY'

  try:
    parts = str(month_str).split('-')
    year, month = int(parts[0], 10), int(parts[1], 10)
  except:
    year, month = 2026, 8

  num_days = calendar.monthrange(year, month)[1]
  calendar_data = []

  for day in range(1, num_days + 1):
    date_str = f'{year}-{month:02d}-{day:02d}'

    try:
      jd = swe.julday(year, month, day, 12.0)
      sun_pos, _ = swe.calc_ut(jd, swe.SUN)
      moon_pos, _ = swe.calc_ut(jd, swe.MOON)

      sun_rashi_idx = int(sun_pos[0] / 30) % 12
      moon_rashi_idx = int(moon_pos[0] / 30) % 12

      sun_rashi = rashi_names[sun_rashi_idx]
      moon_rashi = rashi_names[moon_rashi_idx]

      gann_degree = int((moon_pos[0] + day * 13) % 360)
      moon_cycle_day = int((moon_pos[0] % 360) / 12) + 1
      sun_cycle_day = int((sun_pos[0] % 360) + 1)
    except Exception:
      moon_rashi_idx = (day + len(symbol)) % 12
      sun_rashi_idx = (month + day) % 12
      sun_rashi = rashi_names[sun_rashi_idx]
      moon_rashi = rashi_names[moon_rashi_idx]
      gann_degree = (day * 15) % 360
      moon_cycle_day = (day % 30) + 1
      sun_cycle_day = day

    if gann_degree < 90:
      gann_angle = '90° Gann Pivot'
      bias_text = 'Bullish Accumulation'
    elif gann_degree < 180:
      gann_angle = '180° Opposition'
      bias_text = (
          'Bullish Breakout' if (day % 2 == 0) else 'Bearish Correction'
      )
    elif gann_degree < 270:
      gann_angle = '270° Square Angle'
      bias_text = 'High Volatility Reversal'
    else:
      gann_angle = '360° Full Cycle'
      bias_text = 'Trend Continuation'

    if moon_rashi_idx in [0, 4, 8]:
      trend = 'BULLISH'
      mood = 'High Momentum & Strong Buying'
      up_time = '09:30 - 11:45'
      down_time = '14:00 - 15:00'
      high_vol = True
    elif moon_rashi_idx in [1, 5, 9]:
      trend = 'SIDEWAYS'
      mood = 'Range Bound & Steady Action'
      up_time = '10:00 - 11:00'
      down_time = '13:30 - 14:30'
      high_vol = False
    else:
      trend = 'BEARISH'
      mood = 'Profit Booking & Choppy Decay'
      up_time = '10:15 - 11:00'
      down_time = '13:00 - 14:45'
      high_vol = day % 4 == 0

    calendar_data.append({
        'date': date_str,
        'trend': trend,
        'rashi': f'ચંદ્ર: {moon_rashi} | સૂર્ય: {sun_rashi}',
        'gannInfo': (
            f'🔄 {gann_angle} ({gann_degree}°) | {bias_text} [Moon:'
            f' D{moon_cycle_day} | Sun: D{sun_cycle_day}]'
        ),
        'mood': mood,
        'up': up_time,
        'down': down_time,
        'highVol': high_vol,
    })

  return calendar_data


@app.post('/calculate-stock')
async def calculate_stock(item: dict):
  symbol = item.get('stock_symbol') or item.get('symbol') or 'NIFTY'
  formatted_symbol = symbol.upper().strip()

  if formatted_symbol in ['ZINC', 'ALUMINUM', 'LEAD', 'NICKEL']:
    return {
        'stock': symbol,
        'symbol': symbol,
        'ltp': 0.0,
        'futures_price': 0.0,
        'spot_change': 0.0,
        'spot_change_pct': 0.0,
        'fut_change': 0.0,
        'fut_change_pct': 0.0,
        'prev_close': 0.0,
        'high': 0.0,
        'low': 0.0,
    }

  if formatted_symbol == 'NIFTY':
    spot_ticker_str = '^NSEI'
  elif formatted_symbol == 'BANKNIFTY':
    spot_ticker_str = '^NSEBANK'
  elif formatted_symbol == 'SENSEX':
    spot_ticker_str = '^BSESN'
  elif formatted_symbol == 'COPPER':
    spot_ticker_str = 'HG=F'
  elif formatted_symbol == 'CRUDEOIL':
    spot_ticker_str = 'CL=F'
  elif formatted_symbol == 'NATURALGAS':
    spot_ticker_str = 'NG=F'
  elif formatted_symbol == 'GOLD':
    spot_ticker_str = 'GC=F'
  elif formatted_symbol == 'SILVER':
    spot_ticker_str = 'SI=F'
  else:
    spot_ticker_str = f'{formatted_symbol}.NS'

  ltp, high, low, prev_close = 0.0, 0.0, 0.0, 0.0

  try:
    spot_ticker = yf.Ticker(spot_ticker_str)
    todays_data = spot_ticker.history(period='2d')

    if not todays_data.empty:
      ltp = float(todays_data['Close'].iloc[-1])
      high = float(todays_data['High'].iloc[-1])
      low = float(todays_data['Low'].iloc[-1])
      prev_close = (
          float(todays_data['Close'].iloc[-2])
          if len(todays_data) > 1
          else ltp
      )
  except Exception:
    pass

  futures_price = ltp
  spot_diff = round(ltp - prev_close, 2) if ltp and prev_close else 0.0
  spot_pct = round((spot_diff / prev_close) * 100, 2) if prev_close else 0.0

  return {
      'stock': symbol,
      'symbol': symbol,
      'ltp': round(ltp, 2),
      'futures_price': round(futures_price, 2),
      'spot_change': abs(spot_diff),
      'spot_change_pct': abs(spot_pct),
      'fut_change': abs(spot_diff),
      'fut_change_pct': abs(spot_pct),
      'prev_close': round(prev_close, 2),
      'high': round(high, 2),
      'low': round(low, 2),
  }


@app.post('/scan-open-price')
async def scan_open_price(item: dict):
  symbols = item.get('symbols', ['NIFTY', 'BANKNIFTY', 'RELIANCE'])
  data = []

  for sym in symbols:
    try:
      if sym in ['ZINC', 'ALUMINUM', 'LEAD', 'NICKEL']:
        continue

      if sym in ['NIFTY', 'FINNIFTY', 'MIDCAPNIFTY']:
        t_str = '^NSEI'
      elif sym == 'BANKNIFTY':
        t_str = '^NSEBANK'
      elif sym == 'SENSEX':
        t_str = '^BSESN'
      elif sym == 'COPPER':
        t_str = 'HG=F'
      elif sym == 'CRUDEOIL':
        t_str = 'CL=F'
      elif sym == 'NATURALGAS':
        t_str = 'NG=F'
      elif sym == 'GOLD':
        t_str = 'GC=F'
      elif sym == 'SILVER':
        t_str = 'SI=F'
      elif sym.startswith('NIFTY'):
        t_str = '^NSEI'
      else:
        t_str = f'{sym}.NS'

      ticker = yf.Ticker(t_str)
      hist = ticker.history(period='2d')

      if hist.empty or len(hist) < 1:
        continue

      ltp = float(hist['Close'].iloc[-1])
      open_price = (
          float(hist['Open'].iloc[-1])
          if 'Open' in hist.columns and not math.isnan(hist['Open'].iloc[-1])
          else ltp
      )
      prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else ltp

      base_price = open_price if open_price > 0 else ltp

      root = math.sqrt(base_price)
      baseRoot = math.floor(root * 8.0) / 8.0

      sell_lvl = math.pow(baseRoot, 2)
      buy_lvl = math.pow(baseRoot + 0.125, 2)

      bT1 = math.pow(baseRoot + 0.250, 2)
      bT2 = math.pow(baseRoot + 0.375, 2)
      bT3 = math.pow(baseRoot + 0.500, 2)
      bT4 = math.pow(baseRoot + 0.625, 2)

      sT1 = math.pow(baseRoot - 0.125, 2)
      sT2 = math.pow(baseRoot - 0.250, 2)
      sT3 = math.pow(baseRoot - 0.375, 2)
      sT4 = math.pow(baseRoot - 0.500, 2)

      status = 'RANGE'
      statusBg = '#f1f5f9'
      statusColor = '#334155'
      statusText = '⚪ In Range / Sideways'

      if ltp > buy_lvl:
        status = 'BUY'
        statusBg = '#dcfce7'
        statusColor = '#166534'
        statusText = '🟢 Buy Above Trigger'
      elif ltp < sell_lvl:
        status = 'SELL'
        statusBg = '#fee2e2'
        statusColor = '#991b1b'
        statusText = '🔴 Sell Below Trigger'

      data.append({
          'symbol': sym,
          'open': round(open_price, 2),
          'ltp': round(ltp, 2),
          'prevClose': round(prev_close, 2),
          'buyLvl': round(buy_lvl, 2),
          'sellLvl': round(sell_lvl, 2),
          'buyTargets': [
              round(bT1, 2),
              round(bT2, 2),
              round(bT3, 2),
              round(bT4, 2),
          ],
          'sellTargets': [
              round(sT1, 2),
              round(sT2, 2),
              round(sT3, 2),
              round(sT4, 2),
          ],
          'status': status,
          'statusBg': statusBg,
          'statusColor': statusColor,
          'statusText': statusText,
      })
    except Exception:
      continue

  return {'data': data}


# 🔥 VCP Confluence Strategy Scanner API Endpoint (Fast Multithreaded)
@app.post('/scan-vcp')
async def scan_vcp_endpoint(req: Request):
  try:
    body = await req.json()
    capital = float(body.get('capital', 500000.0))
  except:
    capital = 500000.0

  try:
    results = scan_all_vcp(account_capital=capital)
    return {'status': 'success', 'data': results}
  except Exception as e:
    return {'status': 'error', 'data': [], 'message': str(e)}


@app.api_route('/scan-static-pivot', methods=['GET', 'POST'])
async def scan_static_pivot(req: Request):
  try:
    if req.method == 'POST':
      body = await req.json()
      symbols = body.get('symbols', ['NIFTY', 'BANKNIFTY', 'RELIANCE'])
    else:
      symbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE']
  except:
    symbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE']

  data = []
  india_vix = 13.5

  for vix_sym in ['^INDIAVIX', '^VIX']:
    try:
      vix_ticker = yf.Ticker(vix_sym)
      vix_hist = vix_ticker.history(period='1d')
      if not vix_hist.empty and len(vix_hist['Close']) > 0:
        val = float(vix_hist['Close'].iloc[-1])
        if val > 0:
          india_vix = val
          break
    except:
      continue

  for sym in symbols:
    if sym in ['ZINC', 'ALUMINUM', 'LEAD', 'NICKEL']:
      continue

    weekly_close = 0.0
    monthly_close = 0.0
    ltp = 0.0
    weekly_date_str = 'N/A'
    monthly_date_str = 'N/A'
    volume_spike = False
    pcr_value = 1.05
    orb_high, orb_low = 0.0, 0.0
    is_relative_strong = False

    try:
      if sym in ['NIFTY', 'FINNIFTY', 'MIDCAPNIFTY']:
        t_str = '^NSEI'
      elif sym == 'BANKNIFTY':
        t_str = '^NSEBANK'
      elif sym == 'SENSEX':
        t_str = '^BSESN'
      elif sym == 'COPPER':
        t_str = 'HG=F'
      elif sym == 'CRUDEOIL':
        t_str = 'CL=F'
      elif sym == 'NATURALGAS':
        t_str = 'NG=F'
      elif sym == 'GOLD':
        t_str = 'GC=F'
      elif sym == 'SILVER':
        t_str = 'SI=F'
      elif sym.startswith('NIFTY'):
        t_str = '^NSEI'
      else:
        t_str = f'{sym}.NS'

      ticker = yf.Ticker(t_str)

      # 🔥 લાઈવ LTP અને પ્રિવિયસ ક્લોઝ સચોટ મેળવવા માટે 2 દિવસનો હિસ્ટ્રી ડેટા
      hist_data = ticker.history(period='1y')
      if not hist_data.empty:
        ltp = float(hist_data['Close'].iloc[-1])
        prev_close_val = (
            float(hist_data['Close'].iloc[-2]) if len(hist_data) > 1 else ltp
        )
        stock_pct = (
            ((ltp - prev_close_val) / prev_close_val) * 100
            if prev_close_val
            else 0
        )
        if stock_pct > 0.4:
          is_relative_strong = True

        past_data = hist_data.iloc[:-1]
        weekly_close = float(past_data['Close'].iloc[-1])
        weekly_date_str = str(past_data.index[-1].strftime('%Y-%m-%d'))

        last_date = past_data.index[-1]
        prev_month_data = past_data[past_data.index.month != last_date.month]
        if not prev_month_data.empty:
          monthly_close = float(prev_month_data['Close'].iloc[-1])
          monthly_date_str = str(prev_month_data.index[-1].strftime('%Y-%m-%d'))
        else:
          monthly_close = weekly_close
      else:
        weekly_close = ltp
        monthly_close = ltp

      # Intraday data for ORB and Volume
      todays_intraday_vol = ticker.history(period='1d', interval='5m')
      if not todays_intraday_vol.empty:
        if len(todays_intraday_vol) >= 3:
          morning_session = todays_intraday_vol.iloc[:3]
          orb_high = float(morning_session['High'].max())
          orb_low = float(morning_session['Low'].min())

        curr_vol = (
            float(todays_intraday_vol['Volume'].iloc[-1])
            if 'Volume' in todays_intraday_vol.columns
            else 0
        )
        avg_vol = (
            float(todays_intraday_vol['Volume'].mean())
            if 'Volume' in todays_intraday_vol.columns
            else 1
        )
        if avg_vol > 0 and curr_vol > (avg_vol * 1.3):
          volume_spike = True

    except Exception as e:
      ltp = 0.0
      weekly_close = 0.0
      monthly_close = 0.0

    if weekly_close > 0:
      r_w = math.sqrt(weekly_close)
      sup_w = round(((r_w - 1.0) ** 2), 2)
      res_w = round(((r_w + 1.0) ** 2), 2)
      up_g45_w = round((r_w + 0.25) ** 2, 2)
      up_g90_w = round((r_w + 0.50) ** 2, 2)
      up_g180_w = round((r_w + 1.00) ** 2, 2)
      up_g360_w = round((r_w + 2.00) ** 2, 2)
      down_g45_w = round((max(0, r_w - 0.25)) ** 2, 2)
      down_g90_w = round((max(0, r_w - 0.50)) ** 2, 2)
      down_g180_w = round((max(0, r_w - 1.00)) ** 2, 2)
      down_g360_w = round((max(0, r_w - 2.00)) ** 2, 2)
    else:
      sup_w, res_w, up_g45_w, up_g90_w, up_g180_w, up_g360_w = (
          0.0,
          0.0,
          0.0,
          0.0,
          0.0,
          0.0,
      )
      down_g45_w, down_g90_w, down_g180_w, down_g360_w = 0.0, 0.0, 0.0, 0.0

    if monthly_close > 0:
      r_m = math.sqrt(monthly_close)
      sup_m = round(((r_m - 1.0) ** 2), 2)
      res_m = round(((r_m + 1.0) ** 2), 2)
      up_g45_m = round((r_m + 0.25) ** 2, 2)
      up_g90_m = round((r_m + 0.50) ** 2, 2)
      up_g180_m = round((r_m + 1.00) ** 2, 2)
      up_g360_m = round((r_m + 2.00) ** 2, 2)
      down_g45_m = round((max(0, r_m - 0.25)) ** 2, 2)
      down_g90_m = round((max(0, r_m - 0.50)) ** 2, 2)
      down_g180_m = round((max(0, r_m - 1.00)) ** 2, 2)
      down_g360_m = round((max(0, r_m - 2.00)) ** 2, 2)
    else:
      sup_m, res_m, up_g45_m, up_g90_m, up_g180_m, up_g360_m = (
          0.0,
          0.0,
          0.0,
          0.0,
          0.0,
          0.0,
      )
      down_g45_m, down_g90_m, down_g180_m, down_g360_m = 0.0, 0.0, 0.0, 0.0

    item_obj = {
        'symbol': sym,
        'ltp': round(ltp, 2),
        'volume_spike': volume_spike,
        'prev_close': (
            round(prev_close_val, 2)
            if 'prev_close_val' in locals()
            else round(ltp, 2)
        ),
        'pcr': pcr_value,
        'momentum': {
            'orb_high': round(orb_high, 2),
            'orb_low': round(orb_low, 2),
            'is_strong': is_relative_strong,
        },
        'weekly': {
            'close': round(weekly_close, 2),
            'support': sup_w,
            'resistance': res_w,
            'gann': {
                'up': {
                    'g45': up_g45_w,
                    'g90': up_g90_w,
                    'g180': up_g180_w,
                    'g360': up_g360_w,
                },
                'down': {
                    'g45': down_g45_w,
                    'g90': down_g90_w,
                    'g180': down_g180_w,
                    'g360': down_g360_w,
                },
            },
        },
        'monthly': {
            'close': round(monthly_close, 2),
            'support': sup_m,
            'resistance': res_m,
            'gann': {
                'up': {
                    'g45': up_g45_m,
                    'g90': up_g90_m,
                    'g180': up_g180_m,
                    'g360': up_g360_m,
                },
                'down': {
                    'g45': down_g45_m,
                    'g90': down_g90_m,
                    'g180': down_g180_m,
                    'g360': down_g360_m,
                },
            },
        },
    }
    data.append(item_obj)

  return {
      'weekly_date': weekly_date_str,
      'monthly_date': monthly_date_str,
      'india_vix': round(india_vix, 2),
      'data': data,
  }


if __name__ == '__main__':
  import uvicorn

  uvicorn.run('server:app', host='0.0.0.0', port=5000, reload=True)
