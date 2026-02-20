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
			partListUnique,
			countMissingValueTolerance,
			lcrStats,
			uniqueComponentTypes,
			uniqueComponentSizes,
			uniqueReelWidths,
		] = await Promise.all([
			knex("part_library").count("* as count").first(),

			knex("part_list").count("* as count").first(),

			knex("part_list").countDistinct("part_name as count").first(),

			knex("part_library as pl")
				.leftJoin(
					"part_list as plist",
					"pl.part_name",
					"plist.part_name",
				)
				.where(function () {
					this.where("pl.component_type", "!=", "HW").andWhere(
						function () {
							this.where(function () {
								this.whereIn("pl.component_type", [
									"RES",
									"CAP",
								])
									.andWhere(function () {
										this.whereNull("plist.value")
											.orWhereNull("plist.tolerance")
											.orWhere("plist.value", "")
											.orWhere("plist.tolerance", "");
									})
									.andWhere(function () {
										this.whereNull(
											"plist.specification",
										).orWhereRaw(
											"plist.specification NOT LIKE ?",
											["%BM%"],
										);
									});
							})
								.orWhere(function () {
									this.where(function () {
										this.whereRaw(
											"plist.specification LIKE '%[0-9]PF%'",
										)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]PF[,;%]%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '% PF%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]NF%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]NF[,;%]%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '% NF%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]UF%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]UF[,;%]%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '% UF%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]MF%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]MF[,;%]%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '% MF%'",
											);
									})
										.whereNotIn("pl.component_type", [
											"CAP",
											"CM",
										])
										.whereRaw(
											"plist.specification NOT LIKE ?",
											["%BM%"],
										);
								})
								.orWhere(function () {
									this.where(function () {
										this.whereRaw(
											"plist.specification LIKE '%[0-9]OHM%'",
										)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]OHM[,;%]%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '% OHM%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]KOHM%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]KOHM[,;%]%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '% KOHM%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]MOHM%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '%[0-9]MOHM[,;%]%'",
											)
											.orWhereRaw(
												"plist.specification LIKE '% MOHM%'",
											);
									})
										.whereNotIn("pl.component_type", [
											"RES",
											"RM",
										])
										.whereRaw(
											"plist.specification NOT LIKE ?",
											["%BM%"],
										);
								});
						},
					);
				})
				.countDistinct("pl.part_name as count")
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

			knex("part_library")
				.countDistinct("component_type as count")
				.first(),

			knex("part_library")
				.countDistinct("component_size as count")
				.first(),

			knex("part_library").countDistinct("reel_width as count").first(),
		]);

		const totalPartLibrary = Number(partLibraryTotal?.count || 0);
		const totalPartList = Number(partListTotal?.count || 0);
		const uniquePartList = Number(partListUnique?.count || 0);
		const duplicateRowCount = totalPartList - uniquePartList;

		const missingCount = Number(countMissingValueTolerance?.count || 0);
		const validCount = Math.max(uniquePartList - missingCount, 0);

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
				partListTotal: totalPartList,
				partListUnique: uniquePartList,
				partListDuplicate: duplicateRowCount,

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

				uniqueCounts: {
					componentTypes: Number(uniqueComponentTypes?.count || 0),
					componentSizes: Number(uniqueComponentSizes?.count || 0),
					reelWidths: Number(uniqueReelWidths?.count || 0),
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

		const windowSize = range === "7d" ? 2 : range === "30d" ? 5 : 7;

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

		const dailyRate = records.map((r) => {
			const pass = Number(r.pass) || 0;
			const fail = Number(r.fail) || 0;
			const total = pass + fail;
			return {
				date: r.date,
				pass,
				fail,
				passRate:
					total === 0 ? null : +((pass / total) * 100).toFixed(2),
			};
		});

		const movingAvg = dailyRate.map((r, i) => {
			const window = dailyRate.slice(
				Math.max(0, i - (windowSize - 1)),
				i + 1,
			);
			const validPoints = window.filter((x) => x.passRate !== null);

			const avg =
				validPoints.length === 0
					? null
					: +(
							validPoints.reduce((s, x) => s + x.passRate, 0) /
							validPoints.length
						).toFixed(2);

			return { ...r, mva: avg };
		});

		const validMva = movingAvg.filter((r) => r.mva !== null);
		const firstMva = validMva.at(0)?.mva ?? 0;
		const lastMva = validMva.at(-1)?.mva ?? 0;
		const trendDiff = +(lastMva - firstMva).toFixed(2);

		const totalPass = records.reduce((s, r) => s + Number(r.pass), 0);
		const totalFail = records.reduce((s, r) => s + Number(r.fail), 0);
		const totalAll = totalPass + totalFail;

		const worstDay = dailyRate.reduce(
			(worst, r) => (r.fail > (worst?.fail ?? -1) ? r : worst),
			null,
		);

		const insights = {
			overallPassRate:
				totalAll === 0 ? 0 : +((totalPass / totalAll) * 100).toFixed(2),
			trend: {
				direction:
					trendDiff > 1 ? "up" : trendDiff < -1 ? "down" : "stable",
				value: +Math.abs(trendDiff).toFixed(2),
			},
			worstDay: worstDay
				? { date: worstDay.date, failCount: worstDay.fail }
				: null,
			totalRecords: totalAll,
		};

		res.json({
			success: true,
			data: movingAvg,
			insights,
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
