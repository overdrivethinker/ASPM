exports.up = function (knex) {
	return knex.schema.createTable("reel_width", (table) => {
		table.increments("id").primary();

		table.string("width_code", 10).notNullable().unique();
	});
};

exports.down = function (knex) {
	return knex.schema.dropTableIfExists("reel_width");
};
