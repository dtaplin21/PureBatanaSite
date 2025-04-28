import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import { 
  insertProductSchema, 
  insertUserSchema, 
  insertOrderSchema, 
  insertOrderItemSchema, 
  insertCartItemSchema, 
  insertReviewSchema, 
  insertSubscriberSchema, 
  insertContactMessageSchema 
} from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";

// Initialize Stripe with secret key
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes - All prefixed with /api
  
  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      
      // Enhance products with review counts
      const productsWithReviews = await Promise.all(
        products.map(async (product) => {
          const reviews = await storage.getProductReviews(product.id);
          return {
            ...product,
            reviewCount: reviews.length
          };
        })
      );
      
      res.json(productsWithReviews);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const product = await storage.getProductBySlug(req.params.slug);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Increment the view count
      await storage.incrementProductViewCount(product.id);
      
      // Get the updated product with incremented view count
      const updatedProduct = await storage.getProduct(product.id);
      
      // Get the review count for this product
      const reviews = await storage.getProductReviews(product.id);
      
      // Return product with additional metadata
      res.json({
        ...updatedProduct,
        reviewCount: reviews.length
      });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Error fetching product" });
    }
  });
  
  // Update product (for admin use)
  app.patch("/api/products/:id", express.json(), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // We're only allowing price updates through this endpoint for security
      const { price } = req.body;
      
      if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ message: "Invalid price. Price must be a non-negative number." });
      }
      
      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Update only the price
      const updatedProduct = await storage.updateProduct(id, { price });
      
      if (!updatedProduct) {
        return res.status(500).json({ message: "Failed to update product" });
      }
      
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Error updating product" });
    }
  });

  // Cart Items
  app.get("/api/cart/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const cartItems = await storage.getCartItems(userId);
      
      // Fetch product details for each cart item
      const cartWithProducts = await Promise.all(
        cartItems.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          return {
            ...item,
            product
          };
        })
      );
      
      res.json(cartWithProducts);
    } catch (error) {
      res.status(500).json({ message: "Error fetching cart items" });
    }
  });

  app.post("/api/cart", express.json(), async (req, res) => {
    try {
      const validation = insertCartItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid cart item data", errors: validation.error });
      }
      
      const { userId, productId, quantity } = validation.data;
      
      // Check if product exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Check if user already has this product in cart
      const existingCartItem = await storage.getCartItemByUserAndProduct(userId, productId);
      
      if (existingCartItem) {
        // Update quantity
        const updatedItem = await storage.updateCartItemQuantity(
          existingCartItem.id,
          existingCartItem.quantity + quantity
        );
        return res.status(200).json(updatedItem);
      } else {
        // Create new cart item
        const newCartItem = await storage.createCartItem(validation.data);
        res.status(201).json(newCartItem);
      }
    } catch (error) {
      res.status(500).json({ message: "Error adding item to cart" });
    }
  });

  app.put("/api/cart/:id", express.json(), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity } = req.body;
      
      if (typeof quantity !== 'number' || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }
      
      const updatedItem = await storage.updateCartItemQuantity(id, quantity);
      
      if (!updatedItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      
      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Error updating cart item" });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCartItem(id);
      
      if (!success) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Error removing item from cart" });
    }
  });

  // Clear cart
  app.delete("/api/cart/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      await storage.clearCart(userId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Error clearing cart" });
    }
  });

  // Users (simplified for demo - in a real app would include authentication)
  app.post("/api/users/register", express.json(), async (req, res) => {
    try {
      const validation = insertUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid user data", errors: validation.error });
      }
      
      // Check if username or email already exists
      const existingUserByUsername = await storage.getUserByUsername(validation.data.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(validation.data.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Create user
      const newUser = await storage.createUser(validation.data);
      
      // Don't return password in response
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error creating user" });
    }
  });

  app.post("/api/users/login", express.json(), async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) { // In a real app, you'd use proper password hashing
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Don't return password in response
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error during login" });
    }
  });

  // Orders
  app.get("/api/orders/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const orders = await storage.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Error fetching orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Get order items
      const orderItems = await storage.getOrderItems(id);
      
      res.json({
        ...order,
        items: orderItems
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching order" });
    }
  });

  app.post("/api/orders", express.json(), async (req, res) => {
    try {
      const orderData = insertOrderSchema.safeParse(req.body.order);
      if (!orderData.success) {
        return res.status(400).json({ message: "Invalid order data", errors: orderData.error });
      }
      
      const orderItemsData = z.array(insertOrderItemSchema).safeParse(req.body.orderItems);
      if (!orderItemsData.success) {
        return res.status(400).json({ message: "Invalid order items data", errors: orderItemsData.error });
      }
      
      // Create order
      const newOrder = await storage.createOrder(orderData.data);
      
      // Create order items
      const orderItemsPromises = orderItemsData.data.map(item => 
        storage.createOrderItem({
          ...item,
          orderId: newOrder.id
        })
      );
      
      const orderItems = await Promise.all(orderItemsPromises);
      
      // Clear user's cart
      await storage.clearCart(orderData.data.userId);
      
      // Send order confirmation email
      try {
        const { sendOrderConfirmationEmail } = await import('./email');
        
        // Get product details for each order item
        const orderItemsWithDetails = await Promise.all(
          orderItems.map(async (item) => {
            const product = await storage.getProduct(item.productId);
            return {
              name: product?.name || `Product #${item.productId}`,
              quantity: item.quantity,
              price: item.price
            };
          })
        );
        
        // Calculate totals
        const subtotal = orderItemsWithDetails.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0);
        const shipping = subtotal >= 50 ? 0 : 5.95;
        const total = subtotal + shipping;
        
        // Generate a formatted order number
        const orderNumber = `PB${newOrder.id.toString().padStart(5, '0')}`;
        
        // Send the confirmation email
        await sendOrderConfirmationEmail({
          orderNumber,
          customerName: orderData.data.name,
          customerEmail: orderData.data.email,
          items: orderItemsWithDetails,
          subtotal,
          shipping,
          total,
          shippingAddress: orderData.data.shippingAddress || "",
          dateCreated: newOrder.createdAt || new Date()
        });
        
      } catch (emailError) {
        // Log the error but don't fail the order creation
        console.error('Error sending order confirmation email:', emailError);
      }
      
      res.status(201).json({
        ...newOrder,
        items: orderItems
      });
    } catch (error) {
      res.status(500).json({ message: "Error creating order" });
    }
  });

  // Reviews
  app.get("/api/reviews", async (req, res) => {
    try {
      // Get all reviews (will add pagination in a real app)
      const allReviews = await storage.getAllReviews();
      res.json(allReviews);
    } catch (error) {
      res.status(500).json({ message: "Error fetching reviews" });
    }
  });

  app.get("/api/reviews/product/:productId", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Error fetching reviews" });
    }
  });

  app.post("/api/reviews", express.json(), async (req, res) => {
    try {
      const validation = insertReviewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid review data", errors: validation.error });
      }
      
      const newReview = await storage.createReview(validation.data);
      res.status(201).json(newReview);
    } catch (error) {
      res.status(500).json({ message: "Error creating review" });
    }
  });

  // Newsletter
  app.post("/api/newsletter/subscribe", express.json(), async (req, res) => {
    try {
      const validation = insertSubscriberSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid email", errors: validation.error });
      }
      
      // Check if email already subscribed
      const existingSubscriber = await storage.getSubscriberByEmail(validation.data.email);
      if (existingSubscriber) {
        return res.status(409).json({ message: "Email already subscribed" });
      }
      
      const newSubscriber = await storage.createSubscriber(validation.data);
      res.status(201).json(newSubscriber);
    } catch (error) {
      res.status(500).json({ message: "Error subscribing to newsletter" });
    }
  });

  // Contact
  app.post("/api/contact", express.json(), async (req, res) => {
    try {
      const validation = insertContactMessageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid contact form data", errors: validation.error });
      }
      
      // First save to the database
      const newMessage = await storage.createContactMessage(validation.data);
      
      // Then send email using SendGrid
      const { sendEmail } = await import('./email');
      
      // Format the email content
      const emailText = `
Name: ${validation.data.name}
Email: ${validation.data.email}
Subject: ${validation.data.subject}
Message: ${validation.data.message}
      `;
      
      const emailHtml = `
<h2>New Contact Form Submission</h2>
<p><strong>Name:</strong> ${validation.data.name}</p>
<p><strong>Email:</strong> ${validation.data.email}</p>
<p><strong>Subject:</strong> ${validation.data.subject}</p>
<p><strong>Message:</strong></p>
<p>${validation.data.message.replace(/\n/g, '<br>')}</p>
      `;
      
      // Send the email to dtaplin21@aol.com
      await sendEmail({
        to: 'dtaplin21@aol.com',
        from: 'noreply@replit.com', // Using Replit's domain which should be pre-verified
        subject: `Pure Batana Contact: ${validation.data.subject}`,
        text: emailText,
        html: emailHtml,
        replyTo: validation.data.email // Set reply-to as the submitter's email
      });
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ message: "Error submitting contact form" });
    }
  });

  // Test SMS notification (for admin use only)
  app.get("/api/test-sms-notification", async (req, res) => {
    try {
      // Import the notification function
      const { sendSaleNotificationSms } = await import('./notification');
      
      // Send a test SMS
      const success = await sendSaleNotificationSms(
        'TEST-ORDER',
        'Test Customer',
        99.99
      );
      
      if (success) {
        res.json({ message: "Test SMS notification sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send test SMS notification" });
      }
    } catch (error) {
      console.error('Error sending test SMS:', error);
      res.status(500).json({ message: "Error sending test SMS" });
    }
  });

  // Stripe payments
  app.post("/api/create-payment-intent", express.json(), async (req, res) => {
    try {
      const { amount, orderItems, quantity = 1 } = req.body;
      
      // Create a payment intent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        description: "Pure Batana Oil",
        metadata: {
          orderItems: JSON.stringify(orderItems),
          quantity: quantity.toString()
        }
      });

      // Send the client secret to the client
      res.status(200).json({
        clientSecret: paymentIntent.client_secret
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ 
        error: error.message 
      });
    }
  });

  // Webhook for payment completion
  app.post("/api/webhook", express.raw({type: 'application/json'}), async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'] as string;
      
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).send('Webhook secret is not set');
      }

      let event: Stripe.Event;
      
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
      
      // Handle the event
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);
        
        try {
          // Extract customer information from payment intent
          const customerEmail = paymentIntent.receipt_email || '';
          const customerName = paymentIntent.shipping?.name || 'Customer';
          const shippingAddress = paymentIntent.shipping?.address ? 
            `${paymentIntent.shipping.address.line1}, 
             ${paymentIntent.shipping.address.line2 || ''} 
             ${paymentIntent.shipping.address.city}, 
             ${paymentIntent.shipping.address.state} 
             ${paymentIntent.shipping.address.postal_code}, 
             ${paymentIntent.shipping.address.country}`.replace(/\s+/g, ' ').trim() : 
            'No address provided';
          
          // Extract order items from metadata
          let orderItems = [];
          let quantity = 1; // Default quantity
          
          if (paymentIntent.metadata && paymentIntent.metadata.quantity) {
            quantity = parseInt(paymentIntent.metadata.quantity) || 1;
          }
          
          // Create a standardized order item
          orderItems.push({
            name: "Pure Batana Oil",
            quantity: quantity,
            price: paymentIntent.amount / 100 / quantity // Convert from cents and divide by quantity
          });
          
          // Calculate order totals
          const subtotal = orderItems.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0);
          const shipping = subtotal >= 50 ? 0 : 5.95;
          const total = paymentIntent.amount / 100; // Convert from cents
          
          // Generate a formatted order number
          const orderNumber = `PB${paymentIntent.id.substring(3, 9).toUpperCase()}`;
          
          // Create order data object
          const orderData = {
            orderNumber,
            customerName,
            customerEmail,
            items: orderItems,
            subtotal,
            shipping,
            total,
            shippingAddress,
            dateCreated: new Date(paymentIntent.created * 1000) // Convert Unix timestamp to Date
          };
          
          // Send order confirmation email to customer
          const { sendOrderConfirmationEmail, sendAdminOrderNotification } = await import('./email');
          if (customerEmail) {
            await sendOrderConfirmationEmail(orderData);
          }
          
          // Send order notification to admin (your email)
          await sendAdminOrderNotification(orderData);
          
          // Send SMS notification via email-to-SMS gateway
          try {
            const { sendSaleNotificationSms } = await import('./notification');
            await sendSaleNotificationSms(
              orderNumber,
              customerName,
              total
            );
          } catch (smsError) {
            console.error('Error sending SMS notification:', smsError);
          }
          
          // If we have order data in our system, update it
          try {
            const orders = await storage.getOrders();
            const matchingOrder = orders.find(order => 
              Math.round(order.total * 100) === paymentIntent.amount &&
              order.status === 'pending'
            );
            
            if (matchingOrder) {
              // Update order status to 'paid'
              await storage.updateOrderStatus(matchingOrder.id, 'paid');
            }
          } catch (storageError) {
            console.error('Error updating order in storage:', storageError);
          }
        } catch (error) {
          console.error('Error processing payment success:', error);
        }
      }
      
      res.json({received: true});
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API - Test SMS notifications
  app.post("/api/notifications/test-sms", express.json(), async (req, res) => {
    try {
      const { sendSaleNotificationSms } = await import('./notification');
      
      // Send a test SMS
      const success = await sendSaleNotificationSms(
        "TEST123", 
        "Test Customer", 
        29.99
      );
      
      if (success) {
        res.json({ 
          success: true, 
          message: "Test SMS notification sent successfully!" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send test SMS notification" 
        });
      }
    } catch (error) {
      console.error('Error sending test SMS notification:', error);
      res.status(500).json({ 
        success: false, 
        message: "Error sending test SMS notification" 
      });
    }
  });

  // API - Update SMS notification settings
  app.post("/api/notifications/sms-settings", express.json(), async (req, res) => {
    try {
      const { phoneNumber, carrier } = req.body;
      
      if (!phoneNumber || !carrier) {
        return res.status(400).json({ 
          message: "Phone number and carrier are required" 
        });
      }
      
      const { updateSmsSettings } = await import('./notification');
      updateSmsSettings(phoneNumber, carrier);
      
      res.json({ 
        success: true, 
        message: "SMS notification settings updated" 
      });
    } catch (error) {
      console.error('Error updating SMS settings:', error);
      res.status(500).json({ message: "Error updating SMS settings" });
    }
  });

  // Admin API - Get Stripe Orders
  app.get("/api/stripe/orders", async (req, res) => {
    try {
      // Fetch payment intents from Stripe
      const paymentIntents = await stripe.paymentIntents.list({
        limit: 100, // Get the last 100 payments
        expand: ['data.customer'] // Include customer info
      });

      // Transform payment intents into more user-friendly order objects
      const orders = paymentIntents.data.map(pi => {
        // Extract useful metadata from the payment intent
        let items = [];
        let description = pi.description || "Pure Batana Oil";
        let quantity = 1;
        
        // Parse quantity from metadata if available
        if (pi.metadata && pi.metadata.quantity) {
          quantity = parseInt(pi.metadata.quantity) || 1;
        }
        
        // Create a standardized item object
        items.push({
          description,
          quantity,
          amount: pi.amount / quantity // Divide by quantity to get per-item price
        });
        
        // Extract customer information safely
        const customerInfo: {
          id: string;
          email: string;
          name: string;
          phone: string | null;
          address: any;
        } = {
          id: 'anonymous',
          email: pi.receipt_email || 'No email',
          name: 'Anonymous',
          phone: null,
          address: null
        };
        
        // If customer object exists and is not a string, extract properties
        if (pi.customer && typeof pi.customer === 'object') {
          // Check if it's a Customer (not deleted) by seeing if it has an id property
          if ('id' in pi.customer) {
            customerInfo.id = pi.customer.id || customerInfo.id;
            
            // Check if other properties exist (handle both Customer and possible DeletedCustomer)
            if ('email' in pi.customer && pi.customer.email) {
              customerInfo.email = pi.customer.email;
            }
            
            if ('name' in pi.customer && pi.customer.name) {
              customerInfo.name = pi.customer.name;
            }
            
            if ('phone' in pi.customer && pi.customer.phone) {
              customerInfo.phone = pi.customer.phone;
            }
            
            if ('address' in pi.customer && pi.customer.address) {
              customerInfo.address = pi.customer.address;
            }
          }
        }
        
        return {
          id: pi.id,
          created: pi.created,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          customer: customerInfo,
          shipping: pi.shipping,
          items: items
        };
      });

      res.json({ orders });
    } catch (error) {
      console.error('Error fetching Stripe orders:', error);
      res.status(500).json({ message: "Error fetching Stripe orders" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
