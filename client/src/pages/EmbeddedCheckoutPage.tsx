import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useCart } from '../context/CartContext';
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import StripeCheckoutForm from '../components/StripeCheckoutForm';
import { Link } from 'wouter';

// Load Stripe outside of component render to avoid recreating
// the Stripe object on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export default function EmbeddedCheckoutPage() {
  const { cart, cartTotal, cartCount, clearCart } = useCart();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Calculate shipping fee - if subtotal is $50 or more, shipping is free, otherwise $5.95
  const shippingFee = cartTotal >= 50 ? 0 : 5.95;
  const orderTotal = cartTotal + shippingFee;
  
  // Total quantity across all items in the cart
  const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    if (cartTotal === 0) {
      return;
    }
    
    // Format order items for the payment intent metadata
    const formattedItems = cart.map(item => ({
      id: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    }));

    // Create a payment intent as soon as the page loads
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount: orderTotal, 
        orderItems: formattedItems,
        quantity: totalQuantity 
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to create payment intent');
        }
        return res.json();
      })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error creating payment intent:', err);
        setError(err.message);
        setLoading(false);
        toast({
          title: "Error",
          description: "There was a problem setting up the payment. Please try again.",
          variant: "destructive",
        });
      });
  }, [cartTotal, orderTotal, cart, totalQuantity, toast]);

  const handlePaymentSuccess = () => {
    // This won't actually get called because of the redirect,
    // but including it for completeness
    clearCart();
  };

  // If the cart is empty, show a message
  if (cartTotal === 0) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-display font-bold mb-6">Your Cart is Empty</h1>
          <p className="mb-8 text-neutral-600">You haven't added any items to your cart yet.</p>
          <Link href="/">
            <Button className="bg-[#3a5a40] hover:bg-[#588157]">
              Return to Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-3xl font-display font-bold mb-8 text-center">Secure Checkout</h1>
      
      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/3">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-100 mb-6">
            <div className="p-6 border-b border-neutral-100">
              <h2 className="font-display font-semibold text-xl mb-4">Order Details</h2>
              
              {cart.map((item) => (
                <div key={item.product.id} className="flex py-4 border-b border-neutral-100 last:border-0">
                  <div className="w-20 h-20 rounded-md overflow-hidden mr-4 flex-shrink-0">
                    <img 
                      src={item.product.images[0]} 
                      alt={item.product.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium">{item.product.name}</h3>
                    <p className="text-sm text-neutral-500">${item.product.price.toFixed(2)} × {item.quantity}</p>
                  </div>
                  <div className="font-medium">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="lg:w-1/3">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-100 p-6">
            <h2 className="font-display font-semibold text-xl mb-4">Payment</h2>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-medium">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Shipping</span>
                <span className="font-medium">
                  {shippingFee === 0 ? "Free" : `$${shippingFee.toFixed(2)}`}
                </span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${orderTotal.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="bg-[#f8f7f4] p-3 rounded-md text-sm">
                <p className="flex items-center">
                  <i className="fas fa-shield-alt text-[#588157] mr-2"></i>
                  <span>Secure checkout with SSL encryption</span>
                </p>
              </div>
            </div>

            {/* Show loading state or Stripe Elements form */}
            {loading ? (
              <div className="text-center py-6">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-[#3a5a40] border-t-transparent rounded-full mb-4"></div>
                <p>Setting up secure payment...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
                <p>There was an error setting up the payment: {error}</p>
                <Button 
                  className="mt-4 bg-red-600 hover:bg-red-700"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <Elements stripe={stripePromise} options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#3a5a40',
                  },
                },
              }}>
                <StripeCheckoutForm 
                  amount={orderTotal} 
                  orderItems={cart.map(item => ({
                    id: item.product.id,
                    name: item.product.name,
                    price: item.product.price,
                    quantity: item.quantity
                  }))} 
                  quantity={totalQuantity}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            )}

            {/* External checkout option removed */}
          </div>
        </div>
      </div>
    </div>
  );
}