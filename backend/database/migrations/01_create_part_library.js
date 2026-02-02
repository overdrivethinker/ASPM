exports.up = function (knex) {
	return knex.schema.createTable("part_library", (table) => {
		table.increments("part_id").primary();
		table.string("part_name", 255).notNullable().unique();
		table.string("component_type", 100);
		table.string("component_size", 100);
		table.string("reel_width", 100);
		table.datetime("updated_date").defaultTo(knex.fn.now());
		table.index("part_name");
	});
};

exports.down = function (knex) {
	return knex.schema.dropTableIfExists("part_library");
};
