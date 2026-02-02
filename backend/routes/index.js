const express = require("express");
const router = express.Router();

const machineRouter = require("./machine_ingest");
const uploadRouter = require("./upload");
const usersRouter = require("./users");
const authRouter = require("./auth");
const lcrRecordsRouter = require("./lcr_records");
const partLibraryRouter = require("./part_library");
const partListRouter = require("./part_list");
const componentRouter = require("./component");
const dashboardRouter = require("./dashboard");

router.use("/psi-aspm/machine/interface", machineRouter);
router.use("/psi-aspm/upload", uploadRouter);
router.use("/psi-aspm/users", usersRouter);
router.use("/psi-aspm/auth", authRouter);
router.use("/psi-aspm/lcr-records", lcrRecordsRouter);
router.use("/psi-aspm/part-library", partLibraryRouter);
router.use("/psi-aspm/part-list", partListRouter);
router.use("/psi-aspm/component", componentRouter);
router.use("/psi-aspm/dashboard", dashboardRouter);

module.exports = router;
