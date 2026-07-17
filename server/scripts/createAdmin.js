// One-off bootstrap script to create the first admin account.
// There is no public registration endpoint, so this is how the very first
// user gets in. Safe to re-run: if the email already exists, it does nothing
// (never silently resets an existing admin's password).
//
// Usage:
//   ADMIN_EMAIL=you@mowito.in ADMIN_PASSWORD=... ADMIN_NAME="Your Name" node scripts/createAdmin.js

require("dotenv").config({ quiet: true });
const bcrypt = require("bcryptjs");
const { prisma } = require("../src/lib/prisma");

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password || !name) {
    console.error("ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME must all be set.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists - no changes made.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: "ADMIN" },
  });

  console.log(`Created admin user ${user.email} (${user.id}).`);
}

main()
  .catch((err) => {
    console.error("createAdmin failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
