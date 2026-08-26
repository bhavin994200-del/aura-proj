import React, { useState, useEffect } from 'react';

export default function SuperSwingModule() {
  const [subTab, setSubTab] = useState('super_buy');
  const [marketStocks, setMarketStocks] = useState(() => {
    const cached = localStorage.getItem('master_cached_market_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (marketStocks.length === 0) {
      loadScannerCache();
    }
  }, []);

  const loadScannerCache = () => {
    setIsLoading(true);
    const cached = localStorage.getItem('master_cached_market_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMarketStocks(parsed);
        }
      } catch (e) {}
    }
    setIsLoading(false);
  };

  const getStatus = (ltp, target, sl, type) => {
    if (type === 'BUY') {
      if (ltp >= target) return { text: '🎯 Target Hit', color: '#15803d', bg: '#dcfce7' };
      if (ltp <= sl) return { text: '🛑 SL Hit', color: '#b91c1c', bg: '#fee2e2' };
      return { text: '⚡ Near Support Zone', color: '#2563eb', bg: '#eff6ff' };
    } else {
      if (ltp <= target) return { text: '🎯 Target Hit', color: '#15803d', bg: '#dcfce7' };
      if (ltp >= sl) return { text: '🛑 SL Hit', color: '#b91c1c', bg: '#fee2e2' };
      return { text: '⚡ Near Resistance Zone', color: '#2563eb', bg: '#eff6ff' };
    }
  };

  // 🔥 1. Super Weekly Buy (Sorted by closest to support)
  const superWeeklyBuy = marketStocks
    .filter(item => {
      const ltp = item.ltp;
      const sup = item.weekly?.support;
      return sup && ltp >= sup && ltp <= (sup * 1.03); // સપોર્ટથી માત્ર 3% ની અંદર
    })
    .map(item => {
      const ltp = item.ltp;
      const sup = item.weekly.support;
      const sl = Number((sup * 0.993).toFixed(1)); // 0.7% Tight SL
      const target = Number((item.weekly?.gann?.up?.g360 || ltp * 1.08).toFixed(1));
      const distance = ((ltp - sup) / sup) * 100; // સપોર્ટથી અંતર પર્સન્ટેજમાં
      return {
        name: item.name || item.symbol,
        ltp,
        type: 'BUY',
        support: sup,
        resistance: item.weekly?.resistance || ltp * 1.05,
        sl,
        target,
        distance,
        rr: '1 : 8.0',
        status: getStatus(ltp, target, sl, 'BUY')
      };
    })
    .sort((a, b) => a.distance - b.distance); // સૌથી નજીકનો સ્ટોક સૌથી ઉપર!

  // 🔥 2. Super Weekly Sell (Sorted by closest to resistance)
  const superWeeklySell = marketStocks
    .filter(item => {
      const ltp = item.ltp;
      const res = item.weekly?.resistance;
      return res && ltp <= res && ltp >= (res * 0.97); // રેઝિસ્ટન્સથી માત્ર 3% ની અંદર
    })
    .map(item => {
      const ltp = item.ltp;
      const res = item.weekly.resistance;
      const sl = Number((res * 1.007).toFixed(1)); // 0.7% Tight SL
      const target = Number((item.weekly?.gann?.down?.g360 || ltp * 0.92).toFixed(1));
      const distance = ((res - ltp) / res) * 100; // રેઝિસ્ટન્સથી અંતર પર્સન્ટેજમાં
      return {
        name: item.name || item.symbol,
        ltp,
        type: 'SHORT',
        support: item.weekly?.support || ltp * 0.95,
        resistance: res,
        sl,
        target,
        distance,
        rr: '1 : 8.0',
        status: getStatus(ltp, target, sl, 'SHORT')
      };
    })
    .sort((a, b) => a.distance - b.distance); // સૌથી નજીકનું રિજેક્શન સૌથી ઉપર!

  // 🔥 3. Super Monthly Buy (Sorted by closest to monthly support)
  const superMonthlyBuy = marketStocks
    .filter(item => {
      const ltp = item.ltp;
      const sup = item.monthly?.support || item.weekly?.support;
      return sup && ltp >= sup && ltp <= (sup * 1.035);
    })
    .map(item => {
      const ltp = item.ltp;
      const sup = item.monthly?.support || item.weekly?.support;
      const sl = Number((sup * 0.992).toFixed(1));
      const target = Number((item.monthly?.gann?.up?.g360 || ltp * 1.14).toFixed(1));
      const distance = ((ltp - sup) / sup) * 100;
      return {
        name: item.name || item.symbol,
        ltp,
        type: 'BUY',
        support: sup,
        resistance: item.monthly?.resistance || ltp * 1.10,
        sl,
        target,
        distance,
        rr: '1 : 10.0',
        status: getStatus(ltp, target, sl, 'BUY')
      };
    })
    .sort((a, b) => a.distance - b.distance);

  // 🔥 4. Super Monthly Sell (Sorted by closest to monthly resistance)
  const superMonthlySell = marketStocks
    .filter(item => {
      const ltp = item.ltp;
      const res = item.monthly?.resistance || item.weekly?.resistance;
      return res && ltp <= res && ltp >= (res * 0.965);
    })
    .map(item => {
      const ltp = item.ltp;
      const res = item.monthly?.resistance || item.weekly?.resistance;
      const sl = Number((res * 1.008).toFixed(1));
      const target = Number((item.monthly?.gann?.down?.g360 || ltp * 0.86).toFixed(1));
      const distance = ((res - ltp) / res) * 100;
      return {
        name: item.name || item.symbol,
        ltp,
        type: 'SHORT',
        support: item.monthly?.support || ltp * 0.90,
        resistance: res,
        sl,
        target,
        distance,
        rr: '1 : 10.0',
        status: getStatus(ltp, target, sl, 'SHORT')
      };
    })
    .sort((a, b) => a.distance - b.distance);

  let activeData = superWeeklyBuy;
  let activeHeader = '🟢 Super Weekly Buy (Closest to Support)';
  if (subTab === 'super_weekly_sell') {
    activeData = superWeeklySell;
    activeHeader = '🔴 Super Weekly Sell (Closest to Resistance)';
  } else if (subTab === 'super_monthly_buy') {
    activeData = superMonthlyBuy;
    activeHeader = '🟢 Super Monthly Buy (Closest to Support)';
  } else if (subTab === 'super_monthly_sell') {
    activeData = superMonthlySell;
    activeHeader = '🔴 Super Monthly Sell (Closest to Resistance)';
  }

  const handleAddToWatchlist = (sym) => {
    try {
      const wl = JSON.parse(localStorage.getItem('vedicedge_watchlist') || '[]');
      if (!wl.includes(sym)) {
        wl.unshift(sym);
        localStorage.setItem('vedicedge_watchlist', JSON.stringify(wl));
        alert(`Stock ${sym} added to Watchlist!`);
      } else {
        alert(`Stock ${sym} is already in Watchlist.`);
      }
    } catch (e) {
      alert("Error updating watchlist.");
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ color: '#18181b', margin: '0 0 5px 0' }}>⭐ Super Swing (Proximity Scanner)</h2>
          <p style={{ color: '#52525b', fontSize: '14px', marginTop: '0' }}>
            Showing stocks closest to Support/Resistance with Tight SL ({marketStocks.length} Cached Stocks)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setSubTab('super_buy')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'super_buy' ? '#27272a' : '#e4e4e7', color: subTab === 'super_buy' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🟢 W-Buy ({superWeeklyBuy.length})
          </button>
          <button 
            onClick={() => setSubTab('super_weekly_sell')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'super_weekly_sell' ? '#27272a' : '#e4e4e7', color: subTab === 'super_weekly_sell' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🔴 W-Sell ({superWeeklySell.length})
          </button>
          <button 
            onClick={() => setSubTab('super_monthly_buy')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'super_monthly_buy' ? '#27272a' : '#e4e4e7', color: subTab === 'super_monthly_buy' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🟢 M-Buy ({superMonthlyBuy.length})
          </button>
          <button 
            onClick={() => setSubTab('super_monthly_sell')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'super_monthly_sell' ? '#27272a' : '#e4e4e7', color: subTab === 'super_monthly_sell' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🔴 M-Sell ({superMonthlySell.length})
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #d4d4d8', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ backgroundColor: '#f4f4f5', padding: '15px 20px', borderBottom: '1px solid #d4d4d8', fontWeight: 'bold', color: '#18181b', fontSize: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{activeHeader}</span>
          <span style={{ fontSize: '13px', color: '#52525b', fontWeight: 'normal' }}>Total Setups: {activeData.length}</span>
        </div>

        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fafafa', zIndex: '1' }}>
              <tr style={{ borderBottom: '1px solid #e4e4e7', color: '#71717a' }}>
                <th style={{ padding: '12px 20px', width: '90px' }}>Action</th>
                <th style={{ padding: '12px 20px' }}>Symbol</th>
                <th style={{ padding: '12px 20px' }}>LTP (₹)</th>
                <th style={{ padding: '12px 20px' }}>Support / Resistance</th>
                <th style={{ padding: '12px 20px' }}>Proximity (Distance)</th>
                <th style={{ padding: '12px 20px' }}>Tight SL / Target</th>
                <th style={{ padding: '12px 20px' }}>R:R Ratio</th>
                <th style={{ padding: '12px 20px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeData.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#71717a' }}>
                    No setups found right at the support/resistance zone.
                  </td>
                </tr>
              ) : (
                activeData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 20px' }}>
                      <button 
                        onClick={() => handleAddToWatchlist(item.name)}
                        style={{ padding: '5px 10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        + Watch
                      </button>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 'bold', color: '#18181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a 
                          href={`https://in.tradingview.com/chart/?symbol=NSE:${item.name}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'underline' }}
                        >
                          {item.name} 🔗
                        </a>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', backgroundColor: item.type === 'BUY' ? '#dcfce7' : '#fee2e2', color: item.type === 'BUY' ? '#15803d' : '#b91c1c' }}>
                          {item.type}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#27272a', fontWeight: 'bold' }}>₹{item.ltp}</td>
                    <td style={{ padding: '14px 20px' }}>
                      {item.type === 'BUY' ? (
                        <div style={{ color: '#16a34a', fontWeight: '600' }}>Sup: ₹{Number(item.support).toFixed(1)}</div>
                      ) : (
                        <div style={{ color: '#dc2626', fontWeight: '600' }}>Res: ₹{Number(item.resistance).toFixed(1)}</div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontWeight: 'bold', color: item.distance <= 1 ? '#15803d' : '#d97706', fontSize: '13px' }}>
                        {item.distance <= 0.5 ? '🔥 Exactly at Level' : `+${item.distance.toFixed(2)}% away`}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '12px' }}>
                      <div style={{ color: '#b91c1c', fontWeight: 'bold' }}>SL: ₹{item.sl}</div>
                      <div style={{ color: '#15803d' }}>Tgt: ₹{item.target}</div>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 'bold', color: '#7c3aed' }}>{item.rr}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', backgroundColor: item.status.bg, color: item.status.color }}>
                        {item.status.text}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
