import React, { useState, useEffect } from 'react';
import { fullFnoList } from './watchlistData';
import BiasCalendar from './BiasCalendar';
import StaticPivotScanner from './StaticPivotScanner';
import CalculatorModule from './Calculator';
import OpenPrice from './OpenPrice';
import VcpScanner from './VcpScanner'; // 👈 નવું VcpScanner ઇમ્પોર્ટ કર્યું

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
        spotChange: 0.00,
        spotChangePct: 0.00,
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
    const keepServerAlive = () => {
      fetch('https://aura-proj.onrender.com/scan-static-pivot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: ['NIFTY'] })
      }).catch(() => {});
    };

    const fetchGlobalLiveData = async () => {
      try {
        const symbolsToFetch = Array.from(new Set(['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCAPNIFTY', ...fullFnoList]));

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
              return { 
                ...ind, 
                ltp: found.ltp || found.close, 
                prevClose: found.prev_close || found.previous_close || ind.prevClose 
              };
            }
            return ind;
          }));

          const mappedItems = liveList.map((found, idx) => {
            const spotLtp = found.ltp || found.close || 1000.0;
            const prevClose = found.prev_close || found.previous_close || found.pc || spotLtp;
            const spotDiff = spotLtp - prevClose;
            const spotPct = prevClose ? (spotDiff / prevClose) * 100 : 0;

            const symName = found.symbol || found.name || 'UNKNOWN';
            let cat = 'F&O';
            if (
              ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCAPNIFTY', 'NIFTYIT', 'NIFTYAUTO', 'NIFTYFMCG', 'NIFTYMETAL', 'NIFTYPHARMA', 'NIFTYENERGY', 'NIFTYINFRA'].some(ind => symName.includes(ind)) ||
              symName.startsWith('NIFTY')
            ) {
              cat = 'Index';
            } else if (['NATURALGAS', 'CRUDEOIL', 'GOLD', 'SILVER', 'COPPER', 'ALUMINI', 'ZINC', 'LEAD'].includes(symName)) {
              cat = 'Commodity';
            }

            return {
              id: idx + 1,
              name: symName,
              category: cat,
              ltp: spotLtp,
              spotChange: spotDiff.toFixed(2),
              spotChangePct: spotPct.toFixed(2),
              prevClose: prevClose,
              high: found.weekly?.resistance || found.high || (spotLtp + 20),
              low: found.weekly?.support || found.low || (spotLtp - 20)
            };
          });

          setMarketData(mappedItems);
          localStorage.setItem('vedicedge_home_market', JSON.stringify(mappedItems));

          if (response.india_vix) {
            setIndiaVix(response.india_vix);
          }
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch (e) {
        console.log("Global live fetch polling error, checking cache...");
        const cached = localStorage.getItem('master_cached_market_data');
        if (cached) {
          try {
            const liveList = JSON.parse(cached);
            if (Array.isArray(liveList) && liveList.length > 0) {
              setIndices(prevIndices => prevIndices.map(ind => {
                const found = liveList.find(item => item.symbol === ind.name || item.name === ind.name);
                if (found && (found.ltp || found.close)) {
                  return { ...ind, ltp: found.ltp || found.close, prevClose: found.prev_close || ind.prevClose };
                }
                return ind;
              }));
            }
          } catch (err) {
            console.log("Cache parse error");
          }
        }
      }
    };

    keepServerAlive();
    fetchGlobalLiveData();
    const interval = setInterval(fetchGlobalLiveData, 5000);
    const keepAliveInterval = setInterval(keepServerAlive, 25000);

    return () => {
      clearInterval(interval);
      clearInterval(keepAliveInterval);
    };
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
          <button onClick={() => setActiveTab('vcpScanner')} style={btnStyle(activeTab === 'vcpScanner')}>🎯 VCP Scanner</button> {/* 👈 સાઈડબાર બટન */}
          <button onClick={() => setActiveTab('biasCalendar')} style={btnStyle(activeTab === 'biasCalendar')}>Bias Calendar</button>
          <button onClick={() => setActiveTab('calculator')} style={btnStyle(activeTab === 'calculator')}>Calculator</button>
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
          {activeTab === 'vcpScanner' && <VcpScanner />} {/* 👈 રેન્ડરિંગ વ્યુ */}
          {activeTab === 'biasCalendar' && <BiasCalendar />}
          {activeTab === 'calculator' && <CalculatorModule />}
        </div>

      </div>
    </div>
  );
}

function HomeDashboard({ marketData, setMarketData }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingAll, setLoadingAll] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    const savedFav = localStorage.getItem('aura_favorites');
    return savedFav ? JSON.parse(savedFav) : [];
  });

  const toggleFavorite = (name) => {
    let updatedFavs;
    if (favorites.includes(name)) {
      updatedFavs = favorites.filter(item => item !== name);
    } else {
      updatedFavs = [...favorites, name];
    }
    setFavorites(updatedFavs);
    localStorage.setItem('aura_favorites', JSON.stringify(updatedFavs));
  };

  const handleRefresh = async () => {
    setLoadingAll(true);
    try {
      const symbolsToFetch = Array.from(new Set(['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCAPNIFTY', ...fullFnoList]));
      const res = await fetch('https://aura-proj.onrender.com/scan-static-pivot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: symbolsToFetch })
      });
      const response = await res.json();
      const liveList = response.data || [];

      if (liveList.length > 0) {
        const allMappedItems = liveList.map((found, idx) => {
          const spotLtp = found.ltp || found.close || 1000.0;
          const prevClose = found.prev_close || found.previous_close || found.pc || spotLtp;
          const spotDiff = spotLtp - prevClose;
          const spotPct = prevClose ? (spotDiff / prevClose) * 100 : 0;

          const symName = found.symbol || found.name || 'UNKNOWN';
          let cat = 'F&O';
          if (
            ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCAPNIFTY', 'NIFTYIT', 'NIFTYAUTO', 'NIFTYFMCG', 'NIFTYMETAL', 'NIFTYPHARMA', 'NIFTYENERGY', 'NIFTYINFRA'].some(ind => symName.includes(ind)) ||
            symName.startsWith('NIFTY')
          ) {
            cat = 'Index';
          } else if (['NATURALGAS', 'CRUDEOIL', 'GOLD', 'SILVER', 'COPPER', 'ALUMINI', 'ZINC', 'LEAD'].includes(symName)) {
            cat = 'Commodity';
          }

          return {
            id: idx + 1,
            name: symName,
            category: cat,
            ltp: spotLtp,
            spotChange: spotDiff.toFixed(2),
            spotChangePct: spotPct.toFixed(2),
            prevClose: prevClose,
            high: found.weekly?.resistance || found.high || (spotLtp + 20),
            low: found.weekly?.support || found.low || (spotLtp - 20)
          };
        });

        setMarketData(allMappedItems);
        localStorage.setItem('vedicedge_home_market', JSON.stringify(allMappedItems));
      }
    } catch (err) {
      console.log("Error refreshing stocks!");
    }
    setLoadingAll(false);
  };

  const filteredData = marketData.filter(item => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFav = !showOnlyFavorites || favorites.includes(item.name);
    return matchesCategory && matchesSearch && matchesFav;
  });

  return (
    <div>
      <h2 style={{ color: '#18181b', margin: '0 0 5px 0' }}>Market Overview</h2>
      <p style={{ color: '#52525b', fontSize: '14px', marginTop: '0' }}>Manage Indices, F&O, and Commodities</p>
      
      {/* Search Bar, Refresh & Heart Filter */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px', marginBottom: '15px', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="🔍 Search Stock, Index or Commodity..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          style={{ ...inputStyle, flex: 1, padding: '12px', fontSize: '14px', background: '#ffffff' }} 
        />
        <button 
          onClick={() => setShowOnlyFavorites(!showOnlyFavorites)} 
          style={{ 
            padding: '12px 18px', 
            backgroundColor: showOnlyFavorites ? '#ef4444' : '#ffffff', 
            color: showOnlyFavorites ? '#ffffff' : '#ef4444', 
            border: '1px solid #ef4444', 
            borderRadius: '6px', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            fontSize: '16px'
          }}
          title="Filter Favorites"
        >
          ❤️
        </button>
        <button 
          onClick={handleRefresh} 
          disabled={loadingAll}
          style={{ padding: '12px 20px', backgroundColor: '#3f3f46', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loadingAll ? 'Refreshing...' : '🔄 Refresh All'}
        </button>
      </div>

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

      {/* List / Table View */}
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f4f4f5' }}>
        <thead>
          <tr style={{ background: '#d4d4d8', color: '#18181b' }}>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Category</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Stock / Index</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>LTP</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Change (%)</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Prev Close</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Low / High</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Support (90°) / Resist (90°)</th>
            <th style={{ padding: '10px', border: '1px solid #a1a1aa' }}>Favorite</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#52525b', border: '1px solid #a1a1aa' }}>No data found.</td>
            </tr>
          ) : (
            filteredData.map((item) => {
              const hRoot = Math.sqrt(item.high || item.ltp);
              const lRoot = Math.sqrt(item.low || item.ltp);
              
              const supVal = Math.pow(hRoot - (90 / 180.0), 2);
              const resVal = Math.pow(lRoot + (90 / 180.0), 2);
              const support90 = Math.min(supVal, resVal).toFixed(2);
              const resistance90 = Math.max(supVal, resVal).toFixed(2);
              
              const spotDiffVal = Number(item.ltp) - Number(item.prevClose);
              const spotPctVal = item.prevClose ? (spotDiffVal / Number(item.prevClose)) * 100 : 0;
              const isSpotPos = spotDiffVal >= 0;
              const isFav = favorites.includes(item.name);

              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #a1a1aa' }}>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #a1a1aa', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.category}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', border: '1px solid #a1a1aa', color: '#18181b' }}>{item.name}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #a1a1aa', color: '#18181b' }}>{item.ltp}</td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #a1a1aa' }}>
                    <span style={{ fontSize: '11px', backgroundColor: isSpotPos ? '#dcfce7' : '#fee2e2', color: isSpotPos ? '#15803d' : '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {isSpotPos ? `+${spotDiffVal.toFixed(2)}` : spotDiffVal.toFixed(2)} ({isSpotPos ? `+${spotPctVal.toFixed(2)}%` : `${spotPctVal.toFixed(2)}%`})
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #a1a1aa', color: '#52525b' }}>{item.prevClose}</td>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #a1a1aa', fontSize: '12px' }}>
                    <span style={{ color: '#dc2626' }}>{item.low}</span> / <span style={{ color: '#16a34a' }}>{item.high}</span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #a1a1aa', fontSize: '11px' }}>
                    <span style={{ color: '#166534', fontWeight: '600' }}>S: {support90}</span> | <span style={{ color: '#991b1b', fontWeight: '600' }}>R: {resistance90}</span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #a1a1aa' }}>
                    <button 
                      onClick={() => toggleFavorite(item.name)} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                      title="Toggle Favorite"
                    >
                      {isFav ? '❤️' : '🤍'}
                    </button>
                  </td>
                </tr>
              );
            })
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

export default App;
