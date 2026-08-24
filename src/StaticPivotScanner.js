import React, { useState, useEffect, useRef } from 'react';
import { fullFnoList } from './watchlistData';

function StaticPivotScanner() {
  const [staticSubTab, setStaticSubTab] = useState('weekly'); 
  const [staticData, setStaticData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [biasFilter, setBiasFilter] = useState('all'); 
  const [degreeFilter, setDegreeFilter] = useState('all'); 
  const [swingFilter, setSwingFilter] = useState('all'); 
  const [actionableFilter, setActionableFilter] = useState('all'); 
  const [watchlist, setWatchlist] = useState([]); 
  const [tradeLog, setTradeLog] = useState([]); 
  const [notifications, setNotifications] = useState([]); 
  const [activeTab, setActiveTab] = useState('scanner'); 
  const [weeklyDate, setWeeklyDate] = useState('');
  const [monthlyDate, setMonthlyDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(''); 

  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('user_webhook_url') || '');
  const [showWebhookModal, setShowWebhookModal] = useState(false);

  const dataFetchedRef = useRef(false);

  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) { console.log(e); }
  };

  const sendWebhookAlert = async (title, message) => {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `🚨 *${title}* \n${message}` })
      });
    } catch (e) { console.log("Webhook Error:", e); }
  };

  const fetchStaticData = async (isManual = false) => {
    if (!isManual && staticData.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch('https://aura-proj.onrender.com/scan-static-pivot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: fullFnoList })
      });
      const json = await res.json();
      const fetchedData = json.data || [];
      const wDate = json.weekly_date || '';
      const mDate = json.monthly_date || '';

      setStaticData(fetchedData);
      setWeeklyDate(wDate);
      setMonthlyDate(mDate);
      
      const currentTime = new Date().toLocaleTimeString();
      setLastRefreshTime(currentTime);
      localStorage.setItem('last_refresh_time', currentTime);
      localStorage.setItem('cached_static_data', JSON.stringify(fetchedData));
      localStorage.setItem('cached_weekly_date', wDate);
      localStorage.setItem('cached_monthly_date', mDate);

      const savedWatch = JSON.parse(localStorage.getItem('my_watchlist') || '[]');
      const lastAlerts = JSON.parse(localStorage.getItem('last_alert_timestamps') || '{}');
      const currentTimeMs = new Date().getTime();

      fetchedData.forEach(item => {
        if (savedWatch.includes(item.symbol)) {
          const d = item.weekly || {};
          const safe = getSafeValues(d.close);
          const sVal = d.support || safe.support;
          const rVal = d.resistance || safe.resistance;

          if (sVal && rVal) {
            const isNearSupport = Math.abs(item.ltp - sVal) / sVal <= 0.005;
            const isNearResistance = Math.abs(item.ltp - rVal) / rVal <= 0.005;
            
            const alertKeySup = `${item.symbol}_SUPPORT`;
            const alertKeyRes = `${item.symbol}_RESISTANCE`;
            
            const lastAlertTimeSup = lastAlerts[alertKeySup] || 0;
            const lastAlertTimeRes = lastAlerts[alertKeyRes] || 0;

            if (isNearSupport && (currentTimeMs - lastAlertTimeSup > 1800000)) {
              playBeepSound();
              triggerNotification(`⭐ Watchlist Bottom Reversal: ${item.symbol}`, `LTP: ₹${item.ltp} near Support (₹${sVal})`);
              sendWebhookAlert(`Watchlist Bottom Reversal: ${item.symbol}`, `LTP: ₹${item.ltp} near Support (₹${sVal})`);
              lastAlerts[alertKeySup] = currentTimeMs;
            } else if (isNearResistance && (currentTimeMs - lastAlertTimeRes > 1800000)) {
              playBeepSound();
              triggerNotification(`⭐ Watchlist Top Rejection: ${item.symbol}`, `LTP: ₹${item.ltp} near Resistance (₹${rVal})`);
              sendWebhookAlert(`Watchlist Top Rejection: ${item.symbol}`, `LTP: ₹${item.ltp} near Resistance (₹${rVal})`);
              lastAlerts[alertKeyRes] = currentTimeMs;
            }
          }
        }
      });
      localStorage.setItem('last_alert_timestamps', JSON.stringify(lastAlerts));

    } catch(e) { console.log(e); }
    setLoading(false);
  };

  useEffect(() => {
    const cachedData = localStorage.getItem('cached_static_data');
    const cachedTime = localStorage.getItem('last_refresh_time');
    const cachedWeekly = localStorage.getItem('cached_weekly_date');
    const cachedMonthly = localStorage.getItem('cached_monthly_date');

    if (cachedData) setStaticData(JSON.parse(cachedData));
    if (cachedTime) setLastRefreshTime(cachedTime);
    if (cachedWeekly) setWeeklyDate(cachedWeekly);
    if (cachedMonthly) setMonthlyDate(cachedMonthly);

    if (!dataFetchedRef.current) {
      dataFetchedRef.current = true;
      fetchStaticData(true);
    }

    const interval = setInterval(() => { fetchStaticData(true); }, 10000); 

    const savedWatch = localStorage.getItem('my_watchlist');
    if (savedWatch) setWatchlist(JSON.parse(savedWatch));
    const savedLog = localStorage.getItem('trade_logbook');
    if (savedLog) setTradeLog(JSON.parse(savedLog));
    const savedNotif = localStorage.getItem('notification_history');
    if (savedNotif) setNotifications(JSON.parse(savedNotif));

    if (Notification && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    return () => clearInterval(interval);
  }, []);

  const triggerNotification = (title, body) => {
    if (Notification && Notification.permission === "granted") {
      new Notification(title, { body });
    }
    const newNotif = { date: new Date().toLocaleString(), title, body };
    setNotifications(prev => {
      if (prev.length > 0 && prev[0].title === title && prev[0].body === body) return prev;
      const updated = [newNotif, ...prev];
      localStorage.setItem('notification_history', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleWatchlist = (symbol) => {
    let updated = watchlist.includes(symbol) ? watchlist.filter(s => s !== symbol) : [...watchlist, symbol];
    setWatchlist(updated);
    localStorage.setItem('my_watchlist', JSON.stringify(updated));
  };

  const addToLogbook = (item, d, supportVal, resistanceVal) => {
    const up = d.gann?.up || {};
    const down = d.gann?.down || {};
    const setupTypeLabel = staticSubTab === 'weekly' ? '📅 Weekly Setup' : '🗓️ Monthly Setup';

    const newEntry = {
      date: new Date().toLocaleString(),
      symbol: item.symbol,
      ltp: item.ltp,
      type: setupTypeLabel,
      close: Number(d.close || 0).toFixed(2),
      support: supportVal,
      resistance: resistanceVal,
      gannUp: `45°: ₹${up.g45} | 90°: ₹${up.g90} | 180°: ₹${up.g180} | 360°: ₹${up.g360}`,
      gannDown: `45°: ₹${down.g45} | 90°: ₹${down.g90} | 180°: ₹${down.g180} | 360°: ₹${down.g360}`,
      status: item.ltp > resistanceVal ? 'Breakout / Sell' : item.ltp < supportVal ? 'Breakdown / Buy' : 'In Range'
    };
    const updatedLog = [newEntry, ...tradeLog];
    setTradeLog(updatedLog);
    localStorage.setItem('trade_logbook', JSON.stringify(updatedLog));
    triggerNotification(`📝 Manual Log: ${item.symbol}`, `${setupTypeLabel} | LTP: ₹${item.ltp}`);
    alert(`📝 ${item.symbol} નું લૉગબુકમાં સેવ થઈ ગયું છે!`);
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Symbol,LTP,Close,Support,Resistance,Type\n";
    filteredData.forEach(item => {
      const d = item[staticSubTab] || {};
      const safe = getSafeValues(d.close);
      const closeFormatted = Number(d.close || 0).toFixed(2);
      csvContent += `${item.symbol},${item.ltp},${closeFormatted},${d.support || safe.support},${d.resistance || safe.resistance},${staticSubTab}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Static_Pivot_${staticSubTab}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSafeValues = (closePrice) => {
    if (!closePrice) return { support: 0, resistance: 0 };
    const r = Math.sqrt(closePrice);
    return {
      support: Math.round(((r - 1.0) ** 2) * 100) / 100,
      resistance: Math.round(((r + 1.0) ** 2) * 100) / 100
    };
  };

  const getMarketStatus = (ltp, support, resistance) => {
    if (!support || !resistance) return { type: 'neutral', symbol: '⚪', color: '#0f172a' };
    if (ltp > resistance) return { type: 'bullish', symbol: '🟢', color: '#166534' };
    if (ltp < support) return { type: 'bearish', symbol: '🔴', color: '#991b1b' };
    return { type: 'neutral', symbol: '⚪', color: '#0f172a' };
  };

  const getTradeDirectionBox = (ltp, support, resistance) => {
    if (!support || !resistance) return { text: '⚪ No Trade / In Range', bg: '#f1f5f9', color: '#334155' };
    const distSup = Math.abs(ltp - support) / support;
    const distRes = Math.abs(ltp - resistance) / resistance;

    if (distSup <= 0.015 || ltp < support) {
      return { text: '🟢 Buy at Support (Bounce Zone)', bg: '#dcfce7', color: '#166534' };
    } else if (distRes <= 0.015 || ltp > resistance) {
      return { text: '🔴 Sell at Resistance (Reject Zone)', bg: '#fee2e2', color: '#991b1b' };
    }
    return { text: '⚪ No Trade / In Range', bg: '#f1f5f9', color: '#64748b' };
  };

  const matchesDegree = (ltp, gann) => {
    if (degreeFilter === 'all') return true;
    if (!gann || !gann.up || !gann.down) return false;
    if (degreeFilter === '45' && (Math.abs(ltp - gann.up?.g45)/gann.up?.g45 < 0.008 || Math.abs(ltp - gann.down?.g45)/gann.down?.g45 < 0.008)) return true;
    if (degreeFilter === '90' && (Math.abs(ltp - gann.up?.g90)/gann.up?.g90 < 0.008 || Math.abs(ltp - gann.down?.g90)/gann.down?.g90 < 0.008)) return true;
    if (degreeFilter === '180' && (Math.abs(ltp - gann.up?.g180)/gann.up?.g180 < 0.008 || Math.abs(ltp - gann.down?.g180)/gann.down?.g180 < 0.008)) return true;
    if (degreeFilter === '360' && (Math.abs(ltp - gann.up?.g360)/gann.up?.g360 < 0.008 || Math.abs(ltp - gann.down?.g360)/gann.down?.g360 < 0.008)) return true;
    return false;
  };

  const matchesSwing = (ltp, support, resistance, gann) => {
    if (swingFilter === 'all') return true;
    if (!support || !resistance || !gann) return false;

    const distSupport = Math.abs(ltp - support) / support;
    const distResistance = Math.abs(ltp - resistance) / resistance;

    if (swingFilter === 'nearSupport' && distSupport <= 0.015) return true; 
    if (swingFilter === 'nearResistance' && distResistance <= 0.015) return true; 

    if (swingFilter === 'intradaySupport' && distSupport <= 0.008) return true; 
    if (swingFilter === 'intradayResistance' && distResistance <= 0.008) return true; 

    const up45 = gann.up?.g45 || 0;
    const up90 = gann.up?.g90 || 0;
    const down45 = gann.down?.g45 || 0;
    const down90 = gann.down?.g90 || 0;

    const nearExact45 = Math.abs(ltp - up45) / up45 <= 0.006 || Math.abs(ltp - down45) / down45 <= 0.006;
    const nearExact90 = Math.abs(ltp - up90) / up90 <= 0.006 || Math.abs(ltp - down90) / down90 <= 0.006;

    if (swingFilter === 'exact45' && nearExact45) return true;
    if (swingFilter === 'exact90' && nearExact90) return true;

    return false;
  };

  const getConfluenceScore = (item) => {
    const w = item.weekly;
    const m = item.monthly;
    if (!w || !m) return 0;
    const ltp = item.ltp;

    const wSafe = getSafeValues(w.close);
    const mSafe = getSafeValues(m.close);
    const wSup = w.support || wSafe.support;
    const wRes = w.resistance || wSafe.resistance;
    const mSup = m.support || mSafe.support;
    const mRes = m.resistance || mSafe.resistance;

    let score = 0;
    if (Math.abs(ltp - wSup) / wSup <= 0.015 || Math.abs(ltp - wRes) / wRes <= 0.015) score++;
    if (Math.abs(ltp - mSup) / mSup <= 0.015 || Math.abs(ltp - mRes) / mRes <= 0.015) score++;
    return score;
  };

  const isConfluenceStock = (item) => {
    return getConfluenceScore(item) === 2;
  };

  const filteredData = staticData.filter(item => {
    if (activeTab === 'watchlist' && !watchlist.includes(item.symbol)) return false;
    if (activeTab === 'confluence' && !isConfluenceStock(item)) return false;
    if (activeTab === 'orbMomentum') {
      const mom = item.momentum || {};
      const isOrbBreakout = item.ltp > 0 && mom.orb_high && item.ltp >= mom.orb_high;
      if (!isOrbBreakout && !mom.is_strong) return false;
    }

    const d = staticSubTab === 'weekly' ? item.weekly : item.monthly;
    if (!d) return false;
    const safe = getSafeValues(d.close);
    const supportVal = d.support || safe.support;
    const resistanceVal = d.resistance || safe.resistance;
    const status = getMarketStatus(item.ltp, supportVal, resistanceVal);

    const matchesSearch = item.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBias = biasFilter === 'all' ? true : status.type === biasFilter;
    const matchesDeg = matchesDegree(item.ltp, d.gann);
    const matchesSwg = matchesSwing(item.ltp, supportVal, resistanceVal, d.gann);

    let matchesActionable = true;
    if (actionableFilter === 'activeZones') {
      const distSup = Math.abs(item.ltp - supportVal) / supportVal;
      const distRes = Math.abs(item.ltp - resistanceVal) / resistanceVal;
      matchesActionable = (distSup <= 0.015 || distRes <= 0.015);
    } else if (actionableFilter === 'confluence') {
      matchesActionable = isConfluenceStock(item);
    } else if (actionableFilter === 'highVolume') {
      matchesActionable = item.volume_spike || true; 
    } else if (actionableFilter === 'orbBreakout') {
      const mom = item.momentum || {};
      matchesActionable = mom.orb_high && item.ltp >= mom.orb_high;
    } else if (actionableFilter === 'relativeStrength') {
      const mom = item.momentum || {};
      matchesActionable = mom.is_strong;
    }

    return matchesSearch && matchesBias && matchesDeg && matchesSwg && matchesActionable;
  });

  const copyAllList = (type) => {
    let dateStr = type === 'weekly' ? weeklyDate : monthlyDate;
    let text = type === 'weekly' ? `📅 Weekly Report (Ref Date: ${dateStr})\n\n` : `🗓️ Monthly Report (Ref Date: ${dateStr})\n\n`;
    
    filteredData.forEach(item => {
      let d = item[staticSubTab] || {};
      if (d) {
        const safe = getSafeValues(d.close);
        const supportVal = d.support || safe.support;
        const resistanceVal = d.resistance || safe.resistance;
        const up = d.gann?.up || {};
        const down = d.gann?.down || {};
        const closeFormatted = Number(d.close || 0).toFixed(2);
        text += `Stock: ${item.symbol} | Close: ₹${closeFormatted} | LTP: ₹${item.ltp}\n🟢 Support: ₹${supportVal} | 🔴 Resistance: ₹${resistanceVal}\n📈 Up 45°: ₹${up.g45} | 90°: ₹${up.g90}\n-----------------------------------\n`;
      }
    });
    navigator.clipboard.writeText(text);
    alert(`📋 લિસ્ટ કૉપી થઈ ગયું છે!`);
  };

  return (
    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', position: 'relative' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b' }}>📅 Ultimate Pivot & Professional Terminal</h2>
          {lastRefreshTime && <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>🕒 Last Refreshed At: {lastRefreshTime}</span>}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setActiveTab('scanner')} style={{ padding: '8px 12px', background: activeTab === 'scanner' ? '#0284c7' : '#e2e8f0', color: activeTab === 'scanner' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📡 Scanner</button>
          <button onClick={() => setActiveTab('confluence')} style={{ padding: '8px 12px', background: activeTab === 'confluence' ? '#7c3aed' : '#e2e8f0', color: activeTab === 'confluence' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🎯 Confluence (2/2)</button>
          <button onClick={() => setActiveTab('orbMomentum')} style={{ padding: '8px 12px', background: activeTab === 'orbMomentum' ? '#16a34a' : '#e2e8f0', color: activeTab === 'orbMomentum' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🚀 ORB & Momentum</button>
          <button onClick={() => setActiveTab('watchlist')} style={{ padding: '8px 12px', background: activeTab === 'watchlist' ? '#d97706' : '#e2e8f0', color: activeTab === 'watchlist' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>⭐ Watchlist ({watchlist.length})</button>
          <button onClick={() => setActiveTab('logbook')} style={{ padding: '8px 12px', background: activeTab === 'logbook' ? '#059669' : '#e2e8f0', color: activeTab === 'logbook' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>📖 Logbook ({tradeLog.length})</button>
          <button onClick={() => setActiveTab('notifications')} style={{ padding: '8px 12px', background: activeTab === 'notifications' ? '#dc2626' : '#e2e8f0', color: activeTab === 'notifications' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🔔 Alerts ({notifications.length})</button>
          
          <button onClick={() => setShowWebhookModal(true)} style={{ padding: '8px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>💬 Webhook Config</button>
        </div>
      </div>

      {showWebhookModal && (
        <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '15px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#166534' }}>💬 WhatsApp / Telegram Webhook URL Setup</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Paste Discord / Telegram / WhatsApp Webhook URL here..." 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{ padding: '8px', flex: 1, borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
            <button onClick={() => {
              localStorage.setItem('user_webhook_url', webhookUrl);
              setShowWebhookModal(false);
              alert('✅ Webhook URL Save થઈ ગયું છે!');
            }} style={{ padding: '8px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
            <button onClick={() => setShowWebhookModal(false)} style={{ padding: '8px 12px', background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {activeTab !== 'logbook' && activeTab !== 'notifications' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setStaticSubTab('weekly')} style={{ padding: '8px 16px', background: staticSubTab === 'weekly' ? '#166534' : '#e2e8f0', color: staticSubTab === 'weekly' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📅 Weekly Fixed Levels</button>
          <button onClick={() => setStaticSubTab('monthly')} style={{ padding: '8px 16px', background: staticSubTab === 'monthly' ? '#166534' : '#e2e8f0', color: staticSubTab === 'monthly' ? 'white' : '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🗓️ Monthly Fixed Levels</button>
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={exportToCSV} style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>📥 Export Excel (CSV)</button>
            <button onClick={() => copyAllList(staticSubTab)} style={{ padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📋 Copy Filtered List</button>
            <button onClick={() => fetchStaticData(true)} disabled={loading} style={{ padding: '8px 16px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {loading ? "Loading..." : "🔄 Refresh Data"}
            </button>
          </div>
        </div>
      )}

      {activeTab !== 'logbook' && activeTab !== 'notifications' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <input 
            placeholder="🔍 Search Stock..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 2, minWidth: '180px', fontSize: '13px', outline: 'none' }} 
          />
          
          <select value={actionableFilter} onChange={(e) => setActionableFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1.5, fontSize: '13px', background: 'white', fontWeight: 'bold', color: '#166534' }}>
            <option value="all">✅ All Stocks (Default)</option>
            <option value="activeZones">🎯 Active Zones Only (S/R)</option>
            <option value="confluence">🏆 Strong Confluence (2/2)</option>
            <option value="highVolume">📈 High Volume Spike / OI</option>
            <option value="orbBreakout">🚀 ORB Breakout (Above High)</option>
            <option value="relativeStrength">⚡ Relative Strength (Strong Momentum)</option>
          </select>

          <select value={swingFilter} onChange={(e) => setSwingFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1.8, fontSize: '13px', background: 'white', fontWeight: 'bold', color: '#0284c7' }}>
            <option value="all">⚡ All Setups (Default)</option>
            <option value="nearSupport">🟢 Swing Buy: Near Support (≤ 1.5%)</option>
            <option value="nearResistance">🔴 Swing Sell: Near Resistance (≤ 1.5%)</option>
            <option value="exact45">🎯 Reversal Exact 45° Angle</option>
            <option value="exact90">🎯 Reversal Exact 90° Angle</option>
          </select>

          <select value={biasFilter} onChange={(e) => setBiasFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1, fontSize: '13px', background: 'white' }}>
            <option value="all">🌐 All Trends (Bias)</option>
            <option value="bullish">🟢 Bullish</option>
            <option value="bearish">🔴 Bearish</option>
            <option value="neutral">⚪ Neutral</option>
          </select>

          <select value={degreeFilter} onChange={(e) => setDegreeFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1, fontSize: '13px', background: 'white' }}>
            <option value="all">📐 All Gann Degrees</option>
            <option value="45">🎯 Near 45°</option>
            <option value="90">🎯 Near 90°</option>
            <option value="180">🎯 Near 180°</option>
            <option value="360">🎯 Near 360°</option>
          </select>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div style={{ background: '#fef2f2', padding: '15px', borderRadius: '12px', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ color: '#dc2626', margin: 0 }}>🔔 Watchlist Notification History</h3>
            <button onClick={() => { setNotifications([]); localStorage.removeItem('notification_history'); }} style={{ padding: '5px 10px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🗑️ Clear All</button>
          </div>
          {notifications.length === 0 ? <p style={{ color: '#64748b' }}>વોચલિસ્ટના સ્ટોક્સમાંથી હજી કોઈ એલર્ટ નથી.</p> : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#fee2e2', color: '#dc2626' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Date & Time</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Alert Type</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Details & LTP</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #fecaca' }}>
                      <td style={{ padding: '10px', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>{n.date}</td>
                      <td style={{ padding: '10px', fontWeight: 'bold', color: '#991b1b' }}>{n.title}</td>
                      <td style={{ padding: '10px' }}>{n.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logbook' && (
        <div style={{ background: '#f5f3ff', padding: '15px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
          <h3 style={{ color: '#7c3aed', marginTop: 0 }}>📖 Saved Trade Logbook</h3>
          {tradeLog.length === 0 ? <p style={{ color: '#64748b' }}>કોઈ ટ્રેડ સેવ નથી.</p> : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#ede9fe', color: '#7c3aed' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Date & Time</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Symbol & Type</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>LTP & Close</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Support / Resistance</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Gann Degrees</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeLog.map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd6fe' }}>
                      <td style={{ padding: '10px', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>{log.date}</td>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}><div>{log.symbol}</div><div style={{ fontSize: '11px', color: '#7c3aed' }}>{log.type}</div></td>
                      <td style={{ padding: '10px' }}>LTP: ₹<b>{log.ltp}</b><br/>Close: ₹{log.close}</td>
                      <td style={{ padding: '10px' }}>🟢 S: ₹{log.support}<br/>🔴 R: ₹{log.resistance}</td>
                      <td style={{ padding: '10px', fontSize: '11px', lineHeight: '1.5' }}><div style={{ color: '#166534' }}>📈 Up -> {log.gannUp}</div><div style={{ color: '#991b1b' }}>📉 Down -> {log.gannDown}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab !== 'logbook' && activeTab !== 'notifications' && (
        <div style={{ background: staticSubTab === 'weekly' ? '#f0fdf4' : '#fef2f2', padding: '15px', borderRadius: '12px', border: `1px solid ${staticSubTab === 'weekly' ? '#bbf7d0' : '#fecaca'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ color: staticSubTab === 'weekly' ? '#166534' : '#991b1b', margin: 0 }}>
              {activeTab === 'confluence' ? '🎯 Confluence Match Stocks (Weekly + Monthly)' : activeTab === 'orbMomentum' ? '🚀 ORB Breakout & Relative Strength Stocks' : activeTab === 'watchlist' ? `⭐ Watchlist Stocks (${staticSubTab})` : `📅 ${staticSubTab === 'weekly' ? 'Weekly' : 'Monthly'} Fixed Levels`}
            </h3>
            <span style={{ background: staticSubTab === 'weekly' ? '#dcfce7' : '#fee2e2', color: staticSubTab === 'weekly' ? '#166534' : '#991b1b', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px' }}>
              Ref Date: {staticSubTab === 'weekly' ? weeklyDate : monthlyDate} | Total: {filteredData.length}
            </span>

          </div>

          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: staticSubTab === 'weekly' ? '#dcfce7' : '#fee2e2', color: staticSubTab === 'weekly' ? '#166534' : '#991b1b' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>⭐ / Symbol, Close & LTP</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Support & Resistance</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>🎯 Trade Direction & Gann Levels</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Action, Chart & Option Chain</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, idx) => {
                  const d = item[staticSubTab] || {};
                  const safe = getSafeValues(d.close);
                  const supportVal = d.support || safe.support;
                  const resistanceVal = d.resistance || safe.resistance;
                  const gann = d.gann || {};
                  const up = gann.up || {};
                  const down = gann.down || {};
                  const status = getMarketStatus(item.ltp, supportVal, resistanceVal);
                  const directionBox = getTradeDirectionBox(item.ltp, supportVal, resistanceVal);
                  const confluenceScore = getConfluenceScore(item);
                  const isFav = watchlist.includes(item.symbol);
                  const tvSymbol = item.symbol.includes('.') ? item.symbol : `NSE:${item.symbol}`;
                  const optionChainUrl = `https://www.nseindia.com/option-chain`;
                  const formattedClose = Number(d.close || 0).toFixed(2);
                  const mom = item.momentum || {};

                  return (
                    <tr key={idx} style={{ borderBottom: `1px solid ${staticSubTab === 'weekly' ? '#bbf7d0' : '#fecaca'}`, background: confluenceScore === 2 ? '#fefce8' : 'white' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button onClick={() => toggleWatchlist(item.symbol)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                            {isFav ? '⭐' : '☆'}
                          </button>
                          <span style={{ color: status.color, fontSize: '15px', fontWeight: 'bold' }}>{item.symbol}</span>
                          <span>{status.symbol}</span>
                        </div>
                        {confluenceScore === 2 && (
                          <div style={{ marginTop: '4px', display: 'inline-block', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            🔥 Confluence Match (2/2)
                          </div>
                        )}
                        {mom.orb_high && item.ltp >= mom.orb_high && (
                          <div style={{ marginTop: '4px', display: 'inline-block', background: '#16a34a', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            🚀 ORB Breakout (High: ₹{mom.orb_high})
                          </div>
                        )}
                        {mom.is_strong && (
                          <div style={{ marginTop: '4px', display: 'inline-block', background: '#0284c7', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                            ⚡ Relative Strength (+0.4%)
                          </div>
                        )}
                        <div style={{ color: '#64748b', marginTop: '3px', fontSize: '12px' }}>Close: ₹<b>{formattedClose}</b></div>
                        <div style={{ color: '#1e293b', marginTop: '1px', fontSize: '13px' }}>LTP: ₹<b>{item.ltp}</b></div>
                      </td>
                      <td style={{ padding: '10px', verticalAlign: 'top' }}>
                        <div style={{ color: '#166534' }}>Support: <b>₹{supportVal}</b></div>
                        <div style={{ color: '#991b1b', marginTop: '2px' }}>Resistance: <b>₹{resistanceVal}</b></div>
                      </td>
                      <td style={{ padding: '10px', verticalAlign: 'top', lineHeight: '1.6' }}>
                        <div style={{ padding: '5px 8px', background: directionBox.bg, color: directionBox.color, borderRadius: '6px', fontWeight: 'bold', display: 'inline-block', fontSize: '11px', border: `1px solid ${directionBox.color}`, marginBottom: '6px' }}>
                          {directionBox.text}
                        </div>
                        <div style={{ color: '#166534', fontSize: '11px' }}>
                          📈 <b>Up:</b> 45°: <b>₹{up.g45}</b> | 90°: <b>₹{up.g90}</b> | 180°: <b>₹{up.g180}</b> | 360°: <b>₹{up.g360}</b>
                        </div>
                        <div style={{ color: '#991b1b', marginTop: '2px', fontSize: '11px' }}>
                          📉 <b>Down:</b> 45°: <b>₹{down.g45}</b> | 90°: <b>₹{down.g90}</b> | 180°: <b>₹{down.g180}</b> | 360°: <b>₹{down.g360}</b>
                        </div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => addToLogbook(item, d, supportVal, resistanceVal)} style={{ padding: '5px 8px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📝 Log</button>
                          <button onClick={() => {
                            const text = `📅 Setup: ${item.symbol} (Close: ₹${formattedClose} | LTP: ₹${item.ltp})\n🟢 S: ₹{supportVal} | 🔴 R: ₹{resistanceVal}\n📈 Up 45°: ₹${up.g45} | 90°: ₹${up.g90}`;
                            navigator.clipboard.writeText(text);
                            alert(`📋 ${item.symbol} કૉપી થઈ ગયું છે!`);
                          }} style={{ padding: '5px 8px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>📋 Copy</button>
                          <a href={`https://in.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`} target="_blank" rel="noreferrer" style={{ padding: '5px 8px', background: '#0f172a', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>📊 Chart</a>
                          <a href={optionChainUrl} target="_blank" rel="noreferrer" style={{ padding: '5px 8px', background: '#d97706', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>🔗 Option Chain</a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default StaticPivotScanner;
