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

			const leftUniquePart = await trx("dbo.wms_v_raw_material_labels")
				.where({
					code: LEFTUNIQUEID,
					item_code: LEFTID,
				})
				.whereNull("deleted_at")
				.first();

			const rightUniquePart = await trx("dbo.wms_v_raw_material_labels")
				.where({
					code: RIGHTUNIQUEID,
					item_code: RIGHTID,
				})
				.whereNull("deleted_at")
				.first();

			if (!leftUniquePart || !rightUniquePart) {
				const missingType =
					!leftUniquePart && !rightUniquePart
						? "both"
						: !leftUniquePart
							? "left"
							: "right";

				await APILogger.logPartDeleted(req.body, missingType, trx);

				if (!leftUniquePart && !rightUniquePart) {
					return {
						code: 0,
						message: `\nPART WAS DELETED\nL:${LEFTUNIQUEID} | R:${RIGHTUNIQUEID}`,
						data: "",
					};
				}
				if (!leftUniquePart) {
					return {
						code: 0,
						message: `\nLEFT PART WAS DELETED: ${LEFTUNIQUEID}`,
						data: "",
					};
				}
				if (!rightUniquePart) {
					return {
						code: 0,
						message: `\nRIGHT PART WAS DELETED: ${RIGHTUNIQUEID}`,
						data: "",
					};
				}
			}

			const leftDocCode = await trx("dbo.wms_v_splscn")
				.where({
					SPLSCN_ITMCD: LEFTID,
					SPLSCN_UNQCODE: LEFTUNIQUEID,
				})
				.orderBy("SPLSCN_LUPDT", "asc")
				.first();

			const rightDocCode = await trx("dbo.wms_v_splscn")
				.where({
					SPLSCN_ITMCD: RIGHTID,
					SPLSCN_UNQCODE: RIGHTUNIQUEID,
				})
				.orderBy("SPLSCN_LUPDT", "asc")
				.first();

			if (!leftDocCode && !rightDocCode) {
				await APILogger.logPSNMissing(req.body, trx);
				return {
					code: 0,
					message: `\nPSN BOTH MISSING\nL:${LEFTID} | R:${RIGHTID}`,
					data: "",
				};
			}

			if (!leftDocCode) {
				await APILogger.logPSNMissing(req.body, trx);
				return {
					code: 0,
					message: `\nLEFT PSN MISSING: ${LEFTID}`,
					data: "",
				};
			}

			if (!rightDocCode) {
				await APILogger.logPSNMissing(req.body, trx);
				return {
					code: 0,
					message: `\nRIGHT PSN MISSING: ${RIGHTID}`,
					data: "",
				};
			}

			if (leftDocCode.SPLSCN_DOC !== rightDocCode.SPLSCN_DOC) {
				await APILogger.logPSNDifferent(
					req.body,
					leftDocCode.SPLSCN_DOC,
					rightDocCode.SPLSCN_DOC,
					trx,
				);

				return {
					code: 0,
					message: `\nPSN ARE DIFFERENT\nL DOC:${leftDocCode.SPLSCN_DOC} |\nR DOC:${rightDocCode.SPLSCN_DOC}`,
					data: "",
				};
			}

			let componentType = "NORMAL PARTS";
			let isCommon = false;
			let isSA = false;

			if (LEFTID != RIGHTID) {
				// await APILogger.logPartsDifferent(req.body, trx);

				// return {
				// 	code: 0,
				// 	message: "\nPARTS ARE DIFFERENT",
				// 	data: "",
				// };
				const getAssyNo = await trx("dbo.WMS_TLWS")
					.where("TLWS_PSNNO", rightDocCode.SPLSCN_DOC)
					.orderBy("TLWS_LUPDT", "asc")
					.first();

				const rawAssyNo = getAssyNo.TLWS_MDLCD;
				const assyNo = rawAssyNo.slice(0, 7) + "-" + rawAssyNo.slice(7);

				if (!rawAssyNo) {
					await APILogger.logAssyNoNotFound(
						req.body,
						rawAssyNo,
						rightDocCode.SPLSCN_DOC,
						trx,
					);

					return {
						code: 0,
						message: `\nASSY NO:${rawAssyNo} NOT FOUND\nON PSN:${rightDocCode.SPLSCN_DOC}`,
						data: "",
					};
				}

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
					return {
						code: 0,
						message: `\nPART NUMBERS NOT FOUND\nL:${LEFTID} | R:${RIGHTID}`,
						data: "",
					};
				} else if (!leftPart) {
					return {
						code: 0,
						message: `\nPART NUMBER NOT FOUND\nL:${LEFTID}`,
						data: "",
					};
				} else {
					return {
						code: 0,
						message: `\nPART NUMBER NOT FOUND\nR:${RIGHTID}`,
						data: "",
					};
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
					return {
						code: 0,
						message: `\nPARTS LIBRARY NOT FOUND\nL:${leftPart.part_name} | R:${rightPart.part_name}`,
						data: "",
					};
				} else if (!leftLibrary) {
					return {
						code: 0,
						message: `\nPARTS LIBRARY NOT FOUND\nL:${leftPart.part_name}`,
						data: "",
					};
				} else {
					return {
						code: 0,
						message: `\nPARTS LIBRARY NOT FOUND\nR:${rightPart.part_name}`,
						data: "",
					};
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
					return {
						code: 0,
						message: `\nPARTS LIBRARY INCOMPLETE\nL:${leftPart.part_name} | R:${rightPart.part_name}`,
						data: "",
					};
				} else if (!leftComplete) {
					return {
						code: 0,
						message: `\nPARTS LIBRARY INCOMPLETE\nL:${leftPart.part_name}`,
						data: "",
					};
				} else {
					return {
						code: 0,
						message: `\nPARTS LIBRARY INCOMPLETE\nR:${rightPart.part_name}`,
						data: "",
					};
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

				if (leftInvalid && rightInvalid) {
					return {
						code: 0,
						message: `\nVALUE/TOLERANCE NOT FOUND FOR CAP/RES PART\nL:${LEFTID} | R:${RIGHTID}`,
						data: "",
					};
				} else if (leftInvalid) {
					return {
						code: 0,
						message: `\nVALUE/TOLERANCE NOT FOUND FOR CAP/RES PART\nL:${LEFTID}`,
						data: "",
					};
				} else {
					return {
						code: 0,
						message: `\nVALUE/TOLERANCE NOT FOUND FOR CAP/RES PART\nR:${RIGHTID}`,
						data: "",
					};
				}
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
		return res.status(500).json({
			code: 0,
			message: err.message,
		});
	}
}

module.exports = router;
