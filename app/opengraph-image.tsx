import { ImageResponse } from 'next/og';

export const alt = 'BidGuard – statybos sąmatų ir tiekėjų pasiūlymų valdymas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 56%, #ffffff 100%)',
          color: '#0f172a',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 58, height: 58, borderRadius: 14, background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 700 }}>✓</div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-1px' }}>BidGuard</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 980 }}>
          <div style={{ fontSize: 64, lineHeight: 1.06, fontWeight: 700, letterSpacing: '-3px' }}>Sąmata, darbų apimtis ir tiekėjų pasiūlymai — vienoje vietoje.</div>
          <div style={{ fontSize: 27, lineHeight: 1.4, color: '#475569' }}>Statybos projektų komandoms · Excel ir PDF · Kontroliuojama apimtis</div>
        </div>
      </div>
    ),
    size
  );
}
