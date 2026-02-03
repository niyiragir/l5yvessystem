/* ========== IMPORTS ========== */
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const http = require("http");
const socketIo = require("socket.io");
const db = require("./db");

/* ========== CONFIG ========== */
const ADMIN_EMAIL = "yvesniyiragira5@gmail.com";
const ADMIN_PASSWORD = "clema@123";
const PORT = process.env.PORT || 3003;

/* ========== APP SETUP ========== */
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

/* ========== MIDDLEWARE ========== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "secret123",
    resave: false,
    saveUninitialized: false,
  })
);

/* ========== ROLE GUARDS ========== */
const isUser = (req, res, next) =>
  req.session.user?.role === "user" ? next() : res.redirect("/");

const isAdmin = (req, res, next) =>
  req.session.user?.role === "admin" ? next() : res.redirect("/");

/* ========== HOME ========== */
app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

/* ========== AUTH ========== */
// REGISTER
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).send("All fields required");

  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users(name,email,password,role) VALUES(?,?,?,'user')",
    [name, email, hash],
    (err, result) => {
      if (err) return res.status(400).send("Email already exists");

      req.session.user = {
        id: result.insertId,
        name,
        email,
        role: "user",
      };
      res.redirect("/user");
    }
  );
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // ADMIN LOGIN
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    db.query(
      "SELECT * FROM users WHERE email=? AND role='admin'",
      [ADMIN_EMAIL],
      async (_, rows) => {
        if (rows.length === 0) {
          const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
          db.query(
            "INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')",
            ["Admin", ADMIN_EMAIL, hash],
            (_, r) => {
              req.session.user = {
                id: r.insertId,
                name: "Admin",
                email: ADMIN_EMAIL,
                role: "admin",
              };
              res.redirect("/admin");
            }
          );
        } else {
          req.session.user = rows[0];
          res.redirect("/admin");
        }
      }
    );
    return;
  }

  // USER LOGIN
  db.query(
    "SELECT * FROM users WHERE email=? AND role='user'",
    [email],
    async (_, rows) => {
      if (rows.length === 0) return res.send("Invalid credentials");

      const ok = await bcrypt.compare(password, rows[0].password);
      if (!ok) return res.send("Wrong password");

      req.session.user = rows[0];
      res.redirect("/user");
    }
  );
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

/* ========== PAGES ========== */
app.get("/user", isUser, (req, res) =>
  res.sendFile(__dirname + "/public/user.html")
);

app.get("/admin", isAdmin, (req, res) =>
  res.sendFile(__dirname + "/public/admin.html")
);

app.get("/forgot", (req, res) =>
  res.sendFile(__dirname + "/public/forgot.html")
);

/* ========== FORGOT PASSWORD (FIXED) ========== */
app.post("/forgot-password", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Missing fields" });

  const hash = await bcrypt.hash(password, 10);

  db.query(
    "UPDATE users SET password=? WHERE email=?",
    [hash, email],
    (_, result) => {
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Email not found" });

      res.json({ message: "Password reset successful" });
    }
  );
});

/* ========== CHAT ========== */
io.on("connection", (socket) => {
  socket.on("message", (msg) => io.emit("message", msg));
});

/* ========== SERVER ========== */
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
