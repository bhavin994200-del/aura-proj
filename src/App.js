import React, { useState, useEffect } from 'react';
import { fullFnoList } from './watchlistData';
import BiasCalendar from './BiasCalendar';
import StaticPivotScanner from './StaticPivotScanner';
import CalculatorModule from './Calculator';
import OpenPrice from './OpenPrice';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [lastUpdated, setLastUpdated] = useState('');
  const [indiaVix, setIndiaVix] = useState(0.0);

  const [marketData, setMarketData] = useState(() => {
    const saved = localStorage.getItem('vedicedge_home_market');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.log("Error parsing saved market data");
      }
    }
    
    return ['SENSEX', 'NIFTY', 'BANKNIFTY'].map((sym, idx) => {
      const base = 500.0 + (sumChars(sym) * 43 % 20000);
      return {
        id: idx + 1,
        name: sym,
        category: 'Index',
        ltp: Number(base.toFixed(2)),
        futuresPrice: Number((base * 1.003).toFixed(2)),
        spotChange: 120.50,
        spotChangePct: 0.50,
        futChange: 145.00,
        futChangePct: 0.60,
        prevClose: Number((base - 100).toFixed(2)),
        high: Number((base + 150).toFixed(2)),
        low: Number((base - 120).toFixed(2))
      };
    });
  });

  const [indices, setIndices] = useState([
    { name: 'NIFTY', ltp: 24239.40, prevClose: 24231.85 },
    { name: 'BANKNIFTY', ltp: 57660.50, prevClose: 57495.90 },
    { name: 'SENSEX', ltp: 77568.75, prevClose: 77537.72 }
  ]);

  function sumChars(str) {
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      sum += str.charCodeAt(i);
    }
    return sum;
  }

  useEffect(() => {
    const fetchGlobalLiveData = async () => {
      try {
        const homeSymbols = marketData.map(item => item.name);
        const symbolsToFetch = Array.from(new Set(['NIFTY', 'BANKNIFTY', 'SENSEX', ...homeSymbols, ...fullFnoList.slice(0, 40)]));

        const res = await fetch('https://aura-proj.onrender.com/scan-static-pivot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: symbolsToFetch })
        });
        const response = await res.json();
        const liveList = response.data || [];

        if (liveList.length > 0) {
          localStorage.setItem('master_cached_market_data', JSON.stringify(liveList));

          setIndices(prevIndices => prevIndices.map(ind => {
            const found = liveList.find(item => item.symbol === ind.name || item.name === ind.name);
            if (found && (found.ltp || found.close)) {
              return { ...ind, ltp: found.ltp || found.close };
            }
            return ind;
          }));

          setMarketData(prevMarket => prevMarket.map(item => {
            const found = liveList.find(i => i.symbol === item.name || i.name === item.name);
            if (found && (found.ltp || found.close)) {
              const spotLtp = found.ltp || found.close;
              const prevClose = found.prev_close || item.prevClose;
              const spotDiff = spotLtp - prevClose;
              const spotPct = prevClose ? (spotDiff / prevClose) * 100 : 0;

              return {
                ...item,
                ltp: spotLtp,
                spotChange: Math.abs(spotDiff).toFixed(2),
                spotChangePct: Math.abs(spotPct).toFixed(2),
                prevClose: prevClose,
                high: found.weekly?.resistance || found.high || item.high,
                low: found.weekly?.support || found.low || item.low
              };
            }
            return item;
          }));

          if (response.india_vix) {
            setIndiaVix(response.india_vix);
          }
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch (e) {
        console.log("Global live fetch polling error (Server waking up)");
      }
    };

    fetchGlobalLiveData();
    const interval = setInterval(fetchGlobalLiveData, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#e4e4e7', color: '#27272a', fontFamily: 'sans-serif' }}>
      
      {/* Sidebar */}
      <div style={{ width: '260px', backgroundColor: '#d4d4d8', borderRight: '1px solid #a1a1aa', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #a1a1aa', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#18181b' }}>
            ⚡ Aura Terminal
          </div>
          <div style={{ fontSize: '12px', color: '#52525b', marginTop: '6px' }}>
            Last Update: <span style={{ fontWeight: '600', color: '#18181b' }}>{lastUpdated}</span>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
          <button onClick={() => setActiveTab('home')} style={btnStyle(activeTab === 'home')}>Home Dashboard</button>
          <button onClick={() => setActiveTab('openPrice')} style={btnStyle(activeTab === 'openPrice')}>🚀 OpenPrice</button>
          <button onClick={() => setActiveTab('scanner')} style={btnStyle(activeTab === 'scanner')}>Static Scanner</button>
          <button onClick={() => setActiveTab('biasCalendar')} style={btnStyle(activeTab === 'biasCalendar')}>Bias Calendar</button>
          <button onClick={() => setActiveTab('calculator')} style={btnStyle(activeTab === 'calculator')}>Calculator</button>
          <button onClick={() => setActiveTab('watchlist')} style={btnStyle(activeTab === 'watchlist')}>Watchlist</button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* Top Header */}
        <div style={{ height: '70px', backgroundColor: '#d4d4d8', borderBottom: '1px solid #a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', flexShrink: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: '500', color: '#52525b' }}>
            Welcome back, <span style={{ color: '#18181b', fontWeight: 'bold' }}>Bhavin</span> ✨
          </div>
          
          <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
            {indices.map((ind, idx) => {
              const diff = (ind.ltp - ind.prevClose).toFixed(2);
              const percent = ind.prevClose ? ((diff / ind.prevClose) * 100).toFixed(2) : "0.00";
              const isPositive = diff >= 0;

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '13px' }}>
                  <span style={{ fontWeight: 'bold', color: '#18181b' }}>{ind.name}: <span style={{ color: '#27272a' }}>{ind.ltp}</span></span>
                  <span style={{ fontSize: '12px', color: isPositive ? '#15803d' : '#b91c1c', fontWeight: 'bold' }}>
                    {isPositive ? `+${diff} (+${percent}%)` : `${diff} (${percent}%)`}
                  </span>
                </div>
              );
            })}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '13px', borderLeft: '1px solid #a1a1aa', paddingLeft: '20px' }}>
              <span style={{ fontWeight: 'bold', color: '#18181b' }}>INDIA VIX</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: indiaVix > 15 ? '#b91c1c' : '#15803d' }}>
                {indiaVix} {indiaVix > 15 ? '⚠️' : '🟢'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Content */}
        <div style={{ padding: '30px', flex: 1, overflowY: 'auto', backgroundColor: '#e4e4e7' }}>
          {activeTab === 'home' && <HomeDashboard marketData={marketData} setMarketData={setMarketData} />}
          {activeTab === 'openPrice' && <OpenPrice />}
          {activeTab === 'scanner' && <StaticPivotScanner />}
          {activeTab === 'biasCalendar' && <BiasCalendar />}
          {activeTab === 'calculator' && <CalculatorModule />}
          {activeTab === 'watchlist' && <WatchlistModule />}
        </div>

      </div>
    </div>
  );
}

function HomeDashboard({ marketData, setMarketData }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('F&O');
  
  const [alerts, setAlerts] = useState({});
  const [alertInputs, setAlertInputs] = useState({});

  useEffect(() => {
    marketData.forEach(item => {
      const targetAlert = alerts[item.name];
      if (targetAlert && item.ltp >= Number(targetAlert)) {
        alert(`🚨 PRICE ALERT! ${item.name} has crossed your target ₹${targetAlert}! Current LTP: ₹${item.ltp}`);
        setAlerts(prev => {
          const updated = { ...prev };
          delete updated[item.name];
          return updated;
        });
      }
    });
  }, [marketData, alerts]);

  const handleSetAlert = (symbol) => {
    const val = alertInputs[symbol];
    if (!val) return;
    setAlerts(prev => ({ ...prev, [symbol]: val }));
    alert(`✅ Alert set for ${symbol} at ₹${val}`);
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!newName) return;

    const cleanSymbol = newName.trim().toUpperCase();
    
    if (marketData.some(item => item.name === cleanSymbol)) {
      alert("Stock is already added in Home Dashboard!");
      setNewName('');
      return;
    }

    try {
      const res = await fetch('https://aura-proj.onrender.com/calculate-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_symbol: cleanSymbol })
      });
      const data = await res.json();
      
      const spotLtp = data.ltp || 1000.0;
      const prevClose = data.prev_close || (spotLtp - 10);
      const spotDiff = spotLtp - prevClose;
      const spotPct = prevClose ? (spotDiff / prevClose) * 100 : 0;

      const futPrice = data.futures_price || Number((spotLtp * 1.003).toFixed(2));
      const futDiff = futPrice - prevClose;
      const futPct = prevClose ? (futDiff / prevClose) * 100 : 0;

      const newItem = {
        id: Date.now(),
        name: cleanSymbol,
        category: newCategory,
        ltp: spotLtp,
        futuresPrice: futPrice,
        spotChange: Math.abs(spotDiff).toFixed(2),
        spotChangePct: Math.abs(spotPct).toFixed(2),
        futChange: Math.abs(futDiff).toFixed(2),
        futChangePct: Math.abs(futPct).toFixed(2),
        prevClose: prevClose,
        high: data.high || (spotLtp + 20),
        low: data.low || (spotLtp - 20)
      };

      const updatedList = [...marketData, newItem];
      setMarketData(updatedList);
      localStorage.setItem('vedicedge_home_market', JSON.stringify(updatedList));
      setNewName('');
    } catch (err) {
      alert("Error fetching stock data from backend!");
    }
  };

  const handleDeleteStock = (id) => {
    const updatedList = marketData.filter(item => item.id !== id);
    setMarketData(updatedList);
    localStorage.setItem('vedicedge_home_market', JSON.stringify(updatedList));
  };

  const filteredData = selectedCategory === 'ALL' 
    ? marketData 
    : marketData.filter(item => item.category === selectedCategory);

  return (
    <div>
      <h2 style={{ color: '#18181b', margin: '0 0 5px 0' }}>Market Overview</h2>
      <p style={{ color: '#52525b', fontSize: '14px', marginTop: '0' }}>Manage Indices, F&O, and Commodities</p>
      
      <form onSubmit={handleAddStock} style={{ display: 'flex', gap: '10px', marginTop: '20px', marginBottom: '20px', backgroundColor: '#d4d4d8', padding: '15px', borderRadius: '10px', border: '1px solid #a1a1aa', flexWrap: 'wrap', alignItems: 'center' }}>
        
        <div style={{ flex: '2', minWidth: '180px' }}>
          <input 
            type="text" 
            list="instruments-list"
            placeholder="Instrument Name" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} 
            required 
          />
          <datalist id="instruments-list">
            {fullFnoList.map((item, idx) => (
              <option key={idx} value={item} />
            ))}
          </datalist>
        </div>

        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={inputStyle}>
          <option value="Index">Index</option>
          <option value="F&O">F&O</option>
          <option value="Commodity">Commodity</option>
        </select>

        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#3f3f46', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Add Item
        </button>
      </form>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {['ALL', 'Index', 'F&O', 'Commodity'].map((cat) => (
          <button 
            key={cat} 
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '6px 16px',
              backgroundColor: selectedCategory === cat ? '#3f3f46' : '#d4d4d8',
              color: selectedCategory === cat ? '#ffffff' : '#27272a',
              border: '1px solid #a1a1aa',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
        {filteredData.map((item) => {
          const hRoot = Math.sqrt(item.high || item.ltp);
          const lRoot = Math.sqrt(item.low || item.ltp);
          
          const support90 = Math.pow(hRoot - (90 / 180.0), 2).toFixed(2);
          const resistance90 = Math.pow(lRoot + (90 / 180.0), 2).toFixed(2);

          const spotDiffVal = item.ltp - item.prevClose;
          const isSpotPos = spotDiffVal >= 0;

          const futPriceVal = item.futuresPrice || (item.ltp * 1.003).toFixed(2);
          const futDiffVal = futPriceVal - item.prevClose;
          const isFutPos = futDiffVal >= 0;

          return (
            <div key={item.id} style={{ ...cardStyle, padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '9px', textTransform: 'uppercase', backgroundColor: '#e4e4e7', padding: '2px 5px', borderRadius: '4px', fontWeight: 'bold', color: '#52525b', border: '1px solid #a1a1aa' }}>
                    {item.category}
                  </span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#18181b' }}>{item.name}</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#52525b' }}>Prev: <strong style={{ color: '#18181b' }}>{item.prevClose}</strong></span>
                  <button onClick={() => handleDeleteStock(item.id)} style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }} title="Delete">×</button>
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #d4d4d8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 'bold' }}>SPOT</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#27272a', marginRight: '6px' }}>₹ {item.ltp}</span>
                    <span style={{ fontSize: '10px', backgroundColor: isSpotPos ? '#dcfce7' : '#fee2e2', color: isSpotPos ? '#15803d' : '#b91c1c', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {isSpotPos ? `+${item.spotChange || spotDiffVal.toFixed(2)}` : `${item.spotChange || spotDiffVal.toFixed(2)}`} ({isSpotPos ? `+${item.spotChangePct || '0.50'}%` : `${item.spotChangePct || '0.50'}%`})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e4e4e7', paddingTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>FUT</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#15803d', marginRight: '6px' }}>₹ {futPriceVal}</span>
                    <span style={{ fontSize: '10px', backgroundColor: isFutPos ? '#dcfce7' : '#fee2e2', color: isFutPos ? '#15803d' : '#b91c1c', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {isFutPos ? `+${item.futChange || futDiffVal.toFixed(2)}` : `${item.futChange || futDiffVal.toFixed(2)}`} ({isFutPos ? `+${item.futChangePct || '0.60'}%` : `${item.futChangePct || '0.60'}%`})
                    </span>
                  </div>
                </div>

              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#52525b', marginBottom: '8px', borderBottom: '1px solid #d4d4d8', paddingBottom: '6px' }}>
                <span>Low: <strong style={{ color: '#dc2626' }}>{item.low}</strong></span>
                <span>High: <strong style={{ color: '#16a34a' }}>{item.high}</strong></span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#3f3f46', fontWeight: '600', marginBottom: '8px' }}>
                <span style={{ color: '#166534' }}>Support (90°): {support90}</span>
                <span style={{ color: '#991b1b' }}>Resist (90°): {resistance90}</span>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', backgroundColor: '#e4e4e7', padding: '6px', borderRadius: '6px', border: '1px solid #a1a1aa' }}>
                <input 
                  type="number"
                  placeholder="Set Alert Price..."
                  value={alertInputs[item.name] || ''}
                  onChange={(e) => setAlertInputs({ ...alertInputs, [item.name]: e.target.value })}
                  style={{ flex: 1, padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #a1a1aa' }}
                />
                <button 
                  onClick={() => handleSetAlert(item.name)}
                  style={{ padding: '4px 10px', background: '#3f3f46', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {alerts[item.name] ? `Active (${alerts[item.name]})` : 'Set'}
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

function WatchlistModule() {
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('vedicedge_watchlist');
    return saved ? JSON.parse(saved) : ['RELIANCE', 'TCS', 'NIFTY', 'BANKNIFTY'];
  });
  
  const [selectedStock, setSelectedStock] = useState('');
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);

  const addStock = () => {
    if (!selectedStock) {
      alert("Please select a stock first!");
      return;
    }
    const cleanStock = selectedStock.trim();
    if (!watchlist.includes(cleanStock)) {
      const updated = [...watchlist, cleanStock];
      setWatchlist(updated);
      localStorage.setItem('vedicedge_watchlist', JSON.stringify(updated));
      setSelectedStock('');
    } else {
      fetchWatchlistData();
      alert("Stock is already in watchlist! Refreshed data.");
    }
  };

  const removeStock = (stockToRemove) => {
    const updated = watchlist.filter(s => s !== stockToRemove);
    setWatchlist(updated);
    localStorage.setItem('vedicedge_watchlist', JSON.stringify(updated));
  };

  const getTradeDirectionBox = (ltp, lowVal, highVal) => {
    if (!lowVal || !highVal) return { text: 'No Trade / In Range', bg: '#f1f5f9', color: '#334155' };
    const distSup = Math.abs(ltp - lowVal) / lowVal;
    const distRes = Math.abs(ltp - highVal) / highVal;

    if (distSup <= 0.015 || ltp < lowVal) {
      return { text: 'Buy at Support (Bounce)', bg: '#dcfce7', color: '#166534' };
    } else if (distRes <= 0.015 || ltp > highVal) {
      return { text: 'Sell at Resistance (Reject)', bg: '#fee2e2', color: '#991b1b' };
    }
    return { text: 'No Trade / In Range', bg: '#f1f5f9', color: '#64748b' };
  };

  const fetchWatchlistData = async () => {
    if (watchlist.length === 0) return;
    setLoading(true);
    const results = await Promise.all(watchlist.map(async (sym) => {
      try {
        const res = await fetch('https://aura-proj.onrender.com/calculate-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock_symbol: sym })
        });
        const data = await res.json();
        if (data && data.ltp) {
          let hRoot = Math.sqrt(data.high || data.ltp);
          let lRoot = Math.sqrt(data.low || data.ltp);
          let levels = {
            "90": { bullish: Math.pow(hRoot - (90 / 180.0), 2).toFixed(2), bearish: Math.pow(lRoot + (90 / 180.0), 2).toFixed(2) },
            "180": { bullish: Math.pow(hRoot - (180 / 180.0), 2).toFixed(2), bearish: Math.pow(lRoot + (180 / 180.0), 2).toFixed(2) },
            "360": { bullish: Math.pow(hRoot - (360 / 180.0), 2).toFixed(2), bearish: Math.pow(lRoot + (360 / 180.0), 2).toFixed(2) }
          };
          let pct = data.prev_close ? (((data.ltp - data.prev_close) / data.prev_close) * 100).toFixed(2) : "0.00";
          let directionBox = getTradeDirectionBox(data.ltp, data.low, data.high);
          return { ...data, pct, levels, directionBox };
        }
        return null;
      } catch (e) {
        return null;
      }
    }));
    setStockData(results.filter(item => item !== null));
    setLoading(false);
  };

  useEffect(() => { 
    fetchWatchlistData(); 
  }, [watchlist]);

  return (
    <div style={{ background: '#f4f4f5', padding: '0px' }}>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center', background: '#d4d4d8', padding: '15px', borderRadius: '8px', border: '1px solid #a1a1aa' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#27272a' }}>Select Stock / Index / Commodity:</label>
          <select 
            value={selectedStock} 
            onChange={(e) => setSelectedStock(e.target.value)} 
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #a1a1aa', background: 'white' }}>
            <option value="">-- Choose Option --</option>
            {fullFnoList.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={addStock} style={{ padding: '9px 20px', background: '#3f3f46', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Add Stock</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <button onClick={fetchWatchlistData} disabled={loading} style={{ padding: '8px 16px', background: '#3f3f46', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? 'Fetching Live Data...' : 'Refresh Data'}
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f4f4f5' }}>
        <thead>
          <tr style={{ background: '#d4d4d8', color: '#18181b' }}>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Stock / Index</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>LTP</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>%</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>H / L (Range)</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Trade Status</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>90°</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>180°</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>360°</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {stockData.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: '#52525b', border: '1px solid #a1a1aa' }}>No stocks data found. Click "Refresh Data" or add a stock.</td>
            </tr>
          ) : (
            stockData.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #a1a1aa' }}>
                <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #a1a1aa', color: '#18181b' }}>{s.stock}</td>
                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #a1a1aa', color: '#18181b' }}>{s.ltp}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: s.pct >= 0 ? '#15803d' : '#b91c1c', border: '1px solid #a1a1aa', fontWeight: 'bold' }}>{s.pct}%</td>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px', border: '1px solid #a1a1aa', color: '#27272a' }}>{s.high} / {s.low}</td>
                <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #a1a1aa' }}>
                  <div style={{ padding: '5px 8px', background: s.directionBox.bg, color: s.directionBox.color, borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', border: `1px solid ${s.directionBox.color}` }}>
                    {s.directionBox.text}
                  </div>
                </td>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: '11px', border: '1px solid #a1a1aa', color: '#27272a' }}>B:{s.levels["90"].bullish}<br/>S:{s.levels["90"].bearish}</td>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: '11px', border: '1px solid #a1a1aa', color: '#27272a' }}>B:{s.levels["180"].bullish}<br/>S:{s.levels["180"].bearish}</td>
                <td style={{ padding: '10px', textAlign: 'center', fontSize: '11px', border: '1px solid #a1a1aa', color: '#27272a' }}>B:{s.levels["360"].bullish}<br/>S:{s.levels["360"].bearish}</td>
                <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #a1a1aa' }}>
                  <button onClick={() => removeStock(s.stock)} style={{ background: '#b91c1c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const btnStyle = (active) => ({
  padding: '12px 15px',
  textAlign: 'left',
  backgroundColor: active ? '#b4b4b8' : 'transparent',
  color: active ? '#18181b' : '#52525b',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: '0.2s',
  flexShrink: 0
});

const inputStyle = {
  padding: '10px',
  backgroundColor: '#e4e4e7',
  border: '1px solid #a1a1aa',
  borderRadius: '6px',
  color: '#27272a',
  flex: '1',
  minWidth: '100px'
};

const cardStyle = {
  backgroundColor: '#f4f4f5',
  padding: '15px',
  borderRadius: '12px',
  border: '1px solid #a1a1aa',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
};

export default App;
