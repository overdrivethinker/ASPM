const express = require("express");
const router = express.Router();
const knex = require("../database/db");

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
			return res.status(400).json({
				code: 0,
				message: "INVALID ACTION. USE 'check' OR 'save'",
				data: "",
			});
		}
	} catch (err) {
		res.status(500).json({
			code: 0,
			message: err.message,
			data: "",
		});
	}
});

async function handleCheck(req, res) {
	const { LEFTID, LEFTUNIQUEID, RIGHTID, RIGHTUNIQUEID } = req.body;

	if (!LEFTID || !RIGHTID) {
		return res.json({
			code: 0,
			message: "\nLEFTID AND RIGHTID ARE REQUIRED",
			data: "",
		});
	}

	if (LEFTID != RIGHTID) {
		return res.json({
			code: 0,
			message: "\nPARTS ARE DIFFERENT",
			data: "",
		});
	}

	if (LEFTUNIQUEID == RIGHTUNIQUEID) {
		return res.json({
			code: 0,
			message: "\nDUPLICATE UNIQUE CODE",
			data: "",
		});
	}

	const leftPart = await knex("dbo.part_list")
		.select("*")
		.where("part_number", LEFTID)
		.first();

	const rightPart = await knex("dbo.part_list")
		.select("*")
		.where("part_number", RIGHTID)
		.first();

	if (!leftPart || !rightPart) {
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

	const leftLibrary = await knex("dbo.part_library")
		.select("*")
		.where("part_name", leftPart.part_name)
		.first();

	const rightLibrary = await knex("dbo.part_library")
		.select("*")
		.where("part_name", rightPart.part_name)
		.first();

	if (!leftLibrary || !rightLibrary) {
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

	if (leftLibrary.reel_width !== "8" && rightLibrary.reel_width !== "8") {
		return res.json({
			code: 2,
			message: "BOTH TRAYS IC / REEL WIDTH ARE ABOVE 8MM",
			data: "",
		});
	} else if (leftLibrary.reel_width !== "8") {
		const width = [];
		width.push(`L:${leftLibrary.reel_width}MM`);
		width.push(`R:${rightLibrary.reel_width}MM`);
		return res.json({
			code: 0,
			message: `\nREEL WIDTH MISMATCH\n${width.join(" | ")}`,
			data: "",
		});
	} else if (rightLibrary.reel_width !== "8") {
		return res.json({
			code: 0,
			message: `\nREEL WIDTH MISMATCH\nR:${rightLibrary.reel_width}MM`,
			data: "",
		});
	}

	const validTypes = ["CAP", "RES"];
	if (
		!validTypes.includes(leftLibrary.component_type) ||
		!validTypes.includes(rightLibrary.component_type)
	) {
		return res.json({
			code: 1,
			message: "COMPONENT TYPE NOT CAP/RES",
			data: {
				DESCRIPTION: "",
			},
		});
	}

	if (!leftPart.value || !rightPart.value) {
		if (!leftPart.value && !rightPart.value) {
			return res.json({
				code: 0,
				message: `\nVALUE NOT FOUND FOR CAP/RES PART\nL:${LEFTID} | R:${RIGHTID}`,
				data: "",
			});
		} else if (!leftPart.value) {
			return res.json({
				code: 0,
				message: `\nVALUE NOT FOUND FOR CAP/RES PART\nL:${LEFTID}`,
				data: "",
			});
		} else {
			return res.json({
				code: 0,
				message: `\nVALUE NOT FOUND FOR CAP/RES PART\nR:${RIGHTID}`,
				data: "",
			});
		}
	}

	const leftDescription = `${leftLibrary.component_type}_${leftPart.value}_${leftPart.tolerance}_${leftLibrary.component_size}`;

	return res.json({
		code: 1,
		message: "PARTS ARE IDENTICAL",
		data: {
			DESCRIPTION: leftDescription,
		},
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
		return res.json({
			code: 0,
			message: "REQUIRED FIELDS ARE MISSING",
			data: "",
		});
	}

	try {
		await knex.transaction(async (trx) => {
			await trx("dbo.LCR_records").insert({
				timestamp: TIMESTAMP,
				user_id: USERID,
				machine_sn: MACHINESN,
				device_name: DEVICENAME,
				left_id: LEFTID,
				left_unique_id: LEFTUNIQUEID,
				left_value: LEFTVALUE,
				left_result: LEFTRESULT,
				right_id: RIGHTID,
				right_unique_id: RIGHTUNIQUEID,
				right_value: RIGHTVALUE,
				right_result: RIGHTRESULT,
				result:
					LEFTRESULT === "OK" && RIGHTRESULT === "OK"
						? "PASS"
						: "FAIL",
			});
		});

		return res.json({
			code: 1,
			message: "DATA SAVED SUCCESSFULLY",
		});
	} catch (err) {
		return res.json({
			code: 0,
			message: err.message,
		});
	}
}

module.exports = router;
