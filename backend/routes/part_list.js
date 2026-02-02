const express = require("express");
const router = express.Router();
const knex = require("../database/db");

router.get("/", async (req, res) => {
	try {
		const { page = 1, limit = 15, search = "" } = req.query;

		const parsedPage = parseInt(page);
		const parsedLimit = parseInt(limit);
		const offset = (parsedPage - 1) * parsedLimit;

		let query = knex("part_list")
			.select(
				"part_id",
				"part_number",
				"part_name",
				"specification",
				"value",
				"tolerance",
				"updated_date",
			)
			.orderBy("part_name", "asc");

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

		let countQuery = knex("part_list").count("* as count");

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

router.post("/", async (req, res) => {
	try {
		const { part_number, part_name, specification, value, tolerance } =
			req.body;

		if (!part_number || !part_number.trim()) {
			return res.status(400).json({ error: "Part number is required" });
		}

		if (!part_name || !part_name.trim()) {
			return res.status(400).json({ error: "Part name is required" });
		}

		const existing = await knex("part_list")
			.where("part_number", part_number.trim())
			.first();

		if (existing) {
			return res
				.status(409)
				.json({ error: "Part number already exists" });
		}

		const [part_id] = await knex("part_list").insert({
			part_number: part_number.trim(),
			part_name: part_name.trim(),
			specification: specification?.trim() || null,
			value: value?.trim() || null,
			tolerance: tolerance?.trim() || null,
		});

		res.status(201).json({
			message: "Part created successfully",
			data: {
				part_id,
				part_number: part_number.trim(),
				part_name: part_name.trim(),
				specification: specification?.trim() || null,
				value: value?.trim() || null,
				tolerance: tolerance?.trim() || null,
			},
		});
	} catch (err) {
		console.error("POST /part-list error:", err);

		if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
			return res
				.status(409)
				.json({ error: "Part number already exists" });
		}

		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.put("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { part_name, specification, value, tolerance } = req.body;

		const existingPart = await knex("part_list")
			.where("part_id", id)
			.first();

		if (!existingPart) {
			return res.status(404).json({ error: "Part not found" });
		}

		await knex("part_list")
			.where("part_id", id)
			.update({
				part_name: part_name?.trim() || existingPart.part_name,
				specification: specification?.trim() || null,
				value: value?.trim() || null,
				tolerance: tolerance?.trim() || null,
			});

		const updatedPart = await knex("part_list")
			.where("part_id", id)
			.first();

		res.json({
			message: "Part updated successfully",
			data: updatedPart,
		});
	} catch (err) {
		console.error("PUT /part-list error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const existingPart = await knex("part_list")
			.where("part_id", id)
			.first();

		if (!existingPart) {
			return res.status(404).json({ error: "Part not found" });
		}

		await knex("part_list").where("part_id", id).delete();

		res.json({
			message: "Part deleted successfully",
			data: existingPart,
		});
	} catch (err) {
		console.error("DELETE /part-list error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/export", async (req, res) => {
	const data = await knex("part_list")
		.select(
			"part_number",
			"part_name",
			"specification",
			"value",
			"tolerance",
			"updated_date",
		)
		.orderBy("part_name", "asc");

	res.json(data);
});

module.exports = router;
