const express = require("express");
const router = express.Router();
const knex = require("../database/db");

router.get("/export", async (req, res) => {
	try {
		const { start_date, end_date } = req.query;

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
				"part_library as plib_left",
				"pl_left.part_name",
				"plib_left.part_name",
			)
			.leftJoin(
				"part_list as pl_right",
				"lcr.right_id",
				"pl_right.part_number",
			)
			.leftJoin(
				"part_library as plib_right",
				"pl_right.part_name",
				"plib_right.part_name",
			)
			.select(
				"lcr.timestamp",
				"lcr.user_id",
				"lcr.device_name",
				"lcr.left_id",
				"pl_left.value as left_value_value",
				"pl_left.tolerance as left_tolerance",
				"plib_left.component_size as left_component_size",
				"lcr.left_value",
				"lcr.right_id",
				"pl_right.value as right_value_value",
				"pl_right.tolerance as right_tolerance",
				"lcr.right_value",
				"lcr.result",
			)
			.orderBy("lcr.timestamp", "desc");

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

router.get("/activity-logs/export", async (req, res) => {
	try {
		const { start_date, end_date } = req.query;

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

		let query = knex("api_activity_logs as log")
			.select(
				"log.timestamp",
				"log.user_id",
				"log.device_name",
				"log.left_id",
				"log.left_unique_id",
				"log.right_id",
				"log.right_unique_id",
				"log.status_code",
				"log.message",
				"log.error_detail",
			)
			.where("log.action", "check")
			.orderBy("log.timestamp", "desc");

		if (dateRange) {
			query = query.where(function () {
				if (dateRange.start && dateRange.end) {
					this.whereBetween("log.timestamp", [
						dateRange.start,
						dateRange.end,
					]);
				} else if (dateRange.start) {
					this.where("log.timestamp", ">=", dateRange.start);
				} else if (dateRange.end) {
					this.where("log.timestamp", "<=", dateRange.end);
				}
			});
		}

		const rows = await query;

		res.json({
			data: rows,
			total: rows.length,
		});
	} catch (err) {
		console.error("GET /api-activity-logs/export error:", err);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

module.exports = router;
