exports.seed = async function (knex) {
	await knex("component_size").del();

	await knex("component_size").insert([
		{
			metric_code: "0",
			imperial_code: "0",
			length_mm: 0,
			width_mm: 0,
		},
		{
			metric_code: "0201",
			imperial_code: "008004",
			length_mm: 0.25,
			width_mm: 0.125,
		},
		{
			metric_code: "0402",
			imperial_code: "01005",
			length_mm: 0.4,
			width_mm: 0.2,
		},
		{
			metric_code: "0603",
			imperial_code: "0201",
			length_mm: 0.6,
			width_mm: 0.3,
		},
		{
			metric_code: "1005",
			imperial_code: "0402",
			length_mm: 1.0,
			width_mm: 0.5,
		},
		{
			metric_code: "1608",
			imperial_code: "0603",
			length_mm: 1.6,
			width_mm: 0.8,
		},
		{
			metric_code: "2012",
			imperial_code: "0805",
			length_mm: 2.0,
			width_mm: 1.25,
		},
		{
			metric_code: "3216",
			imperial_code: "1206",
			length_mm: 3.2,
			width_mm: 1.6,
		},
		{
			metric_code: "3225",
			imperial_code: "1210",
			length_mm: 3.2,
			width_mm: 2.5,
		},
		{
			metric_code: "4532",
			imperial_code: "1812",
			length_mm: 4.5,
			width_mm: 3.2,
		},
		{
			metric_code: "5750",
			imperial_code: "2220",
			length_mm: 5.7,
			width_mm: 5.0,
		},
	]);
};
