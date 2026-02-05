const knex = require("../database/db");
const { toWIB } = require("../utils/helpers");

class APILogger {
	static async log(logData, trx = null) {
		try {
			const logEntry = {
				timestamp: toWIB(new Date()),
				action: logData.action,
				user_id: logData.user_id || null,
				device_name: logData.device_name || null,
				left_id: logData.left_id || null,
				left_unique_id: logData.left_unique_id || null,
				right_id: logData.right_id || null,
				right_unique_id: logData.right_unique_id || null,
				status_code: logData.status_code,
				message: logData.message,
				error_detail: logData.error_detail || null,
			};

			if (trx) {
				await trx("dbo.api_activity_logs").insert(logEntry);
			} else {
				await knex("dbo.api_activity_logs").insert(logEntry);
			}
		} catch (err) {
			console.error("Failed to log activity:", err.message);
		}
	}

	static async logInvalidAction(action) {
		await this.log({
			action: action || "UNKNOWN",
			status_code: 0,
			message: "INVALID_ACTION",
			error_detail: "Invalid action provided",
		});
	}

	static async logSystemError(action, error) {
		await this.log({
			action: action || "UNKNOWN",
			status_code: 0,
			message: "SYSTEM_ERROR",
			error_detail: error.message,
		});
	}

	static async logMissingFields(data) {
		await this.log({
			action: data.action || "check",
			left_id: data.left_id,
			right_id: data.right_id,
			status_code: 0,
			message: "MISSING_REQUIRED_FIELDS",
			error_detail: "Required fields are missing",
		});
	}

	static async logPartsDifferent(data, trx = null) {
		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "PARTS_DIFFERENT",
				error_detail: `Left: ${data.LEFTID}, Right: ${data.RIGHTID}`,
			},
			trx,
		);
	}

	static async logDuplicateCode(data, trx = null) {
		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "DUPLICATE_UNIQUE_CODE",
				error_detail: `Duplicate code: ${data.LEFTUNIQUEID}`,
			},
			trx,
		);
	}

	static async logPartNotFound(data, missingParts, trx = null) {
		let errorDetail = "";
		if (missingParts === "both") {
			errorDetail = `Both not found - L:${data.LEFTID}, R:${data.RIGHTID}`;
		} else if (missingParts === "left") {
			errorDetail = `Left not found - L:${data.LEFTID}`;
		} else {
			errorDetail = `Right not found - R:${data.RIGHTID}`;
		}

		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "PART_NOT_FOUND",
				error_detail: errorDetail,
			},
			trx,
		);
	}

	static async logLibraryNotFound(
		data,
		missingLib,
		partNames,

		trx = null,
	) {
		let errorDetail = "";
		if (missingLib === "both") {
			errorDetail = `Both library not found - L:${partNames.left}, R:${partNames.right}`;
		} else if (missingLib === "left") {
			errorDetail = `Left library not found - L:${partNames.left}`;
		} else {
			errorDetail = `Right library not found - R:${partNames.right}`;
		}

		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "LIBRARY_NOT_FOUND",
				error_detail: errorDetail,
			},
			trx,
		);
	}

	static async logLibraryIncomplete(
		data,
		incompleteParts,
		partNames,

		trx = null,
	) {
		let errorDetail = "";
		if (incompleteParts === "both") {
			errorDetail = `Both incomplete - L:${partNames.left}, R:${partNames.right}`;
		} else if (incompleteParts === "left") {
			errorDetail = `Left incomplete - L:${partNames.left}`;
		} else {
			errorDetail = `Right incomplete - R:${partNames.right}`;
		}

		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "LIBRARY_INCOMPLETE",
				error_detail: errorDetail,
			},
			trx,
		);
	}

	static async logReelWidthIssue(
		data,
		issue,
		widths,

		trx = null,
	) {
		let statusCode = issue === "both_above_8" ? 2 : 0;
		let errorDetail = "";

		if (issue === "both_above_8") {
			errorDetail = `L:${widths.left}MM, R:${widths.right}MM`;
		} else if (issue === "left_mismatch") {
			errorDetail = `L:${widths.left}MM, R:${widths.right}MM`;
		} else {
			errorDetail = `R:${widths.right}MM`;
		}

		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: statusCode,
				message:
					issue === "both_above_8"
						? "BOTH_REEL_WIDTH_ABOVE_8MM"
						: "REEL_WIDTH_MISMATCH",
				error_detail: errorDetail,
			},
			trx,
		);
	}

	static async logValueToleranceNotFound(
		data,
		missingData,

		trx = null,
	) {
		let errorDetail = "";
		if (missingData === "both") {
			errorDetail = `Both missing value/tolerance - L:${data.LEFTID}, R:${data.RIGHTID}`;
		} else if (missingData === "left") {
			errorDetail = `Left missing value/tolerance - L:${data.LEFTID}`;
		} else {
			errorDetail = `Right missing value/tolerance - R:${data.RIGHTID}`;
		}

		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "VALUE_TOLERANCE_NOT_FOUND",
				error_detail: errorDetail,
			},
			trx,
		);
	}

	static async logCheckSuccess(
		data,
		successType,
		detail,

		trx = null,
	) {
		let message = "";
		if (successType === "body_marking") {
			message = "SUCCESS_WITH_BODY_MARKING";
		} else if (successType === "not_cap_res") {
			message = "SUCCESS_NOT_CAP_RES";
		} else {
			message = "PARTS_IDENTICAL_SUCCESS";
		}

		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 1,
				message: message,
				error_detail: detail,
			},
			trx,
		);
	}

	static async logCheckError(data, error, trx = null) {
		await this.log(
			{
				action: "check",
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "CHECK_PROCESS_ERROR",
				error_detail: error.message,
			},
			trx,
		);
	}

	static async logSaveMissingFields(data) {
		await this.log({
			action: "save",
			user_id: data.USERID,
			device_name: data.DEVICENAME,
			left_id: data.LEFTID,
			left_unique_id: data.LEFTUNIQUEID,
			right_id: data.RIGHTID,
			right_unique_id: data.RIGHTUNIQUEID,
			status_code: 0,
			message: "SAVE_MISSING_FIELDS",
			error_detail: "Required fields for save are missing",
		});
	}

	static async logSaveSuccess(data, finalResult, trx = null) {
		await this.log(
			{
				action: "save",
				user_id: data.USERID,
				device_name: data.DEVICENAME,
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 1,
				message: "SAVE_SUCCESS",
				error_detail: `Result: ${finalResult}, L:${data.LEFTRESULT}, R:${data.RIGHTRESULT}`,
			},
			trx,
		);
	}

	static async logSaveError(data, error, trx = null) {
		await this.log(
			{
				action: "save",
				user_id: data.USERID,
				device_name: data.DEVICENAME,
				left_id: data.LEFTID,
				left_unique_id: data.LEFTUNIQUEID,
				right_id: data.RIGHTID,
				right_unique_id: data.RIGHTUNIQUEID,
				status_code: 0,
				message: "SAVE_ERROR",
				error_detail: error.message,
			},
			trx,
		);
	}
}

module.exports = APILogger;
