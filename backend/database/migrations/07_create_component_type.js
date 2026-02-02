exports.up = function (knex) {
	return knex.schema.createTable("component_type", (table) => {
		table.increments("id").primary();

		table.string("code", 10).notNullable().unique();
		table.string("name", 50).notNullable();
	});
};

exports.down = function (knex) {
	return knex.schema.dropTableIfExists("component_type");
};
