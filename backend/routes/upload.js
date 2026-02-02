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
				if (!row.part_name) continue;

				const exists = await trx("dbo.part_library")
					.where("part_name", String(row.part_name))
					.first();

				if (exists) {
					skipped++;
					continue;
				}

				await trx("dbo.part_library").insert({
					part_name: row.part_name,
					component_type: row.component_type,
					component_size: row.component_size,
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

		const COL_PART_CODE = 3;
		const COL_PART_NAME = 5;
		const COL_SUPPLIER = 6;
		const START_ROW = 7;

		const workbook = xlsx.read(req.file.buffer, { type: "buffer" });

		const allData = [];
		const maxSheetIndex = Math.min(workbook.SheetNames.length, 3);

		for (let i = 1; i < maxSheetIndex; i++) {
			const sheetName = workbook.SheetNames[i];
			const sheet = workbook.Sheets[sheetName];

			const sheetData = processSheet(
				sheet,
				COL_PART_CODE,
				COL_PART_NAME,
				COL_SUPPLIER,
				START_ROW,
				i,
			);

			allData.push(...sheetData);
		}

		const uniqueData = removeDuplicates(allData);

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
					supplier: row.supplier,
					specification: row.specification,
					value: row.value,
					tolerance: row.tolerance,
					reference_file: req.file.originalname,
				});

				inserted++;
			}
		});

		res.json({
			status: "OK",
			file: req.file.originalname,
			sheets_processed: maxSheetIndex - 1,
			inserted,
			skipped,
			total_unique: uniqueData.length,
			total_with_duplicates: allData.length,
		});
	} catch (err) {
		res.status(500).json({
			status: "ERROR",
			message: err.message,
		});
	}
});

module.exports = router;
