const mysql = require("mysql");

// CONFIGURATION
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",           // shyiramo password yawe niba ihari
  database: "system",
  multipleStatements: true
});

// CONNECT WITH ERROR HANDLING
db.connect(err => {
  if (err) {
    console.error("❌ MySQL Connection Failed!", err);
    process.exit(1); // Stop server niba database itabonetse
  } else {
    console.log("✅ MySQL Connected Successfully!");
  }
});

// HANDLE DISCONNECTION
db.on("error", err => {
  console.error("❌ MySQL Error:", err);
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    console.log("🔄 Reconnecting to MySQL...");
    db.connect();
  } else {
    throw err;
  }
});

module.exports = db;




