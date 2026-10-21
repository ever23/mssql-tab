const { describe, it } = require('node:test');
const assert = require("assert")
const { dbTabla, SQLSERVER_DB } = require('dbtabla')
const connect = require('../mssql-tab.js')

describe("Test de dbTabla integrado con mssql-tab", () => {
    it('instanciacion dbTabla', () => {
        const mssql = new connect({
            server   : 'localhost',
            user     : 'sa',
            password : 'TuPasswordFuerte123'
        })
        const db = mssql.tabla('usuarios')
        
        assert.ok(db instanceof dbTabla)
        mssql.end()
    })
})
