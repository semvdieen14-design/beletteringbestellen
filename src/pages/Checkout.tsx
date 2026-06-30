import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice } from '@/lib/pricing';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CreditCard, Building2, Check, ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type PaymentMethod = 'ideal' | 'bancontact' | 'creditcard';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ideal');
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: '',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    phone: '',
  });

  // Pre-fill email if user is logged in
  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user]);

  const shippingCost = totalPrice >= 75 ? 0 : 4.95;
  const grandTotal = totalPrice + shippingCost;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BB-${dateStr}-${random}`;
  };

  const saveOrderToDatabase = async (orderNumber: string) => {
    const orderId = crypto.randomUUID();
    const orderData = {
      id: orderId,
      user_id: user?.id || null,
      product_name: items.map(i => i.text).join(', '),
      width_cm: items[0]?.dimensions?.widthCm || 0,
      height_cm: items[0]?.heightCm || 0,
      price: grandTotal,
      status: 'pending',
      design_data: {
        order_number: orderNumber,
        items: items.map(item => ({
          text: item.text,
          font: item.font?.name,
          color: item.color?.hex,
          color_name: item.color?.name,
          height_cm: item.heightCm,
          quantity: item.quantity,
          price: item.priceCalculation?.total || 0,
        })),
        customer: {
          email: formData.email,
          name: `${formData.firstName} ${formData.lastName}`,
          company: formData.company,
          phone: formData.phone,
          address: {
            street: formData.street,
            houseNumber: formData.houseNumber,
            postalCode: formData.postalCode,
            city: formData.city,
          }
        },
        subtotal: totalPrice,
        shipping_cost: shippingCost,
        total: grandTotal,
        payment_method: paymentMethod,
      },
    };

    // Geen .select() na insert: anon heeft (terecht) geen leesrecht op orders.
    // We genereren de id zelf, dus teruglezen is niet nodig.
    const { error } = await supabase
      .from('orders')
      .insert(orderData);

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }

    return orderId;
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Generate order number
      const orderNumber = generateOrderNumber();

      // Save order to database first
      const orderId = await saveOrderToDatabase(orderNumber);

      // Store order info in localStorage for the success page
      localStorage.setItem('pendingOrder', JSON.stringify({
        orderId,
        orderNumber,
        email: formData.email,
        customerName: `${formData.firstName} ${formData.lastName}`,
        items: items.map(item => ({
          text: item.text,
          font: item.font?.name || 'Logo',
          color: item.color?.name || 'Full color',
          height: item.heightCm,
          quantity: item.quantity,
          price: item.priceCalculation?.total || 0,
        })),
        subtotal: totalPrice,
        shipping: shippingCost,
        total: grandTotal,
        address: {
          street: formData.street,
          houseNumber: formData.houseNumber,
          postalCode: formData.postalCode,
          city: formData.city,
        },
      }));

      // Map payment method to Mollie method
      const mollieMethod = paymentMethod === 'creditcard' ? 'creditcard' : paymentMethod;

      // Get the base URL for redirects
      const baseUrl = window.location.origin;

      // Create Mollie payment
      const { data, error } = await supabase.functions.invoke('create-mollie-payment', {
        body: {
          amount: grandTotal,
          description: `Bestelling ${orderNumber} - BeletteringBestellen.nl`,
          redirectUrl: `${baseUrl}/betaling-succes?order=${orderNumber}`,
          webhookUrl: `https://ezpdvawqpymxlupblypw.supabase.co/functions/v1/mollie-webhook`,
          metadata: {
            order_id: orderId,
            order_number: orderNumber,
            customer_email: formData.email,
          },
          method: mollieMethod,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Betaling aanmaken mislukt');
      }

      // Clear cart before redirect
      clearCart();

      // Redirect to Mollie checkout
      window.location.href = data.checkoutUrl;

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        variant: 'destructive',
        title: 'Er ging iets mis',
        description: error instanceof Error ? error.message : 'Probeer het opnieuw of neem contact met ons op.',
      });
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Je winkelwagen is leeg</h1>
          <p className="text-muted-foreground mb-6">Voeg eerst items toe aan je winkelwagen</p>
          <Button onClick={() => navigate('/')}>
            Terug naar de shop
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>Bestellen | BeletteringBestellen.nl</title>
        <meta name="description" content="Rond je bestelling af. Veilig betalen met iDEAL, Bancontact of creditcard." />
        <meta name="robots" content="noindex" />
      </Helmet>
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="section-container py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Afrekenen</h1>
              <p className="text-sm text-muted-foreground">
                Stap {step === 'details' ? '1' : '2'} van 2
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="section-container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            {step === 'details' ? (
              <form onSubmit={handleSubmitDetails} className="card-elevated space-y-6">
                <h2 className="text-xl font-bold text-foreground">Jouw gegevens</h2>

                {user && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm text-primary font-medium">
                      Je bent ingelogd als {user.email}. Je bestelling wordt gekoppeld aan je account.
                    </p>
                  </div>
                )}

                {/* Contact */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Contact</h3>
                  <div>
                    <Label htmlFor="email">E-mailadres *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="jouw@email.nl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefoonnummer</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="06 12345678"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Verzendadres</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">Voornaam *</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        required
                        value={formData.firstName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Achternaam *</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        required
                        value={formData.lastName}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="company">Bedrijfsnaam (optioneel)</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="street">Straat *</Label>
                      <Input
                        id="street"
                        name="street"
                        required
                        value={formData.street}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <Label htmlFor="houseNumber">Huisnr. *</Label>
                      <Input
                        id="houseNumber"
                        name="houseNumber"
                        required
                        value={formData.houseNumber}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="postalCode">Postcode *</Label>
                      <Input
                        id="postalCode"
                        name="postalCode"
                        required
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        placeholder="1234 AB"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="city">Plaats *</Label>
                      <Input
                        id="city"
                        name="city"
                        required
                        value={formData.city}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full btn-hero" size="lg">
                  Naar betaling
                </Button>
              </form>
            ) : (
              <div className="card-elevated space-y-6">
                <h2 className="text-xl font-bold text-foreground">Betaalmethode</h2>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ideal')}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'ideal'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="w-12 h-8 bg-white rounded flex items-center justify-center border border-border">
                      <span className="font-bold text-sm text-pink-500">iDEAL</span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">iDEAL</p>
                      <p className="text-sm text-muted-foreground">Direct betalen via je bank</p>
                    </div>
                    {paymentMethod === 'ideal' && (
                      <Check className="w-5 h-5 text-primary ml-auto" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bancontact')}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'bancontact'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="w-12 h-8 bg-white rounded flex items-center justify-center border border-border">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Bancontact</p>
                      <p className="text-sm text-muted-foreground">Voor Belgische banken</p>
                    </div>
                    {paymentMethod === 'bancontact' && (
                      <Check className="w-5 h-5 text-primary ml-auto" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('creditcard')}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'creditcard'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="w-12 h-8 bg-white rounded flex items-center justify-center border border-border">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Creditcard</p>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard, American Express</p>
                    </div>
                    {paymentMethod === 'creditcard' && (
                      <Check className="w-5 h-5 text-primary ml-auto" />
                    )}
                  </button>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Je wordt doorgestuurd naar een beveiligde betaalpagina van Mollie.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('details')}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    Terug
                  </Button>
                  <Button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="flex-1 btn-hero"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verwerken...
                      </>
                    ) : (
                      `Betaal ${formatPrice(grandTotal)}`
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card-elevated sticky top-24 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Overzicht</h2>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {item.logoImage ? (
                        <img src={item.logoImage} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span
                          className="text-xs font-medium break-words text-center p-1"
                          style={{
                            fontFamily: item.font.fontFamily,
                            color: item.color.hex,
                            textShadow: item.color.id === 'white' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                          }}
                        >
                          {item.text.substring(0, 10)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{item.text}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.logoImage ? 'Logo' : item.font.name} · {item.heightCm}cm × {item.quantity}
                      </p>
                    </div>
                    <span className="font-medium">{formatPrice(item.priceCalculation.total)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Verzending</span>
                  <span>{shippingCost === 0 ? 'Gratis' : formatPrice(shippingCost)}</span>
                </div>
                {shippingCost > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Gratis verzending vanaf €75
                  </p>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">Totaal</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(grandTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Incl. 21% BTW</p>
              </div>

              {/* Veilig betalen badge */}
              <div className="flex items-center justify-center gap-2 bg-muted/50 rounded-xl px-4 py-3 mt-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success shrink-0">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-xs text-muted-foreground">Veilig betalen via <strong className="text-foreground">iDEAL, Bancontact of creditcard</strong> — beveiligd met SSL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
