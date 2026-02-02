exports.seed = async function (knex) {
	await knex("reel_width").del();

	await knex("reel_width").insert([
		{ width_code: "0" },
		{ width_code: "8" },
		{ width_code: "12" },
		{ width_code: "16" },
		{ width_code: "24" },
		{ width_code: "32" },
		{ width_code: "44" },
		{ width_code: "56" },
	]);
};
