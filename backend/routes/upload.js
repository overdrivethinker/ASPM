const express = require("express");
const xlsx = require("xlsx");
const knex = require("../database/db");
const multer = require("multer");
const router = express.Router();
const { processSheet, removeDuplicates } = require("../utils/parser");
const { toWIB } = require("../utils/helpers");

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024,
	},
	fileFilter: (req, file, cb) => {
		if (!file.originalname.match(/\.(csv)$/i)) {
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
		const skippedRows = [];

		await knex.transaction(async (trx) => {
			for (const row of rows) {
				let skipReason = null;

				if (
					!row.part_name ||
					!row.component_type ||
					row.component_size === undefined ||
					row.component_size === null ||
					row.reel_width === undefined ||
					row.reel_width === null
				) {
					skipReason = "Missing required fields";
					skipped++;
					skippedRows.push({ ...row, skip_reason: skipReason });
					continue;
				}

				const partListExists = await trx("dbo.part_list")
					.where("part_name", String(row.part_name))
					.first();

				if (!partListExists) {
					skipReason = "Part name not found in part_list";
					skipped++;
					skippedRows.push({ ...row, skip_reason: skipReason });
					continue;
				}

				const exists = await trx("dbo.part_library")
					.where("part_name", String(row.part_name))
					.first();

				if (exists) {
					skipReason = "Part already exists in library";
					skipped++;
					skippedRows.push({ ...row, skip_reason: skipReason });
					continue;
				}

				let componentTypeExist = await trx("dbo.component_type")
					.where("code", String(row.component_type))
					.first();

				if (!componentTypeExist) {
					skipReason = "Component type not found";
					skipped++;
					skippedRows.push({ ...row, skip_reason: skipReason });
					continue;
				}

				let componentSize = String(row.component_size);

				if (/^\d{3,4}$/.test(componentSize)) {
					componentSize = componentSize.padStart(4, "0");
				}

				const componentSizeExists = await trx("dbo.component_size")
					.where("metric_code", componentSize)
					.first();

				if (!componentSizeExists) {
					skipReason = "Component size not found";
					skipped++;
					skippedRows.push({ ...row, skip_reason: skipReason });
					continue;
				}

				const reelWidth = await trx("dbo.reel_width")
					.where("width_code", row.reel_width)
					.first();

				if (!reelWidth) {
					skipReason = "Reel width not found";
					skipped++;
					skippedRows.push({ ...row, skip_reason: skipReason });
					continue;
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

		const response = {
			status: "OK",
			file: req.file.originalname,
			inserted,
			skipped,
			total: rows.length,
		};

		if (skippedRows.length > 0) {
			const ws = xlsx.utils.json_to_sheet(skippedRows);
			const wb = xlsx.utils.book_new();
			xlsx.utils.book_append_sheet(wb, ws, "Skipped Data");

			const csvBuffer = xlsx.write(wb, {
				type: "buffer",
				bookType: "csv",
			});
			const base64CSV = csvBuffer.toString("base64");

			response.skippedFile = {
				data: base64CSV,
				filename: `SKIPPED_PARTS_${toWIB(new Date()).toISOString().split("T")[0].split("-").reverse().join("-")}.csv`,
			};
		}

		res.json(response);
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
