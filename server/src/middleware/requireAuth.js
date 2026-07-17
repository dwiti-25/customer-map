const { verifyToken } = require("../lib/jwt");
const { prisma } = require("../lib/prisma");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: { message: "Missing or invalid Authorization header" } });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: { message: "Invalid or expired token" } });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });

  // Re-checked from the DB on every request (not trusted from the token) so an
  // offboarded employee (isActive=false) or a role change takes effect immediately,
  // without needing refresh-token infrastructure.
  if (!user || !user.isActive) {
    return res.status(401).json({ error: { message: "Account is inactive or no longer exists" } });
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  next();
}

module.exports = { requireAuth };
