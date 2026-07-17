const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const industriesRoutes = require("./routes/industries.routes");
const customersRoutes = require("./routes/customers.routes");
const locationsRoutes = require("./routes/locations.routes");
const routesRoutes = require("./routes/routes.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", industriesRoutes);
app.use("/api", customersRoutes);
app.use("/api", locationsRoutes);
app.use("/api", routesRoutes);

module.exports = app;
