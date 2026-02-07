const express = require("express");
const router = express.Router();
const knex = require("../database/db");
const { toWIB } = require("../utils/helpers");
const {
	parseSpecification,
	removeDuplicates,
} = require("../utils/parser-table");

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
				updated_date: toWIB(new Date()),
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

router.get("/check/missing-value", async (req, res) => {
	try {
		const { page = 1, limit = 10 } = req.query;

		const parsedPage = parseInt(page);
		const parsedLimit = parseInt(limit);
		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await knex("part_library as pl")
			.leftJoin("part_list as plist", "pl.part_name", "plist.part_name")
			.where(function () {
				this.where("pl.component_type", "RES").orWhere(
					"pl.component_type",
					"CAP",
				);
			})
			.where(function () {
				this.whereNull("plist.value")
					.orWhereNull("plist.tolerance")
					.orWhere("plist.value", "")
					.orWhere("plist.tolerance", "");
			})
			.where(function () {
				this.whereNull("plist.specification").orWhere(
					"plist.specification",
					"not like",
					"%BM%",
				);
			})
			.count("* as count")
			.first();

		const total = Number(countResult?.count || 0);

		const data = await knex("part_library as pl")
			.leftJoin("part_list as plist", "pl.part_name", "plist.part_name")
			.where(function () {
				this.where("pl.component_type", "RES").orWhere(
					"pl.component_type",
					"CAP",
				);
			})
			.where(function () {
				this.whereNull("plist.value")
					.orWhereNull("plist.tolerance")
					.orWhere("plist.value", "")
					.orWhere("plist.tolerance", "");
			})
			.where(function () {
				this.whereNull("plist.specification").orWhere(
					"plist.specification",
					"not like",
					"%BM%",
				);
			})
			.select(
				"pl.part_id as library_part_id",
				"pl.part_name",
				"pl.component_type",
				"pl.component_size",
				"pl.reel_width",
				"plist.part_id as list_part_id",
				"plist.part_number",
				"plist.value",
				"plist.tolerance",
				"plist.specification",
			)
			.orderBy("pl.part_name", "asc")
			.limit(parsedLimit)
			.offset(offset);

		const pages = total > 0 ? Math.ceil(total / parsedLimit) : 1;

		res.json({
			success: true,
			data: data || [],
			pagination: {
				page: parsedPage,
				limit: parsedLimit,
				total: total,
				pages: pages,
			},
		});
	} catch (error) {
		console.error("Error checking missing value/tolerance:", error);
		res.status(500).json({
			success: false,
			message: "Error checking missing value/tolerance",
			error: error.message,
			data: [],
			pagination: {
				page: 1,
				limit: 10,
				total: 0,
				pages: 1,
			},
		});
	}
});

router.get("/check/incomplete-partlib", async (req, res) => {
	try {
		const { page = 1, limit = 10 } = req.query;

		const parsedPage = parseInt(page);
		const parsedLimit = parseInt(limit);
		const offset = (parsedPage - 1) * parsedLimit;

		const countResult = await knex("part_list as plist")
			.leftJoin("part_library as pl", "plist.part_name", "pl.part_name")
			.whereNull("pl.part_name")
			.count("* as count")
			.first();

		const total = Number(countResult?.count || 0);

		const data = await knex("part_list as plist")
			.leftJoin("part_library as pl", "plist.part_name", "pl.part_name")
			.whereNull("pl.part_name")
			.select(
				"plist.part_id as list_part_id",
				"plist.part_number",
				"plist.part_name",
				"plist.value",
				"plist.tolerance",
				"pl.part_id as library_part_id",
				"pl.component_type",
				"pl.component_size",
				"pl.reel_width",
			)
			.orderBy("plist.part_name", "asc")
			.limit(parsedLimit)
			.offset(offset);

		const pages = total > 0 ? Math.ceil(total / parsedLimit) : 1;

		res.json({
			success: true,
			data: data || [],
			pagination: {
				page: parsedPage,
				limit: parsedLimit,
				total: total,
				pages: pages,
			},
		});
	} catch (error) {
		console.error("Error checking incomplete part library:", error);
		res.status(500).json({
			success: false,
			message: "Error checking incomplete part library",
			error: error.message,
			data: [],
			pagination: {
				page: 1,
				limit: 10,
				total: 0,
				pages: 1,
			},
		});
	}
});

router.get("/check/summary", async (req, res) => {
	try {
		const countMissingValueTolerance = await knex("part_library as pl")
			.leftJoin("part_list as plist", "pl.part_name", "plist.part_name")
			.where(function () {
				this.where("pl.component_type", "RES").orWhere(
					"pl.component_type",
					"CAP",
				);
			})
			.where(function () {
				this.whereNull("plist.value")
					.orWhereNull("plist.tolerance")
					.orWhere("plist.value", "")
					.orWhere("plist.tolerance", "");
			})
			.where(function () {
				this.whereNull("plist.specification").orWhere(
					"plist.specification",
					"not like",
					"%BM%",
				);
			})
			.count("* as count")
			.first();

		const countMissingComponentType = await knex("part_list as plist")
			.leftJoin("part_library as pl", "plist.part_name", "pl.part_name")
			.whereNull("pl.part_name")
			.count("* as count")
			.first();

		res.json({
			success: true,
			summary: {
				res_cap_missing_value_tolerance: Number(
					countMissingValueTolerance?.count || 0,
				),
				value_missing_component_type: Number(
					countMissingComponentType?.count || 0,
				),
			},
		});
	} catch (error) {
		console.error("Error getting summary:", error);
		res.status(500).json({
			success: false,
			message: "Error getting summary",
			error: error.message,
			summary: {
				res_cap_missing_value_tolerance: 0,
				value_missing_component_type: 0,
			},
		});
	}
});

router.get("/check/missing-value/export", async (req, res) => {
	try {
		const data = await knex("part_library as pl")
			.leftJoin("part_list as plist", "pl.part_name", "plist.part_name")
			.where(function () {
				this.where("pl.component_type", "RES").orWhere(
					"pl.component_type",
					"CAP",
				);
			})
			.where(function () {
				this.whereNull("plist.value")
					.orWhereNull("plist.tolerance")
					.orWhere("plist.value", "")
					.orWhere("plist.tolerance", "");
			})
			.where(function () {
				this.whereNull("plist.specification").orWhere(
					"plist.specification",
					"not like",
					"%BM%",
				);
			})
			.select(
				"plist.part_number",
				"pl.part_name",
				"pl.component_type",
				"pl.component_size",
				"pl.reel_width",
				"plist.specification",
				"plist.value",
				"plist.tolerance",
			)
			.orderBy("pl.part_name", "asc");

		res.json(data);
	} catch (error) {
		console.error("Export error:", error);
		res.status(500).json({ error: "Export failed" });
	}
});

router.get("/check/incomplete-partlib/export", async (req, res) => {
	try {
		const data = await knex("part_list as plist")
			.leftJoin("part_library as pl", "plist.part_name", "pl.part_name")
			.whereNull("pl.part_name")
			.select(
				"plist.part_number",
				"plist.part_name",
				"plist.value",
				"plist.tolerance",
				"pl.component_type",
				"pl.component_size",
				"pl.reel_width",
			)
			.orderBy("plist.part_name", "asc");

		res.json(data);
	} catch (error) {
		console.error("Export error:", error);
		res.status(500).json({ error: "Export failed" });
	}
});

router.post("/sync", async (req, res) => {
	try {
		const rows = await knex("dbo.ENG_MITMSPCS").select(
			"ITMCD",
			"PRDNO",
			"SPECS",
		);

		if (!rows.length) {
			return res
				.status(400)
				.json({ message: "[DB] dbo.ENG_MITMSPCS IS EMPTY" });
		}

		const sheetData = rows
			.filter((r) => {
				if (!r.ITMCD) return false;
				const cleanITMCD = r.ITMCD.toString().trim().replace(/-/g, "");
				return cleanITMCD.length === 9 && /^\d{9}$/.test(cleanITMCD);
			})
			.map((r) => {
				const spec = r.SPECS?.toString().trim() || null;
				const parsedSpec = parseSpecification(spec);

				return {
					part_code: r.ITMCD?.toString().trim().replace(/-/g, ""),
					part_name: r.PRDNO?.toString().trim(),
					specification: spec,
					value: parsedSpec.value,
					tolerance: parsedSpec.tolerance,
				};
			});

		const uniqueData = removeDuplicates(sheetData);

		if (!uniqueData.length) {
			return res
				.status(400)
				.json({ message: "[DB] NO VALID DATA AFTER PROCESSING" });
		}

		let inserted = 0;

		await knex.transaction(async (trx) => {
			await trx.raw("DELETE FROM dbo.part_list");
			await trx.raw("DBCC CHECKIDENT ('dbo.part_list', RESEED, 0)");

			for (const row of uniqueData) {
				if (!row.part_code) continue;

				await trx("dbo.part_list").insert({
					part_number: row.part_code,
					part_name: row.part_name,
					specification: row.specification,
					value: row.value,
					tolerance: row.tolerance,
				});

				inserted++;
			}
		});

		res.json({
			status: "OK",
			source: "dbo.ENG_MITMSPCS",
			inserted,
			total_unique: uniqueData.length,
			total_with_duplicates: sheetData.length,
		});
	} catch (err) {
		res.status(500).json({
			status: "ERROR",
			message: err.message,
		});
	}
});

module.exports = router;
