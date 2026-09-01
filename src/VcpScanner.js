import React, { useState } from 'react';

function VcpScanner() {
  const [vcpData, setVcpData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [capital, setCapital] = useState(500000);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasScanned, setHasScanned] = useState(false); // સ્કેન થયા પછી જ સાચો મેસેજ દેખાડવા માટે

  const fetchVcpSignals = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('https://aura-proj.onrender.com/scan-vcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capital: Number(capital) })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setVcpData(json.data || []);
      } else {
        setErrorMsg('બેકએન્ડ સર્વર પરથી ડેટા મેળવવામાં સમસ્યા આવી છે.');
      }
    } catch (e) {
      console.log("VCP Scan Error:", e);
      setErrorMsg('સર્વર કનેક્ટ થઈ શક્યું નથી. કૃપા કરીને થોડીવાર પછી પ્રયત્ન કરો.');
    }
    setLoading(false);
    setHasScanned(true);
  };

  return (
    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: 0 }}>🎯 Hybrid Confluence VCP & Risk Scanner</h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>Uptrend, Support Confluence, VCP Contraction અને 1% Risk Position Sizing.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>Capital (₹):</label>
          <input 
            type="number" 
            value={capital} 
            onChange={(e) => setCapital(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '120px', fontWeight: 'bold' }}
          />
          <button 
            onClick={fetchVcpSignals} 
            disabled={loading}
            style={{ padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? '⏳ Scanning All F&O...' : '🚀 Run VCP Scan'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold', fontSize: '13px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#7c3aed', color: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ padding: '12px' }}>Symbol</th>
              <th style={{ padding: '12px' }}>Signal</th>
              <th style={{ padding: '12px' }}>Entry Price (₹)</th>
              <th style={{ padding: '12px' }}>Stop Loss (₹)</th>
              <th style={{ padding: '12px' }}>Target (1:2.5) (₹)</th>
              <th style={{ padding: '12px' }}>Risk / Share (₹)</th>
              <th style={{ padding: '12px' }}>Position Size</th>
              <th style={{ padding: '12px' }}>Capital Deployed (₹)</th>
              <th style={{ padding: '12px' }}>Max Loss (1%)</th>
            </tr>
          </thead>
          <tbody>
            {vcpData.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  {loading ? (
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#7c3aed', marginBottom: '5px' }}>🚀 બધા જ F&O સ્ટોક્સ મલ્ટિથ્રેડિંગ દ્વારા સ્કેન થઈ રહ્યા છે...</div>
                      <div style={{ fontSize: '12px' }}>કૃપા કરીને 5 થી 10 સેકન્ડ રાહ જુઓ.</div>
                    </div>
                  ) : !hasScanned ? (
                    '👆 ઉપર આપેલું "🚀 Run VCP Scan" બટન દબાવો જેથી માર્કેટ સ્કેન શરૂ થાય.'
                  ) : (
                    'આજે કોઈ સ્ટોક પર VCP Confluence સિગ્નલ મળ્યું નથી.'
                  )}
                </td>
              </tr>
            ) : (
              vcpData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#1e293b' }}>{item['Symbol']}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '3px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                      🟢 BUY SIGNAL
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>₹{item['Entry Price (₹)']}</td>
                  <td style={{ padding: '12px', color: '#991b1b', fontWeight: 'bold' }}>₹{item['Stop Loss (₹)']}</td>
                  <td style={{ padding: '12px', color: '#166534', fontWeight: 'bold' }}>₹{item['Target (1:2.5) (₹)']}</td>
                  <td style={{ padding: '12px' }}>₹{item['Risk Per Share (₹)']}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#0284c7' }}>{item['Position Size (Shares)']} Shares</td>
                  <td style={{ padding: '12px' }}>₹{item['Capital Deployed (₹)']}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#b91c1c' }}>₹{item['Max Loss (1% Account Risk)']}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default VcpScanner;
