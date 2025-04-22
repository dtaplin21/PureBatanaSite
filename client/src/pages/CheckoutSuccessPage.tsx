import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useStripe } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import { Button } from "@/components/ui/button";
import { Link } from 'wouter';

export default function CheckoutSuccessPage() {
  const stripe = useStripe();
  const [location] = useLocation();
  const { clearCart } = useCart();
  
  useEffect(() => {
    // Clear the cart after a successful checkout
    clearCart();
    
    // Check the status of the payment if coming from the embedded checkout
    if (!stripe) {
      return;
    }

    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    if (clientSecret) {
      stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
        if (paymentIntent) {
          // We can show different messages based on the payment status
          switch (paymentIntent.status) {
            case "succeeded":
              console.log('Payment succeeded!');
              break;
            case "processing":
              console.log('Your payment is processing.');
              break;
            case "requires_payment_method":
              console.log('Your payment was not successful, please try again.');
              break;
            default:
              console.log('Something went wrong.');
              break;
          }
        }
      });
    }
  }, [stripe, location, clearCart]);

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-neutral-100 text-center">
        <div className="rounded-full w-20 h-20 bg-green-100 mx-auto mb-6 flex items-center justify-center">
          <i className="fas fa-check text-3xl text-green-600"></i>
        </div>
        
        <h1 className="text-3xl font-display font-bold mb-4">Thank You For Your Order!</h1>
        
        <p className="text-lg text-neutral-600 mb-6">
          Your payment has been successfully processed. You should receive an email confirmation shortly.
        </p>
        
        <div className="p-4 bg-[#f8f7f4] rounded-lg mb-8">
          <h3 className="font-medium mb-2">What Happens Next?</h3>
          <p className="text-neutral-600 mb-2">
            1. Your order will be processed within 1-2 business days.
          </p>
          <p className="text-neutral-600">
            2. You'll receive shipping confirmation once your order is on its way.
          </p>
        </div>
        
        <Link href="/">
          <Button className="bg-[#3a5a40] hover:bg-[#588157]">
            Return to Homepage
          </Button>
        </Link>
      </div>
    </div>
  );
}