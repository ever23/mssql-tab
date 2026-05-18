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
        const db = new dbTabla(mssql, SQLSERVER_DB)
        
        assert.ok(db instanceof dbTabla)
        mssql.end()
    })
})
