/* ===== IMPORTS ===== */
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const http = require("http");
const socketIo = require("socket.io");
const db = require("./db"); // your db.js connection

/* ===== CONFIG ===== */
const ADMIN_EMAIL = "yvesniyiragira5@gmail.com";
const ADMIN_PASSWORD = "clema@123";

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

/* ===== MIDDLEWARE ===== */
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: "secret123",
  resave: false,
  saveUninitialized: false
}));

// Role middleware
const isUser = (req,res,next) =>
  req.session.user && req.session.user.role === "user"
    ? next() : res.redirect("/");

const isAdmin = (req,res,next) =>
  req.session.user && req.session.user.role === "admin"
    ? next() : res.redirect("/");

/* ===== AUTH ===== */

// REGISTER USER ONLY
app.post("/register", async (req,res) => {
  const { name, email, password } = req.body;
  if(!name || !email || !password) return res.status(400).send("All fields required");

  const role = "user"; // force user role
  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
    [name,email,hash,role],
    (err,result)=>{
      if(err){
        if(err.code==="ER_DUP_ENTRY") return res.status(400).send("Email already exists");
        return res.status(500).send(err.message);
      }

      // auto login after register
      req.session.user = { id: result.insertId, name, email, role };
      res.redirect("/user");
    }
  );
});

// LOGIN (Admin + User)
app.post("/login", (req,res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).send("Email & password required");

  // ADMIN fixed login
  if(email === ADMIN_EMAIL && password === ADMIN_PASSWORD){
    db.query("SELECT * FROM users WHERE email=? AND role='admin'", [ADMIN_EMAIL], async (err,result)=>{
      if(err) return res.status(500).send(err.message);

      if(result.length === 0){
        // first time admin login → create account
        const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        db.query(
          "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
          ["Admin", ADMIN_EMAIL, hash, "admin"],
          (err2,r)=>{
            if(err2) return res.status(500).send(err2.message);

            req.session.user = { id: r.insertId, name: "Admin", email: ADMIN_EMAIL, role: "admin" };
            return res.redirect("/admin");
          }
        );
      } else {
        // admin exists
        req.session.user = { id: result[0].id, name: result[0].name, email: result[0].email, role: "admin" };
        return res.redirect("/admin");
      }
    });
    return;
  }

  // NORMAL USER LOGIN
  db.query("SELECT * FROM users WHERE email=? AND role='user'", [email], async (err,result)=>{
    if(err) return res.status(500).send(err.message);
    if(result.length === 0) return res.status(401).send("Invalid credentials");

    const user = result[0];
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(401).send("Wrong password");

    req.session.user = { id: user.id, name: user.name, email: user.email, role: "user" };
    res.redirect("/user");
  });
});

// LOGOUT
app.get("/logout", (req,res)=>{
  req.session.destroy();
  res.redirect("/");
});

/* ===== USER PAGE ===== */
app.get("/user", isUser, (req,res)=>{
  res.sendFile(__dirname+"/public/user.html");
});

/* ===== ADMIN DASHBOARD ===== */
app.get("/admin", isAdmin, (req,res)=>{
  res.sendFile(__dirname+"/public/admin.html");
});

// READ USERS
app.get("/admin/users", isAdmin, (req,res)=>{
  db.query("SELECT id,name,email,role FROM users", (err,result)=>{
    if(err) return res.status(500).send(err.message);
    res.json(result);
  });
});

// CREATE USER
app.post("/admin/create", isAdmin, async (req,res)=>{
  const { name, email, password, role } = req.body;
  if(!name || !email || !password || !role) return res.status(400).send("All fields required");

  const hash = await bcrypt.hash(password,10);

  db.query("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
    [name,email,hash,role],
    (err,result)=>{
      if(err){
        if(err.code==="ER_DUP_ENTRY") return res.status(400).send("Email already exists");
        return res.status(500).send(err.message);
      }
      res.sendStatus(200);
    }
  );
});

// UPDATE USER
app.put("/admin/update", isAdmin, (req,res)=>{
  const { id, field, value } = req.body;
  const allowed = ["name","email","role"];
  if(!allowed.includes(field)) return res.status(400).send("Invalid field");

  db.query(`UPDATE users SET ${field}=? WHERE id=?`, [value,id], (err,result)=>{
    if(err) return res.status(500).send(err.message);
    res.sendStatus(200);
  });
});

// DELETE USER
app.delete("/admin/delete/:id", isAdmin, (req,res)=>{
  const id = parseInt(req.params.id);
  if(isNaN(id)) return res.status(400).send("Invalid ID");

  db.query("DELETE FROM users WHERE id=?",[id], (err,result)=>{
    if(err) return res.status(500).send(err.message);
    res.sendStatus(200);
  });
});

/* ===== CHAT ===== */
io.on("connection", socket=>{
  socket.on("message", msg=>{
    io.emit("message", msg);
  });
});

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(express.static("public"));

app.use(session({
  secret:"secret123",
  resave:false,
  saveUninitialized:true
}));

// ===== FORGOT PASSWORD =====
app.post("/forgot-password",(req,res)=>{
  const { email, newPassword } = req.body;

  if(!email || !newPassword)
    return res.send("All fields required");

  const sql = "UPDATE users SET password=? WHERE email=?";
  db.query(sql,[newPassword,email],(err,result)=>{
    if(err) return res.send("Server error");

    if(result.affectedRows === 0)
      return res.send("Email not found");

    res.send("✅ Password reset successful");
  });
});
// fetch all messages
/* ===== SEND MESSAGE (broadcast) ===== */
app.post("/send-message",(req,res)=>{
  const { sender_id, message } = req.body;
  if(!sender_id || !message) return res.status(400).send("Missing fields");

  // store in DB
  db.query("INSERT INTO messages(sender_id,message) VALUES(?,?)",[sender_id,message],(err)=>{
    if(err) return res.status(500).send(err.message);

    // broadcast to all users in real-time
    io.emit("receive_message",{sender_id,message});
    res.sendStatus(200);
  });
});

/* ===== FETCH MESSAGES ===== */
app.get("/messages",(req,res)=>{
  db.query("SELECT * FROM messages ORDER BY created_at", (err,rows)=>{
    if(err) return res.status(500).json({error:err});
    res.json(rows);
  });
});


const PORT = 3003; // cyangwa 4000, 5000
server.listen(PORT, ()=>{
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
