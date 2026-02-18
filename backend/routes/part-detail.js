const express = require("express");
const router = express.Router();
const knex = require("../database/db");

router.get("/", async (req, res) => {
	try {
		const { page = 1, limit = 17, search = "" } = req.query;

		const parsedPage = parseInt(page);
		const parsedLimit = parseInt(limit);
		const offset = (parsedPage - 1) * parsedLimit;

		let query = knex("vw_part_master_detail")
			.select("*")
			.orderBy("part_number", "asc");

		if (search) {
			query = query.where(function () {
				this.where("part_number", "like", `%${search}%`).orWhere(
					"part_name",
					"like",
					`%${search}%`,
				);
			});
		}

		const rows = await query.limit(parsedLimit).offset(offset);

		let countQuery = knex("vw_part_master_detail").count("* as count");

		if (search) {
			countQuery = countQuery.where(function () {
				this.where("part_number", "like", `%${search}%`).orWhere(
					"part_name",
					"like",
					`%${search}%`,
				);
			});
		}

		const totalResult = await countQuery.first();
		const total = Number(totalResult?.count || 0);

		res.json({
			data: rows,
			pagination: {
				page: parsedPage,
				limit: parsedLimit,
				total,
				pages: Math.ceil(total / parsedLimit),
			},
		});
	} catch (err) {
		console.error("GET /part-list error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/export", async (req, res) => {
	const data = await knex("vw_part_master_detail")
		.select("*")
		.orderBy("part_number", "asc");

	res.json(data);
});

module.exports = router;
