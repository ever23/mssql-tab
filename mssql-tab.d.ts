import { Connect, dbTabla } from 'dbtabla';

export class mssqlTab extends Connect {
    pool: any;
    connection: any;
    constructor(params: any);
    connect(): Promise<any>;
    end(): Promise<any>;
    query(query: string, params?: any[]): Promise<any>;
    beginTransaction(): Promise<any>;
    commit(): Promise<any>;
    rollback(): Promise<any>;
}

export default mssqlTab;
