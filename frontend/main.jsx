import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const formatPrice = (price) => `Rs. ${price}`;

const getSavedAuth = () => {
  const token = localStorage.getItem("foodStoreToken");
  const user = localStorage.getItem("foodStoreUser");

  return {
    token,
    user: user ? JSON.parse(user) : null,
  };
};

function App() {
  const savedAuth = getSavedAuth();
  const [categories, setCategories] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [moreItems, setMoreItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [recentItem, setRecentItem] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [token, setToken] = useState(savedAuth.token);
  const [user, setUser] = useState(savedAuth.user);

  const cartCount = cart.reduce((total, cartItem) => total + cartItem.quantity, 0);
  const cartTotal = cart.reduce(
    (total, cartItem) => total + cartItem.price * cartItem.quantity,
    0
  );
  const getCartItem = (itemName) =>
    cart.find((cartItem) => cartItem.name === itemName);
  const allItems = [...popularItems, ...moreItems];
  const selectedCategoryItems = selectedCategory
    ? allItems.filter((item) => item.category === selectedCategory)
    : [];

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const response = await fetch("/api/menu");

        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }

        const text = await response.text();
        if (!text) {
          throw new Error("Backend server is not responding. Please ensure the server is running with 'npm run server'");
        }

        const menu = JSON.parse(text);
        setCategories(menu.categories);
        setPopularItems(menu.popularItems);
        setMoreItems(menu.moreItems);
        setSelectedCategory(menu.categories[0] || "");
      } catch (error) {
        console.error("Menu loading error:", error);
        setMenuError(error.message);
      } finally {
        setIsMenuLoading(false);
      }
    };

    loadMenu();
  }, []);

  useEffect(() => {
    if (!token) {
      setOrders([]);
      return;
    }

    loadOrderHistory(token);
  }, [token]);

  const loadOrderHistory = async (authToken = token) => {
    if (!authToken) {
      return;
    }

    try {
      const response = await fetch("/api/orders", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Could not load order history.");
      }

      const text = await response.text();
      if (!text) {
        throw new Error("Empty response from server");
      }

      const userOrders = JSON.parse(text);
      setOrders(userOrders);
    } catch (error) {
      setAuthMessage(error.message);
    }
  };

  const scrollToMenu = () => {
    document.querySelector("#menu")?.scrollIntoView({ behavior: "smooth" });
  };

  const saveAuth = (authData) => {
    localStorage.setItem("foodStoreToken", authData.token);
    localStorage.setItem("foodStoreUser", JSON.stringify(authData.user));
    setToken(authData.token);
    setUser(authData.user);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthMessage("");

    const endpoint = authMode === "signup" ? "/api/signup" : "/api/login";
    const body =
      authMode === "signup"
        ? authForm
        : { email: authForm.email, password: authForm.password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      if (!text) {
        throw new Error("Backend server is not responding");
      }

      const result = JSON.parse(text);

      if (!response.ok) {
        throw new Error(result.message);
      }

      saveAuth(result);
      setAuthMessage(result.message);
      setAuthForm({ name: "", email: "", password: "" });
      setIsAuthOpen(false);
    } catch (error) {
      setAuthMessage(error.message);
    }
  };

  const logout = async () => {
    if (token) {
      await fetch("/api/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    localStorage.removeItem("foodStoreToken");
    localStorage.removeItem("foodStoreUser");
    setToken(null);
    setUser(null);
    setCart([]);
    setOrders([]);
    setAuthMessage("Logout successful.");
  };

  const addToCart = (item) => {
    setCart((currentCart) => {
      const itemInCart = currentCart.find(
        (cartItem) => cartItem.name === item.name
      );

      if (!itemInCart) {
        return [...currentCart, { ...item, quantity: 1 }];
      }

      return currentCart.map((cartItem) =>
        cartItem.name === item.name
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      );
    });
    setRecentItem(item.name);

    window.setTimeout(() => {
      setRecentItem("");
    }, 1200);
  };

  const removeFromCart = (itemName) => {
    setCart((currentCart) =>
      currentCart
        .map((cartItem) =>
          cartItem.name === itemName
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        )
        .filter((cartItem) => cartItem.quantity > 0)
    );
  };

  const placeOrder = async () => {
    if (!token) {
      alert("Please login before placing an order.");
      setIsAuthOpen(true);
      return;
    }

    if (cartCount === 0) {
      alert("Please add an item before ordering.");
      return;
    }

    try {
      const isOnlinePayment = paymentMethod !== "Cash on Delivery";

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart,
          paymentMethod,
          paymentStatus: isOnlinePayment ? "Completed" : "pending",
        }),
      });

      const text = await response.text();
      if (!text) {
        throw new Error("Backend server is not responding");
      }

      const result = JSON.parse(text);

      if (!response.ok) {
        throw new Error(result.message);
      }

      if (isOnlinePayment) {
        alert(`Payment processed with ${paymentMethod}. Order placed successfully! Total: ${formatPrice(result.order.total)}`);
      } else {
        alert(`${result.message} Total: ${formatPrice(result.order.total)}`);
      }

      setCart([]);
      loadOrderHistory();
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const renderProductCard = (item) => {
    const cartItem = getCartItem(item.name);

    return (
      <article className="product-card" key={item.name}>
        <div
          className={`product-image ${item.imageClass}`}
          style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : {}}
        ></div>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="product-meta">
          <span>{formatPrice(item.price)}</span>
          {cartItem ? (
            <div className="quantity-control product-quantity">
              <button
                className="quantity-btn"
                onClick={() => removeFromCart(item.name)}
                aria-label={`Remove one ${item.name}`}
              >
                -
              </button>
              <strong>{cartItem.quantity}</strong>
              <button
                className="quantity-btn"
                onClick={() => addToCart(item)}
                aria-label={`Add one ${item.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => addToCart(item)}>
              {recentItem === item.name ? "Added" : "Add"}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <div className="logo">ZOMATO</div>
          <nav className="main-nav">
            <a href="#home">Home</a>
            <a href="#menu">Menu</a>
            <a href="#popular">Popular</a>
            <a href="#more-items">More Items</a>
            <a href="#history">History</a>
          </nav>
          {user ? (
            <button className="btn btn-secondary" onClick={logout}>
              Logout
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => setIsAuthOpen(true)}
              type="button"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {isAuthOpen && (
        <div className="modal-backdrop">
          <div className="auth-modal">
            <button
              className="modal-close"
              onClick={() => setIsAuthOpen(false)}
              type="button"
              aria-label="Close login form"
            >
              x
            </button>
            <div>
              <p className="eyebrow">Account</p>
              <h2>{authMode === "signup" ? "Create Account" : "Login"}</h2>
              <p className="muted-text">
                Login or signup before placing an order.
              </p>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <div className="auth-tabs">
                <button
                  type="button"
                  className={authMode === "login" ? "tab active" : "tab"}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === "signup" ? "tab active" : "tab"}
                  onClick={() => setAuthMode("signup")}
                >
                  Signup
                </button>
              </div>
              {authMode === "signup" && (
                <input
                  type="text"
                  placeholder="Name"
                  value={authForm.name}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, name: event.target.value })
                  }
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm({ ...authForm, email: event.target.value })
                }
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm({ ...authForm, password: event.target.value })
                }
                required
              />
              <button className="btn btn-primary" type="submit">
                {authMode === "signup" ? "Create Account" : "Login"}
              </button>
              {authMessage && <p className="status-text">{authMessage}</p>}
            </form>
          </div>
        </div>
      )}

      <section className="hero" id="home">
        <div className="container hero-content">
          <div>
            <p className="eyebrow">Delicious food delivered fast</p>
            <h1>Find your next favorite meal</h1>
            <p>
              Explore a curated menu of burgers, pizzas, Asian bowls, and local
              favorites in one place.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={scrollToMenu}>
                Explore Menu
              </button>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  alert("Today offer: Get 20% off on orders above Rs. 499.")
                }
              >
                View Offers
              </button>
            </div>
          </div>
          <div className="food-card">
            <span>{user ? `Hi ${user.name}` : "Best Seller"}</span>
            <h2>Masala Dosa</h2>
            <p>Crispy dosa with spicy potato filling and coconut chutney.</p>
            <div className="price">{formatPrice(129)}</div>
          </div>
        </div>
      </section>

      <section className="section bg-light" id="menu">
        <div className="container">
          <div className="section-header">
            <h2>Categories</h2>
            <p>Choose your flavour and enjoy quick delivery.</p>
          </div>
          {isMenuLoading ? (
            <p className="status-text">Loading menu...</p>
          ) : menuError ? (
            <p className="status-text">{menuError}</p>
          ) : (
            <div className="categories-grid">
              {categories.map((category) => (
                <button
                  className={
                    selectedCategory === category
                      ? "category-card active-category"
                      : "category-card"
                  }
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
          )}
          {!isMenuLoading && !menuError && selectedCategory && (
            <div className="category-results">
              <div className="section-header">
                <h2>{selectedCategory} Items</h2>
                <p>Items available in this category.</p>
              </div>
              {selectedCategoryItems.length === 0 ? (
                <p className="status-text">No items found in this category.</p>
              ) : (
                <div className="product-grid">
                  {selectedCategoryItems.map(renderProductCard)}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section" id="popular">
        <div className="container">
          <div className="section-header">
            <h2>Popular Items</h2>
            <p>Top-rated choices from our food store.</p>
          </div>
          {isMenuLoading ? (
            <p className="status-text">Loading popular items...</p>
          ) : menuError ? (
            <p className="status-text">{menuError}</p>
          ) : (
            <div className="product-grid">{popularItems.map(renderProductCard)}</div>
          )}
        </div>
      </section>

      <section className="section bg-light" id="more-items">
        <div className="container">
          <div className="section-header">
            <h2>More Items</h2>
            <p>Add snacks, drinks, and extra favorites to your cart.</p>
          </div>
          {isMenuLoading ? (
            <p className="status-text">Loading more items...</p>
          ) : menuError ? (
            <p className="status-text">{menuError}</p>
          ) : (
            <div className="product-grid">{moreItems.map(renderProductCard)}</div>
          )}
        </div>
      </section>

      <section className="section" id="cart">
        <div className="container cart-panel">
          <div className="cart-heading">
            <div>
              <h2>Your Cart</h2>
              <p>{cartCount} item{cartCount === 1 ? "" : "s"} selected</p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setCart([])}
              disabled={cartCount === 0}
            >
              Clear Cart
            </button>
          </div>

          {cartCount === 0 ? (
            <p className="empty-cart">Your cart is empty. Add something tasty.</p>
          ) : (
            <>
              <div className="cart-list">
                {cart.map((item) => (
                  <div className="cart-item" key={item.name}>
                    <div>
                      <span>{item.name}</span>
                      <small>{formatPrice(item.price)} each</small>
                    </div>
                    <div className="quantity-control">
                      <button
                        className="quantity-btn"
                        onClick={() => removeFromCart(item.name)}
                        aria-label={`Remove one ${item.name}`}
                      >
                        -
                      </button>
                      <strong>{item.quantity}</strong>
                      <button
                        className="quantity-btn"
                        onClick={() => addToCart(item)}
                        aria-label={`Add one ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                    <strong>{formatPrice(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              <div className="payment-box">
                <label htmlFor="paymentMethod">Choose Payment Method:</label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  required
                >
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                </select>

                {paymentMethod === "Cash on Delivery" && (
                  <div className="payment-details">
                    <p><strong>Cash on Delivery</strong></p>
                    <p>Payment Mode: Cash | Status: Pending</p>
                    <p style={{ fontSize: "0.9rem", color: "#666" }}>
                      Pay when your order arrives. No online payment required.
                    </p>
                  </div>
                )}

                {paymentMethod === "UPI" && (
                  <div className="payment-details">
                    <p><strong>UPI Payment</strong></p>
                    <p>Payment Mode: Digital Transfer | Status: Instant</p>
                    <p style={{ fontSize: "0.9rem", color: "#666" }}>
                      Total Amount: <strong>{formatPrice(cartTotal)}</strong>
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "#999" }}>
                      You'll be redirected to your UPI app to complete the payment.
                    </p>
                  </div>
                )}

                {paymentMethod === "Credit Card" && (
                  <div className="payment-details">
                    <p><strong>Credit Card Payment</strong></p>
                    <p>Payment Mode: Card | Status: Secure</p>
                    <p style={{ fontSize: "0.9rem", color: "#666" }}>
                      Total Amount: <strong>{formatPrice(cartTotal)}</strong>
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "#999" }}>
                      Visa, Mastercard, American Express accepted. Secured by Razorpay.
                    </p>
                  </div>
                )}

                {paymentMethod === "Debit Card" && (
                  <div className="payment-details">
                    <p><strong>Debit Card Payment</strong></p>
                    <p>Payment Mode: Card | Status: Secure</p>
                    <p style={{ fontSize: "0.9rem", color: "#666" }}>
                      Total Amount: <strong>{formatPrice(cartTotal)}</strong>
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "#999" }}>
                      All major banks supported. Secured by Razorpay.
                    </p>
                  </div>
                )}
              </div>
              <div className="cart-total">
                <span>Total</span>
                <strong>{formatPrice(cartTotal)}</strong>
              </div>
              <button className="btn btn-primary checkout-btn" onClick={placeOrder}>
                Place Order
              </button>
            </>
          )}
        </div>
      </section>

      <section className="section bg-light" id="history">
        <div className="container history-panel">
          <div className="section-header">
            <h2>Order History</h2>
            <p>Previous orders for the logged-in account.</p>
          </div>
          {!user ? (
            <p className="status-text">Login to view your order history.</p>
          ) : orders.length === 0 ? (
            <p className="status-text">No orders yet.</p>
          ) : (
            <div className="history-list">
              {orders.map((order) => (
                <article className="history-card" key={order.id}>
                  <div className="cart-heading">
                    <div>
                      <h3>Order #{order.id.slice(0, 8)}</h3>
                      <p>{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>
                  <p className="muted-text">
                    Payment: {order.paymentMethod} ({order.paymentStatus || "pending"}) | Status: {order.status}
                  </p>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.name}>
                        {item.name} x {item.quantity}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="site-footer" id="contact">
        <div className="container footer-inner">
          <div>
            <h3>Zomato Food Store</h3>
            <p>Fast delivery, fresh flavours, and great offers.</p>
          </div>
          <div className="footer-links">
            <a href="#home">Home</a>
            <a href="#menu">Menu</a>
            <a href="#history">History</a>
          </div>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
