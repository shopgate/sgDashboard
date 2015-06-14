declare module "googleapis" {


	module auth {

		interface OAuth2Credentials {
			access_token:string;
			refresh_token:string;
		}

		interface GenerateURLParams {
			access_type:string;
			scopes:string[];
		}

		export class OAuth2 {
			constructor(clientId:string, clientSecret:string, redirectUrl:string);
			setCredentials(credentials:OAuth2Credentials):void;
			generateAuthUrl(params:GenerateURLParams):string;
			getToken(code:string, cb:(err:Error, tokens:OAuth2Credentials)=> void);
			refreshAccessToken(cb:(err:Error, tokens:OAuth2Credentials)=> void);

		}
	}

}