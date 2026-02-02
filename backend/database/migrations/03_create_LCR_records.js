exports.up = function (knex) {
	return knex.schema.createTable("LCR_records", (table) => {
		table.increments("record_id").primary();
		table.datetime("timestamp").defaultTo(knex.fn.now());
		table.string("user_id", 100);
		table.string("machine_sn", 100);
		table.string("device_name", 255);
		table.string("left_id", 255);
		table.string("left_unique_id", 255);
		table.string("left_value", 100);
		table.string("left_result", 50);
		table.string("right_id", 255);
		table.string("right_unique_id", 255);
		table.string("right_value", 100);
		table.string("right_result", 50);
		table.string("result", 50);
	});
};

exports.down = function (knex) {
	return knex.schema.dropTableIfExists("LCR_records");
};
