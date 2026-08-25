import React, { useState } from 'react';
import { fullFnoList } from './watchlistData';

export default function SwingTradesModule({ marketData = [] }) {
  const [subTab, setSubTab] = useState('weekly');
  const [selectedStock, setSelectedStock] = useState('');
  const [tradeType, setTradeType] = useState('BUY');

  const [customAddedSetups, setCustomAddedSetups] = useState([]);

  // 🔥 લાઈવ માર્કેટ સ્કેનર ડેટામાંથી BUY અને SHORT અલગ કરીએ છીએ
  const buyStocksFromMarket = marketData
    .filter(i => i.pct >= 0)
    .map(item => ({
      name: item.symbol,
      ltp: item.ltp,
      type: 'BUY',
      sl: Number((item.support * 0.99).toFixed(1)),
      slDesc: '90° Support SL',
      target: Number((item.gann?.up?.g180 || item.ltp * 1.05).toFixed(1)),
      targetDesc: '180° Up Target',
      rr: '1 : 4.0',
      desc: 'Gann Support Base Setup'
    }));

  const shortStocksFromMarket = marketData
    .filter(i => i.pct < 0)
    .map(item => ({
      name: item.symbol,
      ltp: item.ltp,
      type: 'SHORT',
      sl: Number((item.resistance * 1.01).toFixed(1)),
      slDesc: '180° Resistance SL',
      target: Number((item.gann?.down?.g180 || item.ltp * 0.95).toFixed(1)),
      targetDesc: '180° Down Target',
      rr: '1 : 4.0',
      desc: 'Gann Resistance Rejection'
    }));

  const weeklySetups = [...buyStocksFromMarket, ...customAddedSetups.filter(i => i.type === 'BUY')];
  const monthlySetups = [...shortStocksFromMarket, ...customAddedSetups.filter(i => i.type === 'SHORT')];

  const currentData = subTab === 'weekly' ? weeklySetups : monthlySetups;

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

      const newItem = {
        name: cleanSymbol,
        ltp: currentLtp,
        type: tradeType,
        sl: sl,
        slDesc: tradeType === 'BUY' ? '45° Support SL' : '45° Resistance SL',
        target: target,
        targetDesc: tradeType === 'BUY' ? '360° Mega Target' : '360° Down Target',
        rr: '1 : 4.0',
        desc: tradeType === 'BUY' ? 'Manual Gann Support Setup' : 'Manual Gann Resistance Setup'
      };

      setCustomAddedSetups([newItem, ...customAddedSetups]);
      setSelectedStock('');
      alert(`Real swing setup added for ${cleanSymbol}!`);
    } catch (err) {
      alert("Error fetching stock data from backend!");
    }
  };

  const handleCopyForSocial = () => {
    let text = `🚀 *AURA TERMINAL - SWING TRADES* 🚀\n`;
    text = text + `Mode: ${subTab.toUpperCase()} SWING\n`;
    text = text + `-----------------------------------\n\n`;

    currentData.forEach((item, index) => {
      text = text + `${index + 1}. *${item.name}* (${item.type})\n`;
      text = text + `    LTP: ₹ ${item.ltp}\n`;
      text = text + `    SL: ₹ ${item.sl} (${item.slDesc})\n`;
      text = text + `    Target: ₹ ${item.target} (${item.targetDesc})\n`;
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
          <h2 style={{ color: '#18181b', margin: '0 0 5px 0' }}>🚀 Real Swing Trades Setup (Degree-Wise)</h2>
          <p style={{ color: '#52525b', fontSize: '14px', marginTop: '0' }}>માર્કેટ સ્કેનરના તમામ લાઈવ સ્ટોક્સ અને ગાન ડિગ્રી લેવલ્સ</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={handleCopyForSocial}
            style={{ padding: '8px 14px', backgroundColor: '#059669', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            📋 Copy All
          </button>

          <button 
            onClick={() => setSubTab('weekly')}
            style={{ padding: '8px 14px', backgroundColor: subTab === 'weekly' ? '#27272a' : '#e4e4e7', color: subTab === 'weekly' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🟢 Weekly Buy Swing ({weeklySetups.length})
          </button>
          <button 
            onClick={() => setSubTab('monthly')}
            style={{ padding: '8px 14px', backgroundColor: subTab === 'monthly' ? '#27272a' : '#e4e4e7', color: subTab === 'monthly' ? '#ffffff' : '#27272a', border: '1px solid #a1a1aa', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔴 Monthly Short Swing ({monthlySetups.length})
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

      <TableView data={currentData} title={subTab === 'weekly' ? '🟢 Weekly Buy Swing Setups (All Scanned)' : '🔴 Monthly Short Swing Setups (All Scanned)'} onSelect={handleSelectStock} />
    </div>
  );
}

function TableView({ data, title, onSelect }) {
  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #d4d4d8', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ backgroundColor: '#f4f4f5', padding: '15px 20px', borderBottom: '1px solid #d4d4d8', fontWeight: 'bold', color: '#18181b', fontSize: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <span style={{ fontSize: '13px', color: '#52525b', fontWeight: 'normal' }}>{data.length} Active Setups</span>
      </div>

      <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fafafa', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid #e4e4e7', color: '#71717a' }}>
              <th style={{ padding: '12px 20px', width: '90px' }}>Action</th>
              <th style={{ padding: '12px 20px' }}>Symbol & Setup</th>
              <th style={{ padding: '12px 20px' }}>LTP</th>
              <th style={{ padding: '12px 20px' }}>Stop-Loss (SL)</th>
              <th style={{ padding: '12px 20px' }}>Target</th>
              <th style={{ padding: '12px 20px' }}>Risk : Reward</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#71717a' }}>No active setups found. Run full market scan first!</td>
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
                      {item.name} 
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', backgroundColor: item.type === 'BUY' ? '#dcfce7' : '#fee2e2', color: item.type === 'BUY' ? '#15803d' : '#b91c1c' }}>
                        {item.type}
                      </span>
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
