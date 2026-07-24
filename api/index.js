// Vercel imports this file as a serverless function. It just hands requests
// to the same Express app used for local development (server.js) — nothing
// calls app.listen() here, Vercel handles that part.
module.exports = require("../server");
