const express = require("express");
const router = express.Router();
const knex = require("../database/db");
const { toWIB } = require("../utils/helpers");

router.get("/overview", async (req, res) => {
	try {
		const endDate = toWIB(new Date());
		const startDate = toWIB(new Date());
		startDate.setDate(startDate.getDate() - 90);

		const [
			partLibraryTotal,
			partListTotal,
			partListWithValue,
			partListWithTolerance,
			lcrStats,
		] = await Promise.all([
			knex("part_library").count("* as count").first(),

			knex("part_list").count("* as count").first(),

			knex("part_list")
				.count("* as count")
				.whereNotNull("value")
				.where("value", "!=", "")
				.first(),

			knex("part_list")
				.count("* as count")
				.whereNotNull("tolerance")
				.where("tolerance", "!=", "")
				.first(),

			knex("LCR_records")
				.whereBetween("timestamp", [startDate, endDate])
				.select(
					knex.raw("COUNT(*) as totalTests"),
					knex.raw(
						"SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) as passCount",
					),
					knex.raw(
						"SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) as failCount",
					),
				)
				.first(),
		]);

		const totalTests = Number(lcrStats?.totalTests || 0);
		const passCount = Number(lcrStats?.passCount || 0);
		const failCount = Number(lcrStats?.failCount || 0);
		const passRate = totalTests
			? +((passCount / totalTests) * 100).toFixed(2)
			: 0;

		res.json({
			success: true,
			data: {
				partLibraryTotal: Number(partLibraryTotal?.count || 0),
				partListTotal: Number(partListTotal?.count || 0),
				partListWithValue: Number(partListWithValue?.count || 0),
				partListWithTolerance: Number(
					partListWithTolerance?.count || 0,
				),
				lcr: {
					totalTests,
					passCount,
					failCount,
					passRate,
				},
			},
		});
	} catch (err) {
		console.error("GET /statistics/overview error:", err);
		res.status(500).json({
			success: false,
			message: err.message,
		});
	}
});

module.exports = router;
