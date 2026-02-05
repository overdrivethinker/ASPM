const express = require("express");
const xlsx = require("xlsx");
const knex = require("../database/db");
const multer = require("multer");
const router = express.Router();
const { processSheet, removeDuplicates } = require("../utils/parser");

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024,
	},
	fileFilter: (req, file, cb) => {
		if (!file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
			return cb(new Error("ONLY EXCEL OR CSV FILES ARE ALLOWED"));
		}
		cb(null, true);
	},
});

router.post("/partlib", upload.single("file"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: "NO FILE UPLOADED" });
		}

		const isCSV = req.file.originalname.toLowerCase().endsWith(".csv");

		const workbook = isCSV
			? xlsx.read(req.file.buffer, { type: "buffer", FS: "," })
			: xlsx.read(req.file.buffer, { type: "buffer" });

		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const rows = xlsx.utils.sheet_to_json(sheet);

		if (!rows.length) {
			return res.status(400).json({ message: "[FILE] FILE IS EMPTY" });
		}

		let inserted = 0;
		let skipped = 0;

		await knex.transaction(async (trx) => {
			for (const row of rows) {
				if (
					!row.part_name ||
					!row.component_type ||
					!row.component_size ||
					!row.reel_width
				) {
					skipped++;
					continue;
				}

				const partListExists = await trx("dbo.part_list")
					.where("part_name", String(row.part_name))
					.first();

				if (!partListExists) {
					skipped++;
					continue;
				}

				const exists = await trx("dbo.part_library")
					.where("part_name", String(row.part_name))
					.first();

				if (exists) {
					skipped++;
					continue;
				}

				let componentSize = String(row.component_size);
				if (/^\d{3,4}$/.test(componentSize)) {
					componentSize = componentSize.padStart(4, "0");
				}

				await trx("dbo.part_library").insert({
					part_name: row.part_name,
					component_type: row.component_type,
					component_size: componentSize,
					reel_width: row.reel_width,
				});

				inserted++;
			}
		});

		res.json({
			status: "OK",
			file: req.file.originalname,
			inserted,
			skipped,
			total: rows.length,
		});
	} catch (err) {
		res.status(500).json({
			status: "ERROR",
			message: err.message,
		});
	}
});

router.post("/partlist", upload.single("file"), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: "NO FILE UPLOADED" });
		}

		const COL_ITMCD = 0;
		const COL_PRDNO = 1;
		const COL_SPECS = 2;
		const START_ROW = 1;

		const workbook = xlsx.read(req.file.buffer, { type: "buffer" });

		const firstSheetName = workbook.SheetNames[0];
		const firstSheet = workbook.Sheets[firstSheetName];

		const sheetData = processSheet(
			firstSheet,
			COL_ITMCD,
			COL_PRDNO,
			COL_SPECS,
			START_ROW,
		);

		const uniqueData = removeDuplicates(sheetData);

		if (!uniqueData.length) {
			return res.status(400).json({ message: "[XLSX] FILE IS EMPTY" });
		}

		let inserted = 0;
		let skipped = 0;

		await knex.transaction(async (trx) => {
			for (const row of uniqueData) {
				if (!row.part_code) continue;

				const exists = await trx("dbo.part_list")
					.where("part_number", row.part_code)
					.first();

				if (exists) {
					skipped++;
					continue;
				}

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
			file: req.file.originalname,
			sheets_processed: 1,
			inserted,
			skipped,
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
