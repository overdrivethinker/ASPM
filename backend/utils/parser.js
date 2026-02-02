const xlsx = require("xlsx");

function parseTolerance(str) {
	if (!str) return null;

	const s = str.replace(/\s+/g, "");

	// +-5%  | +-0.25OHM | +-1%
	let match = s.match(/^\+\-(\d+(\.\d+)?)([a-zA-Z%]+)$/);
	if (match) {
		return `+-${match[1]}${match[3].toUpperCase()}`;
	}

	// ±5% | ±1%
	match = s.match(/^±(\d+(\.\d+)?)([a-zA-Z%]+)$/);
	if (match) {
		return `+-${match[1]}${match[3].toUpperCase()}`;
	}

	// +0.75-0.25PF | +10-5%
	match = s.match(/^\+(\d+(\.\d+)?)([a-zA-Z%]+)?-(\d+(\.\d+)?)([a-zA-Z%]+)$/);
	if (match) {
		const unit = match[6].toUpperCase();
		return `+${match[1]}${unit}-${match[4]}${unit}`;
	}

	// -80+10% | -5+10%
	match = s.match(/^-(\d+(\.\d+)?)\+(\d+(\.\d+)?)([a-zA-Z%]+)$/);
	if (match) {
		const unit = match[5].toUpperCase();
		return `-${match[1]}${unit}+${match[3]}${unit}`;
	}

	// -0.25+0.75PF
	match = s.match(/^-(\d+(\.\d+)?)([a-zA-Z%]+)?\+(\d+(\.\d+)?)([a-zA-Z%]+)$/);
	if (match) {
		const unit = match[6].toUpperCase();
		return `-${match[1]}${unit}+${match[4]}${unit}`;
	}

	// 0.5% | 5% | 10%
	match = s.match(/^(\d+(\.\d+)?)([a-zA-Z%]+)$/);
	if (match) {
		return `+-${match[1]}${match[3].toUpperCase()}`;
	}

	return null;
}

function normalizeValue(value) {
	if (!value) return null;

	const cleaned = value.replace(/\s+/g, "");

	const match = cleaned.match(
		/^(\d+(\.\d+)?)(PF|NF|UF|MF|F|OHM|KOHM|MOHM|H|MH|UH)/i,
	);

	if (match) {
		const number = match[1];
		const unit = match[3].toUpperCase();
		return `${number}${unit}`;
	}

	return null;
}

function parseSpecification(spec) {
	if (!spec) return {};

	const parts = spec.split(/[,;]/).map((p) => p.trim());

	let value = null;

	// Cari value dengan component unit
	for (const part of parts) {
		const hasComponentUnit =
			/(\d+(\.\d+)?)\s*(PF|NF|UF|MF|F|OHM|KOHM|MOHM|H|MH|UH)/i.test(part);

		if (hasComponentUnit) {
			const extracted = normalizeValue(part);
			if (extracted) {
				value = extracted;
				break;
			}
		}
	}

	// Cari tolerance part
	let tolPart = parts.find(
		(p) => /[%]|OHM|PF|NF|UF/i.test(p) && /[+-]/.test(p),
	);

	if (!tolPart) {
		tolPart = parts.find((p) => /^\s*(\d+(\.\d+)?)\s*%\s*$/.test(p));
	}

	const tolerance = parseTolerance(tolPart);

	return {
		value,
		tolerance,
	};
}

function processSheet(sheet, COL_ITMCD, COL_PRDNO, COL_SPECS, START_ROW) {
	const rows = xlsx.utils.sheet_to_json(sheet, {
		header: 1,
		range: START_ROW,
		defval: null,
	});

	return rows
		.filter((r) => r[COL_ITMCD]) // Filter rows yang punya ITMCD
		.map((r) => {
			const spec = r[COL_SPECS]?.toString().trim();
			const parsedSpec = parseSpecification(spec);
			return {
				part_code: r[COL_ITMCD]?.toString().trim().replace(/-/g, ""), // Remove dash dari part code
				part_name: r[COL_PRDNO]?.toString().trim(),
				supplier: null, // Tidak ada supplier di format ini
				specification: spec,
				value: parsedSpec.value,
				tolerance: parsedSpec.tolerance,
			};
		});
}

function removeDuplicates(data) {
	const uniqueData = [];
	const seenPartCodes = new Set();

	data.forEach((item) => {
		if (!seenPartCodes.has(item.part_code)) {
			seenPartCodes.add(item.part_code);
			uniqueData.push(item);
		}
	});

	return uniqueData;
}

module.exports = {
	parseTolerance,
	normalizeValue,
	parseSpecification,
	processSheet,
	removeDuplicates,
};
