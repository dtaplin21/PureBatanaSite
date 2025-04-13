import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();
  
  // Clear the cart when the success page loads
  useEffect(() => {
    // Only clear the cart once when the component mounts
    const clearCartOnce = () => {
      clearCart();
    };
    clearCartOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-sm border border-neutral-100">
        <div className="flex justify-center">
          <CheckCircle className="text-[#3a5a40] w-16 h-16 mb-4" />
        </div>
        <h1 className="font-display font-bold text-2xl text-[#3a5a40] mb-4">Order Confirmed!</h1>
        <p className="text-neutral-600 mb-6">
          Thank you for your purchase. We've received your order and will process it right away.
          A detailed receipt has been sent to your email address with your order number and complete purchase information.
        </p>
        <div className="bg-[#f1f8e9] p-4 rounded-lg mb-6 text-left">
          <h3 className="font-medium text-[#3a5a40] mb-2">What's Next?</h3>
          <ul className="list-disc pl-5 text-sm space-y-1 text-neutral-700">
            <li>Check your email for your order confirmation</li>
            <li>Your order will be shipped within 1-2 business days</li>
            <li>You'll receive tracking information once your order ships</li>
          </ul>
        </div>
        <div className="space-y-4">
          <Link href="/orders">
            <Button variant="outline" className="w-full">
              View Your Orders
            </Button>
          </Link>
          <Link href="/">
            <Button className="w-full bg-[#3a5a40] hover:bg-[#588157]">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}