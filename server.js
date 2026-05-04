import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Razorpay configuration (use test keys for development)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "w6UfgNspOy1XoG87M6tRK0Sr";

const categories = [
  "Pizza",
  "Biryani",
  "Burgers",
  "South Indian",
  "Chinese",
  "Desserts",
  "Drinks",
];

const popularItems = [
  {
    name: "Paneer Tikka Pizza",
    category: "Pizza",
    description: "Cheesy pizza topped with spicy paneer and veggies.",
    price: 299,
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
    imageClass: "pizza",
  },
  {
    name: "Hyderabadi Biryani",
    category: "Biryani",
    description: "Aromatic rice layered with tender chicken and spices.",
    price: 349,
    imageUrl:
      "https://images.unsplash.com/photo-1563379091339-03246963d51a?auto=format&fit=crop&w=900&q=80",
    imageClass: "biryani",
  },
  {
    name: "Classic Burger",
    category: "Burgers",
    description: "Juicy patty with lettuce, cheese, and special sauce.",
    price: 179,
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
    imageClass: "burger",
  },
];

const moreItems = [
  {
    name: "Masala Dosa",
    category: "South Indian",
    description: "Crispy dosa served with sambar and coconut chutney.",
    price: 129,
    imageUrl:
      "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=900&q=80",
    imageClass: "dosa",
  },
  {
    name: "Veg Hakka Noodles",
    category: "Chinese",
    description: "Street-style noodles tossed with crunchy vegetables.",
    price: 159,
    imageUrl:
      "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=900&q=80",
    imageClass: "noodles",
  },
  {
    name: "Chocolate Brownie",
    category: "Desserts",
    description: "Warm brownie with a rich chocolate center.",
    price: 119,
    imageUrl:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80",
    imageClass: "brownie",
  },
  {
    name: "Cold Coffee",
    category: "Drinks",
    description: "Creamy chilled coffee topped with a light froth.",
    price: 99,
    imageUrl:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80",
    imageClass: "coffee",
  },
];

const users = [];
const sessions = new Map();
const orders = [];

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, savedPassword) => {
  if (!savedPassword || !savedPassword.includes(":")) {
    return false;
  }
  
  try {
    const [salt, savedHash] = savedPassword.split(":");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(savedHash));
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
};

const getPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = sessions.get(token);
    const user = users.find((currentUser) => currentUser.id === userId);

    if (!token || !user) {
      return res.status(401).json({ message: "Please login first." });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Authentication failed." });
  }
};

app.use(express.json());

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

app.get("/api/menu", (req, res) => {
  res.json({
    categories,
    popularItems,
    moreItems,
  });
});

app.post("/api/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userExists = users.some((user) => user.email === normalizedEmail);

  if (userExists) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password: hashPassword(password),
  };
  const token = crypto.randomUUID();

  users.push(user);
  sessions.set(token, user.id);

  return res.status(201).json({
    message: "Signup successful.",
    token,
    user: getPublicUser(user),
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  const user = users.find((currentUser) => currentUser.email === normalizedEmail);

  if (!user || !verifyPassword(password || "", user.password)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = crypto.randomUUID();
  sessions.set(token, user.id);

  return res.json({
    message: "Login successful.",
    token,
    user: getPublicUser(user),
  });
});

app.post("/api/logout", authenticate, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Logout successful." });
});

app.get("/api/orders", authenticate, (req, res) => {
  const userOrders = orders.filter((order) => order.userId === req.user.id);
  res.json(userOrders);
});

app.post("/api/orders", authenticate, (req, res) => {
  const { items, paymentMethod, paymentStatus } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Order must include items." });
  }

  if (!paymentMethod) {
    return res.status(400).json({ message: "Please choose a payment method." });
  }

  const total = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0
  );

  const order = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    items,
    total,
    paymentMethod,
    paymentStatus: paymentStatus || "pending",
    status: "Confirmed",
    createdAt: new Date().toISOString(),
  };

  orders.push(order);

  return res.status(201).json({
    message: "Order placed successfully.",
    order,
  });
});

app.post("/api/create-payment", authenticate, (req, res) => {
  const { amount, items, paymentMethod } = req.body;

  if (!amount || !items || items.length === 0) {
    return res.status(400).json({ message: "Invalid payment request." });
  }

  try {
    // Create a Razorpay order ID (for demo purposes, we'll generate a mock one)
    const orderId = `order_${crypto.randomUUID().slice(0, 12)}`;

    return res.status(200).json({
      orderId,
      razorpayKey: RAZORPAY_KEY_ID,
      amount,
      currency: "INR",
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    return res.status(500).json({ message: "Payment processing failed." });
  }
});

app.post("/api/verify-payment", authenticate, (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, items, paymentMethod } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id) {
    return res.status(400).json({ message: "Invalid payment details." });
  }

  try {
    // For demo: accept all payments (in production, verify signature)
    const total = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    const order = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      items,
      total,
      paymentMethod,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      status: "Confirmed",
      paymentStatus: "Completed",
      createdAt: new Date().toISOString(),
    };

    orders.push(order);

    return res.status(201).json({
      message: "Payment successful and order confirmed.",
      order,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ message: "Payment verification failed." });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ 
    message: err.message || "Internal server error" 
  });
});


