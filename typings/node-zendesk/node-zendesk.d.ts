declare module "node-zendesk" {

    interface ZendeskSearch {
        query(searchTerm:string, cb:(err:Error, statusCode:Number, body:any, responseList:any, resultList:any)=> void):void;
        queryAll(searchTerm:string, cb:(err:Error, data:any)=> void):void;
        queryAnonymous (searchTerm:string, cb:(err:Error, data:any)=> void):void;
        queryAnonymousAll (searchTerm:string, cb:(err:Error, data:any)=> void):void;
    }

    interface ZendeskTickets {
        list(callback:Function);
    }

    interface ZendeskRequests {
        list(callback:Function);
        listOpen(callback:Function);
        listSolved(callback:Function);
    }

    export interface ZendeskClient {
        tickets:ZendeskTickets;
        search:ZendeskSearch;
        requests:ZendeskRequests;
    }

    interface ZendeskConfig {
        username:string;
        token:string;
        remoteUri: string;
    }

    export function createClient(config:ZendeskConfig):ZendeskClient;
}

