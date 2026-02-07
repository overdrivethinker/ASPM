const express = require("express");
const router = express.Router();

const machineRouter = require("./machine-ingest");
const uploadRouter = require("./upload");
const usersRouter = require("./users");
const authRouter = require("./auth");
const lcrRecordsRouter = require("./machine-monitor");
const partLibraryRouter = require("./part-library");
const partListRouter = require("./part-list");
const componentRouter = require("./component");
const dashboardRouter = require("./dashboard");
const handyRouter = require("./handy-replicate");

router.use("/psi-aspm/machine/interface", machineRouter);
router.use("/psi-aspm/upload", uploadRouter);
router.use("/psi-aspm/users", usersRouter);
router.use("/psi-aspm/auth", authRouter);
router.use("/psi-aspm/machine-monitor", lcrRecordsRouter);
router.use("/psi-aspm/part-library", partLibraryRouter);
router.use("/psi-aspm/part-list", partListRouter);
router.use("/psi-aspm/component", componentRouter);
router.use("/psi-aspm/dashboard", dashboardRouter);
router.use("/psi-aspm/handy-replicate", handyRouter);

module.exports = router;
