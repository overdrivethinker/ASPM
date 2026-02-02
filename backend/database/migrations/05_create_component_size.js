exports.up = function (knex) {
	return knex.schema.createTable("component_size", (table) => {
		table.increments("id").primary();

		table.string("metric_code", 10).notNullable().unique();
		table.string("imperial_code", 10).nullable();

		table.decimal("length_mm", 5, 2).notNullable();
		table.decimal("width_mm", 5, 2).notNullable();
	});
};

exports.down = function (knex) {
	return knex.schema.dropTableIfExists("component_size");
};
