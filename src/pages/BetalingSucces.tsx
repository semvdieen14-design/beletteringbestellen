import { useEffect, useState } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
import { CheckCircle, Package, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface PendingOrder {
  orderId: string;
  orderNumber: string;
  email: string;
  customerName: string;
  items: Array<{
    text: string;
    font: string;
    color: string;
    height: number;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
  };
}

const BetalingSucces = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orderData, setOrderData] = useState<PendingOrder | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const pendingOrderStr = localStorage.getItem('pendingOrder');
    if (!pendingOrderStr) {
      setVerifying(false);
      return;
    }

    const pendingOrder: PendingOrder = JSON.parse(pendingOrderStr);
    setOrderData(pendingOrder);

    // Poll Supabase until webhook updates the status (max ~15 sec)
    let attempts = 0;
    const maxAttempts = 10;

    const checkStatus = async () => {
      attempts++;

      const { data } = await supabase.functions.invoke('order-status', {
        body: { orderId: pendingOrder.orderId },
      });

      const status = data?.status;

      if (status === 'paid') {
        localStorage.removeItem('pendingOrder');
        setVerifying(false);
        sendConfirmationEmail(pendingOrder);
        trackPurchase(pendingOrder);
      } else if (status === 'payment_failed' || status === 'cancelled') {
        localStorage.removeItem('pendingOrder');
        navigate('/betaling-mislukt');
      } else if (attempts < maxAttempts) {
        // Status nog pending, probeer opnieuw
        setTimeout(checkStatus, 1500);
      } else {
        // Na 15 sec nog steeds niet bevestigd — toon succes als fallback
        localStorage.removeItem('pendingOrder');
        setVerifying(false);
      }
    };

    checkStatus();
  }, []);

  const trackPurchase = (order: PendingOrder) => {
    if (typeof window.gtag !== 'function') return;
    if (localStorage.getItem('cookies-accepted') === 'functional') return;
    window.gtag('event', 'purchase', {
      transaction_id: order.orderNumber,
      value: order.total,
      shipping: order.shipping,
      currency: 'EUR',
      items: order.items.map((item, index) => ({
        item_id: `item_${index}`,
        item_name: item.text || 'Plakletters',
        item_category: 'Belettering',
        price: item.price,
        quantity: item.quantity,
      })),
    });
  };

  const sendConfirmationEmail = async (order: PendingOrder) => {
    try {
      const { error } = await supabase.functions.invoke('send-order-email', {
        body: {
          to: order.email,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          items: order.items,
          subtotal: order.subtotal,
          shipping: order.shipping,
          total: order.total,
          address: order.address,
        },
      });

      if (!error) {
        setEmailSent(true);
      } else {
        console.error('Error sending email:', error);
      }
    } catch (err) {
      console.error('Error sending email:', err);
    }
  };

  const orderNumber = searchParams.get('order') || orderData?.orderNumber;

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Betaling verifiëren...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Bedankt voor je bestelling!
        </h1>

        {orderNumber && (
          <div className="bg-muted rounded-xl p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Bestelnummer</p>
            <p className="text-xl font-bold text-primary">{orderNumber}</p>
          </div>
        )}

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 text-left bg-muted/50 rounded-lg p-4">
            <Mail className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Bevestiging verstuurd</p>
              <p className="text-sm text-muted-foreground">
                {orderData?.email ? `Naar ${orderData.email}` : 'Je ontvangt een e-mail met je bestelgegevens'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-left bg-muted/50 rounded-lg p-4">
            <Package className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Snelle verzending</p>
              <p className="text-sm text-muted-foreground">
                Je bestelling wordt zo snel mogelijk verwerkt en verzonden
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={() => navigate("/")} className="w-full" size="lg">
            Terug naar home
          </Button>
          <Button onClick={() => navigate("/mijn-account")} variant="outline" className="w-full" size="lg">
            Bekijk mijn bestellingen
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BetalingSucces;
