import React, { useState, useEffect } from 'react';
import { fullFnoList } from './watchlistData';

export default function SwingTradesModule() {
  const [subTab, setSubTab] = useState('weekly_buy');
  const [selectedStock, setSelectedStock] = useState('');
  const [tradeType, setTradeType] = useState('BUY');
  const [liveMarketStocks, setLiveMarketStocks] = useState(() => {
    // 🔥 સ્ટેટિક સ્કેનર અથવા ઓપન પ્રાઇસના કેશ્ડ ડેટામાંથી સીધો જ આખો ડેટા પકડશે (સર્વર લોડ ફ્રી)
    const cachedMaster = localStorage.getItem('master_cached_market_data');
    const cachedOpen = localStorage.getItem('vedicedge_openprice_data');
    const cachedSwing = localStorage.getItem('aura_swing_cache_data');

    if (cachedMaster) {
      try {
        const parsed = JSON.parse(cachedMaster);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    if (cachedOpen) {
      try {
        const parsed = JSON.parse(cachedOpen);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    if (cachedSwing) {
      try {
        const parsed = JSON.parse(cachedSwing);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [customAddedSetups, setCustomAddedSetups] = useState([]);

  useEffect(() => {
    // જો કેશ ખાલી હોય તો જ બેકએન્ડને હિટ કરશે
    if (liveMarketStocks.length === 0) {
      fetchAllStaticData();
    }
  }, []);

  const fetchAllStaticData = async () => {
    setIsLoading(true);
    try {
      // સર્વર પર ઓવરલોડ ન થાય તે માટે માત્ર પ્રાઇમરી લિસ્ટ સ્કેન કરશે અથવા કેશ વાપરશે
      const res = await fetch('https://aura-proj.onrender.com/scan-static-pivot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: fullFnoList.slice(0, 50) }) // શરુઆતના મુખ્ય સ્ટોક્સ બેચમાં સ્કેન કરશે
      });
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        setLiveMarketStocks(json.data);
        localStorage.setItem('aura_swing_cache_data', JSON.stringify(json.data));
      }
    } catch (err) {
      console.error("Error scanning static pivot for swing trades:", err);
    }
    setIsLoading(false);
  };

  const getTradeStatus = (ltp, target, sl, type) => {
    if (type === 'BUY') {
      if (ltp >= target) return { status: '🎯 Target Hit', color: '#15803d', bg: '#dcfce7' };
      if (ltp <= sl) return { status: '🛑 SL Hit', color: '#b91c1c', bg: '#fee2e2' };
      return { status: '⚡ Active', color: '#2563eb', bg: '#eff6ff' };
    } else {
      if (ltp <= target) return { status: '🎯 Target Hit', color: '#15803d', bg: '#dcfce7' };
      if (ltp >= sl) return { status: '🛑 SL Hit', color: '#b91c1c', bg: '#fee2e2' };
      return { status: '⚡ Active', color: '#2563eb', bg: '#eff6ff' };
    }
  };

  // 🔥 1. Weekly Buy Setups (LTP પ્રમાણે સોર્ટ કરેલા)
  const weeklyBuyStocks = liveMarketStocks
    .filter(item => {
      const ltp = item.ltp;
      const support = item.weekly?.support;
      return support && ltp >= support && ltp <= (support * 1.04);
    })
    .map(item => {
      const ltp = item.ltp;
      const sl = Number((item.weekly.support * 0.99).toFixed(1));
      const target = Number((item.weekly?.gann?.up?.g360 || ltp * 1.08).toFixed(1));
      const statusInfo = getTradeStatus(ltp, target, sl, 'BUY');

      return {
        name: item.name || item.symbol,
        ltp: ltp,
        type: 'BUY',
        sl: sl,
        slDesc: 'Weekly Support SL',
        target: target,
        targetDesc: 'Weekly 360° Mega Target',
        rr: '1 : 5.5',
        desc: 'Static Weekly Support Setup',
        isSpike: item.volume_spike || false,
        status: statusInfo
      };
    })
    .sort((a, b) => a.ltp - b.ltp);

  // 🔥 2. Weekly Sell Setups
  const weeklySellStocks = liveMarketStocks
    .filter(item => {
      const ltp = item.ltp;
      const resistance = item.weekly?.resistance;
      return resistance && ltp <= resistance && ltp >= (resistance * 0.96);
    })
    .map(item => {
      const ltp = item.ltp;
      const sl = Number((item.weekly.resistance * 1.01).toFixed(1));
      const target = Number((item.weekly?.gann?.down?.g360 || ltp * 0.92).toFixed(1));
      const statusInfo = getTradeStatus(ltp, target, sl, 'SHORT');

      return {
        name: item.name || item.symbol,
        ltp: ltp,
        type: 'SHORT',
        sl: sl,
        slDesc: 'Weekly Resistance SL',
        target: target,
        targetDesc: 'Weekly 360° Down Target',
        rr: '1 : 5.5',
        desc: 'Static Weekly Resistance Setup',
        isSpike: item.volume_spike || false,
        status: statusInfo
      };
    })
    .sort((a, b) => b.ltp - a.ltp);

  // 🔥 3. Monthly Buy Setups
  const monthlyBuyStocks = liveMarketStocks
    .filter(item => {
      const ltp = item.ltp;
      const support = item.monthly?.support || item.weekly?.support;
      return support && ltp >= support && ltp <= (support * 1.05);
    })
    .map(item => {
      const ltp = item.ltp;
      const supportVal = item.monthly?.support || item.weekly?.support;
      const sl = Number((supportVal * 0.98).toFixed(1));
      const target = Number((item.monthly?.gann?.up?.g360 || ltp * 1.12).toFixed(1));
      const statusInfo = getTradeStatus(ltp, target, sl, 'BUY');

      return {
        name: item.name || item.symbol,
        ltp: ltp,
        type: 'BUY',
        sl: sl,
        slDesc: 'Monthly Support SL',
        target: target,
        targetDesc: 'Monthly 360° Mega Target',
        rr: '1 : 7.0',
        desc: 'Static Monthly Support Setup',
        isSpike: item.volume_spike || false,
        status: statusInfo
      };
    })
    .sort((a, b) => a.ltp - b.ltp);

  // 🔥 4. Monthly Sell Setups
  const monthlySellStocks = liveMarketStocks
    .filter(item => {
      const ltp = item.ltp;
      const resistance = item.monthly?.resistance || item.weekly?.resistance;
      return resistance && ltp <= resistance && ltp >= (resistance * 0.95);
    })
    .map(item => {
      const ltp = item.ltp;
      const resVal = item.monthly?.resistance || item.weekly?.resistance;
      const sl = Number((resVal * 1.02).toFixed(1));
      const target = Number((item.monthly?.gann?.down?.g360 || ltp * 0.88).toFixed(1));
      const statusInfo = getTradeStatus(ltp, target, sl, 'SHORT');

      return {
        name: item.name || item.symbol,
        ltp: ltp,
        type: 'SHORT',
        sl: sl,
        slDesc: 'Monthly Resistance SL',
        target: target,
        targetDesc: 'Monthly 360° Down Target',
        rr: '1 : 7.0',
        desc: 'Static Monthly Resistance Setup',
        isSpike: item.volume_spike || false,
        status: statusInfo
      };
    })
    .sort((a, b) => b.ltp - a.ltp);

  const weeklyBuySetups = [...weeklyBuyStocks, ...customAddedSetups.filter(i => i.type === 'BUY' && i.duration === 'weekly')];
  const weeklySellSetups = [...weeklySellStocks, ...customAddedSetups.filter(i => i.type === 'SHORT' && i.duration === 'weekly')];
  const monthlyBuySetups = [...monthlyBuyStocks, ...customAddedSetups.filter(i => i.type === 'BUY' && i.duration === 'monthly')];
  const monthlySellSetups = [...monthlySellStocks, ...customAddedSetups.filter(i => i.type === 'SHORT' && i.duration === 'monthly')];

  let currentData = weeklyBuySetups;
  let currentTitle = '🟢 Weekly Buy Swing Setups';
  if (subTab === 'weekly_sell') {
    currentData = weeklySellSetups;
    currentTitle = '🔴 Weekly Sell Swing Setups';
  } else if (subTab === 'monthly_buy') {
    currentData = monthlyBuySetups;
    currentTitle = '🟢 Monthly Buy Swing Setups';
  } else if (subTab === 'monthly_sell') {
    currentData = monthlySellSetups;
    currentTitle = '🔴 Monthly Sell Swing Setups';
  }

  const handleAddCustomSwing = async (e) => {
    e.preventDefault();
    if (!selectedStock) return;

    const cleanSymbol = selectedStock.trim().toUpperCase();
    try {
      const res = await fetch('https://aura-proj.onrender.com/calculate-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_symbol: cleanSymbol })
      });
      const data = await res.json();
      const currentLtp = data.ltp || 1000.0;

      let sl = tradeType === 'BUY' ? Number((currentLtp * 0.985).toFixed(1)) : Number((currentLtp * 1.015).toFixed(1));
      let target = tradeType === 'BUY' ? Number((currentLtp * 1.060).toFixed(1)) : Number((currentLtp * 0.940).toFixed(1));
      let duration = subTab.includes('monthly') ? 'monthly' : 'weekly';

      const newItem = {
        name: cleanSymbol,
        ltp: currentLtp,
        type: tradeType,
        sl: sl,
        slDesc: tradeType === 'BUY' ? '45° Support SL' : '45° Resistance SL',
        target: target,
        targetDesc: tradeType === 'BUY' ? '360° Mega Target' : '360° Down Target',
        rr: '1 : 5.5',
        desc: 'Manual Custom Setup',
        duration: duration,
        status: { status: '⚡ Active', color: '#2563eb', bg: '#eff6ff' }
      };

      setCustomAddedSetups([newItem, ...customAddedSetups]);
      setSelectedStock('');
      alert(`Real swing setup added for ${cleanSymbol}!`);
    } catch (err) {
      alert("Error fetching stock data from backend!");
    }
  };

  const handleCopyForSocial = () => {
    let text = `🚀 *AURA TERMINAL - CACHED SWING TRADES* 🚀\n`;
    text = text + `Mode: ${subTab.toUpperCase()}\n`;
    text = text + `-----------------------------------\n\n`;

    currentData.forEach((item, index) => {
      text = text + `${index + 1}. *${item.name}* (${item.type})\n`;
      text = text + `    LTP: ₹ ${item.ltp}\n`;
      text = text + `    SL: ₹ ${item.sl} (${item.slDesc})\n`;
      text = text + `    Target: ₹ ${item.target} (${item.targetDesc})\n`;
      text = text + `    Status: ${item.status.status}\n`;
      text = text + `    R:R: ${item.rr}\n\n`;
    });

    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const handleSelectStock = (sym) => {
    try {
      const savedWatchlist = JSON.parse(localStorage.getItem('aura_watchlist') || '[]');
      if (!savedWatchlist.includes(sym)) {
        const updatedList = [sym, ...savedWatchlist];
        localStorage.setItem('aura_watchlist', JSON.stringify(updatedList));
        alert(`Stock ${sym} added to Home Dashboard!`);
      } else {
        alert(`Stock ${sym} is already in your Home Dashboard.`);
      }
    } catch (err) {
      alert("Failed to add stock.");
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ color: '#18181b', margin: '0 0 5px 0' }}>🚀 Cached Swing Trades (LTP Sorted)</h2>
          <p style={{ color: '#52525b', fontSize: '14px', marginTop: '0' }}>
            {isLoading ? 'Loading from cache...' : `Loaded Database: ${liveMarketStocks.length} Stocks`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={fetchAllStaticData}
            disabled={isLoading}
            style={{ padding: '8px 12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            {isLoading ? 'Scanning...' : '⚡ Force Refresh'}
          </button>

          <button 
            onClick={handleCopyForSocial}
            style={{ padding: '8px 12px', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            📋 Copy
          </button>

          <button 
            onClick={() => setSubTab('weekly_buy')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'weekly_buy' ? '#27272a' : '#e4e4e7', color: subTab === 'weekly_buy' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🟢 W-Buy ({weeklyBuySetups.length})
          </button>
          <button 
            onClick={() => setSubTab('weekly_sell')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'weekly_sell' ? '#27272a' : '#e4e4e7', color: subTab === 'weekly_sell' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🔴 W-Sell ({weeklySellSetups.length})
          </button>
          <button 
            onClick={() => setSubTab('monthly_buy')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'monthly_buy' ? '#27272a' : '#e4e4e7', color: subTab === 'monthly_buy' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🟢 M-Buy ({monthlyBuySetups.length})
          </button>
          <button 
            onClick={() => setSubTab('monthly_sell')}
            style={{ padding: '8px 12px', backgroundColor: subTab === 'monthly_sell' ? '#27272a' : '#e4e4e7', color: subTab === 'monthly_sell' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
          >
            🔴 M-Sell ({monthlySellSetups.length})
          </button>
        </div>
      </div>

      {/* Manual Add Swing Setup Form */}
      <form onSubmit={handleAddCustomSwing} style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f4f4f5', padding: '15px', borderRadius: '10px', border: '1px solid #d4d4d8', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '2', minWidth: '200px' }}>
          <input 
            type="text" 
            list="swing-fno-list"
            placeholder="Select or type stock from F&O..." 
            value={selectedStock} 
            onChange={(e) => setSelectedStock(e.target.value)} 
            style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #a1a1aa', background: 'white', boxSizing: 'border-box' }} 
            required 
          />
          <datalist id="swing-fno-list">
            {fullFnoList.map((item, idx) => (
              <option key={idx} value={item} />
            ))}
          </datalist>
        </div>

        <select value={tradeType} onChange={(e) => setTradeType(e.target.value)} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #a1a1aa', background: 'white', fontWeight: 'bold' }}>
          <option value="BUY">🟢 BUY SWING</option>
          <option value="SHORT">🔴 SHORT SWING</option>
        </select>

        <button type="submit" style={{ padding: '9px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Add Custom Setup
        </button>
      </form>

      <TableView data={currentData} title={currentTitle} onSelect={handleSelectStock} />
    </div>
  );
}

function TableView({ data, title, onSelect }) {
  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #d4d4d8', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ backgroundColor: '#f4f4f5', padding: '15px 20px', borderBottom: '1px solid #d4d4d8', fontWeight: 'bold', color: '#18181b', fontSize: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <span style={{ fontSize: '13px', color: '#52525b', fontWeight: 'normal' }}>{data.length} Filtered Setups</span>
      </div>

      <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fafafa', zIndex: '1' }}>
            <tr style={{ borderBottom: '1px solid #e4e4e7', color: '#71717a' }}>
              <th style={{ padding: '12px 20px', width: '90px' }}>Action</th>
              <th style={{ padding: '12px 20px' }}>Symbol & Setup</th>
              <th style={{ padding: '12px 20px' }}>LTP</th>
              <th style={{ padding: '12px 20px' }}>Stop-Loss (SL)</th>
              <th style={{ padding: '12px 20px' }}>Target</th>
              <th style={{ padding: '12px 20px' }}>Status</th>
              <th style={{ padding: '12px 20px' }}>Risk : Reward</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#71717a' }}>No cached swing setups found. Open Static Scanner tab once to cache data!</td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <button 
                      onClick={() => onSelect(item.name)}
                      style={{ padding: '5px 10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      + Select
                    </button>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 'bold', color: '#18181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a 
                        href={`https://in.tradingview.com/chart/?symbol=NSE:${item.name}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'underline' }}
                        title="Open TradingView Chart"
                      >
                        {item.name} 🔗
                      </a>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', backgroundColor: item.type === 'BUY' ? '#dcfce7' : '#fee2e2', color: item.type === 'BUY' ? '#15803d' : '#b91c1c' }}>
                        {item.type}
                      </span>
                      {item.isSpike && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold' }}>
                          ⚡ Vol Spike
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#71717a', fontStyle: 'italic', marginTop: '2px' }}>{item.desc}</div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#27272a', fontWeight: 'bold' }}>₹ {item.ltp}</td>
                  <td style={{ padding: '14px 20px', color: '#b91c1c', fontWeight: '600' }}>
                    ₹ {item.sl}
                    <div style={{ fontSize: '11px', fontWeight: 'normal', color: '#b91c1c' }}>({item.slDesc})</div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#15803d', fontWeight: '600' }}>
                    ₹ {item.target}
                    <div style={{ fontSize: '11px', fontWeight: 'normal', color: '#15803d' }}>({item.targetDesc})</div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', backgroundColor: item.status.bg, color: item.status.color }}>
                      {item.status.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 'bold', color: '#2563eb' }}>{item.rr}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
