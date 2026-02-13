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
			countMissingValueTolerance,
			lcrStats,
		] = await Promise.all([
			knex("part_library").count("* as count").first(),

			knex("part_list").count("* as count").first(),

			knex("part_library as pl")
				.leftJoin(
					"part_list as plist",
					"pl.part_name",
					"plist.part_name",
				)
				.where(function () {
					this.where(function () {
						this.whereIn("pl.component_type", ["RES", "CAP"])
							.andWhere(function () {
								this.whereNull("plist.value")
									.orWhereNull("plist.tolerance")
									.orWhere("plist.value", "")
									.orWhere("plist.tolerance", "");
							})
							.andWhere(function () {
								this.where(function () {
									this.whereNull("plist.specification");
								}).andWhere(function () {
									this.where(
										"plist.specification",
										"like",
										"%OHM%",
									)
										.orWhere(
											"plist.specification",
											"like",
											"%KOHM%",
										)
										.orWhere(
											"plist.specification",
											"like",
											"%MOHM%",
										)
										.orWhere(
											"plist.specification",
											"like",
											"%PF%",
										)
										.orWhere(
											"plist.specification",
											"like",
											"%NF%",
										)
										.orWhere(
											"plist.specification",
											"like",
											"%UF%",
										)
										.orWhere(
											"plist.specification",
											"like",
											"%MF%",
										);
								});
							});
					}).orWhere(function () {
						this.whereNotIn("pl.component_type", [
							"RES",
							"CAP",
						]).andWhere(function () {
							this.where("plist.specification", "like", "%OHM%")
								.orWhere(
									"plist.specification",
									"like",
									"%KOHM%",
								)
								.orWhere(
									"plist.specification",
									"like",
									"%MOHM%",
								)
								.orWhere("plist.specification", "like", "%PF%")
								.orWhere("plist.specification", "like", "%NF%")
								.orWhere("plist.specification", "like", "%UF%")
								.orWhere("plist.specification", "like", "%MF%");
						});
					});
				})
				.count("* as count")
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

		const totalPartLibrary = Number(partLibraryTotal?.count || 0);
		const missingCount = Number(countMissingValueTolerance?.count || 0);
		const validCount = Math.max(
			Number(partListTotal?.count || 0) - missingCount,
			0,
		);

		const validPercentage = totalPartLibrary
			? +((validCount / totalPartLibrary) * 100).toFixed(2)
			: 0;

		const totalTests = Number(lcrStats?.totalTests || 0);
		const passCount = Number(lcrStats?.passCount || 0);
		const failCount = Number(lcrStats?.failCount || 0);
		const passRate = totalTests
			? +((passCount / totalTests) * 100).toFixed(2)
			: 0;

		res.json({
			success: true,
			data: {
				partLibraryTotal: totalPartLibrary,
				partListTotal: Number(partListTotal?.count || 0),

				valueToleranceStatus: {
					validCount,
					missingCount,
					validPercentage,
				},

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
