exports.seed = async function (knex) {
	await knex("component_type").del();

	await knex("component_type").insert([
		{ code: "RES", name: "Resistor" },
		{ code: "CAP", name: "Capacitor" },
		{ code: "IND", name: "Inductor" },
		{ code: "IC", name: "IC" },
		{ code: "DIO", name: "Diode" },
		{ code: "LED", name: "LED" },
		{ code: "RM", name: "Resistor Matrix/Array" },
		{ code: "CN", name: "Connector" },
		{ code: "SW", name: "Switch" },
		{ code: "TCA", name: "Tantalum Capacitor" },
		{ code: "TR", name: "Transistor" },
		{ code: "B", name: "Beadcore" },
		{ code: "XTAL", name: "Crystal" },
		{ code: "F", name: "Fuse" },
		{ code: "ZD", name: "Zener Diode" },
		{ code: "HW", name: "Handwork Component" },
		{ code: "PCB", name: "Bare Board" },
		{ code: "HAR", name: "Harness" },
		{ code: "CM", name: "Capacitor Matrix/Array" },
	]);
};
