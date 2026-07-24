// Simple HTTP Basic Auth gate for the admin dashboard and admin API.
// Credentials come from .env (ADMIN_USER / ADMIN_PASS) — never hardcode them here.

function adminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.split(" ")[1] || "";
  const decoded = Buffer.from(token, "base64").toString();

  // Split on the FIRST colon only, so a password containing ":" isn't cut off.
  const separatorIndex = decoded.indexOf(":");
  const login = separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
  const password = separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    console.error(
      "ADMIN_USER / ADMIN_PASS are not set in .env — admin login will always fail until they are."
    );
  }

  if (login === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Gowtham Mess Admin"');
  return res.status(401).send("Authentication required.");
}

module.exports = adminAuth;
