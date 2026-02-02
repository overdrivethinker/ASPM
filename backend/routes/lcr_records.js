const express = require("express");
const router = express.Router();
const knex = require("../database/db");

router.get("/export", async (req, res) => {
	try {
		const { search = "", start_date, end_date } = req.query;

		const buildDateRange = (start, end) => {
			if (start && end) {
				return {
					start: `${start} 00:00:00`,
					end: `${end} 23:59:59`,
				};
			}
			if (start) {
				return { start: `${start} 00:00:00` };
			}
			if (end) {
				return { end: `${end} 23:59:59` };
			}
			return null;
		};

		const dateRange = buildDateRange(start_date, end_date);

		let query = knex("LCR_records as lcr")
			.leftJoin(
				"part_list as pl_left",
				"lcr.left_id",
				"pl_left.part_number",
			)
			.leftJoin(
				"part_list as pl_right",
				"lcr.right_id",
				"pl_right.part_number",
			)
			.select(
				"lcr.timestamp",
				"lcr.user_id",
				"lcr.device_name",
				"lcr.left_id",
				"pl_left.value as left_value_value",
				"pl_left.tolerance as left_tolerance",
				"lcr.left_value",
				"lcr.right_id",
				"pl_right.value as right_value_value",
				"pl_right.tolerance as right_tolerance",
				"lcr.right_value",
				"lcr.result",
			)
			.orderBy("lcr.timestamp", "desc");

		if (search) {
			query = query.where(function () {
				this.where("lcr.device_name", "like", `%${search}%`)
					.orWhere("lcr.user_id", "like", `%${search}%`)
					.orWhere("lcr.machine_sn", "like", `%${search}%`)
					.orWhere("lcr.left_id", "like", `%${search}%`)
					.orWhere("lcr.right_id", "like", `%${search}%`)
					.orWhere("pl_left.part_number", "like", `%${search}%`)
					.orWhere("pl_left.part_name", "like", `%${search}%`)
					.orWhere("pl_right.part_number", "like", `%${search}%`)
					.orWhere("pl_right.part_name", "like", `%${search}%`);
			});
		}

		if (dateRange) {
			query = query.where(function () {
				if (dateRange.start && dateRange.end) {
					this.whereBetween("lcr.timestamp", [
						dateRange.start,
						dateRange.end,
					]);
				} else if (dateRange.start) {
					this.where("lcr.timestamp", ">=", dateRange.start);
				} else if (dateRange.end) {
					this.where("lcr.timestamp", "<=", dateRange.end);
				}
			});
		}

		const rows = await query;

		res.json({
			data: rows,
			total: rows.length,
		});
	} catch (err) {
		console.error("GET /lcr-records/export error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

router.get("/chart-data", async (req, res) => {
	try {
		const range = req.query.range || "90d";

		const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;

		const records = await knex("LCR_records")
			.select(
				knex.raw("CAST([timestamp] AS DATE) AS [date]"),
				knex.raw(
					"SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) AS pass",
				),
				knex.raw(
					"SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END) AS fail",
				),
			)
			.where(
				"[timestamp]",
				">=",
				knex.raw("DATEADD(DAY, ?, CAST(GETDATE() AS DATE))", [-days]),
			)
			.groupBy(knex.raw("CAST([timestamp] AS DATE)"))
			.orderBy("date", "asc");

		const chartData = records.map((r) => ({
			date: r.date,
			pass: Number(r.pass) || 0,
			fail: Number(r.fail) || 0,
		}));

		res.json({
			success: true,
			data: chartData,
		});
	} catch (error) {
		console.error("Error fetching chart data:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch chart data",
		});
	}
});

module.exports = router;
