interface JiraClientLoginBasicAuth {
    username:string;
    password:string;
}

interface JiraClientLogin {
    host:string;
    basic_auth?:JiraClientLoginBasicAuth;
    cookie_jar?:any;

}

interface JiraApiSearchConfig {
    jql:string;
    maxResult?:number;
    fields?:Array<string>;
}

interface JiraApiSearch {
    search(config:JiraApiSearchConfig, callback:Function):void;
}

interface JiraApiUserConfig {
    username?:string;
    userKey?:string;
}

interface JiraApiUser {
    getUser(config:JiraApiUserConfig, callback:Function):void;
}


declare module "jira-connector" {
    class JiraConnector {
        constructor(loginData:JiraClientLogin);
        public search:JiraApiSearch;
        public user:JiraApiUser;


    }
    export = JiraConnector;
}

