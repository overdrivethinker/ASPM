require("dotenv").config({ path: __dirname + "/../.env" });
const express = require("express");
const router = express.Router();
const knex = require("../database/db");
const APILogger = require("../utils/api-logger");
const cmas_enabled = process.env.CMAS_ENABLED === "true";
const cmas_endpoint = process.env.CMAS_ENDPOINT;
const swps_enabled = process.env.SWPS_ENABLED === "true";
const swps_endpoint = process.env.SWPS_ENDPOINT;
const axios = require("axios");

async function getPart(trx, uniqueId, itemId) {
	return trx("dbo.wms_v_raw_material_labels")
		.where({
			code: uniqueId,
			item_code: itemId,
		})
		.whereNull("deleted_at")
		.first();
}

async function getDocCode(trx, itemCode, uniqueId) {
	const splscn = await trx("dbo.wms_v_splscn")
		.where({
			SPLSCN_ITMCD: itemCode,
			SPLSCN_UNQCODE: uniqueId,
		})
		.orderBy("SPLSCN_LUPDT", "asc")
		.first();

	if (splscn) {
		return {
			doc: splscn.SPLSCN_DOC,
		};
	}

	const c3lc = await trx("dbo.wms_v_c3lc")
		.where({
			C3LC_ITMCD: itemCode,
			C3LC_NEWID: uniqueId,
		})
		.first();

	if (c3lc) {
		return {
			doc: c3lc.C3LC_DOC,
		};
	}

	return null;
}

async function getTlwsByDoc(trx, doc) {
	return trx("dbo.WMS_TLWS")
		.where("TLWS_PSNNO", doc)
		.orderBy("TLWS_LUPDT", "asc")
		.first();
}

async function getPartByPartNumber(trx, partNumber) {
	return trx("dbo.part_list").where("part_number", partNumber).first();
}

async function getLibraryByPartName(trx, partName) {
	if (!partName) return null;

	return trx("dbo.part_library").where("part_name", partName).first();
}

async function sendAlert(line, spid, no, status = "active") {
	if (!cmas_enabled) {
		return;
	}

	try {
		await axios.post(cmas_endpoint, {
			line,
			status,
			spid,
			no,
		});
	} catch (error) {
		console.error("Failed to send alert:", error.message);
	}
}

async function storeSWPS({
	woNo,
	proc,
	lineName,
	mcMcZItm,
	RIGHTID,
	rightLotNumber,
	LEFTID,
	leftLotNumber,
	rightQty,
	leftQty,
	RIGHTUNIQUEID,
	LEFTUNIQUEID,
	psnNo,
	jobNo,
	spid,
	mc,
	mcz,
	rawAssyNo,
	bomRev,
	mainItmCd,
	USERID,
	finalResult,
}) {
	if (!swps_enabled) {
		return;
	}

	try {
		await axios.post(swps_endpoint, {
			SWPS_WONO: woNo,
			SWPS_PROCD: proc,
			SWPS_LINENO: lineName,
			SWPS_MCMCZITM: mcMcZItm,
			SWPS_ITMCD: RIGHTID,
			SWPS_LOTNO: rightLotNumber,
			SWPS_NITMCD: LEFTID,
			SWPS_NLOTNO: leftLotNumber,
			SWPS_REMQT: 0,
			SWPS_LUPDT: new Date().toISOString(),
			SWPS_LUPBY: USERID,
			SWPS_REMARK: finalResult,
			QTY: rightQty,
			NQTY: leftQty,
			SWPS_UNQ: RIGHTUNIQUEID,
			SWPS_NUNQ: LEFTUNIQUEID,
			SWPS_PSNNO: psnNo,
			SWPS_JOBNO: jobNo,
			SWPS_SPID: spid,
			SWPS_MC: mc,
			SWPS_MCZ: mcz,
			SWPS_MDLCD: rawAssyNo,
			SWPS_BOMRV: bomRev,
			SWPS_MAINITMCD: mainItmCd,
		});
	} catch (error) {
		console.error("Failed to store SWPS:", error.message);
	}
}

router.get("/", (req, res) => {
	res.send("CONNECTED TO PSI-ASPM API INTERFACE");
});

router.post("/", async (req, res) => {
	try {
		const { action } = req.body;

		if (action === "check") {
			return await handleCheck(req, res);
		} else if (action === "save") {
			return await handleSave(req, res);
		} else {
			await APILogger.logInvalidAction(action);

			return res.status(400).json({
				code: 0,
				message: "INVALID ACTION. USE 'check' OR 'save'",
				data: "",
			});
		}
	} catch (err) {
		await APILogger.logSystemError(req.body.action, err);

		res.status(500).json({
			code: 0,
			message: err.message,
			data: "",
		});
	}
});

async function handleCheck(req, res) {
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
			if (!LEFTID || !RIGHTID) {
				await APILogger.logMissingFields({
					action: "check",
					left_id: LEFTID,
					right_id: RIGHTID,
					timestamp: TIMESTAMP,
					user_id: USERID,
					device_name: DEVICENAME,
				});

				return {
					code: 0,
					message: "\nLEFTID AND RIGHTID ARE REQUIRED",
					data: "",
				};
			}

			if (LEFTUNIQUEID?.length !== 16 || RIGHTUNIQUEID?.length !== 16) {
				const invalidType =
					LEFTUNIQUEID?.length !== 16 && RIGHTUNIQUEID?.length !== 16
						? "both"
						: LEFTUNIQUEID?.length !== 16
							? "left"
							: "right";

				await APILogger.logInvalidUniqueCode(
					req.body,
					invalidType,
					trx,
				);

				if (
					LEFTUNIQUEID?.length !== 16 &&
					RIGHTUNIQUEID?.length !== 16
				) {
					return {
						code: 0,
						message: `\nINVALID UNIQUE CODE\nL:${LEFTUNIQUEID} | R:${RIGHTUNIQUEID}`,
						data: "",
					};
				}

				if (LEFTUNIQUEID?.length !== 16) {
					return {
						code: 0,
						message: `\nLEFT UNIQUE CODE INVALID: ${LEFTUNIQUEID}`,
						data: "",
					};
				}

				if (RIGHTUNIQUEID?.length !== 16) {
					return {
						code: 0,
						message: `\nRIGHT UNIQUE CODE INVALID: ${RIGHTUNIQUEID}`,
						data: "",
					};
				}
			}

			if (LEFTUNIQUEID == RIGHTUNIQUEID) {
				await APILogger.logDuplicateCode(req.body, trx);

				return {
					code: 0,
					message: "\nDUPLICATE UNIQUE CODE",
					data: "",
				};
			}

			const [leftUniquePart, rightUniquePart] = await Promise.all([
				getPart(trx, LEFTUNIQUEID, LEFTID),
				getPart(trx, RIGHTUNIQUEID, RIGHTID),
			]);

			if (!leftUniquePart || !rightUniquePart) {
				const missingType =
					!leftUniquePart && !rightUniquePart
						? "both"
						: !leftUniquePart
							? "left"
							: "right";

				await APILogger.logPartDeleted(req.body, missingType, trx);

				const messages = {
					both: `\nPART WAS DELETED\nL:${LEFTUNIQUEID} | R:${RIGHTUNIQUEID}`,
					left: `\nLEFT PART WAS DELETED\n${LEFTUNIQUEID}`,
					right: `\nRIGHT PART WAS DELETED\n${RIGHTUNIQUEID}`,
				};

				return {
					code: 0,
					message: messages[missingType],
					data: "",
				};
			}

			const [leftDocCode, rightDocCode] = await Promise.all([
				getDocCode(trx, LEFTID, LEFTUNIQUEID),
				getDocCode(trx, RIGHTID, RIGHTUNIQUEID),
			]);

			if (!leftDocCode || !rightDocCode) {
				const missingType =
					!leftDocCode && !rightDocCode
						? "both"
						: !leftDocCode
							? "left"
							: "right";

				await APILogger.logPSNMissing(req.body, missingType, trx);

				const messages = {
					both: `\nPSN BOTH MISSING\nL:${LEFTID} | R:${RIGHTID}`,
					left: `\nLEFT PSN MISSING\n${LEFTID}`,
					right: `\nRIGHT PSN MISSING\n${RIGHTID}`,
				};

				return {
					code: 0,
					message: messages[missingType],
					data: "",
				};
			}

			if (leftDocCode.doc !== rightDocCode.doc) {
				await APILogger.logPSNDifferent(
					req.body,
					leftDocCode.doc,
					rightDocCode.doc,
					trx,
				);

				return {
					code: 0,
					message: `\nPSN ARE DIFFERENT\nL DOC:${leftDocCode.doc} |\nR DOC:${rightDocCode.doc}`,
					data: "",
				};
			}

			let componentType = "NORMAL PARTS";
			let isCommon = false;
			let isSA = false;

			const [leftTlws, rightTlws] = await Promise.all([
				getTlwsByDoc(trx, leftDocCode.doc),
				getTlwsByDoc(trx, rightDocCode.doc),
			]);

			if (!leftTlws || !rightTlws) {
				const missingType =
					!leftTlws && !rightTlws
						? "both"
						: !leftTlws
							? "left"
							: "right";

				await APILogger.logAltPartNotFound(req.body, missingType, trx);

				const messages = {
					both: `\nNON-PRODUCTION PART\nL:${LEFTUNIQUEID} | R:${RIGHTUNIQUEID}`,
					left: `\nLEFT NON-PRODUCTION PART\n${LEFTUNIQUEID}`,
					right: `\nRIGHT NON-PRODUCTION PART\n${RIGHTUNIQUEID}`,
				};

				return {
					code: 0,
					message: messages[missingType],
					data: "",
				};
			}

			if (LEFTID != RIGHTID) {
				const line = rightTlws.TLWS_LINENO;
				const spid = rightTlws.TLWS_SPID;
				const no = DEVICENAME;

				const rawAssyNo = rightTlws.TLWS_MDLCD;
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

					await sendAlert(line, spid, no, "active");

					return {
						code: 0,
						message: `\nPARTS NOT COMMON OR SUBSTITUTE\nL:${LEFTID} | R:${RIGHTID}\nFOR ASSY NO:${assyNo}`,
						data: "",
					};
				}

				isCommon = true;

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

					await sendAlert(line, spid, no, "active");

					return {
						code: 0,
						message: `\nPARTS NOT SA\nL:${LEFTID} | R:${RIGHTID}\nFOR ASSY NO:${assyNo}`,
						data: "",
					};
				}

				isSA = true;

				if (isSA) {
					componentType = "SA PARTS";
				} else if (isCommon) {
					componentType = `${checkCommonPart.TYPE} PARTS`;
				}
			}

			const [leftPart, rightPart] = await Promise.all([
				getPartByPartNumber(trx, LEFTID),
				getPartByPartNumber(trx, RIGHTID),
			]);

			if (!leftPart || !rightPart) {
				const missingType =
					!leftPart && !rightPart
						? "both"
						: !leftPart
							? "left"
							: "right";

				await APILogger.logPartNotFound(req.body, missingType, trx);

				const messages = {
					both: `\nPART NUMBERS NOT FOUND\nL:${LEFTID} | R:${RIGHTID}`,
					left: `\nPART NUMBER NOT FOUND\nL:${LEFTID}`,
					right: `\nPART NUMBER NOT FOUND\nR:${RIGHTID}`,
				};

				return {
					code: 0,
					message: messages[missingType],
					data: "",
				};
			}

			const [leftLibrary, rightLibrary] = await Promise.all([
				getLibraryByPartName(trx, leftPart?.part_name),
				getLibraryByPartName(trx, rightPart?.part_name),
			]);

			if (!leftLibrary || !rightLibrary) {
				const missingType =
					!leftLibrary && !rightLibrary
						? "both"
						: !leftLibrary
							? "left"
							: "right";

				await APILogger.logLibraryNotFound(
					req.body,
					missingType,
					{ left: leftPart.part_name, right: rightPart.part_name },
					trx,
				);

				const messages = {
					both: `\nPARTS LIBRARY NOT FOUND\nL:${leftPart.part_name} | R:${rightPart.part_name}`,
					left: `\nPARTS LIBRARY NOT FOUND\nL:${leftPart.part_name}`,
					right: `\nPARTS LIBRARY NOT FOUND\nR:${rightPart.part_name}`,
				};

				return {
					code: 0,
					message: messages[missingType],
					data: "",
				};
			}

			const checkLibraryComplete = (library) => {
				return !!(
					library.component_type &&
					library.component_size &&
					library.reel_width
				);
			};

			const leftComplete = checkLibraryComplete(leftLibrary);
			const rightComplete = checkLibraryComplete(rightLibrary);

			if (!leftComplete || !rightComplete) {
				const incompleteType =
					!leftComplete && !rightComplete
						? "both"
						: !leftComplete
							? "left"
							: "right";

				await APILogger.logLibraryIncomplete(
					req.body,
					incompleteType,
					{ left: leftPart.part_name, right: rightPart.part_name },
					trx,
				);

				const messages = {
					both: `\nPARTS LIBRARY INCOMPLETE\nL:${leftPart.part_name} | R:${rightPart.part_name}`,
					left: `\nPARTS LIBRARY INCOMPLETE\nL:${leftPart.part_name}`,
					right: `\nPARTS LIBRARY INCOMPLETE\nR:${rightPart.part_name}`,
				};

				return {
					code: 0,
					message: messages[incompleteType],
					data: "",
				};
			}

			if (
				leftLibrary.reel_width !== "8" &&
				rightLibrary.reel_width !== "8"
			) {
				await APILogger.logReelWidthIssue(
					req.body,
					"both_above_8",
					{
						left: leftLibrary.reel_width,
						right: rightLibrary.reel_width,
					},
					componentType,
					trx,
				);

				return {
					code: 2,
					message: `BOTH TRAYS IC/REEL WIDTH ARE ABOVE 8MM\n(${componentType})`,
					data: "",
				};
			} else if (leftLibrary.reel_width !== "8") {
				await APILogger.logReelWidthIssue(
					req.body,
					"left_mismatch",
					{
						left: leftLibrary.reel_width,
						right: rightLibrary.reel_width,
					},
					trx,
				);

				const width = [];
				width.push(`L:${leftLibrary.reel_width}MM`);
				width.push(`R:${rightLibrary.reel_width}MM`);
				return {
					code: 0,
					message: `\nREEL WIDTH MISMATCH\n${width.join(" | ")}`,
					data: "",
				};
			} else if (rightLibrary.reel_width !== "8") {
				await APILogger.logReelWidthIssue(
					req.body,
					"right_mismatch",
					{
						left: leftLibrary.reel_width,
						right: rightLibrary.reel_width,
					},
					trx,
				);

				return {
					code: 0,
					message: `\nREEL WIDTH MISMATCH\nR:${rightLibrary.reel_width}MM`,
					data: "",
				};
			}

			const leftHasBM = leftPart?.specification?.startsWith("BM");
			const rightHasBM = rightPart?.specification?.startsWith("BM");
			const hasBodyMarking = !!leftHasBM || !!rightHasBM;

			const isCapRes =
				["CAP", "RES"].includes(leftLibrary.component_type) &&
				["CAP", "RES"].includes(rightLibrary.component_type);

			if (hasBodyMarking && isCapRes) {
				await APILogger.logCheckSuccess(
					req.body,
					"body_marking",
					"Component type with body marking (CAP/RES)",
					componentType,
					trx,
				);

				return {
					code: 1,
					message: "COMPONENT TYPE WITH BODY MARKING",
					data: {
						DESCRIPTION: "",
					},
				};
			}

			if (!hasBodyMarking && !isCapRes) {
				await APILogger.logCheckSuccess(
					req.body,
					"not_cap_res",
					`Component types: L:${leftLibrary.component_type}, R:${rightLibrary.component_type}`,
					componentType,
					trx,
				);

				return {
					code: 1,
					message: "COMPONENT TYPE NOT CAP/RES",
					data: {
						DESCRIPTION: "",
					},
				};
			}

			const leftInvalid = !leftPart.value || !leftPart.tolerance;
			const rightInvalid = !rightPart.value || !rightPart.tolerance;

			if (leftInvalid || rightInvalid) {
				const missingType =
					leftInvalid && rightInvalid
						? "both"
						: leftInvalid
							? "left"
							: "right";

				await APILogger.logValueToleranceNotFound(
					req.body,
					missingType,
					trx,
				);

				const messages = {
					both: `\nVALUE/TOLERANCE NOT FOUND FOR CAP/RES PART\nL:${LEFTID} | R:${RIGHTID}`,
					left: `\nVALUE/TOLERANCE NOT FOUND FOR CAP/RES PART\nL:${LEFTID}`,
					right: `\nVALUE/TOLERANCE NOT FOUND FOR CAP/RES PART\nR:${RIGHTID}`,
				};

				return {
					code: 0,
					message: messages[missingType],
					data: "",
				};
			}

			const checkSize = await trx("dbo.component_size")
				.where("metric_code", leftLibrary.component_size)
				.first();

			if (!checkSize) {
				await APILogger.logSizeNotFound(
					req.body,
					leftLibrary.component_size,
					trx,
				);
				return {
					code: 0,
					message: `COMPONENT SIZE NOT FOUND: ${leftLibrary.component_size}`,
					data: "",
				};
			}

			const leftDescription = `${leftLibrary.component_type}_${leftPart.value}_${leftPart.tolerance}_${leftLibrary.component_size}`;

			await APILogger.logCheckSuccess(
				req.body,
				"identical",
				`Description: ${leftDescription}`,
				componentType,
				trx,
			);

			return {
				code: 1,
				message: "PARTS ARE IDENTICAL",
				data: {
					DESCRIPTION: leftDescription,
				},
			};
		});

		return res.json(result);
	} catch (err) {
		await APILogger.logCheckError(req.body, err);
		return res.status(500).json({
			code: 0,
			message: err.message,
			data: "",
		});
	}
}

async function handleSave(req, res) {
	const {
		TIMESTAMP,
		USERID,
		MACHINESN,
		DEVICENAME,
		LEFTID,
		LEFTUNIQUEID,
		LEFTVALUE,
		LEFTRESULT,
		RIGHTID,
		RIGHTUNIQUEID,
		RIGHTVALUE,
		RIGHTRESULT,
	} = req.body;

	if (!LEFTID || !RIGHTID || !TIMESTAMP || !USERID) {
		await APILogger.logSaveMissingFields(req.body);
		return res.json({
			code: 0,
			message: "REQUIRED FIELDS ARE MISSING",
			data: "",
		});
	}

	try {
		await knex.transaction(async (trx) => {
			const [leftPart, rightPart] = await Promise.all([
				getPartByPartNumber(trx, LEFTID),
				getPartByPartNumber(trx, RIGHTID),
			]);

			const [leftLibrary, rightLibrary] = await Promise.all([
				getLibraryByPartName(trx, leftPart?.part_name),
				getLibraryByPartName(trx, rightPart?.part_name),
			]);

			const leftHasBM = leftPart?.specification?.startsWith("BM");
			const rightHasBM = rightPart?.specification?.startsWith("BM");
			const hasBodyMarking = !!leftHasBM || !!rightHasBM;

			const isCapRes =
				["CAP", "RES"].includes(leftLibrary.component_type) &&
				["CAP", "RES"].includes(rightLibrary.component_type);

			let finalResult =
				LEFTRESULT === "OK" && RIGHTRESULT === "OK" ? "PASS" : "FAIL";

			let leftValueToSave = LEFTVALUE;
			let rightValueToSave = RIGHTVALUE;

			if (hasBodyMarking && !isCapRes) {
				finalResult = "PASS";
				leftValueToSave = "BM";
				rightValueToSave = "BM";
			}

			if (!hasBodyMarking && !isCapRes) {
				finalResult = "PASS";
				leftValueToSave = "SO";
				rightValueToSave = "SO";
			}

			await trx("dbo.LCR_records").insert({
				timestamp: TIMESTAMP,
				user_id: USERID,
				machine_sn: MACHINESN,
				device_name: DEVICENAME,
				left_id: LEFTID,
				left_unique_id: LEFTUNIQUEID,
				left_value: leftValueToSave,
				left_result: LEFTRESULT,
				right_id: RIGHTID,
				right_unique_id: RIGHTUNIQUEID,
				right_value: rightValueToSave,
				right_result: RIGHTRESULT,
				result: finalResult,
			});

			const [leftUniquePart, rightUniquePart] = await Promise.all([
				getPart(trx, LEFTUNIQUEID, LEFTID),
				getPart(trx, RIGHTUNIQUEID, RIGHTID),
			]);

			const leftLotNumber = leftUniquePart.lot_code;
			const rightLotNumber = rightUniquePart.lot_code;
			const leftQty = leftUniquePart.quantity;
			const rightQty = rightUniquePart.quantity;

			const rightDocCode = await getDocCode(trx, RIGHTID, RIGHTUNIQUEID);

			const tlws = await getTlwsByDoc(trx, rightDocCode.doc);

			const woNo = tlws.TLWS_WONO;
			const proc = tlws.TLWS_PROCD;
			const lineName = tlws.TLWS_LINENO;
			const psnNo = tlws.TLWS_PSNNO;
			const jobNo = tlws.TLWS_JOBNO;
			const spid = tlws.TLWS_SPID;
			const rawAssyNo = tlws.TLWS_MDLCD;
			const bomRev = tlws.TLWS_BOMRV;

			const machineItem = "YOUNGPOOL GAK PAKE FL";
			const machineCode = "YOUNGPOOL GAK PAKE FL";
			const machineZone = "YOUNGPOOL GAK PAKE FL";
			const mainItemCode = "YOUNGPOOL GAK PAKE FL";

			await storeSWPS({
				woNo,
				proc,
				lineName,
				mcMcZItm: machineItem,
				RIGHTID,
				rightLotNumber,
				LEFTID,
				leftLotNumber,
				rightQty,
				leftQty,
				RIGHTUNIQUEID,
				LEFTUNIQUEID,
				psnNo,
				jobNo,
				spid,
				mc: machineCode,
				mcz: machineZone,
				rawAssyNo,
				bomRev,
				mainItmCd: mainItemCode,
				USERID,
				finalResult,
			});

			await APILogger.logSaveSuccess(req.body, finalResult, trx);
		});

		return res.json({
			code: 1,
			message: "DATA SAVED SUCCESSFULLY",
		});
	} catch (err) {
		await APILogger.logSaveError(req.body, err);
		return res.status(500).json({
			code: 0,
			message: err.message,
		});
	}
}

module.exports = router;
