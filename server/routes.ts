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

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes - All prefixed with /api
  
  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const product = await storage.getProductBySlug(req.params.slug);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Error fetching product" });
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
      
      res.status(201).json({
        ...newOrder,
        items: orderItems
      });
    } catch (error) {
      res.status(500).json({ message: "Error creating order" });
    }
  });

  // Reviews
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
      
      const newMessage = await storage.createContactMessage(validation.data);
      res.status(201).json(newMessage);
    } catch (error) {
      res.status(500).json({ message: "Error submitting contact form" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
