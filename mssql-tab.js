const {Connect, SQLSERVER_DB, dbResult} = require("dbtabla")
const mssql = require("mssql")

class mssqlTab extends Connect {
    #pool
    #config
    #connected

    /**
    * @param {object} params - configuracion para mssql
    * @param {boolean} connect - indica si conecta al instante
    */
    constructor(params, connect = true) {
        super(params, SQLSERVER_DB)
        this.typeDB = SQLSERVER_DB
        
        this.#config = { ...params }
        // Compatibilidad: mapear host a server si es necesario
        if (this.#config.host && !this.#config.server) {
            this.#config.server = this.#config.host
        }
        // Configuración por defecto recomendada para mssql
        this.#config.options = this.#config.options || {}
        if (this.#config.options.encrypt === undefined) this.#config.options.encrypt = true
        if (this.#config.options.trustServerCertificate === undefined) this.#config.options.trustServerCertificate = true
        
        this.#pool = null
        this.#connected = false
        this.activeTransaction = null
        this._connectCallback = () => {}
        
        this._escapeChar = "" // SQL Server usa brackets [] para los identificadores, dbtabla delega esto pero por defecto no lo encerramos o usamos comillas
        
        // Mantener el escape nativo de SQL Server
        this._escapeString = (str) => {
            if (typeof str === 'string') {
                return str.replace(/'/g, "''")
            }
            return str
        }

        if (connect) {
            this.connect()
        }
    }

    /**
    * conecta con la base de datos
    * @param {function} callback - funcion que se ejecutara al conectar
    */
    connect(callback = () => { }) {
        this._connectCallback = callback
        this.#connect()
            .then(() => callback())
            .catch(err => {
                if (err.number !== 4060) callback(err)
            })
    }

    async _createDatabase(callback) {
        let dbName = this.#config.database
        let tempConfig = { ...this.#config }
        delete tempConfig.database // Se conecta a master por defecto
        
        try {
            let tempPool = await mssql.connect(tempConfig)
            await tempPool.request().query(`CREATE DATABASE [${dbName}]`)
            await tempPool.close()
            if (callback) callback()
        } catch (error) {
            this._connectCallback(error)
        }
    }

    async #connect() {
        if (!this.#connected) {
            try {
                this.#pool = await mssql.connect(this.#config)
                this.#connected = true
            } catch (error) {
                // 4060 es el código de error de SQL Server para "Cannot open database"
                if (error.number === 4060 || (error.message && error.message.includes('Cannot open database'))) {
                    await new Promise(res => this._createDatabase(res))
                    this.#pool = await mssql.connect(this.#config)
                    this.#connected = true
                } else {
                    throw error
                }
            }
        }
        return this.#pool
    }

    /**
     * termina la conexion
     */
    end() {
        if (this.#pool) {
            this.#pool.close()
            this.#connected = false
        }
    }

    /**
     * envia una consulta a la base de datos
     * @param {string} query_str - consulta sql
     * @param {object} config - configuracion de la query
     * @return {Promise}
     */
    query(query_str, config = {}) {
        this.lastSql = query_str
        return new Promise(async (resolver, reject) => {
            try {
                await this.#connect()
                let request = this.activeTransaction ? this.activeTransaction.request() : this.#pool.request()
                let result = await request.query(query_str)
                
                if (result.recordset) {
                    resolver(new dbResult(this, result.recordset))
                } else {
                    resolver({ affectedRows: result.rowsAffected[0] || 0 })
                }
            } catch (error) {
                reject(error)
            }
        })
    }

    async _keysInTable(table, createOfModel = true) {
        let sql = `
            SELECT c.COLUMN_NAME as name,
                   c.DATA_TYPE as type,
                   c.IS_NULLABLE as is_nullable,
                   c.COLUMN_DEFAULT as column_default,
                   c.ORDINAL_POSITION as ordinal_position,
                   CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary,
                   COLUMNPROPERTY(object_id(c.TABLE_SCHEMA+'.'+c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as is_identity
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
              ON c.TABLE_NAME = kcu.TABLE_NAME 
             AND c.COLUMN_NAME = kcu.COLUMN_NAME 
             AND OBJECTPROPERTY(OBJECT_ID(kcu.CONSTRAINT_SCHEMA + '.' + QUOTENAME(kcu.CONSTRAINT_NAME)), 'IsPrimaryKey') = 1
            WHERE c.TABLE_NAME = '${this._escapeString(table)}'
        `

        const processKeys = (resultData) => {
            let colums = new Array(resultData.length)
            for (let row of resultData) {
                let type = row.type
                if (type === 'bit') type = 'boolean'
                
                colums[row.ordinal_position - 1] = {
                    name: row.name,
                    type: type,
                    defaultNull: row.is_nullable === 'YES',
                    primary: row.is_primary === 1,
                    default: row.column_default,
                    autoincrement: row.is_identity === 1
                }
            }
            return {
                tabla: table,
                colums: colums,
                colum: colums
            }
        }

        let queryResult = await this.query(sql)
        let length = Array.isArray(queryResult) ? queryResult.length : queryResult.length

        if (createOfModel) {
            try {
                await this.inModel(table, length === 0)
                if (length === 0) {
                    queryResult = await this.query(sql)
                    length = Array.isArray(queryResult) ? queryResult.length : queryResult.length
                }
            } catch (e) {
                if (e === undefined) {
                    if (length === 0) throw new Error(`la tabla ${table} no existe`)
                } else {
                    throw e
                }
            }
        } else {
            if (length === 0) throw new Error(`la tabla ${table} no existe`)
        }
        
        return processKeys(queryResult)
    }

    async beginTransaction(config = {}) {
        await this.#connect()
        this.activeTransaction = new mssql.Transaction(this.#pool)
        await this.activeTransaction.begin()
    }

    async commit(config = {}) {
        if (this.activeTransaction) {
            await this.activeTransaction.commit()
            this.activeTransaction = null
        }
    }

    async rollback(config = {}) {
        if (this.activeTransaction) {
            await this.activeTransaction.rollback()
            this.activeTransaction = null
        }
    }

    async _acquireDedicatedConnection() {
        await this.#connect();
        return new mssql.Transaction(this.#pool);
    }

    async _releaseDedicatedConnection(transaction) {
        // En mssql el commit o rollback ya finalizan la transacción
    }

    async _beginTransactionOnConnection(transaction) {
        await transaction.begin();
    }

    async _commitTransactionOnConnection(transaction) {
        await transaction.commit();
    }

    async _rollbackTransactionOnConnection(transaction) {
        await transaction.rollback();
    }

    async _queryOnConnection(transaction, query_str, config = {}) {
        this.lastSql = query_str;
        const request = transaction.request();
        const result = await request.query(query_str);
        if (result.recordset) {
            return new dbResult(this, result.recordset);
        }
        return { affectedRows: (result.rowsAffected && result.rowsAffected[0]) || 0 };
    }
}

module.exports = mssqlTab
