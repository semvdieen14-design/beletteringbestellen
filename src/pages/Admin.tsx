import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Order {
  id: string;
  created_at: string;
  status: string;
  design_data: {
    order_number: string;
    total: number;
    customer: { name: string; email: string };
    items: { text: string; font: string; color: string; height_cm: number; quantity: number }[];
  };
}

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [selected, setSelected] = useState<Order | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingOrders(true);
    const { data, error } = await supabase.functions.invoke('admin-orders', {
      body: { password, action: 'list' },
    });
    setLoadingOrders(false);
    if (error || !data?.orders) {
      setPasswordError('Verkeerd wachtwoord');
      return;
    }
    setOrders(data.orders as Order[]);
    setLoggedIn(true);
  };

  const handleSend = async () => {
    if (!selected) return;
    setLoading(true);
    setResult(null);
    try {
      const { error } = await supabase.functions.invoke('send-shipping-email', {
        body: {
          to: selected.design_data.customer.email,
          customerName: selected.design_data.customer.name,
          orderNumber: selected.design_data.order_number,
          trackingCode: trackingCode || undefined,
        },
      });
      if (error) throw error;

      // Status bijwerken naar 'verzonden' via admin-orders (service_role, server-side)
      const { error: updateError } = await supabase.functions.invoke('admin-orders', {
        body: { password, action: 'mark-shipped', orderId: selected.id },
      });
      if (updateError) throw updateError;

      // Lijst bijwerken
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'verzonden' } : o));

      setResult({ success: true, message: `Verzendmail verstuurd naar ${selected.design_data.customer.email}` });
      setSelected(null);
      setTrackingCode('');
    } catch {
      setResult({ success: false, message: 'Er ging iets mis. Probeer opnieuw.' });
    }
    setLoading(false);
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="bg-primary inline-block p-2 rounded-xl mb-2">
              <span className="font-black text-lg italic text-white">BB</span>
            </div>
            <h1 className="text-xl font-black">Admin</h1>
            <p className="text-sm text-gray-500 mt-1">BeletteringBestellen.nl</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                placeholder="••••••••"
                autoFocus
              />
              {passwordError && <p className="text-red-500 text-sm mt-1">{passwordError}</p>}
            </div>
            <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition">
              Inloggen
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <span className="font-black text-lg italic text-white">BB</span>
            </div>
            <div>
              <h1 className="text-xl font-black">Bestellingen</h1>
              <p className="text-sm text-gray-500">Klik op een bestelling om te verzenden</p>
            </div>
          </div>
          <button onClick={() => setLoggedIn(false)} className="text-xs text-gray-400 hover:underline">
            Uitloggen
          </button>
        </div>

        {/* Resultaat melding */}
        {result && (
          <div className={`rounded-xl p-4 mb-4 font-medium ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {result.success ? '✓ ' : '✗ '}{result.message}
          </div>
        )}

        {/* Verzendformulier als order geselecteerd */}
        {selected && (
          <div className="bg-white rounded-2xl border-2 border-primary shadow-sm p-6 mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Geselecteerd</p>
                <p className="font-black text-lg">{selected.design_data.order_number}</p>
                <p className="text-sm text-gray-600">{selected.design_data.customer.name} — {selected.design_data.customer.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-xl">✕</button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm space-y-1">
              {selected.design_data.items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-bold">{item.quantity}×</span>
                  <span>"{item.text}"</span>
                  <span className="text-gray-400">· {item.font} · {item.height_cm}cm</span>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">
                Track &amp; Trace code <span className="text-gray-400 font-normal">(optioneel)</span>
              </label>
              <input
                type="text"
                value={trackingCode}
                onChange={e => setTrackingCode(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                placeholder="3SPOST123456789"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:opacity-90 transition disabled:opacity-50 text-base"
            >
              {loading ? 'Versturen...' : 'Bestelling verzonden — mail sturen'}
            </button>
          </div>
        )}

        {/* Bestellingen lijst */}
        <div className="space-y-3">
          {loadingOrders && (
            <div className="text-center py-12 text-gray-400">Bestellingen laden...</div>
          )}
          {!loadingOrders && orders.length === 0 && (
            <div className="text-center py-12 text-gray-400">Nog geen bestellingen</div>
          )}
          {orders.map(order => {
            const dd = order.design_data;
            if (!dd) return null;
            const date = new Date(order.created_at).toLocaleDateString('nl-NL', {
              day: 'numeric', month: 'short', year: 'numeric'
            });
            return (
              <button
                key={order.id}
                onClick={() => { setSelected(order); setResult(null); }}
                className={`w-full text-left bg-white rounded-2xl border-2 p-4 hover:border-primary transition ${selected?.id === order.id ? 'border-primary' : 'border-gray-100'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-black text-sm">{dd.order_number}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
                      order.status === 'verzonden' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'paid' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status === 'verzonden' ? 'Verzonden' :
                       order.status === 'paid' ? 'Betaald' : order.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">€{dd.total?.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{date}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1">{dd.customer?.name} — {dd.customer?.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {dd.items?.map(i => `${i.quantity}× "${i.text}"`).join(', ')}
                </p>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
