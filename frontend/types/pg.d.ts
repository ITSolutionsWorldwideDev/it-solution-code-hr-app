declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    host?: string;
    ssl?: boolean | any;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface QueryResult<R = any> {
    rows: R[];
    rowCount: number | null;
    command: string;
    oid: number;
    fields: any[];
  }

  export class Pool {
    constructor(config?: PoolConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query<R = any>(
      queryTextOrConfig: string | any,
      values?: any[]
    ): Promise<QueryResult<R>>;
    connect(): Promise<any>;
    end(): Promise<void>;
  }
}
