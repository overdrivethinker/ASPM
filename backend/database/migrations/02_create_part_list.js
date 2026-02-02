exports.up = function (knex) {
	return knex.schema.createTable("part_list", (table) => {
		table.increments("part_id").primary();
		table.string("part_number", 100).notNullable().unique();
		table.string("part_name", 255).notNullable();
		table.text("specification");
		table.text("value");
		table.text("tolerance");
		table.datetime("updated_date").defaultTo(knex.fn.now());
		table.index("part_number");
		table.index("part_name");
	});
};

exports.down = function (knex) {
	return knex.schema.dropTableIfExists("part_list");
};
