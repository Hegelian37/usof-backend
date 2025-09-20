const db = require('../config/db');

class Model {
    constructor(attributes = {}) {
        this.attributes = attributes;
    }

    // Find method to fetch an object by id
    static async find(id) {
        const [rows] = await db.query(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
        if (rows.length === 0) return null;
        return new this(rows[0]);
    }

    // Helper method to find object by a field (like name) - avoid duplicates when saving
    static async findByField(field, value) {
        const [rows] = await db.query(`SELECT * FROM ${this.tableName} WHERE ${field} = ?`, [value]);
        if (rows.length === 0) return null;
        return new this(rows[0]);
    }

    async delete() {
        if (!this.attributes.id) throw new Error("Cannot delete an object without an ID");
        await db.query(`DELETE FROM ${this.constructor.tableName} WHERE id = ?`, [this.attributes.id]);
    }

    async save() {
        const columns = Object.keys(this.attributes);
        const values = Object.values(this.attributes);

        if (this.attributes.id) {
            // UPDATE
            const updateSet = columns.map(col => `${col} = ?`).join(', ');
            await db.query(
                `UPDATE ${this.constructor.tableName} SET ${updateSet} WHERE id = ?`,
                [...values, this.attributes.id]
            );
        } else {
            // INSERT - while checking for duplicates on uniqueFields
            if (this.constructor.uniqueFields) {
                for (const field of this.constructor.uniqueFields) {
                    const existing = await this.constructor.findByField(field, this.attributes[field]);
                    if (existing) {
                        throw new Error(`${this.constructor.name} with the same ${field} already exists`);
                    }
                }
            }

            // Proceed with INSERT
            const columnNames = columns.join(', ');
            const placeholders = columns.map(() => '?').join(', ');

            const [result] = await db.query(
                `INSERT INTO ${this.constructor.tableName} (${columnNames}) VALUES (${placeholders})`,
                values
            );

            this.attributes.id = result.insertId;
        }
    }
}

module.exports = Model;
