import React, { useState, useEffect } from 'react';
import { fullFnoList } from './watchlistData';

function BiasCalendar() {
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY');
  
  const [calendarDays, setCalendarDays] = useState(() => {
    const savedData = localStorage.getItem('cached_bias_calendar');
    return savedData ? JSON.parse(savedData) : [];
  });
  const [loading, setLoading] = useState(false);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://aura-proj.onrender.com/get-bias-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, symbol: selectedSymbol })
      });
      
      const data = await res.json();
      console.log("API Response:", data); // કન્સોલમાં ડેટા ચેક કરવા માટે

      if (Array.isArray(data)) {
        setCalendarDays(data);
        localStorage.setItem('cached_bias_calendar', JSON.stringify(data));
      } else {
        console.error("API did not return an array:", data);
        setCalendarDays([]);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      alert("ક્લાઉડ સર્વર સાથે કનેક્ટ થઈ શકતું નથી! કૃપા કરીને થોડીવાર પછી પ્રયાસ કરો.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [selectedMonth, selectedSymbol]);

  return (
    <div style={{ padding: '10px', backgroundColor: '#e4e4e7', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#18181b', margin: '0 0 5px 0', fontSize: '22px' }}>
          📅 Market Bias & Time-Window Calendar
        </h2>
        <p style={{ color: '#52525b', fontSize: '13px', margin: 0 }}>
          Month-wise calculated market trends with exact Intraday Up Time and Down Time windows.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: '#d4d4d8', padding: '15px 20px', borderRadius: '10px', border: '1px solid #a1a1aa', marginBottom: '25px', flexWrap: 'wrap' }}>
        
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#27272a', marginBottom: '5px' }}>Select Month:</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #a1a1aa', backgroundColor: '#fff', fontSize: '13px', boxSizing: 'border-box' }} 
          />
        </div>

        <div style={{ flex: '2', minWidth: '250px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#27272a', marginBottom: '5px' }}>Select Symbol / Index:</label>
          <select 
            value={selectedSymbol} 
            onChange={(e) => setSelectedSymbol(e.target.value)} 
            style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #a1a1aa', backgroundColor: '#fff', fontSize: '13px', boxSizing: 'border-box' }}>
            {fullFnoList.map((s, idx) => (
              <option key={idx} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ alignSelf: 'flex-end' }}>
          <button 
            onClick={fetchCalendarData} 
            disabled={loading}
            style={{ padding: '10px 20px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            {loading ? 'Loading...' : 'Force Load Calendar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {calendarDays.length > 0 ? (
          calendarDays.map((day, idx) => (
            <div key={idx} style={{ backgroundColor: '#f4f4f5', borderRadius: '12px', border: '1px solid #a1a1aa', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #d4d4d8', paddingBottom: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#18181b' }}>{day.date}</span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fcd34d' }}>
                  {day.trend}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: '#3f3f46', marginBottom: '10px', lineHeight: '1.5' }}>
                <div>🏛️ {day.rashi}</div>
                {day.gannInfo && <div style={{ color: '#0369a1', fontWeight: 'bold', marginTop: '3px' }}>{day.gannInfo}</div>}
                <div style={{ marginTop: '3px' }}>⚡ બજારનો માહોલ: <span style={{ color: '#52525b' }}>{day.mood}</span></div>
              </div>

              {day.highVol && (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center', border: '1px solid #f87171' }}>
                  ⚡ HIGH VOLATILITY DAY (મોટા ઉતાર-ચઢાવ)
                </div>
              )}

              <div style={{ backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #d4d4d8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#15803d' }}>
                  ▲ UP: <span style={{ fontWeight: 'normal', color: '#27272a' }}>{day.up}</span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#b91c1c' }}>
                  ▼ DOWN: <span style={{ fontWeight: 'normal', color: '#27272a' }}>{day.down}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center', color: '#52525b', gridColumn: 'span 3' }}>કોઈ ડેટા મળ્યો નથી. ઉપર "Force Load Calendar" બટન દબાવો.</p>
        )}
      </div>
    </div>
  );
}

export default BiasCalendar;