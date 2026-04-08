require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const users = [
  {
    username: "dm",
    display_name: "DM",
    role: "dm",
    password: "admin",
  },
  {
    username: "terry",
    display_name: "Terry",
    role: "player",
    password: "gronda",
  },
  {
    username: "hilton",
    display_name: "Hilton",
    role: "player",
    password: "gilly",
  },
  {
    username: "usaq",
    display_name: "Usaq",
    role: "player",
    password: "qasu",
  },
];

const now = new Date().toISOString();

for (const user of users) {
  const passwordHash = bcrypt.hashSync(user.password, 10);

  db.prepare(`
    INSERT INTO users (
      username,
      display_name,
      role,
      password_hash,
      created_at,
      updated_at
    )
    VALUES (
      @username,
      @display_name,
      @role,
      @password_hash,
      @created_at,
      @updated_at
    )
    ON CONFLICT(username) DO UPDATE SET
      display_name = excluded.display_name,
      role = excluded.role,
      password_hash = excluded.password_hash,
      updated_at = excluded.updated_at
  `).run({
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    password_hash: passwordHash,
    created_at: now,
    updated_at: now,
  });

  console.log(`Upserted user: ${user.username}`);
}