exports.seed = async function (knex) {
	await knex("component_type").del();

	await knex("component_type").insert([
		{ code: "RES", name: "Resistor" },
		{ code: "CAP", name: "Capacitor" },
		{ code: "IND", name: "Inductor" },
		{ code: "IC", name: "IC" },
		{ code: "DIODE", name: "Diode" },
		{ code: "LED", name: "LED" },
	]);
};
