const express = require("express");
const router = express.Router();
const knex = require("../database/db");
const APILogger = require("../utils/api-logger");

router.post("/", async (req, res) => {
	handyReplicate(req, res);
});

async function handyReplicate(req, res) {
	const {
		LEFTID,
		LEFTUNIQUEID,
		RIGHTID,
		RIGHTUNIQUEID,
		TIMESTAMP,
		USERID,
		DEVICENAME,
	} = req.body;

	try {
		const result = await knex.transaction(async (trx) => {
			const leftPart = await trx("dbo.wms_v_raw_material_labels")
				.where({
					code: LEFTUNIQUEID,
					item_code: LEFTID,
				})
				.whereNull("deleted_at")
				.first();

			const rightPart = await trx("dbo.wms_v_raw_material_labels")
				.where({
					code: RIGHTUNIQUEID,
					item_code: RIGHTID,
				})
				.whereNull("deleted_at")
				.first();

			if (!leftPart || !rightPart) {
				const missingType =
					!leftPart && !rightPart
						? "both"
						: !leftPart
							? "left"
							: "right";

				await APILogger.logPartDeleted(req.body, missingType, trx);

				if (!leftPart && !rightPart) {
					return {
						code: 0,
						message: `\nPART WAS DELETED\nL:${LEFTUNIQUEID} | R:${RIGHTUNIQUEID}`,
						data: "",
					};
				}
				if (!leftPart) {
					return {
						code: 0,
						message: `\nLEFT PART WAS DELETED: ${LEFTUNIQUEID}`,
						data: "",
					};
				}
				if (!rightPart) {
					return {
						code: 0,
						message: `\nRIGHT PART WAS DELETED: ${RIGHTUNIQUEID}`,
						data: "",
					};
				}
			}

			const leftDocCode = leftPart.doc_code;
			const rightDocCode = rightPart.doc_code;

			if (leftDocCode !== rightDocCode) {
				await APILogger.logPSNDifferent(
					req.body,
					leftDocCode,
					rightDocCode,
					trx,
				);

				return {
					code: 0,
					message: `\nPSN DIFFERENT\nL DOC:${leftDocCode} | R DOC:${rightDocCode}`,
					data: "",
				};
			}

			if (LEFTID != RIGHTID) {
				const getAssyNo = await trx("dbo.WMS_TLWS")
					.where("TLWS_PSNNO", rightDocCode)
					.orderBy("TLWS_LUPDT", "desc")
					.first();

				if (!getAssyNo || !getAssyNo.TLWS_MDLCD) {
					await APILogger.logAssyNoNotFound(
						req.body,
						rightDocCode,
						trx,
					);

					return {
						code: 0,
						message: "\nASSY NO NOT FOUND\nPSN:" + rightDocCode,
						data: "",
					};
				}

				const rawAssyNo = getAssyNo.TLWS_MDLCD;
				const assyNo = rawAssyNo.slice(0, 7) + "-" + rawAssyNo.slice(7);

				const checkCommonPart = await trx("dbo.ENG_COMM_SUB_PART")
					.where("[ASSY CODE]", assyNo)
					.andWhere(function () {
						this.where(function () {
							this.where("[MAIN PARTS]", LEFTID).andWhere(
								"[ALTERNATIVE PARTS]",
								RIGHTID,
							);
						}).orWhere(function () {
							this.where("[MAIN PARTS]", RIGHTID).andWhere(
								"[ALTERNATIVE PARTS]",
								LEFTID,
							);
						});
					})
					.first();

				if (!checkCommonPart) {
					await APILogger.logPartNotCommon(req.body, trx);

					return {
						code: 0,
						message: `\nPARTS NOT COMMON OR SUBSTITUTE\nL:${LEFTID} | R:${RIGHTID}\nFOR ASSY NO:${assyNo}`,
						data: "",
					};
				}

				const checkSAParts = await trx("dbo.wms_v_mitmsa")
					.where("MITMSA_MDLCD", rawAssyNo)
					.andWhere(function () {
						this.where(function () {
							this.where("MITMSA_ITCD", LEFTID).andWhere(
								"MITMSA_ITCDS",
								RIGHTID,
							);
						}).orWhere(function () {
							this.where("MITMSA_ITCD", RIGHTID).andWhere(
								"MITMSA_ITCDS",
								LEFTID,
							);
						});
					})
					.first();

				if (!checkSAParts) {
					await APILogger.logPartNotSA(req.body, trx);

					return {
						code: 0,
						message: `\nPARTS NOT SA\nL:${LEFTID} | R:${RIGHTID}\nFOR ASSY NO:${assyNo}`,
						data: "",
					};
				}
			}

			return {
				code: 1,
				message: "PARTS VERIFIED SUCCESSFULLY",
				data: "",
			};
		});
		return res.json(result);
	} catch (err) {
		return res.status(500).json({
			code: 0,
			message: err.message,
			data: "",
		});
	}
}

module.exports = router;
