const express = require("express");
const router = express.Router();
const knex = require("../database/db");
const APILogger = require("../utils/api-logger");

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

	await knex.transaction(async (trx) => {
		try {
			if (!LEFTID || !RIGHTID) {
				await APILogger.logMissingFields({
					action: "check",
					left_id: LEFTID,
					right_id: RIGHTID,
					timestamp: TIMESTAMP,
					user_id: USERID,
					machine_sn: MACHINESN,
					device_name: DEVICENAME,
				});

				return res.json({
					code: 0,
					message: "\nLEFTID AND RIGHTID ARE REQUIRED",
					data: "",
				});
			}

			if (LEFTID != RIGHTID) {
				await APILogger.logPartsDifferent(req.body, trx);

				return res.json({
					code: 0,
					message: "\nPARTS ARE DIFFERENT",
					data: "",
				});
			}

			if (LEFTUNIQUEID == RIGHTUNIQUEID) {
				await APILogger.logDuplicateCode(req.body, trx);

				return res.json({
					code: 0,
					message: "\nDUPLICATE UNIQUE CODE",
					data: "",
				});
			}

			const leftPart = await trx("dbo.part_list")
				.select("*")
				.where("part_number", LEFTID)
				.first();

			const rightPart = await trx("dbo.part_list")
				.select("*")
				.where("part_number", RIGHTID)
				.first();

			if (!leftPart || !rightPart) {
				const missingType =
					!leftPart && !rightPart
						? "both"
						: !leftPart
							? "left"
							: "right";

				await APILogger.logPartNotFound(req.body, missingType, trx);

				if (!leftPart && !rightPart) {
					return res.json({
						code: 0,
						message: `\nPART NUMBERS NOT FOUND\nL:${LEFTID} | R:${RIGHTID}`,
						data: "",
					});
				} else if (!leftPart) {
					return res.json({
						code: 0,
						message: `\nPART NUMBER NOT FOUND\nL:${LEFTID}`,
						data: "",
					});
				} else {
					return res.json({
						code: 0,
						message: `\nPART NUMBER NOT FOUND\nR:${RIGHTID}`,
						data: "",
					});
				}
			}

			const checkLibraryComplete = (library) => {
				return !!(
					library.component_type &&
					library.component_size &&
					library.reel_width
				);
			};

			const leftLibrary = await trx("dbo.part_library")
				.select("*")
				.where("part_name", leftPart.part_name)
				.first();

			const rightLibrary = await trx("dbo.part_library")
				.select("*")
				.where("part_name", rightPart.part_name)
				.first();

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

				if (!leftLibrary && !rightLibrary) {
					return res.json({
						code: 0,
						message: `\nPARTS LIBRARY NOT FOUND\nL:${leftPart.part_name} | R:${rightPart.part_name}`,
						data: "",
					});
				} else if (!leftLibrary) {
					return res.json({
						code: 0,
						message: `\nPARTS LIBRARY NOT FOUND\nL:${leftPart.part_name}`,
						data: "",
					});
				} else {
					return res.json({
						code: 0,
						message: `\nPARTS LIBRARY NOT FOUND\nR:${rightPart.part_name}`,
						data: "",
					});
				}
			}

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

				if (!leftComplete && !rightComplete) {
					return res.json({
						code: 0,
						message: `\nPARTS LIBRARY INCOMPLETE\nL:${leftPart.part_name} | R:${rightPart.part_name}`,
						data: "",
					});
				} else if (!leftComplete) {
					return res.json({
						code: 0,
						message: `\nPARTS LIBRARY INCOMPLETE\nL:${leftPart.part_name}`,
						data: "",
					});
				} else {
					return res.json({
						code: 0,
						message: `\nPARTS LIBRARY INCOMPLETE\nR:${rightPart.part_name}`,
						data: "",
					});
				}
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
					trx,
				);

				return res.json({
					code: 2,
					message: "BOTH TRAYS IC / REEL WIDTH ARE ABOVE 8MM",
					data: "",
				});
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
				return res.json({
					code: 0,
					message: `\nREEL WIDTH MISMATCH\n${width.join(" | ")}`,
					data: "",
				});
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

				return res.json({
					code: 0,
					message: `\nREEL WIDTH MISMATCH\nR:${rightLibrary.reel_width}MM`,
					data: "",
				});
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
					trx,
				);

				return res.json({
					code: 1,
					message: "COMPONENT TYPE WITH BODY MARKING",
					data: {
						DESCRIPTION: "",
					},
				});
			}

			if (!hasBodyMarking && !isCapRes) {
				await APILogger.logCheckSuccess(
					req.body,
					"not_cap_res",
					`Component types: L:${leftLibrary.component_type}, R:${rightLibrary.component_type}`,
					trx,
				);

				return res.json({
					code: 1,
					message: "COMPONENT TYPE NOT CAP/RES",
					data: {
						DESCRIPTION: "",
					},
				});
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

				if (leftInvalid && rightInvalid) {
					return res.json({
						code: 0,
						message: `\nVALUE / TOLERANCE NOT FOUND FOR CAP/RES PART\nL:${LEFTID} | R:${RIGHTID}`,
						data: "",
					});
				} else if (leftInvalid) {
					return res.json({
						code: 0,
						message: `\nVALUE / TOLERANCE NOT FOUND FOR CAP/RES PART\nL:${LEFTID}`,
						data: "",
					});
				} else {
					return res.json({
						code: 0,
						message: `\nVALUE / TOLERANCE NOT FOUND FOR CAP/RES PART\nR:${RIGHTID}`,
						data: "",
					});
				}
			}

			const leftDescription = `${leftLibrary.component_type}_${leftPart.value}_${leftPart.tolerance}_${leftLibrary.component_size}`;

			await APILogger.logCheckSuccess(
				req.body,
				"identical",
				`Description: ${leftDescription}`,
				trx,
			);

			return res.json({
				code: 1,
				message: "PARTS ARE IDENTICAL",
				data: {
					DESCRIPTION: leftDescription,
				},
			});
		} catch (err) {
			await APILogger.logCheckError(req.body, err, trx);
			throw err;
		}
	});
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
			const leftPart = await trx("dbo.part_list")
				.select("*")
				.where("part_number", LEFTID)
				.first();
			const rightPart = await trx("dbo.part_list")
				.select("*")
				.where("part_number", RIGHTID)
				.first();

			const leftHasBM = leftPart?.specification?.startsWith("BM");
			const rightHasBM = rightPart?.specification?.startsWith("BM");
			const hasBodyMarking = !!leftHasBM || !!rightHasBM;

			let finalResult =
				LEFTRESULT === "OK" && RIGHTRESULT === "OK" ? "PASS" : "FAIL";

			let leftValueToSave = LEFTVALUE;
			let rightValueToSave = RIGHTVALUE;

			if (hasBodyMarking) {
				finalResult = "PASS";
				leftValueToSave = "BM";
				rightValueToSave = "BM";
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

			await APILogger.logSaveSuccess(req.body, finalResult, trx);
		});

		return res.json({
			code: 1,
			message: "DATA SAVED SUCCESSFULLY",
		});
	} catch (err) {
		await APILogger.logSaveError(req.body, err);
		return res.json({
			code: 0,
			message: err.message,
		});
	}
}
module.exports = router;
