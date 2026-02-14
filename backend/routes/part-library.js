const express = require("express");
const router = express.Router();
const knex = require("../database/db");
const { toWIB } = require("../utils/helpers");

router.get("/", async (req, res) => {
	try {
		const { page = 1, limit = 17, search = "" } = req.query;

		const parsedPage = parseInt(page);
		const parsedLimit = parseInt(limit);
		const offset = (parsedPage - 1) * parsedLimit;

		let query = knex("part_library")
			.select(
				"part_id",
				"part_name",
				"component_type",
				"component_size",
				"reel_width",
				"updated_date",
			)
			.orderBy("part_name", "asc");

		if (search) {
			query = query.where(function () {
				this.where("part_name", "like", `%${search}%`)
					.orWhere("component_type", "like", `%${search}%`)
					.orWhere("component_size", "like", `%${search}%`)
					.orWhere("reel_width", "like", `%${search}%`);
			});
		}

		const rows = await query.limit(parsedLimit).offset(offset);

		let countQuery = knex("part_library").count("* as count");

		if (search) {
			countQuery = countQuery.where(function () {
				this.where("part_name", "like", `%${search}%`)
					.orWhere("component_type", "like", `%${search}%`)
					.orWhere("component_size", "like", `%${search}%`)
					.orWhere("reel_width", "like", `%${search}%`);
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
		console.error("GET /part-library error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.post("/", async (req, res) => {
	try {
		const { part_name, component_type, component_size, reel_width } =
			req.body;

		if (!part_name || !part_name.trim()) {
			return res.status(400).json({ error: "Part name is required" });
		}
		const existing = await knex("part_library")
			.where("part_name", part_name)
			.first();

		if (existing) {
			return res
				.status(409)
				.json({ error: "Part library already exists" });
		}

		const partListExist = await knex("part_list")
			.where("part_name", part_name)
			.first();

		if (!partListExist) {
			return res
				.status(409)
				.json({ error: "Part name not exists in part list" });
		}

		const [part_id] = await knex("part_library").insert({
			part_name: part_name,
			component_type: component_type?.trim() || null,
			component_size: component_size?.trim() || null,
			reel_width: reel_width?.trim() || null,
		});

		res.status(201).json({
			message: "Part created successfully",
			data: {
				part_id,
				part_name: part_name,
				component_type: component_type?.trim() || null,
				component_size: component_size?.trim() || null,
				reel_width: reel_width?.trim() || null,
			},
		});
	} catch (err) {
		console.error("POST /part-library error:", err);

		if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
			return res.status(409).json({ error: "Part name already exists" });
		}

		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.put("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { component_type, component_size, reel_width } = req.body;

		await knex("part_library")
			.where("part_name", id)
			.update({
				component_type: component_type?.trim() || null,
				component_size: component_size?.trim() || null,
				reel_width: reel_width?.trim() || null,
				updated_date: toWIB(new Date()),
			});

		const updatedPart = await knex("part_library")
			.where("part_name", id)
			.first();

		res.json({
			message: "Part updated successfully",
			data: updatedPart,
		});
	} catch (err) {
		console.error("PUT /part-library error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const existingPart = await knex("part_library")
			.where("part_id", id)
			.first();

		if (!existingPart) {
			return res.status(404).json({ error: "Part not found" });
		}

		await knex("part_library").where("part_id", id).delete();

		res.json({
			message: "Part deleted successfully",
			data: existingPart,
		});
	} catch (err) {
		console.error("DELETE /part-library error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/export", async (req, res) => {
	const data = await knex("part_library")
		.select(
			"part_name",
			"component_type",
			"component_size",
			"reel_width",
			"updated_date",
		)
		.orderBy("part_name", "asc");

	res.json(data);
});

module.exports = router;
