import React, { useState, useEffect, useRef } from 'react';
import { fullFnoList } from './watchlistData';

function OpenPrice() {
  const todayKey = new Date().toISOString().split('T')[0]; // આજની તારીખ (YYYY-MM-DD)
  
  const [marketData, setMarketData] = useState(() => {
    const savedDate = localStorage.getItem('vedicedge_openprice_date');
    const saved = localStorage.getItem('vedicedge_openprice_data');
    if (savedDate === todayKey && saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(() => {
    const savedDate = localStorage.getItem('vedicedge_openprice_date');
    return savedDate === todayKey ? (localStorage.getItem('vedicedge_openprice_time') || '') : '';
  });

  // OpenPrice ટેબની અંદર જ ટ્રેડ બુક/લોગ માટેનું સ્ટેટ
  const [tradeBookLog, setTradeBookLog] = useState(() => {
    const savedLog = localStorage.getItem('vedicedge_openprice_tradebook');
    return savedLog ? JSON.parse(savedLog) : [];
  });

  const isInitialMount = useRef(true);

  // બીપ સાઉન્ડ વગાડવા માટેનું ફંક્શન (Web Audio API)
  const playBeepSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = type === 'BUY' ? 880 : 440; 
      
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  // આખું નવું સ્કેનિંગ (ક્લાઉડ લાઈવ બેકેન્ડ સાથે)
  const fetchAllOpenPrices = async (isRefresh = false) => {
    const savedDate = localStorage.getItem('vedicedge_openprice_date');
    if (!isRefresh && savedDate === todayKey && marketData.length > 0) {
      isInitialMount.current = false;
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('https://aura-proj.onrender.com/scan-open-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: fullFnoList })
      });
      const json = await res.json();
      const fetchedData = json.data || [];
      const timeStr = new Date().toLocaleTimeString();

      // જો પહેલેથી લોકલ સ્ટોરેજમાં ડેટા હોય તો ટ્રિગર સ્ટેટ અને triggeredAt જાળવી રાખો
      setMarketData(prevList => {
        if (prevList.length === 0) return fetchedData;
        return fetchedData.map(newItem => {
          const oldItem = prevList.find(i => i.symbol === newItem.symbol);
          if (oldItem && (oldItem.status === 'BUY' || oldItem.status === 'SELL')) {
            return {
              ...newItem,
              status: oldItem.status,
              statusBg: oldItem.statusBg,
              statusColor: oldItem.statusColor,
              statusText: oldItem.statusText,
              triggeredAt: oldItem.triggeredAt
            };
          }
          return newItem;
        });
      });

      setLastUpdated(timeStr);
      localStorage.setItem('vedicedge_openprice_date', todayKey);
      localStorage.setItem('vedicedge_openprice_data', JSON.stringify(fetchedData));
      localStorage.setItem('vedicedge_openprice_time', timeStr);
      
      isInitialMount.current = false;
    } catch (e) {
      console.log("OpenPrice Fetch Error:", e);
    }
    setLoading(false);
  };

  // ફક્ત લાઈવ LTP અને વાસ્તવિક ક્રોસઓવર અપડેટ કરવા માટેનું ફંક્શન
  const updateLiveLtpOnly = async () => {
    try {
      const res = await fetch('https://aura-proj.onrender.com/scan-open-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: fullFnoList })
      });
      const json = await res.json();
      const updatedList = json.data || [];

      if (updatedList.length > 0) {
        let newLogs = [...tradeBookLog];
        let hasNewTrigger = false;
        const timeStr = new Date().toLocaleTimeString();
        const currentTime = Date.now();
        
        let updatedState = [];

        setMarketData(prevList => {
          const baseList = prevList.length > 0 ? prevList : updatedList;

          updatedState = baseList.map(oldItem => {
            const found = updatedList.find(newItem => newItem.symbol === oldItem.symbol);
            if (!found) return oldItem;

            const oldStatus = oldItem.status; 
            const newStatus = found.status;

            // જો અગાઉ RANGE હતું અને હવે વાસ્તવમાં BUY કે SELL થયું, તો જ નવો ટ્રિગર ગણવો
            if (!isInitialMount.current && oldStatus === 'RANGE' && (newStatus === 'BUY' || newStatus === 'SELL')) {
              playBeepSound(newStatus);
              hasNewTrigger = true;
              
              const triggerPriceVal = newStatus === 'BUY' ? found.buyLvl : found.sellLvl;

              const alreadyExists = newLogs.some(log => log.symbol === found.symbol);
              if (!alreadyExists) {
                newLogs.unshift({
                  time: timeStr,
                  symbol: found.symbol,
                  action: newStatus,
                  triggerPrice: triggerPriceVal,
                  entryLtp: found.ltp,
                  timestamp: currentTime
                });
              }

              return {
                ...oldItem,
                ltp: found.ltp,
                status: newStatus,
                statusBg: found.statusBg,
                statusColor: found.statusColor,
                statusText: found.statusText,
                triggeredAt: currentTime
              };
            }

            if (oldStatus === 'BUY' || oldStatus === 'SELL') {
              return {
                ...oldItem,
                ltp: found.ltp,
                triggeredAt: oldItem.triggeredAt
              };
            }

            return {
              ...oldItem,
              ltp: found.ltp,
              status: found.status,
              statusBg: found.statusBg,
              statusColor: found.statusColor,
              statusText: found.statusText
            };
          });

          return updatedState;
        });

        if (updatedState.length > 0) {
          localStorage.setItem('vedicedge_openprice_data', JSON.stringify(updatedState));
        }

        if (hasNewTrigger) {
          setTradeBookLog(newLogs);
          localStorage.setItem('vedicedge_openprice_tradebook', JSON.stringify(newLogs));
        }

        // 👈 લાઈવ ટાઈમ દર 5 સેકન્ડે અપડેટ થશે
        setLastUpdated(timeStr);
        localStorage.setItem('vedicedge_openprice_time', timeStr);
        isInitialMount.current = false;
      }
    } catch (err) {
      console.log("Live LTP update error");
    }
  };

  useEffect(() => {
    fetchAllOpenPrices();
    const interval = setInterval(updateLiveLtpOnly, 5000); // 👈 5 સેકન્ડનો લાઈવ રિફ્રેશ ટાઈમર
    return () => clearInterval(interval);
  }, []);

  const filteredList = marketData
    .filter(item => {
      const matchesSearch = item.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      if (filterType === 'ALL') return matchesSearch;
      return matchesSearch && item.status === filterType;
    })
    .sort((a, b) => {
      const timeA = a.triggeredAt || 0;
      const timeB = b.triggeredAt || 0;
      return timeB - timeA;
    });

  const buyCount = marketData.filter(i => i.status === 'BUY').length;
  const sellCount = marketData.filter(i => i.status === 'SELL').length;
  const rangeCount = marketData.filter(i => i.status === 'RANGE').length;

  return (
    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: 0 }}>🚀 OpenPrice Complete F&O Matrix List</h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>ઓપન પ્રાઇસ, લાઈવ LTP અને બંને બાજુના 4-ટાર્ગેટ લેવલ્સનું લિસ્ટ.</p>
          {lastUpdated && <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 'bold' }}>🕒 Updated At: {lastUpdated}</span>}
        </div>
        <div>
          <button 
            onClick={() => fetchAllOpenPrices(true)} 
            disabled={loading} 
            style={{ padding: '8px 16px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? 'Scanning Market...' : '🔄 Refresh Full Data'}
          </button>
        </div>
      </div>

      {/* Live Trigger Book Section */}
      <div style={{ marginBottom: '20px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, color: '#1e293b', fontSize: '14px' }}>📖 OpenPrice Live Trigger Book ({tradeBookLog.length})</h4>
          {tradeBookLog.length > 0 && (
            <button 
              onClick={() => { setTradeBookLog([]); localStorage.removeItem('vedicedge_openprice_tradebook'); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Clear Book
            </button>
          )}
        </div>

        <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
          {tradeBookLog.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '10px' }}>
              જ્યારે કોઈ સ્ટોક LIVE માર્કેટમાં BUY કે SELL લેવલ ક્રોસ કરશે, ત્યારે તેની એન્ટ્રી અહીં અનલિમિટેડ નોંધાશે.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#e2e8f0', color: '#334155', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '6px 10px' }}>Time</th>
                  <th style={{ padding: '6px 10px' }}>Symbol</th>
                  <th style={{ padding: '6px 10px' }}>Action</th>
                  <th style={{ padding: '6px 10px' }}>Trigger Price</th>
                  <th style={{ padding: '6px 10px' }}>Entry LTP</th>
                </tr>
              </thead>
              <tbody>
                {tradeBookLog.map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                    <td style={{ padding: '6px 10px', color: '#64748b' }}>{log.time}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 'bold', color: '#1e293b' }}>{log.symbol}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', background: log.action === 'BUY' ? '#dcfce7' : '#fee2e2', color: log.action === 'BUY' ? '#166534' : '#991b1b', fontWeight: 'bold', fontSize: '10px' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 'bold' }}>₹{log.triggerPrice}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 'bold', color: '#0284c7' }}>₹{log.entryLtp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Summary Filter Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setFilterType('ALL')}
          style={{ padding: '8px 16px', background: filterType === 'ALL' ? '#0f172a' : '#f1f5f9', color: filterType === 'ALL' ? 'white' : '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
        >
          🌐 All Stocks ({marketData.length})
        </button>
        <button 
          onClick={() => setFilterType('BUY')}
          style={{ padding: '8px 16px', background: filterType === 'BUY' ? '#166534' : '#dcfce7', color: filterType === 'BUY' ? 'white' : '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
        >
          🟢 Buy Above Trigger ({buyCount})
        </button>
        <button 
          onClick={() => setFilterType('SELL')}
          style={{ padding: '8px 16px', background: filterType === 'SELL' ? '#991b1b' : '#fee2e2', color: filterType === 'SELL' ? 'white' : '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
        >
          🔴 Sell Below Trigger ({sellCount})
        </button>
        <button 
          onClick={() => setFilterType('RANGE')}
          style={{ padding: '8px 16px', background: filterType === 'RANGE' ? '#475569' : '#f1f5f9', color: filterType === 'RANGE' ? 'white' : '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
        >
          ⚪ In Range / LTP Moving ({rangeCount})
        </button>
      </div>

      {/* Search Input Bar */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="🔍 Search Symbol (e.g. NIFTY, RELIANCE)..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Main Table */}
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ padding: '12px' }}>Symbol</th>
              <th style={{ padding: '12px' }}>Open (₹)</th>
              <th style={{ padding: '12px' }}>LTP (₹)</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Buy Trigger & Targets (T1-T4)</th>
              <th style={{ padding: '12px' }}>Sell Trigger & Targets (T1-T4)</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Chart</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  {loading ? 'ડેટા સ્કેન થઈ રહ્યો છે, કૃપા કરીને થોડી સેકન્ડ રાહ જુઓ...' : 'કોઈ સ્ટોક મળ્યો નથી. ઉપર આપેલું "🔄 Refresh Full Data" બટન દબાવો.'}
                </td>
              </tr>
            ) : (
              filteredList.map((item, idx) => {
                let badgeText = '⚪ RANGE';
                let badgeBg = '#f1f5f9';
                let badgeColor = '#334155';

                if (item.status === 'BUY') {
                  badgeText = '🟢 BUY';
                  badgeBg = '#dcfce7';
                  badgeColor = '#166534';
                } else if (item.status === 'SELL') {
                  badgeText = '🔴 SELL';
                  badgeBg = '#fee2e2';
                  badgeColor = '#991b1b';
                }

                const tvSymbol = item.symbol === 'NIFTY' ? 'NSE:NIFTY' : 
                                 item.symbol === 'BANKNIFTY' ? 'NSE:BANKNIFTY' : 
                                 item.symbol === 'SENSEX' ? 'BSE:SENSEX' : `NSE:${item.symbol}`;
                const tvUrl = `https://in.tradingview.com/chart/?symbol=${tvSymbol}`;

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#1e293b' }}>{item.symbol}</td>
                    
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold', color: '#475569' }}>₹{item.open}</div>
                      {item.triggeredAt ? (
                        <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 'bold', marginTop: '2px' }}>
                          🕒 {new Date(item.triggeredAt).toLocaleTimeString()}
                        </div>
                      ) : (
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                          ⏳ In Range
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>₹{item.ltp}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '4px 8px', background: badgeBg, color: badgeColor, borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', border: `1px solid ${badgeColor}` }}>
                        {badgeText}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px' }}>
                      <div style={{ color: '#166534', fontWeight: 'bold', marginBottom: '2px' }}>Trigger: ₹{item.buyLvl}</div>
                      <div style={{ color: '#15803d' }}>
                        T1: <b>{item.buyTargets?.[0]}</b> | T2: <b>{item.buyTargets?.[1]}</b> | T3: <b>{item.buyTargets?.[2]}</b> | T4: <b>{item.buyTargets?.[3]}</b>
                      </div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px' }}>
                      <div style={{ color: '#991b1b', fontWeight: 'bold', marginBottom: '2px' }}>Trigger: ₹{item.sellLvl}</div>
                      <div style={{ color: '#b91c1c' }}>
                        T1: <b>{item.sellTargets?.[0]}</b> | T2: <b>{item.sellTargets?.[1]}</b> | T3: <b>{item.sellTargets?.[2]}</b> | T4: <b>{item.sellTargets?.[3]}</b>
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <a 
                        href={tvUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ padding: '6px 12px', background: '#0284c7', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '11px', display: 'inline-block' }}
                      >
                        📈 Chart
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OpenPrice;
