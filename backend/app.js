require("./utils/logger");
require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const routes = require("./routes");
app.use("/api", routes);

const DIST_PATH = path.join(__dirname, "/public/dist");

app.use(
	"/psi-aspm",
	express.static(DIST_PATH, {
		index: false,
	}),
);

app.get(/.*/, (req, res) => {
	res.sendFile(path.join(DIST_PATH, "index.html"));
});

const PORT = process.env.SERVER_PORT || 3000;
app.listen(PORT, () => {
	console.log(
		`[Server] PSI-ASPM API server running on http://localhost:${PORT}`,
	);
});
