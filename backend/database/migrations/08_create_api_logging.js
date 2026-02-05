exports.up = function (knex) {
	return knex.schema.createTable("api_activity_logs", function (table) {
		table.bigIncrements("log_id").primary();

		table.datetime("timestamp").notNullable().defaultTo(knex.fn.now());
		table.string("user_id", 50).nullable();
		table.string("device_name", 100).nullable();

		table.string("action", 50).notNullable();

		table.string("left_id", 100).nullable();
		table.string("left_unique_id", 100).nullable();
		table.string("right_id", 100).nullable();
		table.string("right_unique_id", 100).nullable();

		table.integer("status_code").notNullable();
		table.string("message", 200).notNullable();
		table.string("error_detail", 500).nullable();

		table.index("timestamp", "idx_timestamp");
		table.index(["action", "status_code"], "idx_action_status");
		table.index("user_id", "idx_user_id");
		table.index(["left_id", "right_id"], "idx_left_right_id");
	});
};

exports.down = function (knex) {
	return knex.schema.dropTableIfExists("api_activity_logs");
};
