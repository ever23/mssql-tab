import {
    Connect,
    dbTabla,
    SelectOptions,
    WhereClause,
    WhereObject,
    ColumnList,
    JoinsClause,
    JoinsObject,
    dbResult,
    dbRow,
    DbRowRecord
} from 'dbtabla';

export class mssqlTab extends Connect {
    pool: any;
    connection: any;
    constructor(params: any);
    connect(): Promise<any>;
    end(): Promise<any>;
    tabla<T = Record<string, any>, TMethods = Record<string, any>>(
        tabla: string,
        callback?: (t: dbTabla<T> & TMethods, error?: any) => void,
        verify?: boolean
    ): dbTabla<T> & TMethods;
    query(query: string, params?: any[]): Promise<any>;
    beginTransaction(): Promise<any>;
    commit(): Promise<any>;
    rollback(): Promise<any>;
}

export {
    SelectOptions,
    WhereClause,
    WhereObject,
    ColumnList,
    JoinsClause,
    JoinsObject,
    dbResult,
    dbRow,
    DbRowRecord,
    dbTabla,
    Connect
};

export default mssqlTab;
