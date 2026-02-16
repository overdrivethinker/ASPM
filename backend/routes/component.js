const express = require("express");
const router = express.Router();
const knex = require("../database/db");

router.get("/size", async (req, res) => {
	try {
		const data = await knex("component_size")
			.select(
				"id",
				"metric_code",
				"imperial_code",
				"length_mm",
				"width_mm",
			)
			.orderBy("length_mm", "asc")
			.orderBy("width_mm", "asc");

		res.json({
			success: true,
			data,
		});
	} catch (err) {
		console.error("GET /component-size error:", err);
		res.status(500).json({
			success: false,
			message: "Failed to fetch component size",
		});
	}
});
router.get("/reel-width", async (req, res) => {
	try {
		const data = await knex("reel_width")
			.select("id", "width_code")
			.orderBy("id", "asc");

		res.json({
			success: true,
			data,
		});
	} catch (err) {
		console.error("GET /component-reel-width error:", err);
		res.status(500).json({
			success: false,
			message: "Failed to fetch component reel width",
		});
	}
});
router.get("/type", async (req, res) => {
	try {
		const data = await knex("component_type")
			.select("id", "code", "name")
			.orderBy("code", "asc");

		res.json({
			success: true,
			data,
		});
	} catch (err) {
		console.error("GET /component-type error:", err);
		res.status(500).json({
			success: false,
			message: "Failed to fetch component type",
		});
	}
});

module.exports = router;
