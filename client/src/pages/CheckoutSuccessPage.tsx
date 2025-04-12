import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();
  
  // Clear the cart when the success page loads
  useEffect(() => {
    clearCart();
  }, [clearCart]);
  
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-sm border border-neutral-100">
        <div className="flex justify-center">
          <CheckCircle className="text-[#3a5a40] w-16 h-16 mb-4" />
        </div>
        <h1 className="font-display font-bold text-2xl text-[#3a5a40] mb-4">Order Confirmed!</h1>
        <p className="text-neutral-600 mb-6">
          Thank you for your purchase. We've received your order and will process it right away.
          You will receive a confirmation email shortly.
        </p>
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