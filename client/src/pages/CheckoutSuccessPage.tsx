import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { loadStripe } from '@stripe/stripe-js';
import { useCart } from '../context/CartContext';
import { Button } from "@/components/ui/button";
import { Link } from 'wouter';
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle, Clock, AlertTriangle, ArrowRight, Mail, Truck, Package } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Load Stripe outside of component render
const LIVE_STRIPE_PUBLIC_KEY = "pk_live_51RDCwnP64GiuFqkM8fbIXVfWMaxtlM2zcxR12Il6TL0E5M6WIBJWYaUiDDJGHgtCLkeqc2E42D4menU4utdJlLCy00L224tHlT";
const stripePromise = loadStripe(LIVE_STRIPE_PUBLIC_KEY);

export default function CheckoutSuccessPage() {
  const [location] = useLocation();
  const { clearCart } = useCart();
  const [paymentStatus, setPaymentStatus] = useState<string>("succeeded");
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  
  useEffect(() => {
    // Clear the cart once on component mount
    clearCart();
    
    // Get the client secret from URL parameters
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    // Flag to track if component is mounted
    let isMounted = true;

    if (clientSecret) {
      // Load Stripe and retrieve payment intent
      stripePromise.then(stripe => {
        if (!stripe || !isMounted) return;
        
        stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
          // Only update state if component is still mounted
          if (paymentIntent && isMounted) {
            // Store payment status
            setPaymentStatus(paymentIntent.status || "succeeded");
            
            // Generate an order number based on the payment intent ID
            if (paymentIntent.id) {
              setOrderNumber(`PB${paymentIntent.id.substring(3, 9).toUpperCase()}`);
            }
            
            // Get customer email if available
            if (paymentIntent.receipt_email) {
              setCustomerEmail(paymentIntent.receipt_email);
            }
            
            // Log payment status
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
      });
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - run only once on mount

  // Render based on payment status
  let statusIcon;
  let statusTitle;
  let statusDescription;

  switch (paymentStatus) {
    case "succeeded":
      statusIcon = <CheckCircle className="h-12 w-12 text-green-600" />;
      statusTitle = "Thank You For Your Order!";
      statusDescription = "Your payment has been successfully processed. A receipt has been sent to your email.";
      break;
    case "processing":
      statusIcon = <Clock className="h-12 w-12 text-amber-500" />;
      statusTitle = "Your Payment is Processing";
      statusDescription = "We're waiting for confirmation from your bank. We'll email you once your payment is confirmed.";
      break;
    default:
      statusIcon = <AlertTriangle className="h-12 w-12 text-red-500" />;
      statusTitle = "There Was an Issue With Your Payment";
      statusDescription = "Your payment was not successful. Please try again or contact customer support.";
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-2xl mx-auto border-2 border-neutral-100">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-4">
            {statusIcon}
          </div>
          <CardTitle className="text-3xl font-display font-bold">{statusTitle}</CardTitle>
          <CardDescription className="text-lg">{statusDescription}</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {paymentStatus === "succeeded" && (
            <>
              {orderNumber && (
                <div className="bg-[#f8f7f4] p-4 rounded-lg text-center">
                  <h3 className="font-medium text-lg mb-1">Order Number</h3>
                  <p className="text-2xl font-bold text-[#3a5a40]">{orderNumber}</p>
                  <p className="text-sm text-neutral-500 mt-1">Please save this for your reference</p>
                </div>
              )}
              
              {customerEmail && (
                <div className="flex items-center justify-center gap-2 text-neutral-600">
                  <Mail className="h-4 w-4" />
                  <span>Order confirmation sent to: <span className="font-medium">{customerEmail}</span></span>
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">What Happens Next?</h3>
                
                <div className="grid gap-4">
                  <div className="flex gap-3">
                    <div className="bg-[#e9ede6] rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-[#3a5a40]" />
                    </div>
                    <div>
                      <p className="font-medium">Order Processing</p>
                      <p className="text-sm text-neutral-600">Your order will be prepared within 1-2 business days</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="bg-[#e9ede6] rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-4 w-4 text-[#3a5a40]" />
                    </div>
                    <div>
                      <p className="font-medium">Shipping</p>
                      <p className="text-sm text-neutral-600">You'll receive shipping confirmation with tracking details once your order is on its way</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="bg-[#e9ede6] rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-[#3a5a40]" />
                    </div>
                    <div>
                      <p className="font-medium">Customer Support</p>
                      <p className="text-sm text-neutral-600">If you have any questions, please contact us at dtaplin21@gmail.com</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {paymentStatus !== "succeeded" && paymentStatus !== "processing" && (
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-red-800">
                Please try again with a different payment method or contact us at dtaplin21@gmail.com for assistance.
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center pt-2">
          <Link href="/">
            <Button className="bg-[#3a5a40] hover:bg-[#588157]">
              Return to Homepage
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}