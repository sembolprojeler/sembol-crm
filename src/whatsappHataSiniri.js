// src/whatsappHataSiniri.js
// ============================================================================
// WhatsApp paneli HATA SINIRI (error boundary): panelde bir hata olursa tüm CRM düşmez,
// yalnızca panelin yerinde "Bir hata oluştu, sayfayı yenileyin" görünür. Hata konsola yazılır.
// JSX'siz (createElement) — node --test ile doğrudan denenebilsin diye.
// ============================================================================
import { Component, createElement as h } from 'react';

export const PANEL_HATA_METNI = 'Bir hata oluştu, sayfayı yenileyin';

export class WhatsAppHataSiniri extends Component {
  constructor(props) {
    super(props);
    this.state = { hata: null };
  }
  static getDerivedStateFromError(hata) { return { hata }; }
  componentDidCatch(hata, bilgi) { console.error('[WhatsApp paneli] hata:', hata, bilgi?.componentStack || ''); }
  render() {
    if (!this.state.hata) return this.props.children;
    return h('div', { role: 'alert', className: 'p-6 rounded-2xl border-2 border-red-300 bg-red-50 text-red-800 text-center' },
      h('p', { className: 'font-black text-base mb-1' }, PANEL_HATA_METNI),
      h('p', { className: 'text-xs font-bold text-red-700/80 mb-3 break-words' }, String(this.state.hata?.message || this.state.hata)),
      h('button', { type: 'button', onClick: () => window.location.reload(), className: 'px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-black' }, 'Sayfayı yenile'));
  }
}
